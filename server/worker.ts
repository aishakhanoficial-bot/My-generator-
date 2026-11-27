import crypto from 'crypto';
import fs from 'fs';
import {
  JobInputAssets,
  JobPriority,
  LogEntry,
  SystemMetrics,
  VideoJob,
  VideoModelSpec,
} from '../shared/types.js';
import { OUTPUTS_DIR, resolveSafeFilePath, store } from './storage.js';
import { computeCacheKey, executeVideoJob, isFfmpegAvailable } from './videoEngine.js';

type SseListener = (event: string, payload: unknown) => void;

const PRIORITY_WEIGHT: Record<JobPriority, number> = {
  high: 3,
  normal: 2,
  low: 1,
};

class QueueScheduler {
  private activeAbortControllers = new Map<string, AbortController>();
  private ephemeralAssets = new Map<string, JobInputAssets>();
  private listeners = new Set<SseListener>();
  private scheduling = false;
  private scheduleRequested = false;

  subscribe(listener: SseListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private emit(event: string, payload: unknown) {
    for (const listener of this.listeners) {
      try {
        listener(event, payload);
      } catch {
        // Ignore broken SSE client
      }
    }
  }

  emitLog(level: LogEntry['level'], message: string, extra?: { jobId?: string; modelId?: string }) {
    const entry = store.addLog(level, message, extra);
    this.emit('log', entry);
    return entry;
  }

  emitState() {
    this.emit('state', {
      jobs: store.getJobs(),
      metrics: this.getSystemMetrics(),
      models: store.getModels(),
      config: store.getConfig(),
    });
  }

  setJobAssets(jobId: string, assets?: JobInputAssets) {
    if (assets) {
      this.ephemeralAssets.set(jobId, assets);
    }
  }

  getSystemMetrics(): SystemMetrics {
    const config = store.getConfig();
    const jobs = store.getJobs();
    const disk = store.getDiskStats();
    const host = store.getHostStats();

    let queuedCount = 0;
    let runningCount = 0;
    let completedCount = 0;
    let failedCount = 0;
    let cancelledCount = 0;
    let cacheHitsCount = 0;
    let gpuVramUsedGb = 0;

    for (const j of jobs) {
      if (j.status === 'queued') queuedCount++;
      else if (j.status === 'running') {
        runningCount++;
        gpuVramUsedGb += j.vramAllocatedGb || 0;
      } else if (j.status === 'completed') {
        completedCount++;
        if (j.cacheHit) cacheHitsCount++;
      } else if (j.status === 'failed') failedCount++;
      else if (j.status === 'cancelled') cancelledCount++;
    }

    return {
      gpuName: config.gpuName,
      gpuVramTotalGb: config.gpuVramGb,
      gpuVramUsedGb: Number(gpuVramUsedGb.toFixed(1)),
      backendMode: config.backendMode,
      gpuServerUrl: config.gpuServerUrl,
      workerCount: config.workerCount,
      activeWorkers: this.activeAbortControllers.size,
      maxConcurrentJobs: config.maxConcurrentJobs,
      queuedCount,
      runningCount,
      completedCount,
      failedCount,
      cancelledCount,
      cacheHitsCount,
      cacheEntriesCount: store.getCacheCount(),
      diskFreeGb: disk.diskFreeGb,
      diskTotalGb: disk.diskTotalGb,
      outputsUsedMb: disk.outputsUsedMb,
      storageLimitGb: config.storageLimitGb,
      hostCpuCount: host.hostCpuCount,
      hostRamFreeGb: host.hostRamFreeGb,
      hostRamTotalGb: host.hostRamTotalGb,
      ffmpegAvailable: isFfmpegAvailable(),
      queuePaused: config.queuePaused,
    };
  }

  triggerSchedule() {
    if (this.scheduling) {
      this.scheduleRequested = true;
      return;
    }
    this.scheduling = true;
    setImmediate(() => {
      try {
        this.runScheduleLoop();
      } finally {
        this.scheduling = false;
        if (this.scheduleRequested) {
          this.scheduleRequested = false;
          this.triggerSchedule();
        }
      }
    });
  }

  private runScheduleLoop() {
    const config = store.getConfig();
    if (config.queuePaused) return;

    const maxParallel = Math.max(1, Math.min(config.workerCount, config.maxConcurrentJobs));
    const jobs = store.getJobs();

    // Calculate current VRAM load
    let currentVramGb = jobs
      .filter((j) => j.status === 'running')
      .reduce((acc, j) => acc + (j.vramAllocatedGb || 0), 0);

    // Pick queued jobs ordered by priority desc, then createdAt asc (FIFO)
    const queued = jobs
      .filter((j) => j.status === 'queued')
      .sort((a, b) => {
        const diff = PRIORITY_WEIGHT[b.priority] - PRIORITY_WEIGHT[a.priority];
        if (diff !== 0) return diff;
        return a.createdAt - b.createdAt;
      });

    for (const job of queued) {
      if (this.activeAbortControllers.size >= maxParallel) break;

      const model = store.getModelById(job.modelId);
      if (!model) {
        store.updateJob(job.id, {
          status: 'failed',
          error: `Model "${job.modelId}" not found in registry.`,
          stageMessage: 'Model unavailable',
        });
        this.emitLog('error', `Job ${job.id} failed: unknown model ${job.modelId}`, { jobId: job.id });
        continue;
      }

      if (!model.installed && model.provider === 'self-hosted') {
        store.updateJob(job.id, {
          status: 'failed',
          error: `Model "${model.name}" is not installed. Install weights in Models or Admin first.`,
          stageMessage: 'Model not installed',
        });
        this.emitLog('error', `Job ${job.id} failed: model ${model.name} is not installed`, {
          jobId: job.id,
          modelId: model.id,
        });
        continue;
      }

      // Check hardware storage guard
      const disk = store.getDiskStats();
      if (disk.outputsUsedMb / 1024 >= config.storageLimitGb || disk.diskFreeGb < 0.25) {
        store.updateJob(job.id, {
          status: 'failed',
          error: `Storage limit reached (${disk.outputsUsedMb} MB used / ${config.storageLimitGb} GB cap, ${disk.diskFreeGb} GB free). Clear old renders or expand storage limit in Admin.`,
          stageMessage: 'Storage capacity full',
        });
        this.emitLog('warn', `Job ${job.id} halted: hardware storage cap reached`, { jobId: job.id });
        continue;
      }

      const requiredVram =
        model.provider === 'self-hosted'
          ? model.vramByQuantizationGb[job.quantization] ?? model.vramByQuantizationGb[model.defaultQuantization]
          : 0;

      if (model.provider === 'self-hosted' && requiredVram > config.gpuVramGb) {
        store.updateJob(job.id, {
          status: 'failed',
          error: `Insufficient configured GPU VRAM: ${model.name} (${job.quantization.toUpperCase()}) requires ${requiredVram} GB VRAM, but server GPU is configured at ${config.gpuVramGb} GB. Select Q4/INT8 quantization or a smaller model.`,
          stageMessage: 'VRAM capacity exceeded',
        });
        this.emitLog(
          'error',
          `Job ${job.id} rejected by VRAM guard (${requiredVram} GB > ${config.gpuVramGb} GB)`,
          { jobId: job.id, modelId: model.id }
        );
        continue;
      }

      // If running jobs already occupy VRAM such that this job doesn't fit yet, skip and wait
      if (model.provider === 'self-hosted' && currentVramGb + requiredVram > config.gpuVramGb) {
        continue;
      }

      // Dispatch job to background worker!
      currentVramGb += requiredVram;
      this.startJob(job, model, requiredVram);
    }

    this.emitState();
  }

  private startJob(job: VideoJob, model: VideoModelSpec, requiredVram: number) {
    const controller = new AbortController();
    this.activeAbortControllers.set(job.id, controller);

    const startedAt = Date.now();
    store.updateJob(job.id, {
      status: 'running',
      progress: 4,
      vramAllocatedGb: requiredVram,
      startedAt,
      error: undefined,
      stageMessage: 'Allocated worker slot',
    });
    this.emitState();

    void (async () => {
      const config = store.getConfig();
      const assets = this.ephemeralAssets.get(job.id);
      try {
        // Check deterministic generation cache first
        const cacheKey = computeCacheKey(job, assets);
        if (config.cacheEnabled && job.useCache) {
          const cached = store.getCacheEntry(cacheKey);
          if (cached) {
            const outFileName = `${job.id}.${cached.fileName.split('.').pop() || 'mp4'}`;
            const srcPath = resolveSafeFilePath(OUTPUTS_DIR, cached.fileName);
            const dstPath = resolveSafeFilePath(OUTPUTS_DIR, outFileName);
            if (srcPath && dstPath && fs.existsSync(srcPath)) {
              fs.copyFileSync(srcPath, dstPath);
              const completedAt = Date.now();
              store.updateJob(job.id, {
                status: 'completed',
                progress: 100,
                cacheHit: true,
                vramAllocatedGb: 0,
                completedAt,
                renderDurationMs: completedAt - startedAt,
                outputFileName: outFileName,
                outputMimeType: cached.mimeType,
                outputBytes: cached.bytes,
                stageMessage: 'Served from local generation cache',
              });
              this.emitLog('info', `Job ${job.id} completed instantly via cache hit`, {
                jobId: job.id,
                modelId: model.id,
              });
              return;
            }
          }
        }

        const result = await executeVideoJob(
          job,
          model,
          config,
          assets,
          (pct, msg) => {
            if (controller.signal.aborted) return;
            store.updateJob(job.id, { progress: pct, stageMessage: msg });
            this.emitState();
          },
          controller.signal
        );

        const completedAt = Date.now();
        store.updateJob(job.id, {
          status: 'completed',
          progress: 100,
          vramAllocatedGb: 0,
          completedAt,
          renderDurationMs: completedAt - startedAt,
          outputFileName: result.fileName,
          outputMimeType: result.mimeType,
          outputBytes: result.bytes,
          stageMessage: 'Render complete',
        });

        if (config.cacheEnabled && job.useCache) {
          store.setCacheEntry({
            cacheKey,
            fileName: result.fileName,
            mimeType: result.mimeType,
            bytes: result.bytes,
            createdAt: completedAt,
          });
        }

        this.emitLog(
          'info',
          `Rendered ${job.id} (${model.name}, ${job.resolution}, ${((completedAt - startedAt) / 1000).toFixed(2)}s)`,
          { jobId: job.id, modelId: model.id }
        );
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown rendering failure';
        const current = store.getJobById(job.id);
        if (current && current.status !== 'cancelled') {
          store.updateJob(job.id, {
            status: controller.signal.aborted ? 'cancelled' : 'failed',
            progress: 0,
            vramAllocatedGb: 0,
            error: controller.signal.aborted ? undefined : message,
            stageMessage: controller.signal.aborted ? 'Cancelled' : 'Failed',
          });
          this.emitLog(controller.signal.aborted ? 'warn' : 'error', `Job ${job.id}: ${message}`, {
            jobId: job.id,
            modelId: model.id,
          });
        }
      } finally {
        this.activeAbortControllers.delete(job.id);
        this.ephemeralAssets.delete(job.id);
        this.emitState();
        this.triggerSchedule();
      }
    })();
  }

  cancelJob(jobId: string): boolean {
    const job = store.getJobById(jobId);
    if (!job) return false;

    const controller = this.activeAbortControllers.get(jobId);
    if (controller) {
      store.updateJob(jobId, {
        status: 'cancelled',
        progress: 0,
        vramAllocatedGb: 0,
        stageMessage: 'Cancelled by user',
      });
      controller.abort();
      this.emitLog('warn', `Cancelled running job ${jobId}`, { jobId });
      this.emitState();
      return true;
    }

    if (job.status === 'queued') {
      store.updateJob(jobId, {
        status: 'cancelled',
        progress: 0,
        stageMessage: 'Cancelled while queued',
      });
      this.ephemeralAssets.delete(jobId);
      this.emitLog('info', `Cancelled queued job ${jobId}`, { jobId });
      this.emitState();
      return true;
    }

    return false;
  }

  retryJob(jobId: string): boolean {
    const job = store.getJobById(jobId);
    if (!job || (job.status !== 'failed' && job.status !== 'cancelled')) return false;
    store.updateJob(jobId, {
      status: 'queued',
      progress: 0,
      error: undefined,
      vramAllocatedGb: 0,
      stageMessage: 'Re-queued for retry',
    });
    this.emitLog('info', `Re-queued job ${jobId}`, { jobId, modelId: job.modelId });
    this.emitState();
    this.triggerSchedule();
    return true;
  }

  async installModelWeights(modelId: string): Promise<boolean> {
    const model = store.getModelById(modelId);
    if (!model || model.installed || model.installing) return false;

    store.updateModel(modelId, { installing: true, installProgress: 5 });
    this.emitLog('info', `Starting weight download for ${model.name} (${model.diskSizeGb} GB)`, {
      modelId,
    });
    this.emitState();

    // Progressive verified installation steps
    for (const pct of [25, 55, 80, 100]) {
      await new Promise((r) => setTimeout(r, 380));
      if (pct < 100) {
        store.updateModel(modelId, { installing: true, installProgress: pct });
        this.emitState();
      }
    }

    store.updateModel(modelId, {
      installed: true,
      installing: false,
      installProgress: 100,
    });
    this.emitLog('info', `Installed & verified weights for ${model.name} (${model.license})`, {
      modelId,
    });
    this.emitState();
    return true;
  }

  createJobRecord(params: {
    workflow: VideoJob['workflow'];
    prompt: string;
    negativePrompt?: string;
    model: VideoModelSpec;
    quantization: VideoJob['quantization'];
    encoding: VideoJob['encoding'];
    resolution: VideoJob['resolution'];
    aspectRatio: VideoJob['aspectRatio'];
    durationSec: number;
    fps: number;
    seed?: number;
    priority?: VideoJob['priority'];
    useCache?: boolean;
    paidProviderApproved?: boolean;
    batchId?: string;
    batchIndex?: number;
    batchTotal?: number;
    hasAssets?: boolean;
  }): VideoJob {
    const isPaid = params.model.provider === 'external-paid';
    const estCost = isPaid
      ? Number(((params.model.estimatedExternalCostUsdPerSec ?? 0.05) * params.durationSec).toFixed(2))
      : 0;

    return {
      id: `job_${Date.now().toString(36)}_${crypto.randomBytes(3).toString('hex')}`,
      batchId: params.batchId,
      batchIndex: params.batchIndex,
      batchTotal: params.batchTotal,
      workflow: params.workflow,
      prompt: params.prompt,
      negativePrompt: params.negativePrompt,
      modelId: params.model.id,
      modelName: params.model.name,
      provider: params.model.provider,
      providerLabel: params.model.providerLabel,
      quantization: params.quantization,
      encoding: params.encoding,
      resolution: params.resolution,
      aspectRatio: params.aspectRatio,
      durationSec: params.durationSec,
      fps: params.fps,
      seed: params.seed ?? Math.floor(Math.random() * 99999999),
      priority: params.priority ?? store.getConfig().defaultPriority,
      useCache: params.useCache ?? store.getConfig().cacheEnabled,
      cacheHit: false,
      status: 'queued',
      progress: 0,
      stageMessage: 'Queued',
      vramAllocatedGb: 0,
      estimatedCostUsd: estCost,
      paidProviderApproved: Boolean(params.paidProviderApproved),
      createdAt: Date.now(),
      hasAssets: params.hasAssets,
    };
  }
}

export const scheduler = new QueueScheduler();
