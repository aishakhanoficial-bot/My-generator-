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
import {
  getAmbientExprForTheme,
  planStoryboardAndVoiceover,
  renderSceneSvg,
  SceneStoryboard,
} from './sceneArt.js';

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
        version: 'v2-av-scenes',
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
  audioArgs: string[];
} {
  switch (encoding) {
    case 'h264-hq':
      return {
        ext: 'mp4',
        mime: 'video/mp4',
        codecArgs: ['-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p', '-movflags', '+faststart'],
        audioArgs: ['-c:a', 'aac', '-b:a', '160k', '-ac', '2', '-ar', '44100'],
      };
    case 'hevc':
      return {
        ext: 'mp4',
        mime: 'video/mp4',
        codecArgs: ['-c:v', 'libx265', '-preset', 'fast', '-crf', '24', '-pix_fmt', 'yuv420p', '-tag:v', 'hvc1', '-movflags', '+faststart'],
        audioArgs: ['-c:a', 'aac', '-b:a', '128k', '-ac', '2', '-ar', '44100'],
      };
    case 'vp9':
      return {
        ext: 'webm',
        mime: 'video/webm',
        codecArgs: ['-c:v', 'libvpx-vp9', '-crf', '30', '-b:v', '0', '-deadline', 'realtime', '-cpu-used', '4', '-pix_fmt', 'yuv420p'],
        audioArgs: ['-c:a', 'libopus', '-b:a', '96k', '-ac', '2', '-ar', '48000'],
      };
    case 'h264-fast':
    default:
      return {
        ext: 'mp4',
        mime: 'video/mp4',
        codecArgs: ['-c:v', 'libx264', '-preset', 'veryfast', '-crf', '23', '-pix_fmt', 'yuv420p', '-movflags', '+faststart'],
        audioArgs: ['-c:a', 'aac', '-b:a', '128k', '-ac', '2', '-ar', '44100'],
      };
  }
}

function probeHasAudio(filePath: string): boolean {
  try {
    const out = execFileSync(
      'ffprobe',
      ['-v', 'error', '-select_streams', 'a', '-show_entries', 'stream=index', '-of', 'csv=p=0', filePath],
      { encoding: 'utf8', timeout: 5000 }
    );
    return out.trim().length > 0;
  } catch {
    return false;
  }
}

async function synthesizeJobAudioWav(params: {
  job: VideoJob;
  storyboard: SceneStoryboard;
  geminiVoiceWavPath: string | null;
  tempFiles: string[];
  abortSignal: AbortSignal;
}): Promise<string> {
  const { job, storyboard, geminiVoiceWavPath, tempFiles, abortSignal } = params;
  const audioOutPath = resolveSafeFilePath(UPLOADS_DIR, `${job.id}_audio.wav`);
  if (!audioOutPath) throw new Error('Invalid audio output path.');
  tempFiles.push(audioOutPath);

  const dur = job.durationSec;
  const fadeOutStart = Math.max(0.2, dur - 0.8);
  const ambientExpr = getAmbientExprForTheme(storyboard.theme);

  // 1. If Gemini TTS produced a complete WAV voiceover, mix it with the soft stereo ambient bed
  if (geminiVoiceWavPath && fs.existsSync(geminiVoiceWavPath)) {
    try {
      await runFfmpeg(
        [
          '-y',
          '-i', geminiVoiceWavPath,
          '-f', 'lavfi', '-t', String(dur), '-i', `aevalsrc=${ambientExpr}:s=44100:c=stereo`,
          '-filter_complex',
          `[0:a]aresample=44100,aformat=channel_layouts=stereo,volume=1.35,apad[vo];[1:a]afade=t=in:st=0:d=0.5,afade=t=out:st=${fadeOutStart.toFixed(2)}:d=0.8[bg];[vo][bg]amix=inputs=2:duration=shortest:normalize=0[aout]`,
          '-map', '[aout]',
          '-t', String(dur),
          '-c:a', 'pcm_s16le',
          audioOutPath,
        ],
        undefined,
        undefined,
        abortSignal
      );
      return audioOutPath;
    } catch {
      // Fall through to local flite + ambient synthesis
    }
  }

  // 2. Local FFmpeg flite voice synthesis + mood-matched stereo ambient bed
  const speakText = storyboard.speakableAsciiFallback.trim();
  if (speakText.length > 0) {
    const txtPath = resolveSafeFilePath(UPLOADS_DIR, `${job.id}_voice.txt`);
    if (txtPath) {
      tempFiles.push(txtPath);
      fs.writeFileSync(txtPath, speakText, 'utf8');
      const fliteVoice =
        storyboard.voiceName === 'Charon' || storyboard.voiceName === 'Puck' ? 'rms' : 'slt';
      const escapedTxtPath = txtPath.replace(/\\/g, '/').replace(/:/g, '\\:').replace(/'/g, "\\'");
      try {
        await runFfmpeg(
          [
            '-y',
            '-f', 'lavfi', '-i', `flite=textfile='${escapedTxtPath}':voice=${fliteVoice}`,
            '-f', 'lavfi', '-t', String(dur), '-i', `aevalsrc=${ambientExpr}:s=44100:c=stereo`,
            '-filter_complex',
            `[0:a]aresample=44100,aformat=channel_layouts=stereo,volume=1.55,apad[vo];[1:a]afade=t=in:st=0:d=0.5,afade=t=out:st=${fadeOutStart.toFixed(2)}:d=0.8[bg];[vo][bg]amix=inputs=2:duration=shortest:normalize=0[aout]`,
            '-map', '[aout]',
            '-t', String(dur),
            '-c:a', 'pcm_s16le',
            audioOutPath,
          ],
          undefined,
          undefined,
          abortSignal
        );
        return audioOutPath;
      } catch {
        // Fall through to pure ambient bed
      }
    }
  }

  // 3. Guaranteed stereo ambient bed fallback (never silent)
  await runFfmpeg(
    [
      '-y',
      '-f', 'lavfi', '-t', String(dur), '-i', `aevalsrc=${ambientExpr}:s=44100:c=stereo`,
      '-af', `afade=t=in:st=0:d=0.5,afade=t=out:st=${fadeOutStart.toFixed(2)}:d=0.8`,
      '-t', String(dur),
      '-c:a', 'pcm_s16le',
      audioOutPath,
    ],
    undefined,
    undefined,
    abortSignal
  );
  return audioOutPath;
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
  const { ext, mime, codecArgs, audioArgs } = getEncodingArgs(job.encoding);
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
    onStage(10, `Initializing ${model.name} (${job.quantization.toUpperCase()}) pipeline`);

    const geminiVoiceOut = resolveSafeFilePath(UPLOADS_DIR, `${job.id}_gemini_voice.wav`);
    if (geminiVoiceOut) tempFiles.push(geminiVoiceOut);

    const allowGemini = !job.batchTotal || job.batchTotal <= 5;
    onStage(16, 'Planning visual storyboard and spoken voiceover');
    const { storyboard, voiceWavPath } = await planStoryboardAndVoiceover({
      prompt: job.prompt,
      durationSec: job.durationSec,
      jobId: job.id,
      voiceOutPath: geminiVoiceOut || path.join(UPLOADS_DIR, `${job.id}_gemini_voice.wav`),
      allowGemini,
    });

    onStage(24, voiceWavPath ? 'Mixing Gemini AI voiceover + ambient audio' : 'Synthesizing voiceover narration + ambient audio');
    const audioWavPath = await synthesizeJobAudioWav({
      job,
      storyboard,
      geminiVoiceWavPath: voiceWavPath,
      tempFiles,
      abortSignal,
    });

    if (job.workflow === 'image-to-video' && assets?.imageDataUrl) {
      onStage(32, 'Animating input image with motion camera trajectory + audio');
      const imgPath = saveDataUrlToFile(assets.imageDataUrl, `${job.id}_img`);
      tempFiles.push(imgPath);

      const zoomExpr = job.seed % 2 === 0 ? 'min(zoom+0.0016,1.24)' : 'if(lte(zoom,1.0),1.22,max(1.0,zoom-0.0014))';
      const filter = `[0:v]scale=${width * 2}:${height * 2}:force_original_aspect_ratio=increase,crop=${width * 2}:${height * 2},zoompan=z='${zoomExpr}':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${totalFrames}:s=${width}x${height}:fps=${job.fps},vignette=PI/6,format=yuv420p[vout]`;

      await runFfmpeg(
        [
          '-y',
          '-loop', '1', '-i', imgPath,
          '-i', audioWavPath,
          '-filter_complex', filter,
          '-map', '[vout]', '-map', '1:a',
          '-t', String(job.durationSec),
          ...codecArgs,
          ...audioArgs,
          outPath,
        ],
        (pct) => onStage(pct, `Rendering I2V motion frames (${job.fps} fps)`),
        totalFrames,
        abortSignal
      );
    } else if (job.workflow === 'frame-interpolation' && assets?.imageDataUrl && assets?.endFrameDataUrl) {
      onStage(32, 'Interpolating start and end keyframes + audio');
      const startImg = saveDataUrlToFile(assets.imageDataUrl, `${job.id}_start`);
      const endImg = saveDataUrlToFile(assets.endFrameDataUrl, `${job.id}_end`);
      tempFiles.push(startImg, endImg);

      const halfDur = Math.max(1.2, job.durationSec * 0.55);
      const offsetSec = Math.max(0.4, job.durationSec - halfDur);
      const transDur = Math.max(0.6, job.durationSec - offsetSec);

      const filterComplex = `[0:v]scale=${width}:${height}:force_original_aspect_ratio=increase,crop=${width}:${height},setsar=1,fps=${job.fps}[v0];[1:v]scale=${width}:${height}:force_original_aspect_ratio=increase,crop=${width}:${height},setsar=1,fps=${job.fps}[v1];[v0][v1]xfade=transition=smoothleft:duration=${transDur.toFixed(2)}:offset=${offsetSec.toFixed(2)},format=yuv420p[vout]`;

      await runFfmpeg(
        [
          '-y',
          '-loop', '1', '-t', String(halfDur + 0.5), '-i', startImg,
          '-loop', '1', '-t', String(halfDur + 0.5), '-i', endImg,
          '-i', audioWavPath,
          '-filter_complex', filterComplex,
          '-map', '[vout]', '-map', '2:a',
          '-t', String(job.durationSec),
          ...codecArgs,
          ...audioArgs,
          outPath,
        ],
        (pct) => onStage(pct, 'Blending optical keyframe transitions'),
        totalFrames,
        abortSignal
      );
    } else if (job.workflow === 'reference-image' && assets?.referenceImages?.length) {
      onStage(32, `Synthesizing storyboard from ${assets.referenceImages.length} reference image(s) + audio`);
      const refPaths = assets.referenceImages.slice(0, 3).map((r, idx) => {
        const p = saveDataUrlToFile(r, `${job.id}_ref${idx}`);
        tempFiles.push(p);
        return p;
      });

      if (refPaths.length === 1) {
        const filter = `[0:v]scale=${width * 2}:${height * 2}:force_original_aspect_ratio=increase,crop=${width * 2}:${height * 2},zoompan=z='min(zoom+0.0014,1.22)':d=${totalFrames}:s=${width}x${height}:fps=${job.fps},format=yuv420p[vout]`;
        await runFfmpeg(
          [
            '-y',
            '-loop', '1', '-i', refPaths[0],
            '-i', audioWavPath,
            '-filter_complex', filter,
            '-map', '[vout]', '-map', '1:a',
            '-t', String(job.durationSec),
            ...codecArgs,
            ...audioArgs,
            outPath,
          ],
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
        const audioInputIdx = refPaths.length;
        inputs.push('-i', audioWavPath);

        let chain = '';
        let prev = '[r0]';
        const step = job.durationSec / refPaths.length;
        for (let i = 1; i < refPaths.length; i++) {
          const outTag = i === refPaths.length - 1 ? '[vout]' : `[x${i}]`;
          const off = Math.max(0.3, step * i - 0.3);
          chain += `${prev}[r${i}]xfade=transition=fade:duration=0.6:offset=${off.toFixed(2)}${outTag};`;
          prev = outTag;
        }
        const filterComplex = `${prepFilters.join(';')};${chain.slice(0, -1)}`;
        await runFfmpeg(
          [
            '-y',
            ...inputs,
            '-filter_complex', filterComplex,
            '-map', '[vout]', '-map', `${audioInputIdx}:a`,
            '-t', String(job.durationSec),
            ...codecArgs,
            ...audioArgs,
            outPath,
          ],
          (pct) => onStage(pct, 'Compositing multi-reference sequence'),
          totalFrames,
          abortSignal
        );
      }
    } else if (job.workflow === 'video-edit' && (assets?.sourceVideoDataUrl || assets?.sourceVideoJobId)) {
      onStage(32, 'Applying video-to-video editing pipeline');
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

      const sourceHasAudio = probeHasAudio(sourcePath);
      if (sourceHasAudio) {
        const af =
          mode === 'speed-2x'
            ? '-af atempo=2.0'
            : mode === 'reverse'
            ? '-af areverse'
            : '';
        const audioFilterArgs = af ? af.split(' ') : [];
        await runFfmpeg(
          [
            '-y',
            '-i', sourcePath,
            '-vf', vf,
            ...audioFilterArgs,
            '-map', '0:v', '-map', '0:a',
            '-t', String(job.durationSec),
            ...codecArgs,
            ...audioArgs,
            outPath,
          ],
          (pct) => onStage(pct, `Processing video edit (${mode})`),
          totalFrames,
          abortSignal
        );
      } else {
        await runFfmpeg(
          [
            '-y',
            '-i', sourcePath,
            '-i', audioWavPath,
            '-vf', vf,
            '-map', '0:v', '-map', '1:a',
            '-t', String(job.durationSec),
            ...codecArgs,
            ...audioArgs,
            outPath,
          ],
          (pct) => onStage(pct, `Processing video edit (${mode}) + audio`),
          totalFrames,
          abortSignal
        );
      }
    } else {
      // Text-to-Video: Multi-scene illustrated SVG storyboard + motion transitions + audio
      onStage(34, `Rendering 3 illustrated scenes for ${storyboard.theme}`);

      const scenePngs: string[] = [];
      for (const idx of [0, 1, 2] as const) {
        const svgPath = resolveSafeFilePath(UPLOADS_DIR, `${job.id}_scene${idx}.svg`);
        const pngPath = resolveSafeFilePath(UPLOADS_DIR, `${job.id}_scene${idx}.png`);
        if (!svgPath || !pngPath) throw new Error('Invalid temp scene path.');
        tempFiles.push(svgPath, pngPath);

        const svgMarkup = renderSceneSvg({
          theme: storyboard.theme,
          sceneIndex: idx,
          width,
          height,
          caption: storyboard.sceneCaptions[idx],
          seed: job.seed,
        });
        fs.writeFileSync(svgPath, svgMarkup, 'utf8');

        await runFfmpeg(['-y', '-i', svgPath, '-frames:v', '1', pngPath], undefined, undefined, abortSignal);
        scenePngs.push(pngPath);
      }

      onStage(52, `Compositing scenes & encoding ${job.resolution} ${job.encoding.toUpperCase()} + audio`);

      const fadeDur = Math.min(0.6, job.durationSec * 0.16);
      const step = job.durationSec / 3;
      const segDur0 = step + fadeDur;
      const segDur1 = step + fadeDur;
      const segDur2 = Math.max(1.0, job.durationSec - step * 2 + fadeDur);
      const off1 = Math.max(0.4, step - fadeDur * 0.5);
      const off2 = Math.max(off1 + 0.4, step * 2 - fadeDur * 0.5);

      const segFrames0 = Math.max(12, Math.round(segDur0 * job.fps));
      const segFrames1 = Math.max(12, Math.round(segDur1 * job.fps));
      const segFrames2 = Math.max(12, Math.round(segDur2 * job.fps));

      const sw = Math.round(width * 1.12 / 2) * 2;
      const sh = Math.round(height * 1.12 / 2) * 2;

      const filterComplex = [
        `[0:v]scale=${sw}:${sh},zoompan=z='min(zoom+0.0012,1.10)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${segFrames0}:s=${width}x${height}:fps=${job.fps},setsar=1[v0]`,
        `[1:v]scale=${sw}:${sh},zoompan=z='if(lte(zoom,1.0),1.10,max(1.0,zoom-0.0010))':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${segFrames1}:s=${width}x${height}:fps=${job.fps},setsar=1[v1]`,
        `[2:v]scale=${sw}:${sh},zoompan=z='min(zoom+0.0012,1.10)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${segFrames2}:s=${width}x${height}:fps=${job.fps},setsar=1[v2]`,
        `[v0][v1]xfade=transition=fade:duration=${fadeDur.toFixed(2)}:offset=${off1.toFixed(2)}[x1]`,
        `[x1][v2]xfade=transition=smoothleft:duration=${fadeDur.toFixed(2)}:offset=${off2.toFixed(2)},vignette=PI/6,format=yuv420p[vout]`,
      ].join(';');

      await runFfmpeg(
        [
          '-y',
          '-loop', '1', '-t', segDur0.toFixed(2), '-i', scenePngs[0],
          '-loop', '1', '-t', segDur1.toFixed(2), '-i', scenePngs[1],
          '-loop', '1', '-t', segDur2.toFixed(2), '-i', scenePngs[2],
          '-i', audioWavPath,
          '-filter_complex', filterComplex,
          '-map', '[vout]', '-map', '3:a',
          '-t', String(job.durationSec),
          ...codecArgs,
          ...audioArgs,
          outPath,
        ],
        (pct) => onStage(pct, `Encoding ${job.resolution} ${job.encoding.toUpperCase()} with audio`),
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
