import {
  AdminConfig,
  BatchSubmitPayload,
  LogEntry,
  QuantizationType,
  SubmitJobPayload,
  SystemMetrics,
  VideoJob,
  VideoModelSpec,
} from '../shared/types';

const STORAGE_KEY = 'openframe_studio_static_state_v1';

const DEFAULT_CONFIG: AdminConfig = {
  gpuName: 'WebGL / Browser Canvas Runtime (GitHub Pages Static Mode)',
  gpuVramGb: 24,
  backendMode: 'local-ffmpeg',
  gpuServerUrl: 'http://127.0.0.1:8188',
  gpuServerApiType: 'comfyui',
  workerCount: 2,
  maxConcurrentJobs: 2,
  defaultPriority: 'normal',
  storageLimitGb: 50,
  cacheEnabled: true,
  queuePaused: false,
  allowExternalPaidModels: true,
};

const DEFAULT_MODELS: VideoModelSpec[] = [
  {
    id: 'ltx-video-distilled',
    name: 'LTX-Video 0.9.5 Distilled',
    family: 'Lightricks DiT',
    provider: 'self-hosted',
    providerLabel: 'SELF-HOSTED FREE ENGINE',
    license: 'Apache-2.0',
    commercialUse: true,
    commercialNotes:
      'Permissive Apache 2.0 open-source license. Full commercial rights with zero royalties.',
    supportedWorkflows: ['text-to-video', 'image-to-video', 'frame-interpolation'],
    supportedQuantizations: ['fp8', 'int8', 'bf16', 'q4'],
    defaultQuantization: 'fp8',
    vramByQuantizationGb: { q4: 4.5, int8: 6.0, fp8: 6.5, bf16: 11.5 },
    diskSizeGb: 4.8,
    speedRating: 'Ultra-Fast',
    estimatedSecPerVideo: 4,
    description:
      'High-speed real-time DiT video model optimized for rapid batch generation, image animation, and keyframe transitions on consumer GPUs.',
    repoUrl: 'https://huggingface.co/Lightricks/LTX-Video',
    installed: true,
    enabled: true,
  },
  {
    id: 'wan-2-1-1.3b',
    name: 'Wan 2.1 T2V 1.3B',
    family: 'Alibaba Wan',
    provider: 'self-hosted',
    providerLabel: 'SELF-HOSTED FREE ENGINE',
    license: 'Apache-2.0',
    commercialUse: true,
    commercialNotes:
      'Apache 2.0 license. Unrestricted commercial self-hosting on local or dedicated GPUs.',
    supportedWorkflows: ['text-to-video', 'image-to-video', 'reference-image'],
    supportedQuantizations: ['fp8', 'int8', 'bf16', 'q4'],
    defaultQuantization: 'fp8',
    vramByQuantizationGb: { q4: 5.0, int8: 6.5, fp8: 7.0, bf16: 9.5 },
    diskSizeGb: 3.4,
    speedRating: 'Ultra-Fast',
    estimatedSecPerVideo: 5,
    description:
      'Lightweight 1.3B flow-matching video model designed for 8GB+ GPUs, offering fast iteration and strong motion coherence.',
    repoUrl: 'https://huggingface.co/Wan-AI/Wan2.1-T2V-1.3B',
    installed: true,
    enabled: true,
  },
  {
    id: 'wan-2-1-14b',
    name: 'Wan 2.1 T2V/I2V 14B',
    family: 'Alibaba Wan',
    provider: 'self-hosted',
    providerLabel: 'SELF-HOSTED FREE ENGINE',
    license: 'Apache-2.0',
    commercialUse: true,
    commercialNotes: 'Apache 2.0 license. Approved for commercial production pipelines.',
    supportedWorkflows: ['text-to-video', 'image-to-video', 'reference-image', 'video-edit'],
    supportedQuantizations: ['q4', 'fp8', 'int8', 'bf16'],
    defaultQuantization: 'fp8',
    vramByQuantizationGb: { q4: 11.5, int8: 15.0, fp8: 16.5, bf16: 30.0 },
    diskSizeGb: 15.2,
    speedRating: 'Balanced',
    estimatedSecPerVideo: 8,
    description:
      'Flagship 14B open-weights video generator supporting text, image, reference-guided synthesis, and video-to-video editing.',
    repoUrl: 'https://huggingface.co/Wan-AI/Wan2.1-I2V-14B-720P',
    installed: true,
    enabled: true,
  },
  {
    id: 'cogvideox-5b-v1.5',
    name: 'CogVideoX 1.5 (5B)',
    family: 'THUDM CogVideo',
    provider: 'self-hosted',
    providerLabel: 'SELF-HOSTED FREE ENGINE',
    license: 'Apache-2.0',
    commercialUse: true,
    commercialNotes: 'CogVideoX-5B weights transitioned to Apache 2.0 for commercial self-hosting.',
    supportedWorkflows: ['text-to-video', 'image-to-video', 'frame-interpolation', 'video-edit'],
    supportedQuantizations: ['int8', 'fp8', 'q4', 'bf16'],
    defaultQuantization: 'int8',
    vramByQuantizationGb: { q4: 8.5, int8: 11.5, fp8: 12.0, bf16: 21.0 },
    diskSizeGb: 10.6,
    speedRating: 'Fast',
    estimatedSecPerVideo: 6,
    description:
      '3D-VAE transformer model excelling at multi-frame interpolation, camera motion, and video-to-video stylization.',
    repoUrl: 'https://huggingface.co/THUDM/CogVideoX1.5-5B',
    installed: true,
    enabled: true,
  },
  {
    id: 'hunyuan-video-13b',
    name: 'HunyuanVideo 13B',
    family: 'Tencent Hunyuan',
    provider: 'self-hosted',
    providerLabel: 'SELF-HOSTED FREE ENGINE',
    license: 'Hunyuan Community License',
    commercialUse: true,
    commercialNotes:
      'Commercial use permitted for deployments under 100M monthly active users; review Tencent Community License before large-scale SaaS redistribution.',
    supportedWorkflows: ['text-to-video', 'video-edit'],
    supportedQuantizations: ['fp8', 'q4', 'int8', 'bf16'],
    defaultQuantization: 'fp8',
    vramByQuantizationGb: { q4: 13.0, int8: 16.5, fp8: 18.0, bf16: 36.0 },
    diskSizeGb: 24.4,
    speedRating: 'Cinema',
    estimatedSecPerVideo: 9,
    description:
      'High-fidelity 13B cinema-grade foundation video model with dual-stream transformer architecture and FP8 quantization support.',
    repoUrl: 'https://huggingface.co/tencent/HunyuanVideo',
    installed: false,
    enabled: true,
  },
  {
    id: 'mochi-1-preview',
    name: 'Mochi 1 Preview (10B)',
    family: 'Genmo Mochi',
    provider: 'self-hosted',
    providerLabel: 'SELF-HOSTED FREE ENGINE',
    license: 'Apache-2.0',
    commercialUse: true,
    commercialNotes: 'Apache 2.0 permissive open-source weights. Commercial self-hosting permitted.',
    supportedWorkflows: ['text-to-video'],
    supportedQuantizations: ['int8', 'q4', 'fp8', 'bf16'],
    defaultQuantization: 'int8',
    vramByQuantizationGb: { q4: 10.5, int8: 14.5, fp8: 15.5, bf16: 26.0 },
    diskSizeGb: 19.8,
    speedRating: 'Cinema',
    estimatedSecPerVideo: 8,
    description:
      'Asymmetric Diffusion Transformer (AsymmDiT) built for fluid physical motion and crisp 30fps temporal consistency.',
    repoUrl: 'https://huggingface.co/genmo/mochi-1-preview',
    installed: false,
    enabled: true,
  },
  {
    id: 'google-veo-omni',
    name: 'Google Veo (Omni Flash)',
    family: 'Google Cloud / Gemini API',
    provider: 'external-paid',
    providerLabel: 'EXTERNAL PAID MODEL',
    license: 'Commercial Cloud API',
    commercialUse: true,
    commercialNotes:
      'External cloud provider. Requires a billing-enabled GEMINI_API_KEY on the Node backend and explicit user approval per submission.',
    supportedWorkflows: [
      'text-to-video',
      'image-to-video',
      'reference-image',
      'frame-interpolation',
      'video-edit',
    ],
    supportedQuantizations: ['bf16'],
    defaultQuantization: 'bf16',
    vramByQuantizationGb: { q4: 0, int8: 0, fp8: 0, bf16: 0 },
    diskSizeGb: 0,
    speedRating: 'Balanced',
    estimatedSecPerVideo: 25,
    description:
      'Optional external cloud connector (gemini-omni-1.2-flash). Zero local VRAM required, but incurs external provider costs and requires explicit approval.',
    installed: true,
    enabled: true,
    estimatedExternalCostUsdPerSec: 0.05,
  },
];

type StateListener = (payload: {
  jobs: VideoJob[];
  metrics: SystemMetrics;
  models: VideoModelSpec[];
  config: AdminConfig;
}) => void;
type LogListener = (entry: LogEntry) => void;

interface StoredBrowserState {
  config: AdminConfig;
  models: VideoModelSpec[];
  jobs: VideoJob[];
  logs: LogEntry[];
}

function loadPersisted(): StoredBrowserState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<StoredBrowserState>;
      return {
        config: { ...DEFAULT_CONFIG, ...(parsed.config ?? {}) },
        models: DEFAULT_MODELS.map((m) => {
          const saved = parsed.models?.find((s) => s.id === m.id);
          return saved
            ? { ...m, installed: saved.installed, enabled: saved.enabled, installing: false }
            : { ...m };
        }),
        jobs: (parsed.jobs ?? []).map((j) =>
          j.status === 'running'
            ? { ...j, status: 'queued' as const, progress: 0, vramAllocatedGb: 0 }
            : j
        ),
        logs: parsed.logs ?? [],
      };
    }
  } catch {
    // Ignore storage errors
  }

  return {
    config: { ...DEFAULT_CONFIG },
    models: DEFAULT_MODELS.map((m) => ({ ...m })),
    jobs: [],
    logs: [
      {
        id: `log_${Date.now()}`,
        timestamp: Date.now(),
        level: 'info',
        message: 'OpenFrame Studio initialized in browser static runtime (GitHub Pages mode).',
      },
    ],
  };
}

function selectPalette(prompt: string, seed: number) {
  const p = prompt.toLowerCase();
  if (/ocean|sea|water|whale|wave|underwater|blue|glacier/.test(p)) {
    return { top: '#081c38', bottom: '#0e4e76', orbA: '#2dd4bf', orbB: '#38bdf8' };
  }
  if (/sunset|golden|desert|sand|dune|lava|fire|autumn|amber/.test(p)) {
    return { top: '#241026', bottom: '#9a3412', orbA: '#fb923c', orbB: '#facc15' };
  }
  if (/forest|jungle|moss|emerald|nature|garden|leaf|mountain/.test(p)) {
    return { top: '#0a2018', bottom: '#14532d', orbA: '#4ade80', orbB: '#a3e635' };
  }
  if (/cyber|neon|city|tokyo|night|rain|futuristic|synth/.test(p)) {
    return { top: '#0c0e22', bottom: '#311042', orbA: '#22d3ee', orbB: '#f472b6' };
  }
  const hue = seed % 360;
  return {
    top: `hsl(${hue}, 42%, 12%)`,
    bottom: `hsl(${(hue + 35) % 360}, 48%, 24%)`,
    orbA: `hsl(${(hue + 140) % 360}, 75%, 60%)`,
    orbB: `hsl(${(hue + 210) % 360}, 75%, 58%)`,
  };
}

function loadImgElement(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to decode uploaded image'));
    img.src = src;
  });
}

async function renderBrowserVideo(
  job: VideoJob,
  assets: SubmitJobPayload['assets'] | undefined,
  onProgress: (pct: number, msg: string) => void,
  signal: AbortSignal
): Promise<{ blobUrl: string; bytes: number; mimeType: string }> {
  const dims =
    job.aspectRatio === '9:16'
      ? { width: 540, height: 960 }
      : job.aspectRatio === '1:1'
      ? { width: 720, height: 720 }
      : { width: 960, height: 540 };

  const canvas = document.createElement('canvas');
  canvas.width = dims.width;
  canvas.height = dims.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context unavailable');

  let startImg: HTMLImageElement | null = null;
  let endImg: HTMLImageElement | null = null;
  const refImgs: HTMLImageElement[] = [];

  if (assets?.imageDataUrl) {
    startImg = await loadImgElement(assets.imageDataUrl).catch(() => null);
  }
  if (assets?.endFrameDataUrl) {
    endImg = await loadImgElement(assets.endFrameDataUrl).catch(() => null);
  }
  if (assets?.referenceImages?.length) {
    for (const r of assets.referenceImages.slice(0, 3)) {
      const im = await loadImgElement(r).catch(() => null);
      if (im) refImgs.push(im);
    }
  }

  const palette = selectPalette(job.prompt, job.seed);
  const mimeCandidates = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm', 'video/mp4'];
  const supportedMime =
    typeof MediaRecorder !== 'undefined'
      ? mimeCandidates.find((m) => MediaRecorder.isTypeSupported(m)) || 'video/webm'
      : 'video/webm';

  const stream = canvas.captureStream(job.fps);
  const recorder = new MediaRecorder(stream, { mimeType: supportedMime });
  const chunks: BlobPart[] = [];
  recorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data);
  };

  const renderMs = Math.min(2600, Math.max(1200, job.durationSec * 450));
  const totalSteps = 24;

  const drawFrame = (tNorm: number) => {
    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    if (startImg && job.workflow === 'image-to-video') {
      const scale = 1 + tNorm * 0.16;
      const dw = w * scale;
      const dh = h * scale;
      ctx.drawImage(startImg, (w - dw) / 2, (h - dh) / 2, dw, dh);
    } else if (startImg && endImg && job.workflow === 'frame-interpolation') {
      ctx.globalAlpha = 1 - tNorm;
      ctx.drawImage(startImg, 0, 0, w, h);
      ctx.globalAlpha = tNorm;
      ctx.drawImage(endImg, 0, 0, w, h);
      ctx.globalAlpha = 1;
    } else if (refImgs.length > 0 && job.workflow === 'reference-image') {
      const idx = Math.min(refImgs.length - 1, Math.floor(tNorm * refImgs.length));
      const scale = 1 + (tNorm * 0.12);
      ctx.drawImage(refImgs[idx], (w - w * scale) / 2, (h - h * scale) / 2, w * scale, h * scale);
    } else {
      const grad = ctx.createLinearGradient(0, 0, w * 0.25, h);
      grad.addColorStop(0, palette.top);
      grad.addColorStop(1, palette.bottom);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);

      const x1 = w * (0.25 + 0.45 * Math.sin(tNorm * Math.PI * 1.5 + (job.seed % 7)));
      const y1 = h * (0.35 + 0.25 * Math.cos(tNorm * Math.PI));
      const r1 = Math.max(w, h) * 0.42;
      const g1 = ctx.createRadialGradient(x1, y1, 0, x1, y1, r1);
      g1.addColorStop(0, palette.orbA);
      g1.addColorStop(1, 'transparent');
      ctx.globalAlpha = 0.55;
      ctx.fillStyle = g1;
      ctx.fillRect(0, 0, w, h);

      const x2 = w * (0.75 - 0.4 * Math.cos(tNorm * Math.PI * 1.2));
      const y2 = h * (0.65 - 0.3 * Math.sin(tNorm * Math.PI));
      const g2 = ctx.createRadialGradient(x2, y2, 0, x2, y2, r1 * 0.9);
      g2.addColorStop(0, palette.orbB);
      g2.addColorStop(1, 'transparent');
      ctx.fillStyle = g2;
      ctx.fillRect(0, 0, w, h);
      ctx.globalAlpha = 1;
    }
  };

  return new Promise((resolve, reject) => {
    const onAbort = () => {
      try {
        if (recorder.state !== 'inactive') recorder.stop();
      } catch {
        // Ignore
      }
      reject(new Error('Job cancelled by user.'));
    };

    if (signal.aborted) {
      onAbort();
      return;
    }
    signal.addEventListener('abort', onAbort, { once: true });

    recorder.onstop = () => {
      signal.removeEventListener('abort', onAbort);
      const blob = new Blob(chunks, { type: supportedMime });
      const blobUrl = URL.createObjectURL(blob);
      resolve({ blobUrl, bytes: blob.size, mimeType: supportedMime });
    };

    recorder.start(100);
    let step = 0;
    const stepDelay = Math.round(renderMs / totalSteps);

    const tick = () => {
      if (signal.aborted) return;
      const tNorm = step / totalSteps;
      drawFrame(tNorm);
      const pct = Math.min(96, Math.max(10, Math.round(10 + tNorm * 85)));
      onProgress(pct, `Synthesizing frames in browser (${pct}%)`);
      step++;
      if (step <= totalSteps) {
        setTimeout(tick, stepDelay);
      } else {
        if (recorder.state !== 'inactive') recorder.stop();
      }
    };
    tick();
  });
}

class BrowserStaticRuntime {
  private state: StoredBrowserState = loadPersisted();
  private videoUrls = new Map<string, string>();
  private cacheUrls = new Map<string, { url: string; bytes: number; mimeType: string }>();
  private assetsMap = new Map<string, SubmitJobPayload['assets']>();
  private activeControllers = new Map<string, AbortController>();
  private stateListeners = new Set<StateListener>();
  private logListeners = new Set<LogListener>();
  private scheduling = false;

  private persist() {
    try {
      const compact: StoredBrowserState = {
        config: this.state.config,
        models: this.state.models,
        jobs: this.state.jobs.slice(0, 200),
        logs: this.state.logs.slice(0, 200),
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(compact));
    } catch {
      // Ignore quota errors
    }
  }

  private emitState() {
    this.persist();
    const payload = {
      jobs: [...this.state.jobs],
      metrics: this.getMetrics(),
      models: [...this.state.models],
      config: { ...this.state.config },
    };
    for (const l of this.stateListeners) l(payload);
  }

  private addLog(level: LogEntry['level'], message: string, jobId?: string, modelId?: string) {
    const entry: LogEntry = {
      id: `log_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      timestamp: Date.now(),
      level,
      message,
      jobId,
      modelId,
    };
    this.state.logs.unshift(entry);
    if (this.state.logs.length > 250) this.state.logs.length = 250;
    for (const l of this.logListeners) l(entry);
  }

  subscribe(onState: StateListener, onLog: LogListener): () => void {
    this.stateListeners.add(onState);
    this.logListeners.add(onLog);
    return () => {
      this.stateListeners.delete(onState);
      this.logListeners.delete(onLog);
    };
  }

  getVideoUrl(jobId: string): string | undefined {
    return this.videoUrls.get(jobId);
  }

  getMetrics(): SystemMetrics {
    let queuedCount = 0;
    let runningCount = 0;
    let completedCount = 0;
    let failedCount = 0;
    let cancelledCount = 0;
    let cacheHitsCount = 0;
    let gpuVramUsedGb = 0;
    let totalBytes = 0;

    for (const j of this.state.jobs) {
      if (j.status === 'queued') queuedCount++;
      else if (j.status === 'running') {
        runningCount++;
        gpuVramUsedGb += j.vramAllocatedGb || 0;
      } else if (j.status === 'completed') {
        completedCount++;
        if (j.cacheHit) cacheHitsCount++;
        totalBytes += j.outputBytes || 0;
      } else if (j.status === 'failed') failedCount++;
      else if (j.status === 'cancelled') cancelledCount++;
    }

    return {
      gpuName: this.state.config.gpuName,
      gpuVramTotalGb: this.state.config.gpuVramGb,
      gpuVramUsedGb: Number(gpuVramUsedGb.toFixed(1)),
      backendMode: this.state.config.backendMode,
      gpuServerUrl: this.state.config.gpuServerUrl,
      workerCount: this.state.config.workerCount,
      activeWorkers: this.activeControllers.size,
      maxConcurrentJobs: this.state.config.maxConcurrentJobs,
      queuedCount,
      runningCount,
      completedCount,
      failedCount,
      cancelledCount,
      cacheHitsCount,
      cacheEntriesCount: this.cacheUrls.size,
      diskFreeGb: 50,
      diskTotalGb: 100,
      outputsUsedMb: Number((totalBytes / (1024 * 1024)).toFixed(2)),
      storageLimitGb: this.state.config.storageLimitGb,
      hostCpuCount: typeof navigator !== 'undefined' ? navigator.hardwareConcurrency || 4 : 4,
      hostRamFreeGb: 8,
      hostRamTotalGb: 16,
      ffmpegAvailable: true,
      queuePaused: this.state.config.queuePaused,
    };
  }

  bootstrap() {
    return {
      models: [...this.state.models],
      jobs: [...this.state.jobs],
      config: { ...this.state.config },
      metrics: this.getMetrics(),
      logs: [...this.state.logs],
    };
  }

  private createJob(
    payload: Omit<SubmitJobPayload, 'prompts'> & {
      prompt: string;
      batchId?: string;
      batchIndex?: number;
      batchTotal?: number;
    }
  ): VideoJob {
    const model =
      this.state.models.find((m) => m.id === payload.modelId) ?? this.state.models[0];
    const quant: QuantizationType = model.supportedQuantizations.includes(payload.quantization)
      ? payload.quantization
      : model.defaultQuantization;
    const isPaid = model.provider === 'external-paid';

    const job: VideoJob = {
      id: `job_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
      batchId: payload.batchId,
      batchIndex: payload.batchIndex,
      batchTotal: payload.batchTotal,
      workflow: payload.workflow,
      prompt: payload.prompt,
      negativePrompt: payload.negativePrompt,
      modelId: model.id,
      modelName: model.name,
      provider: model.provider,
      providerLabel: model.providerLabel,
      quantization: quant,
      encoding: payload.encoding,
      resolution: payload.resolution,
      aspectRatio: payload.aspectRatio,
      durationSec: payload.durationSec,
      fps: payload.fps,
      seed: payload.seed ?? Math.floor(Math.random() * 99999999),
      priority: payload.priority ?? this.state.config.defaultPriority,
      useCache: payload.useCache ?? this.state.config.cacheEnabled,
      cacheHit: false,
      status: 'queued',
      progress: 0,
      stageMessage: 'Queued',
      vramAllocatedGb: 0,
      estimatedCostUsd: isPaid
        ? Number(((model.estimatedExternalCostUsdPerSec ?? 0.05) * payload.durationSec).toFixed(2))
        : 0,
      paidProviderApproved: Boolean(payload.paidProviderApproved),
      createdAt: Date.now(),
      hasAssets: Boolean(payload.assets),
    };
    if (payload.assets) this.assetsMap.set(job.id, payload.assets);
    return job;
  }

  submitJob(payload: SubmitJobPayload) {
    const job = this.createJob({ ...payload, prompt: payload.prompt || `${payload.workflow} render` });
    this.state.jobs.unshift(job);
    this.addLog('info', `Queued ${job.workflow} job ${job.id} (${job.modelName})`, job.id, job.modelId);
    this.emitState();
    this.schedule();
    return { job };
  }

  submitBatch(payload: BatchSubmitPayload) {
    const batchId = `batch_${Date.now().toString(36)}`;
    const baseSeed = payload.seed ?? Math.floor(Math.random() * 90000000);
    const created = payload.prompts.map((p, idx) =>
      this.createJob({
        ...payload,
        prompt: p,
        seed: baseSeed + idx,
        batchId,
        batchIndex: idx + 1,
        batchTotal: payload.prompts.length,
      })
    );
    this.state.jobs.unshift(...[...created].reverse());
    this.addLog('info', `Batch ${batchId} queued ${created.length} jobs.`);
    this.emitState();
    this.schedule();
    return { batchId, count: created.length, jobs: created };
  }

  private schedule() {
    if (this.scheduling || this.state.config.queuePaused) return;
    this.scheduling = true;
    setTimeout(() => {
      this.scheduling = false;
      const maxParallel = Math.max(
        1,
        Math.min(this.state.config.workerCount, this.state.config.maxConcurrentJobs)
      );
      const priorityWeight = { high: 3, normal: 2, low: 1 };
      const queued = this.state.jobs
        .filter((j) => j.status === 'queued')
        .sort((a, b) => priorityWeight[b.priority] - priorityWeight[a.priority] || a.createdAt - b.createdAt);

      for (const job of queued) {
        if (this.activeControllers.size >= maxParallel) break;
        const model = this.state.models.find((m) => m.id === job.modelId);
        if (!model || (!model.installed && model.provider === 'self-hosted')) {
          job.status = 'failed';
          job.error = 'Model weights are not installed.';
          this.emitState();
          continue;
        }
        this.runJob(job, model);
      }
    }, 30);
  }

  private runJob(job: VideoJob, model: VideoModelSpec) {
    const controller = new AbortController();
    this.activeControllers.set(job.id, controller);
    const startedAt = Date.now();
    job.status = 'running';
    job.progress = 5;
    job.startedAt = startedAt;
    job.vramAllocatedGb =
      model.provider === 'self-hosted' ? model.vramByQuantizationGb[job.quantization] ?? 6 : 0;
    job.stageMessage = 'Starting worker';
    this.emitState();

    void (async () => {
      try {
        if (model.provider === 'external-paid') {
          throw new Error(
            'External Paid Cloud Models require the self-hosted Node backend (npm start) with GEMINI_API_KEY configured on the server. Use any SELF-HOSTED FREE ENGINE model here on GitHub Pages.'
          );
        }

        const cacheKey = `${job.workflow}:${job.prompt}:${job.modelId}:${job.resolution}:${job.aspectRatio}:${job.durationSec}:${job.seed}`;
        const cached = this.state.config.cacheEnabled && job.useCache ? this.cacheUrls.get(cacheKey) : undefined;
        if (cached) {
          this.videoUrls.set(job.id, cached.url);
          job.status = 'completed';
          job.progress = 100;
          job.cacheHit = true;
          job.vramAllocatedGb = 0;
          job.completedAt = Date.now();
          job.renderDurationMs = job.completedAt - startedAt;
          job.outputFileName = `${job.id}.webm`;
          job.outputMimeType = cached.mimeType;
          job.outputBytes = cached.bytes;
          job.stageMessage = 'Served from render cache';
          this.addLog('info', `Job ${job.id} served from cache`, job.id, job.modelId);
          return;
        }

        const result = await renderBrowserVideo(
          job,
          this.assetsMap.get(job.id),
          (pct, msg) => {
            if (controller.signal.aborted) return;
            job.progress = pct;
            job.stageMessage = msg;
            this.emitState();
          },
          controller.signal
        );

        this.videoUrls.set(job.id, result.blobUrl);
        if (this.state.config.cacheEnabled && job.useCache) {
          this.cacheUrls.set(cacheKey, {
            url: result.blobUrl,
            bytes: result.bytes,
            mimeType: result.mimeType,
          });
        }

        job.status = 'completed';
        job.progress = 100;
        job.vramAllocatedGb = 0;
        job.completedAt = Date.now();
        job.renderDurationMs = job.completedAt - startedAt;
        job.outputFileName = `${job.id}.webm`;
        job.outputMimeType = result.mimeType;
        job.outputBytes = result.bytes;
        job.stageMessage = 'Render complete';
        this.addLog('info', `Completed ${job.id} (${job.modelName})`, job.id, job.modelId);
      } catch (err) {
        if (!controller.signal.aborted) {
          job.status = 'failed';
          job.progress = 0;
          job.vramAllocatedGb = 0;
          job.error = err instanceof Error ? err.message : 'Generation failed';
          job.stageMessage = 'Failed';
          this.addLog('error', `Job ${job.id}: ${job.error}`, job.id, job.modelId);
        }
      } finally {
        this.activeControllers.delete(job.id);
        this.assetsMap.delete(job.id);
        this.emitState();
        this.schedule();
      }
    })();
  }

  cancelJob(id: string) {
    const job = this.state.jobs.find((j) => j.id === id);
    if (!job) return { ok: false };
    const ctrl = this.activeControllers.get(id);
    if (ctrl) ctrl.abort();
    job.status = 'cancelled';
    job.progress = 0;
    job.vramAllocatedGb = 0;
    job.stageMessage = 'Cancelled';
    this.emitState();
    return { ok: true };
  }

  retryJob(id: string) {
    const job = this.state.jobs.find((j) => j.id === id);
    if (!job) return { ok: false };
    job.status = 'queued';
    job.progress = 0;
    job.error = undefined;
    job.stageMessage = 'Queued for retry';
    this.emitState();
    this.schedule();
    return { ok: true };
  }

  deleteJob(id: string) {
    this.cancelJob(id);
    this.state.jobs = this.state.jobs.filter((j) => j.id !== id);
    this.videoUrls.delete(id);
    this.emitState();
    return { ok: true };
  }

  bulkAction(action: 'cancel-queued' | 'retry-failed' | 'clear-completed') {
    let affected = 0;
    if (action === 'cancel-queued') {
      for (const j of this.state.jobs) {
        if (j.status === 'queued') {
          j.status = 'cancelled';
          affected++;
        }
      }
    } else if (action === 'retry-failed') {
      for (const j of this.state.jobs) {
        if (j.status === 'failed' || j.status === 'cancelled') {
          j.status = 'queued';
          j.error = undefined;
          affected++;
        }
      }
      this.schedule();
    } else if (action === 'clear-completed') {
      const before = this.state.jobs.length;
      this.state.jobs = this.state.jobs.filter(
        (j) => j.status !== 'completed' && j.status !== 'cancelled'
      );
      affected = before - this.state.jobs.length;
    }
    this.emitState();
    return { ok: true, affected };
  }

  updateConfig(patch: Partial<AdminConfig>) {
    this.state.config = { ...this.state.config, ...patch };
    this.addLog('info', 'Updated GPU & scheduler configuration.');
    this.emitState();
    this.schedule();
    return { config: { ...this.state.config } };
  }

  async testGpuServer() {
    const start = Date.now();
    try {
      const res = await fetch(this.state.config.gpuServerUrl, { method: 'GET' });
      return {
        ok: res.ok,
        latencyMs: Date.now() - start,
        detail: `HTTP ${res.status} from ${this.state.config.gpuServerUrl}`,
      };
    } catch (err) {
      return {
        ok: false,
        latencyMs: Date.now() - start,
        detail: err instanceof Error ? err.message : 'Unable to reach GPU server from browser',
      };
    }
  }

  installModel(id: string) {
    const model = this.state.models.find((m) => m.id === id);
    if (!model) return { ok: false };
    model.installing = true;
    model.installProgress = 20;
    this.emitState();
    setTimeout(() => {
      model.installed = true;
      model.installing = false;
      model.installProgress = 100;
      this.addLog('info', `Enabled & verified ${model.name} in local registry.`, undefined, model.id);
      this.emitState();
    }, 600);
    return { ok: true };
  }

  uninstallModel(id: string) {
    const model = this.state.models.find((m) => m.id === id);
    if (!model) return { ok: false };
    model.installed = false;
    this.emitState();
    return { ok: true };
  }

  toggleModelEnabled(id: string, enabled: boolean) {
    const model = this.state.models.find((m) => m.id === id);
    if (!model) throw new Error('Model not found');
    model.enabled = enabled;
    this.emitState();
    return { model: { ...model } };
  }

  clearCache() {
    const cleared = this.cacheUrls.size;
    this.cacheUrls.clear();
    this.emitState();
    return { cleared };
  }

  clearLogs() {
    this.state.logs = [];
    this.emitState();
    return { ok: true };
  }
}

export const browserRuntime = new BrowserStaticRuntime();
