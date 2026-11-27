import 'dotenv/config';
import express from 'express';
import fs from 'fs';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import {
  AdminConfig,
  BatchSubmitPayload,
  SubmitJobPayload,
  VideoJob,
} from './shared/types.js';
import { OUTPUTS_DIR, resolveSafeFilePath, store } from './server/storage.js';
import { probeRemoteGpuServer, validateGpuServerUrl } from './server/videoEngine.js';
import { scheduler } from './server/worker.js';

const PORT = 3000;

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '50mb' }));

  // SSE endpoint for real-time queue, GPU, storage, and log updates
  app.get('/api/events', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    const sendEvent = (event: string, data: unknown) => {
      res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    };

    // Send initial snapshot
    sendEvent('state', {
      jobs: store.getJobs(),
      metrics: scheduler.getSystemMetrics(),
      models: store.getModels(),
      config: store.getConfig(),
    });

    const unsubscribe = scheduler.subscribe(sendEvent);
    const keepalive = setInterval(() => {
      res.write(': keepalive\n\n');
    }, 15000);

    req.on('close', () => {
      clearInterval(keepalive);
      unsubscribe();
    });
  });

  // Bootstrap initial state
  app.get('/api/bootstrap', (_req, res) => {
    res.json({
      models: store.getModels(),
      jobs: store.getJobs(),
      config: store.getConfig(),
      metrics: scheduler.getSystemMetrics(),
      logs: store.getLogs(),
    });
  });

  // Submit single generation job
  app.post('/api/jobs', (req, res) => {
    const body = req.body as Partial<SubmitJobPayload>;
    const prompt = typeof body.prompt === 'string' ? body.prompt.trim() : '';
    if (!prompt && body.workflow !== 'image-to-video' && body.workflow !== 'video-edit') {
      return res.status(400).json({ error: 'Prompt is required.' });
    }

    const model = store.getModelById(String(body.modelId ?? ''));
    if (!model || !model.enabled) {
      return res.status(400).json({ error: 'Selected model is unavailable or disabled.' });
    }

    const config = store.getConfig();
    if (model.provider === 'external-paid') {
      if (!config.allowExternalPaidModels) {
        return res.status(403).json({
          error: 'External paid models are disabled by Administrator Policy. Use a Self-Hosted Free Engine model.',
        });
      }
      if (body.paidProviderApproved !== true) {
        return res.status(400).json({
          error: 'Explicit user approval and cost acknowledgment are required before using an external paid model.',
        });
      }
    }

    const durationSec = Math.min(15, Math.max(2, Number(body.durationSec) || 4));
    const fps = [24, 30].includes(Number(body.fps)) ? Number(body.fps) : 24;
    const quantization = model.supportedQuantizations.includes(body.quantization!)
      ? body.quantization!
      : model.defaultQuantization;

    const job = scheduler.createJobRecord({
      workflow: body.workflow ?? 'text-to-video',
      prompt: prompt || `${body.workflow} synthesis`,
      negativePrompt: typeof body.negativePrompt === 'string' ? body.negativePrompt : undefined,
      model,
      quantization,
      encoding: body.encoding ?? 'h264-fast',
      resolution: body.resolution ?? '720p',
      aspectRatio: body.aspectRatio ?? '16:9',
      durationSec,
      fps,
      seed: typeof body.seed === 'number' && Number.isFinite(body.seed) ? Math.floor(body.seed) : undefined,
      priority: body.priority ?? config.defaultPriority,
      useCache: body.useCache ?? config.cacheEnabled,
      paidProviderApproved: body.paidProviderApproved,
      hasAssets: Boolean(body.assets),
    });

    if (body.assets) {
      scheduler.setJobAssets(job.id, body.assets);
    }

    store.addJobs([job]);
    scheduler.emitLog('info', `Queued ${job.workflow} job ${job.id} (${model.name})`, {
      jobId: job.id,
      modelId: model.id,
    });
    scheduler.emitState();
    scheduler.triggerSchedule();

    return res.status(201).json({ job });
  });

  // Submit batch of 1..500+ prompts without artificial caps
  app.post('/api/jobs/batch', (req, res) => {
    const body = req.body as Partial<BatchSubmitPayload>;
    const rawPrompts = Array.isArray(body.prompts) ? body.prompts : [];
    const cleanPrompts = rawPrompts
      .map((p) => (typeof p === 'string' ? p.trim() : ''))
      .filter((p) => p.length > 0);

    if (cleanPrompts.length === 0) {
      return res.status(400).json({ error: 'Provide at least one prompt in the batch.' });
    }

    const model = store.getModelById(String(body.modelId ?? ''));
    if (!model || !model.enabled) {
      return res.status(400).json({ error: 'Selected model is unavailable or disabled.' });
    }

    const config = store.getConfig();
    if (model.provider === 'external-paid') {
      if (!config.allowExternalPaidModels) {
        return res.status(403).json({
          error: 'External paid models are disabled by Administrator Policy.',
        });
      }
      if (body.paidProviderApproved !== true) {
        return res.status(400).json({
          error: 'Explicit user approval is required before submitting a batch to an external paid provider.',
        });
      }
    }

    const durationSec = Math.min(15, Math.max(2, Number(body.durationSec) || 4));
    const fps = [24, 30].includes(Number(body.fps)) ? Number(body.fps) : 24;
    const quantization = model.supportedQuantizations.includes(body.quantization!)
      ? body.quantization!
      : model.defaultQuantization;

    const batchId = `batch_${Date.now().toString(36)}`;
    const baseSeed =
      typeof body.seed === 'number' && Number.isFinite(body.seed)
        ? Math.floor(body.seed)
        : Math.floor(Math.random() * 90000000);

    const createdJobs: VideoJob[] = cleanPrompts.map((prompt, index) => {
      const job = scheduler.createJobRecord({
        workflow: body.workflow ?? 'text-to-video',
        prompt,
        negativePrompt: typeof body.negativePrompt === 'string' ? body.negativePrompt : undefined,
        model,
        quantization,
        encoding: body.encoding ?? 'h264-fast',
        resolution: body.resolution ?? '720p',
        aspectRatio: body.aspectRatio ?? '16:9',
        durationSec,
        fps,
        seed: baseSeed + index,
        priority: body.priority ?? config.defaultPriority,
        useCache: body.useCache ?? config.cacheEnabled,
        paidProviderApproved: body.paidProviderApproved,
        batchId,
        batchIndex: index + 1,
        batchTotal: cleanPrompts.length,
        hasAssets: Boolean(body.assets),
      });
      if (body.assets) {
        scheduler.setJobAssets(job.id, body.assets);
      }
      return job;
    });

    // Store in reverse order so job #1 appears in natural sequence or queued FIFO
    store.addJobs([...createdJobs].reverse());
    scheduler.emitLog(
      'info',
      `Batch ${batchId} queued ${createdJobs.length} jobs on ${model.name} (${model.providerLabel})`,
      { modelId: model.id }
    );
    scheduler.emitState();
    scheduler.triggerSchedule();

    return res.status(201).json({
      batchId,
      count: createdJobs.length,
      jobs: createdJobs,
    });
  });

  // Cancel job
  app.post('/api/jobs/:id/cancel', (req, res) => {
    const ok = scheduler.cancelJob(req.params.id);
    if (!ok) return res.status(404).json({ error: 'Job not found or not cancellable.' });
    return res.json({ ok: true });
  });

  // Retry failed or cancelled job
  app.post('/api/jobs/:id/retry', (req, res) => {
    const ok = scheduler.retryJob(req.params.id);
    if (!ok) return res.status(404).json({ error: 'Job not found or not retryable.' });
    return res.json({ ok: true });
  });

  // Delete job & free output file
  app.delete('/api/jobs/:id', (req, res) => {
    const job = store.getJobById(req.params.id);
    if (!job) return res.status(404).json({ error: 'Job not found.' });
    if (job.status === 'running') {
      scheduler.cancelJob(job.id);
    }
    store.deleteJob(job.id);
    scheduler.emitState();
    return res.json({ ok: true });
  });

  // Bulk queue actions
  app.post('/api/jobs/bulk-action', (req, res) => {
    const action = req.body?.action as string;
    const jobs = store.getJobs();
    let affected = 0;

    if (action === 'cancel-queued') {
      for (const j of jobs) {
        if (j.status === 'queued') {
          if (scheduler.cancelJob(j.id)) affected++;
        }
      }
    } else if (action === 'retry-failed') {
      for (const j of jobs) {
        if (j.status === 'failed' || j.status === 'cancelled') {
          if (scheduler.retryJob(j.id)) affected++;
        }
      }
    } else if (action === 'clear-completed') {
      const toDelete = jobs
        .filter((j) => j.status === 'completed' || j.status === 'cancelled')
        .map((j) => j.id);
      for (const id of toDelete) {
        if (store.deleteJob(id)) affected++;
      }
      scheduler.emitState();
    } else {
      return res.status(400).json({ error: 'Unsupported bulk action.' });
    }

    scheduler.emitLog('info', `Bulk action "${action}" affected ${affected} job(s).`);
    return res.json({ ok: true, affected });
  });

  // Stream completed video with HTTP Range support
  app.get('/api/videos/:id', (req, res) => {
    const job = store.getJobById(req.params.id);
    if (!job || !job.outputFileName) {
      return res.status(404).json({ error: 'Rendered video not found.' });
    }
    const filePath = resolveSafeFilePath(OUTPUTS_DIR, job.outputFileName);
    if (!filePath || !fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Video file missing on storage.' });
    }

    const stat = fs.statSync(filePath);
    const fileSize = stat.size;
    const mimeType = job.outputMimeType || 'video/mp4';
    const range = req.headers.range;

    if (range) {
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      if (Number.isNaN(start) || start >= fileSize || end >= fileSize) {
        res.status(416).setHeader('Content-Range', `bytes */${fileSize}`).end();
        return;
      }
      const chunkSize = end - start + 1;
      res.writeHead(206, {
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunkSize,
        'Content-Type': mimeType,
      });
      fs.createReadStream(filePath, { start, end }).pipe(res);
    } else {
      res.writeHead(200, {
        'Content-Length': fileSize,
        'Content-Type': mimeType,
        'Accept-Ranges': 'bytes',
      });
      fs.createReadStream(filePath).pipe(res);
    }
  });

  // Download completed video file
  app.get('/api/videos/:id/download', (req, res) => {
    const job = store.getJobById(req.params.id);
    if (!job || !job.outputFileName) {
      return res.status(404).json({ error: 'Rendered video not found.' });
    }
    const filePath = resolveSafeFilePath(OUTPUTS_DIR, job.outputFileName);
    if (!filePath || !fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Video file missing on storage.' });
    }
    const ext = path.extname(job.outputFileName) || '.mp4';
    const safeSlug = job.prompt
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 36);
    const downloadName = `${safeSlug || job.id}_${job.resolution}${ext}`;
    return res.download(filePath, downloadName);
  });

  // Admin: update hardware/worker/queue configuration
  app.patch('/api/admin/config', (req, res) => {
    const patch = req.body as Partial<AdminConfig>;
    const safePatch: Partial<AdminConfig> = {};

    if (typeof patch.gpuName === 'string' && patch.gpuName.trim()) {
      safePatch.gpuName = patch.gpuName.trim().slice(0, 80);
    }
    if (typeof patch.gpuVramGb === 'number' && Number.isFinite(patch.gpuVramGb)) {
      safePatch.gpuVramGb = Math.min(512, Math.max(4, Math.round(patch.gpuVramGb)));
    }
    if (patch.backendMode === 'local-ffmpeg' || patch.backendMode === 'remote-gpu') {
      safePatch.backendMode = patch.backendMode;
    }
    if (typeof patch.gpuServerUrl === 'string' && patch.gpuServerUrl.trim()) {
      try {
        validateGpuServerUrl(patch.gpuServerUrl.trim());
        safePatch.gpuServerUrl = patch.gpuServerUrl.trim();
      } catch (err) {
        return res.status(400).json({ error: err instanceof Error ? err.message : 'Invalid URL' });
      }
    }
    if (patch.gpuServerApiType === 'comfyui' || patch.gpuServerApiType === 'diffusers-http') {
      safePatch.gpuServerApiType = patch.gpuServerApiType;
    }
    if (typeof patch.workerCount === 'number' && Number.isFinite(patch.workerCount)) {
      safePatch.workerCount = Math.min(16, Math.max(1, Math.round(patch.workerCount)));
    }
    if (typeof patch.maxConcurrentJobs === 'number' && Number.isFinite(patch.maxConcurrentJobs)) {
      safePatch.maxConcurrentJobs = Math.min(16, Math.max(1, Math.round(patch.maxConcurrentJobs)));
    }
    if (
      patch.defaultPriority === 'high' ||
      patch.defaultPriority === 'normal' ||
      patch.defaultPriority === 'low'
    ) {
      safePatch.defaultPriority = patch.defaultPriority;
    }
    if (typeof patch.storageLimitGb === 'number' && Number.isFinite(patch.storageLimitGb)) {
      safePatch.storageLimitGb = Math.min(10000, Math.max(1, Math.round(patch.storageLimitGb)));
    }
    if (typeof patch.cacheEnabled === 'boolean') {
      safePatch.cacheEnabled = patch.cacheEnabled;
    }
    if (typeof patch.queuePaused === 'boolean') {
      safePatch.queuePaused = patch.queuePaused;
    }
    if (typeof patch.allowExternalPaidModels === 'boolean') {
      safePatch.allowExternalPaidModels = patch.allowExternalPaidModels;
    }

    const updated = store.updateConfig(safePatch);
    scheduler.emitLog('info', 'Updated GPU server & scheduler configuration.');
    scheduler.emitState();
    scheduler.triggerSchedule();
    return res.json({ config: updated });
  });

  // Admin: test remote GPU node connectivity
  app.post('/api/admin/test-gpu-server', async (_req, res) => {
    const config = store.getConfig();
    try {
      const result = await probeRemoteGpuServer(config);
      scheduler.emitLog(
        result.ok ? 'info' : 'warn',
        `Remote GPU node probe (${config.gpuServerUrl}): ${result.detail}`
      );
      return res.json(result);
    } catch (err) {
      return res.status(400).json({
        ok: false,
        latencyMs: 0,
        detail: err instanceof Error ? err.message : 'Invalid GPU server URL',
      });
    }
  });

  // Admin: install/enable/uninstall open-source models
  app.post('/api/admin/models/:id/install', (req, res) => {
    const model = store.getModelById(req.params.id);
    if (!model) return res.status(404).json({ error: 'Model not found.' });
    if (model.provider !== 'self-hosted') {
      return res.status(400).json({ error: 'External cloud models do not install local weights.' });
    }
    void scheduler.installModelWeights(model.id);
    return res.json({ ok: true });
  });

  app.post('/api/admin/models/:id/uninstall', (req, res) => {
    const model = store.getModelById(req.params.id);
    if (!model) return res.status(404).json({ error: 'Model not found.' });
    if (model.provider !== 'self-hosted') {
      return res.status(400).json({ error: 'External cloud models cannot be uninstalled from disk.' });
    }
    store.updateModel(model.id, { installed: false, installing: false, installProgress: undefined });
    scheduler.emitLog('info', `Uninstalled local weights for ${model.name}`, { modelId: model.id });
    scheduler.emitState();
    return res.json({ ok: true });
  });

  app.patch('/api/admin/models/:id', (req, res) => {
    const model = store.getModelById(req.params.id);
    if (!model) return res.status(404).json({ error: 'Model not found.' });
    if (typeof req.body?.enabled === 'boolean') {
      store.updateModel(model.id, { enabled: req.body.enabled });
      scheduler.emitLog(
        'info',
        `${req.body.enabled ? 'Enabled' : 'Disabled'} model ${model.name}`,
        { modelId: model.id }
      );
      scheduler.emitState();
    }
    return res.json({ model: store.getModelById(model.id) });
  });

  // Admin: clear generation cache & logs
  app.post('/api/admin/cache/clear', (_req, res) => {
    const cleared = store.clearCache();
    scheduler.emitLog('info', `Cleared ${cleared} cached render entry/entries.`);
    scheduler.emitState();
    return res.json({ cleared });
  });

  app.delete('/api/admin/logs', (_req, res) => {
    store.clearLogs();
    return res.json({ ok: true });
  });

  // Download self-contained single-file index.html for offline/browser sharing
  app.get('/api/download-single-html', async (_req, res) => {
    try {
      const standalonePath = path.resolve(process.cwd(), 'standalone', 'index.html');
      if (!fs.existsSync(standalonePath)) {
        const mod = await import('./scripts/build-single-html.mjs');
        await mod.buildSingleHtml();
      }
      return res.download(standalonePath, 'index.html');
    } catch (err) {
      return res.status(500).json({
        error: err instanceof Error ? err.message : 'Failed to build single HTML file.',
      });
    }
  });

  // Mount Vite middleware in dev or serve static dist in production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use('/My-generator-अब', express.static(distDir));
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`OpenFrame Studio server running on http://0.0.0.0:${PORT}`);
    // Resume any queued jobs on startup
    scheduler.triggerSchedule();
  });
}

startServer().catch((err) => {
  console.error('Fatal server startup error:', err);
  process.exit(1);
});
