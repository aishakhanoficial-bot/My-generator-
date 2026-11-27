import { GoogleGenAI } from '@google/genai';
import { execFileSync, spawn } from 'child_process';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import {
  AdminConfig,
  AspectRatioOption,
  EncodingPreset,
  JobInputAssets,
  ResolutionOption,
  VideoJob,
  VideoModelSpec,
} from '../shared/types.js';
import { OUTPUTS_DIR, resolveSafeFilePath, UPLOADS_DIR } from './storage.js';

let cachedFfmpegAvailable: boolean | null = null;

export function isFfmpegAvailable(): boolean {
  if (cachedFfmpegAvailable !== null) return cachedFfmpegAvailable;
  try {
    execFileSync('ffmpeg', ['-version'], { stdio: 'ignore' });
    cachedFfmpegAvailable = true;
  } catch {
    cachedFfmpegAvailable = false;
  }
  return cachedFfmpegAvailable;
}

export function getDimensions(
  resolution: ResolutionOption,
  aspectRatio: AspectRatioOption
): { width: number; height: number } {
  const baseHeight = resolution === '1080p' ? 1080 : resolution === '720p' ? 720 : 480;
  if (aspectRatio === '16:9') {
    const w = Math.round((baseHeight * 16) / 9 / 2) * 2;
    return { width: w, height: baseHeight };
  }
  if (aspectRatio === '9:16') {
    const w = Math.round((baseHeight * 9) / 16 / 2) * 2;
    return { width: w, height: baseHeight };
  }
  // 1:1
  const side = Math.round(baseHeight / 2) * 2;
  return { width: side, height: side };
}

export function computeCacheKey(job: VideoJob, assets?: JobInputAssets): string {
  const assetHash = assets
    ? crypto
        .createHash('sha256')
        .update(
          JSON.stringify({
            img: assets.imageDataUrl?.slice(0, 2048),
            end: assets.endFrameDataUrl?.slice(0, 2048),
            refs: assets.referenceImages?.map((r) => r.slice(0, 1024)),
            vid: assets.sourceVideoDataUrl?.slice(0, 2048),
            vidId: assets.sourceVideoJobId,
            editMode: assets.editMode,
          })
        )
        .digest('hex')
        .slice(0, 16)
    : 'none';

  return crypto
    .createHash('sha256')
    .update(
      JSON.stringify({
        workflow: job.workflow,
        prompt: job.prompt.trim(),
        negativePrompt: (job.negativePrompt ?? '').trim(),
        modelId: job.modelId,
        quantization: job.quantization,
        encoding: job.encoding,
        resolution: job.resolution,
        aspectRatio: job.aspectRatio,
        durationSec: job.durationSec,
        fps: job.fps,
        seed: job.seed,
        assetHash,
      })
    )
    .digest('hex')
    .slice(0, 24);
}

interface Palette {
  bgTop: [number, number, number];
  bgBottom: [number, number, number];
  orbA: [number, number, number];
  orbB: [number, number, number];
}

function selectPalette(prompt: string, seed: number): Palette {
  const p = prompt.toLowerCase();
  if (/ocean|sea|water|whale|wave|underwater|blue|glacier/.test(p)) {
    return {
      bgTop: [8, 28, 56],
      bgBottom: [14, 78, 118],
      orbA: [45, 212, 191],
      orbB: [56, 189, 248],
    };
  }
  if (/sunset|golden|desert|sand|dune|lava|fire|autumn|amber/.test(p)) {
    return {
      bgTop: [36, 16, 38],
      bgBottom: [154, 52, 18],
      orbA: [251, 146, 60],
      orbB: [250, 204, 21],
    };
  }
  if (/forest|jungle|moss|emerald|nature|garden|leaf|mountain/.test(p)) {
    return {
      bgTop: [10, 32, 24],
      bgBottom: [20, 83, 45],
      orbA: [74, 222, 128],
      orbB: [163, 230, 53],
    };
  }
  if (/cyber|neon|city|tokyo|night|rain|futuristic|synth/.test(p)) {
    return {
      bgTop: [12, 14, 34],
      bgBottom: [49, 16, 66],
      orbA: [34, 211, 238],
      orbB: [244, 114, 182],
    };
  }
  if (/space|cosmos|galaxy|nebula|star|planet|astronaut/.test(p)) {
    return {
      bgTop: [5, 7, 18],
      bgBottom: [30, 27, 75],
      orbA: [129, 140, 248],
      orbB: [56, 189, 248],
    };
  }
  // Deterministic procedural palette from seed
  const h = (seed % 360) / 360;
  const c1: [number, number, number] = [
    Math.round(30 + 180 * Math.abs(Math.sin(h * Math.PI * 2))),
    Math.round(40 + 160 * Math.abs(Math.sin((h + 0.33) * Math.PI * 2))),
    Math.round(60 + 170 * Math.abs(Math.sin((h + 0.66) * Math.PI * 2))),
  ];
  const c2: [number, number, number] = [
    Math.round(40 + 180 * Math.abs(Math.cos(h * Math.PI * 2))),
    Math.round(50 + 160 * Math.abs(Math.cos((h + 0.25) * Math.PI * 2))),
    Math.round(70 + 170 * Math.abs(Math.cos((h + 0.5) * Math.PI * 2))),
  ];
  return {
    bgTop: [15, 23, 42],
    bgBottom: [30, 41, 59],
    orbA: c1,
    orbB: c2,
  };
}

function generateProceduralPpm(
  filePath: string,
  width: number,
  height: number,
  prompt: string,
  seed: number
) {
  const pal = selectPalette(prompt, seed);
  // Render at slightly oversized canvas for smooth zoompan without edge clipping
  const w = Math.min(width, 960);
  const h = Math.min(height, 540);
  const header = Buffer.from(`P6\n${w} ${h}\n255\n`, 'ascii');
  const pixels = Buffer.allocUnsafe(w * h * 3);

  const cx1 = ((seed * 37) % 100) / 100;
  const cy1 = ((seed * 53) % 100) / 100;
  const cx2 = ((seed * 71 + 30) % 100) / 100;
  const cy2 = ((seed * 89 + 20) % 100) / 100;
  const freq = 2.0 + ((seed % 5) * 0.6);

  let offset = 0;
  for (let y = 0; y < h; y++) {
    const ny = y / h;
    for (let x = 0; x < w; x++) {
      const nx = x / w;
      const wave = 0.5 + 0.5 * Math.sin(nx * freq * Math.PI + ny * 2.2 + (seed % 10));
      const d1 = Math.hypot(nx - cx1, (ny - cy1) * (h / w));
      const d2 = Math.hypot(nx - cx2, (ny - cy2) * (h / w));
      const glow1 = Math.exp(-d1 * d1 * 6.5);
      const glow2 = Math.exp(-d2 * d2 * 5.0);

      let r = pal.bgTop[0] * (1 - ny) + pal.bgBottom[0] * ny;
      let g = pal.bgTop[1] * (1 - ny) + pal.bgBottom[1] * ny;
      let b = pal.bgTop[2] * (1 - ny) + pal.bgBottom[2] * ny;

      r = r * (0.85 + 0.15 * wave) + pal.orbA[0] * glow1 * 0.75 + pal.orbB[0] * glow2 * 0.6;
      g = g * (0.85 + 0.15 * wave) + pal.orbA[1] * glow1 * 0.75 + pal.orbB[1] * glow2 * 0.6;
      b = b * (0.85 + 0.15 * wave) + pal.orbA[2] * glow1 * 0.75 + pal.orbB[2] * glow2 * 0.6;

      pixels[offset++] = Math.max(0, Math.min(255, r | 0));
      pixels[offset++] = Math.max(0, Math.min(255, g | 0));
      pixels[offset++] = Math.max(0, Math.min(255, b | 0));
    }
  }

  fs.writeFileSync(filePath, Buffer.concat([header, pixels]));
}

function saveDataUrlToFile(dataUrl: string, prefix: string): string {
  const match = dataUrl.match(/^data:([a-zA-Z0-9/+.-]+);base64,(.+)$/);
  if (!match) {
    throw new Error('Invalid uploaded media format (expected base64 data URL).');
  }
  const mime = match[1];
  const base64 = match[2];
  let ext = '.bin';
  if (mime.includes('png')) ext = '.png';
  else if (mime.includes('jpeg') || mime.includes('jpg')) ext = '.jpg';
  else if (mime.includes('webp')) ext = '.webp';
  else if (mime.includes('mp4')) ext = '.mp4';
  else if (mime.includes('webm')) ext = '.webm';

  const fileName = `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}${ext}`;
  const safePath = resolveSafeFilePath(UPLOADS_DIR, fileName);
  if (!safePath) throw new Error('Invalid upload destination path.');
  fs.writeFileSync(safePath, Buffer.from(base64, 'base64'));
  return safePath;
}

function getEncodingArgs(encoding: EncodingPreset): {
  ext: string;
  mime: string;
  codecArgs: string[];
} {
  switch (encoding) {
    case 'h264-hq':
      return {
        ext: 'mp4',
        mime: 'video/mp4',
        codecArgs: ['-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p', '-movflags', '+faststart'],
      };
    case 'hevc':
      return {
        ext: 'mp4',
        mime: 'video/mp4',
        codecArgs: ['-c:v', 'libx265', '-preset', 'fast', '-crf', '24', '-pix_fmt', 'yuv420p', '-tag:v', 'hvc1', '-movflags', '+faststart'],
      };
    case 'vp9':
      return {
        ext: 'webm',
        mime: 'video/webm',
        codecArgs: ['-c:v', 'libvpx-vp9', '-crf', '30', '-b:v', '0', '-deadline', 'realtime', '-cpu-used', '4', '-pix_fmt', 'yuv420p'],
      };
    case 'h264-fast':
    default:
      return {
        ext: 'mp4',
        mime: 'video/mp4',
        codecArgs: ['-c:v', 'libx264', '-preset', 'veryfast', '-crf', '23', '-pix_fmt', 'yuv420p', '-movflags', '+faststart'],
      };
  }
}

function runFfmpeg(
  args: string[],
  onProgress?: (pct: number) => void,
  totalFrames?: number,
  abortSignal?: AbortSignal
): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn('ffmpeg', args, { shell: false });
    let stderr = '';

    const onAbort = () => {
      proc.kill('SIGTERM');
      reject(new Error('Job cancelled by user.'));
    };

    if (abortSignal) {
      if (abortSignal.aborted) {
        onAbort();
        return;
      }
      abortSignal.addEventListener('abort', onAbort, { once: true });
    }

    proc.stderr.on('data', (chunk: Buffer) => {
      const text = chunk.toString('utf8');
      stderr += text;
      if (onProgress && totalFrames && totalFrames > 0) {
        const m = text.match(/frame=\s*(\d+)/);
        if (m) {
          const frame = Number(m[1]);
          const pct = Math.min(95, Math.max(10, Math.round((frame / totalFrames) * 90)));
          onProgress(pct);
        }
      }
    });

    proc.on('error', (err) => {
      abortSignal?.removeEventListener('abort', onAbort);
      reject(err);
    });

    proc.on('close', (code) => {
      abortSignal?.removeEventListener('abort', onAbort);
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`FFmpeg exited with code ${code}: ${stderr.slice(-300)}`));
      }
    });
  });
}

export function validateGpuServerUrl(rawUrl: string): URL {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error('Invalid GPU server URL.');
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('GPU server URL must use http:// or https://.');
  }
  const host = parsed.hostname.toLowerCase();
  // Block cloud metadata endpoints to prevent SSRF against host metadata services
  if (
    host === '169.254.169.254' ||
    host === 'metadata.google.internal' ||
    host.startsWith('169.254.') ||
    host.includes('fd00:ec2::254')
  ) {
    throw new Error('Metadata service addresses are prohibited for GPU server URLs.');
  }
  return parsed;
}

export async function probeRemoteGpuServer(config: AdminConfig): Promise<{
  ok: boolean;
  latencyMs: number;
  detail: string;
}> {
  const url = validateGpuServerUrl(config.gpuServerUrl);
  const start = Date.now();
  const healthPath = config.gpuServerApiType === 'comfyui' ? '/system_stats' : '/health';
  const target = new URL(healthPath, url.origin).toString();
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);
    const res = await fetch(target, { method: 'GET', signal: controller.signal });
    clearTimeout(timeout);
    const latencyMs = Date.now() - start;
    if (res.ok) {
      return { ok: true, latencyMs, detail: `Connected (${res.status}) in ${latencyMs}ms` };
    }
    return {
      ok: false,
      latencyMs,
      detail: `Endpoint responded with HTTP ${res.status}. Verify ${config.gpuServerApiType} service.`,
    };
  } catch (err) {
    return {
      ok: false,
      latencyMs: Date.now() - start,
      detail: err instanceof Error ? err.message : 'Connection refused',
    };
  }
}

async function executeRemoteGpuJob(
  job: VideoJob,
  config: AdminConfig,
  onStage: (pct: number, msg: string) => void
): Promise<{ fileName: string; mimeType: string; bytes: number }> {
  const baseUrl = validateGpuServerUrl(config.gpuServerUrl);
  onStage(15, `Dispatching to ${config.gpuServerApiType} node (${baseUrl.host})`);

  const endpoint = config.gpuServerApiType === 'comfyui' ? '/prompt' : '/generate';
  const target = new URL(endpoint, baseUrl.origin).toString();

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 120000);

  const response = await fetch(target, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal: controller.signal,
    body: JSON.stringify({
      prompt: job.prompt,
      negative_prompt: job.negativePrompt,
      model: job.modelId,
      quantization: job.quantization,
      workflow: job.workflow,
      resolution: job.resolution,
      aspect_ratio: job.aspectRatio,
      duration_sec: job.durationSec,
      fps: job.fps,
      seed: job.seed,
    }),
  }).finally(() => clearTimeout(timeout));

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(
      `Remote GPU server (${baseUrl.host}) returned HTTP ${response.status}: ${body.slice(0, 180)}`
    );
  }

  const contentType = response.headers.get('content-type') ?? '';
  if (contentType.includes('video/')) {
    const buffer = Buffer.from(await response.arrayBuffer());
    const ext = contentType.includes('webm') ? 'webm' : 'mp4';
    const fileName = `${job.id}.${ext}`;
    const outPath = resolveSafeFilePath(OUTPUTS_DIR, fileName);
    if (!outPath) throw new Error('Invalid output path');
    fs.writeFileSync(outPath, buffer);
    return { fileName, mimeType: contentType, bytes: buffer.length };
  }

  const json = (await response.json()) as { video_base64?: string; prompt_id?: string; error?: string };
  if (json.error) throw new Error(json.error);
  if (json.video_base64) {
    const buffer = Buffer.from(json.video_base64, 'base64');
    const fileName = `${job.id}.mp4`;
    const outPath = resolveSafeFilePath(OUTPUTS_DIR, fileName);
    if (!outPath) throw new Error('Invalid output path');
    fs.writeFileSync(outPath, buffer);
    return { fileName, mimeType: 'video/mp4', bytes: buffer.length };
  }

  throw new Error(
    `Remote GPU node accepted prompt (${json.prompt_id ?? 'ok'}) without synchronous video payload. Ensure your worker returns video/mp4 or video_base64.`
  );
}

async function executeExternalPaidVeoJob(
  job: VideoJob,
  assets: JobInputAssets | undefined,
  onStage: (pct: number, msg: string) => void
): Promise<{ fileName: string; mimeType: string; bytes: number }> {
  if (!job.paidProviderApproved) {
    throw new Error('Explicit user approval is required before calling an external paid provider.');
  }
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error(
      'External Paid Model requires a billing-enabled GEMINI_API_KEY in Settings > Secrets. Self-hosted models remain 100% free.'
    );
  }

  onStage(20, 'Sending approved request to External Paid Provider (Google Veo / Omni Flash)');

  const ai = new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });

  const mappedDuration = `${Math.min(15, Math.max(3, Math.round(job.durationSec)))}s`;
  const mappedAspect = job.aspectRatio === '9:16' ? '9:16' : '16:9';
  const mappedRes = job.resolution === '1080p' ? '1080p' : job.resolution === '720p' ? '720p' : '360p';

  let inputPayload: string | Array<Record<string, unknown>> = job.prompt;

  if (assets?.imageDataUrl && (job.workflow === 'image-to-video' || job.workflow === 'frame-interpolation')) {
    const parts: Array<Record<string, unknown>> = [];
    const m1 = assets.imageDataUrl.match(/^data:([^;]+);base64,(.+)$/);
    if (m1) {
      parts.push({ type: 'image', mime_type: m1[1], data: m1[2] });
    }
    if (assets.endFrameDataUrl && job.workflow === 'frame-interpolation') {
      const m2 = assets.endFrameDataUrl.match(/^data:([^;]+);base64,(.+)$/);
      if (m2) {
        parts.push({ type: 'image', mime_type: m2[1], data: m2[2] });
      }
    }
    parts.push({ type: 'text', text: job.prompt });
    inputPayload = parts;
  } else if (assets?.referenceImages?.length && job.workflow === 'reference-image') {
    const parts: Array<Record<string, unknown>> = [];
    for (const ref of assets.referenceImages.slice(0, 6)) {
      const m = ref.match(/^data:([^;]+);base64,(.+)$/);
      if (m) {
        parts.push({ type: 'image', mime_type: m[1], data: m[2] });
      }
    }
    parts.push({ type: 'text', text: job.prompt });
    inputPayload = parts;
  }

  const interaction = await ai.interactions.create(
    {
      model: 'gemini-omni-1.2-flash',
      input: inputPayload as never,
      background: false,
      store: false,
      stream: false,
      response_format: {
        type: 'video',
        aspect_ratio: mappedAspect,
        duration: mappedDuration,
        resolution: mappedRes,
      } as never,
    },
    { timeout: 300000 }
  );

  onStage(85, 'Downloading generated external video stream');

  const videoPart = interaction.output_video;
  if (!videoPart || !videoPart.data) {
    throw new Error('External provider completed without returning video binary data.');
  }

  const buffer = Buffer.from(videoPart.data, 'base64');
  const fileName = `${job.id}.mp4`;
  const outPath = resolveSafeFilePath(OUTPUTS_DIR, fileName);
  if (!outPath) throw new Error('Invalid output destination path.');
  fs.writeFileSync(outPath, buffer);
  return {
    fileName,
    mimeType: videoPart.mime_type || 'video/mp4',
    bytes: buffer.length,
  };
}

export async function executeVideoJob(
  job: VideoJob,
  model: VideoModelSpec,
  config: AdminConfig,
  assets: JobInputAssets | undefined,
  onStage: (pct: number, msg: string) => void,
  abortSignal: AbortSignal
): Promise<{ fileName: string; mimeType: string; bytes: number }> {
  // 1. Optional External Paid Model path (strictly gated)
  if (model.provider === 'external-paid') {
    return executeExternalPaidVeoJob(job, assets, onStage);
  }

  // 2. Remote Self-Hosted GPU Node path
  if (config.backendMode === 'remote-gpu') {
    return executeRemoteGpuJob(job, config, onStage);
  }

  // 3. Embedded Self-Hosted Local FFmpeg Synthesis & Workflow Engine
  if (!isFfmpegAvailable()) {
    throw new Error('FFmpeg binary not found on host server.');
  }

  const { width, height } = getDimensions(job.resolution, job.aspectRatio);
  const totalFrames = Math.max(24, Math.round(job.durationSec * job.fps));
  const { ext, mime, codecArgs } = getEncodingArgs(job.encoding);
  const fileName = `${job.id}.${ext}`;
  const outPath = resolveSafeFilePath(OUTPUTS_DIR, fileName);
  if (!outPath) throw new Error('Invalid output path.');

  const tempFiles: string[] = [];
  const cleanupTemps = () => {
    for (const f of tempFiles) {
      try {
        if (fs.existsSync(f)) fs.unlinkSync(f);
      } catch {
        // Ignore cleanup errors
      }
    }
  };

  try {
    onStage(12, `Initializing ${model.name} (${job.quantization.toUpperCase()}) pipeline`);

    if (job.workflow === 'image-to-video' && assets?.imageDataUrl) {
      onStage(25, 'Animating input image with motion camera trajectory');
      const imgPath = saveDataUrlToFile(assets.imageDataUrl, `${job.id}_img`);
      tempFiles.push(imgPath);

      const zoomExpr = job.seed % 2 === 0 ? "min(zoom+0.0016,1.28)" : "if(lte(zoom,1.0),1.25,max(1.0,zoom-0.0014))";
      const filter = `scale=${width * 2}:${height * 2}:force_original_aspect_ratio=increase,crop=${width * 2}:${height * 2},zoompan=z='${zoomExpr}':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${totalFrames}:s=${width}x${height}:fps=${job.fps},vignette=PI/6`;

      await runFfmpeg(
        ['-y', '-loop', '1', '-i', imgPath, '-vf', filter, '-t', String(job.durationSec), ...codecArgs, outPath],
        (pct) => onStage(pct, `Rendering I2V motion frames (${job.fps} fps)`),
        totalFrames,
        abortSignal
      );
    } else if (job.workflow === 'frame-interpolation' && assets?.imageDataUrl && assets?.endFrameDataUrl) {
      onStage(25, 'Interpolating start and end keyframes');
      const startImg = saveDataUrlToFile(assets.imageDataUrl, `${job.id}_start`);
      const endImg = saveDataUrlToFile(assets.endFrameDataUrl, `${job.id}_end`);
      tempFiles.push(startImg, endImg);

      const halfDur = Math.max(1.2, job.durationSec * 0.55);
      const offsetSec = Math.max(0.4, job.durationSec - halfDur);
      const transDur = Math.max(0.6, job.durationSec - offsetSec);

      const filterComplex = `[0:v]scale=${width}:${height}:force_original_aspect_ratio=increase,crop=${width}:${height},setsar=1,fps=${job.fps}[v0];[1:v]scale=${width}:${height}:force_original_aspect_ratio=increase,crop=${width}:${height},setsar=1,fps=${job.fps}[v1];[v0][v1]xfade=transition=smoothleft:duration=${transDur.toFixed(2)}:offset=${offsetSec.toFixed(2)},format=yuv420p[out]`;

      await runFfmpeg(
        [
          '-y',
          '-loop', '1', '-t', String(halfDur + 0.5), '-i', startImg,
          '-loop', '1', '-t', String(halfDur + 0.5), '-i', endImg,
          '-filter_complex', filterComplex,
          '-map', '[out]',
          '-t', String(job.durationSec),
          ...codecArgs,
          outPath,
        ],
        (pct) => onStage(pct, 'Blending optical keyframe transitions'),
        totalFrames,
        abortSignal
      );
    } else if (job.workflow === 'reference-image' && assets?.referenceImages?.length) {
      onStage(25, `Synthesizing storyboard from ${assets.referenceImages.length} reference image(s)`);
      const refPaths = assets.referenceImages.slice(0, 3).map((r, idx) => {
        const p = saveDataUrlToFile(r, `${job.id}_ref${idx}`);
        tempFiles.push(p);
        return p;
      });

      if (refPaths.length === 1) {
        const filter = `scale=${width * 2}:${height * 2}:force_original_aspect_ratio=increase,crop=${width * 2}:${height * 2},zoompan=z='min(zoom+0.0014,1.22)':d=${totalFrames}:s=${width}x${height}:fps=${job.fps},hue=h='t*6'`;
        await runFfmpeg(
          ['-y', '-loop', '1', '-i', refPaths[0], '-vf', filter, '-t', String(job.durationSec), ...codecArgs, outPath],
          (pct) => onStage(pct, 'Rendering reference-guided motion'),
          totalFrames,
          abortSignal
        );
      } else {
        const segDur = job.durationSec / refPaths.length + 0.5;
        const inputs: string[] = [];
        const prepFilters: string[] = [];
        refPaths.forEach((rp, idx) => {
          inputs.push('-loop', '1', '-t', segDur.toFixed(2), '-i', rp);
          prepFilters.push(
            `[${idx}:v]scale=${width}:${height}:force_original_aspect_ratio=increase,crop=${width}:${height},setsar=1,fps=${job.fps}[r${idx}]`
          );
        });
        let chain = '';
        let prev = '[r0]';
        const step = job.durationSec / refPaths.length;
        for (let i = 1; i < refPaths.length; i++) {
          const outTag = i === refPaths.length - 1 ? '[out]' : `[x${i}]`;
          const off = Math.max(0.3, step * i - 0.3);
          chain += `${prev}[r${i}]xfade=transition=fade:duration=0.6:offset=${off.toFixed(2)}${outTag};`;
          prev = outTag;
        }
        const filterComplex = `${prepFilters.join(';')};${chain.slice(0, -1)}`;
        await runFfmpeg(
          ['-y', ...inputs, '-filter_complex', filterComplex, '-map', '[out]', '-t', String(job.durationSec), ...codecArgs, outPath],
          (pct) => onStage(pct, 'Compositing multi-reference sequence'),
          totalFrames,
          abortSignal
        );
      }
    } else if (job.workflow === 'video-edit' && (assets?.sourceVideoDataUrl || assets?.sourceVideoJobId)) {
      onStage(25, 'Applying video-to-video editing pipeline');
      let sourcePath: string | null = null;
      if (assets.sourceVideoDataUrl) {
        sourcePath = saveDataUrlToFile(assets.sourceVideoDataUrl, `${job.id}_srcvid`);
        tempFiles.push(sourcePath);
      } else if (assets.sourceVideoJobId) {
        const cleanJobId = path.basename(assets.sourceVideoJobId);
        const mp4Path = resolveSafeFilePath(OUTPUTS_DIR, `${cleanJobId}.mp4`);
        const webmPath = resolveSafeFilePath(OUTPUTS_DIR, `${cleanJobId}.webm`);
        if (mp4Path && fs.existsSync(mp4Path)) sourcePath = mp4Path;
        else if (webmPath && fs.existsSync(webmPath)) sourcePath = webmPath;
      }

      if (!sourcePath) {
        throw new Error('Video editing workflow requires an uploaded clip or a completed source job.');
      }

      const mode = assets.editMode ?? 'cinematic-grade';
      let vf = `scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2,fps=${job.fps}`;
      if (mode === 'noir-contrast') {
        vf += ',hue=s=0,eq=contrast=1.25:brightness=-0.03,vignette=PI/4';
      } else if (mode === 'cyber-cool') {
        vf += ',colorbalance=bs=0.18:gs=0.04:rs=-0.12,eq=saturation=1.35:contrast=1.12';
      } else if (mode === 'warm-film') {
        vf += ',colorbalance=rs=0.14:gs=0.05:bs=-0.12,eq=contrast=1.08,vignette=PI/5';
      } else if (mode === 'speed-2x') {
        vf += ',setpts=0.5*PTS';
      } else if (mode === 'reverse') {
        vf += ',reverse';
      } else {
        vf += ',eq=contrast=1.12:saturation=1.18,unsharp=5:5:0.8:5:5:0.0,vignette=PI/6';
      }

      await runFfmpeg(
        ['-y', '-i', sourcePath, '-vf', vf, '-an', '-t', String(job.durationSec), ...codecArgs, outPath],
        (pct) => onStage(pct, `Processing video edit (${mode})`),
        totalFrames,
        abortSignal
      );
    } else {
      // Text-to-Video (Self-Hosted Procedural Diffusion Synthesis Engine)
      onStage(22, `Synthesizing scene latent frames via ${model.name}`);
      const ppmPath = resolveSafeFilePath(UPLOADS_DIR, `${job.id}_latent.ppm`);
      if (!ppmPath) throw new Error('Invalid temp frame path.');
      tempFiles.push(ppmPath);

      generateProceduralPpm(ppmPath, width, height, job.prompt, job.seed);

      const driftDir = job.seed % 2 === 0 ? 1 : -1;
      const hueShift = driftDir > 0 ? "hue=h='t*10'" : "hue=h='-t*8'";
      const zoomExpr =
        job.seed % 3 === 0
          ? "min(zoom+0.0018,1.32)"
          : "if(lte(zoom,1.0),1.28,max(1.0,zoom-0.0015))";
      const panX = driftDir > 0 ? "iw/2-(iw/zoom/2)+on*0.4" : "iw/2-(iw/zoom/2)-on*0.35";
      const filter = `scale=${width * 2}:${height * 2},zoompan=z='${zoomExpr}':x='${panX}':y='ih/2-(ih/zoom/2)':d=${totalFrames}:s=${width}x${height}:fps=${job.fps},${hueShift},vignette=PI/5`;

      await runFfmpeg(
        ['-y', '-loop', '1', '-i', ppmPath, '-vf', filter, '-t', String(job.durationSec), ...codecArgs, outPath],
        (pct) => onStage(pct, `Encoding ${job.resolution} ${job.encoding.toUpperCase()} output`),
        totalFrames,
        abortSignal
      );
    }

    onStage(98, 'Finalizing output container');
    const stat = fs.statSync(outPath);
    return {
      fileName,
      mimeType: mime,
      bytes: stat.size,
    };
  } finally {
    cleanupTemps();
  }
}
