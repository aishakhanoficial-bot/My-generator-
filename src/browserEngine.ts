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

type BrowserSceneTheme =
  | 'spiritual-twilight'
  | 'ocean'
  | 'desert'
  | 'forest'
  | 'mountain'
  | 'cyber'
  | 'cosmos'
  | 'sunset'
  | 'studio';

function detectBrowserTheme(prompt: string): BrowserSceneTheme {
  const p = prompt.toLowerCase();
  if (
    /آخرت|تیاری|قبر|جنت|نماز|مسجد|قرآن|دعا|اسلام|اللہ|رمضان|موت|عبادت|ایمان|akhirat|hereafter|mosque|islamic|prayer|quran|crescent|lantern|ramadan|eid|dua|eternity|soul|faith|heaven|spiritual/.test(
      p
    )
  ) {
    return 'spiritual-twilight';
  }
  if (/ocean|sea|water|whale|wave|underwater|coral|jellyfish|beach|river|سمندر|لہر|پانی/.test(p)) {
    return 'ocean';
  }
  if (/desert|sand|dune|oasis|camel|sahara|pyramid|صحرا|ریت/.test(p)) return 'desert';
  if (/forest|jungle|moss|tree|pine|nature|garden|leaf|wood|جنگل|درخت/.test(p)) return 'forest';
  if (/mountain|snow|alpine|peak|cliff|valley|aurora|waterfall|پہاڑ|برف/.test(p)) return 'mountain';
  if (/cyber|neon|tokyo|city|rain|futuristic|synth|street|building|شہر|رات/.test(p)) return 'cyber';
  if (/space|cosmos|galaxy|nebula|star|planet|astronaut|moon|universe|آسمان|ستارے|چاند/.test(p)) {
    return 'cosmos';
  }
  if (/sunset|sunrise|dawn|golden hour|amber|fire|lava|candle|غروب|طلوع|سورج/.test(p)) return 'sunset';
  return 'studio';
}

function cleanBrowserCaption(rawPrompt: string): string {
  const cleaned = rawPrompt
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, ' ')
    .replace(/\b(veo\s*3|veo|sora|runway|master\s*prompt|prompt)\b/gi, ' ')
    .replace(/\b(duration|aspect\s*ratio|resolution|camera|lighting|style)\s*[:：]\s*[^|\n]+/gi, ' ')
    .replace(
      /\b(exactly\s*\d+\s*seconds?|vertical\s*9:16|horizontal\s*16:9|square\s*1:1|9:16|16:9|1:1|ultra\s*realistic|photorealistic|cinematic\s*8k|8k|4k)\b/gi,
      ' '
    )
    .replace(/[|–—]+/g, ' · ')
    .replace(/\s*·\s*(·\s*)+/g, ' · ')
    .replace(/\s+/g, ' ')
    .replace(/^[\s·\-:,]+|[\s·\-:,]+$/g, '')
    .trim();
  return cleaned || 'OpenFrame Studio';
}

function getBrowserPalette(theme: BrowserSceneTheme) {
  switch (theme) {
    case 'spiritual-twilight':
      return {
        top: '#060919',
        mid: '#182449',
        bottom: '#b45309',
        glow: '#fde68a',
        accent: '#fbbf24',
        silBack: '#141b33',
        silMid: '#0d1326',
        silFront: '#060914',
      };
    case 'ocean':
      return {
        top: '#071b34',
        mid: '#0e4c73',
        bottom: '#14b8a6',
        glow: '#67e8f9',
        accent: '#2dd4bf',
        silBack: '#0a3352',
        silMid: '#07243b',
        silFront: '#041422',
      };
    case 'desert':
      return {
        top: '#1f102b',
        mid: '#7c2d12',
        bottom: '#f59e0b',
        glow: '#fef08a',
        accent: '#fb923c',
        silBack: '#6b2710',
        silMid: '#431407',
        silFront: '#220903',
      };
    case 'forest':
      return {
        top: '#071c16',
        mid: '#114232',
        bottom: '#3f7d47',
        glow: '#bbf7d0',
        accent: '#4ade80',
        silBack: '#0d3326',
        silMid: '#082219',
        silFront: '#04120d',
      };
    case 'cyber':
      return {
        top: '#09091c',
        mid: '#2e1065',
        bottom: '#be185d',
        glow: '#22d3ee',
        accent: '#f472b6',
        silBack: '#1e1b4b',
        silMid: '#11102e',
        silFront: '#070718',
      };
    case 'cosmos':
      return {
        top: '#030510',
        mid: '#1e1b4b',
        bottom: '#4c1d95',
        glow: '#c4b5fd',
        accent: '#38bdf8',
        silBack: '#17153b',
        silMid: '#0e0c26',
        silFront: '#060514',
      };
    default:
      return {
        top: '#0b132b',
        mid: '#1c2541',
        bottom: '#3a506b',
        glow: '#bae6fd',
        accent: '#38bdf8',
        silBack: '#1b263b',
        silMid: '#111827',
        silFront: '#070b14',
      };
  }
}

function getThemeChordFreqs(theme: BrowserSceneTheme): number[] {
  switch (theme) {
    case 'spiritual-twilight':
      return [146.83, 220.0, 293.66, 349.23];
    case 'ocean':
      return [130.81, 196.0, 246.94, 329.63];
    case 'cyber':
      return [110.0, 164.81, 220.0, 261.63];
    case 'cosmos':
      return [185.0, 277.18, 369.99, 440.0];
    default:
      return [196.0, 293.66, 392.0, 493.88];
  }
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

  const theme = detectBrowserTheme(job.prompt);
  const pal = getBrowserPalette(theme);
  const cleanCaption = cleanBrowserCaption(job.prompt);
  const isRtl = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]/.test(cleanCaption);

  // Build real Web Audio API stereo soundscape track so exported WebM always includes audible audio
  let audioCtx: AudioContext | null = null;
  const videoStream = canvas.captureStream(job.fps);
  const combinedTracks: MediaStreamTrack[] = [...videoStream.getVideoTracks()];

  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (AudioCtx) {
      audioCtx = new AudioCtx();
      if (audioCtx.state === 'suspended') {
        await audioCtx.resume().catch(() => {});
      }
      const dest = audioCtx.createMediaStreamDestination();
      const masterGain = audioCtx.createGain();
      const now = audioCtx.currentTime;
      const playSec = Math.min(3.5, Math.max(1.5, job.durationSec * 0.45));
      masterGain.gain.setValueAtTime(0.001, now);
      masterGain.gain.exponentialRampToValueAtTime(0.16, now + 0.35);
      masterGain.gain.setValueAtTime(0.16, now + Math.max(0.4, playSec - 0.5));
      masterGain.gain.exponentialRampToValueAtTime(0.001, now + playSec);
      masterGain.connect(dest);

      const freqs = getThemeChordFreqs(theme);
      freqs.forEach((f, idx) => {
        if (!audioCtx) return;
        const osc = audioCtx.createOscillator();
        const g = audioCtx.createGain();
        osc.type = idx % 2 === 0 ? 'sine' : 'triangle';
        osc.frequency.setValueAtTime(f, now);
        g.gain.setValueAtTime(0.18 / (idx + 1), now);
        osc.connect(g);
        g.connect(masterGain);
        osc.start(now);
        osc.stop(now + playSec + 0.2);
      });

      const audioTracks = dest.stream.getAudioTracks();
      if (audioTracks.length > 0) {
        combinedTracks.push(...audioTracks);
      }
    }
  } catch {
    // Web Audio unavailable; fallback gracefully to video-only stream
  }

  const combinedStream = new MediaStream(combinedTracks);
  const mimeCandidates = [
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm;codecs=vp9',
    'video/webm;codecs=vp8',
    'video/webm',
    'video/mp4',
  ];
  const supportedMime =
    typeof MediaRecorder !== 'undefined'
      ? mimeCandidates.find((m) => MediaRecorder.isTypeSupported(m)) || 'video/webm'
      : 'video/webm';

  const recorder = new MediaRecorder(combinedStream, { mimeType: supportedMime });
  const chunks: BlobPart[] = [];
  recorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data);
  };

  const renderMs = Math.min(3200, Math.max(1500, job.durationSec * 400));
  const totalSteps = 30;

  const drawFrame = (tNorm: number) => {
    const w = canvas.width;
    const h = canvas.height;
    const minDim = Math.min(w, h);
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
      const scale = 1 + tNorm * 0.12;
      ctx.drawImage(refImgs[idx], (w - w * scale) / 2, (h - h * scale) / 2, w * scale, h * scale);
    } else {
      // Multi-scene illustrated Canvas renderer
      const sceneIdx = tNorm < 0.34 ? 0 : tNorm < 0.67 ? 1 : 2;
      const grad = ctx.createLinearGradient(0, 0, 0, h);
      grad.addColorStop(0, pal.top);
      grad.addColorStop(0.55, pal.mid);
      grad.addColorStop(1, pal.bottom);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);

      // Animated twinkling stars
      for (let i = 0; i < 36; i++) {
        const sx = (((job.seed * 19 + i * 137) % 96) / 100) * w;
        const sy = (((job.seed * 31 + i * 89) % 58) / 100) * h;
        const twinkle = 0.35 + 0.55 * Math.abs(Math.sin(tNorm * Math.PI * 2 + i));
        ctx.fillStyle = pal.glow;
        ctx.globalAlpha = twinkle;
        ctx.beginPath();
        ctx.arc(sx, sy, 1.4 + (i % 2), 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      const horizonY = h * (sceneIdx === 1 ? 0.64 : 0.68);
      const cx = w * 0.5;
      const glowY = sceneIdx === 1 ? h * 0.44 : horizonY - minDim * 0.08;
      const rg = ctx.createRadialGradient(cx, glowY, 0, cx, glowY, minDim * 0.48);
      rg.addColorStop(0, pal.glow);
      rg.addColorStop(0.5, pal.accent + '44');
      rg.addColorStop(1, 'transparent');
      ctx.fillStyle = rg;
      ctx.fillRect(0, 0, w, h);

      if (theme === 'spiritual-twilight') {
        if (sceneIdx === 0) {
          // Crescent moon + mosque domes silhouette
          const mx = w * 0.68;
          const my = h * 0.22;
          const mr = minDim * 0.08;
          ctx.fillStyle = '#fef3c7';
          ctx.beginPath();
          ctx.arc(mx, my, mr, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = pal.top;
          ctx.beginPath();
          ctx.arc(mx + mr * 0.34, my - mr * 0.24, mr * 0.88, 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = pal.silFront;
          const domeW = w * 0.42;
          const domeTop = horizonY - minDim * 0.2;
          ctx.beginPath();
          ctx.moveTo(cx - domeW / 2, horizonY + 16);
          ctx.quadraticCurveTo(cx, domeTop - minDim * 0.14, cx + domeW / 2, horizonY + 16);
          ctx.fill();
          ctx.fillRect(cx - domeW * 0.64, horizonY - minDim * 0.06, domeW * 1.28, h - horizonY + minDim * 0.08);
          // Minarets
          const minW = minDim * 0.036;
          const minTop = horizonY - minDim * 0.32;
          ctx.fillRect(cx - domeW * 0.66, minTop, minW, horizonY - minTop + 20);
          ctx.fillRect(cx + domeW * 0.66 - minW, minTop, minW, horizonY - minTop + 20);
        } else if (sceneIdx === 1) {
          // Glowing hanging lantern
          const lx = cx;
          const ly = h * 0.43 + Math.sin(tNorm * Math.PI * 2) * 6;
          const ls = minDim * 0.13;
          ctx.strokeStyle = pal.accent;
          ctx.lineWidth = 4;
          ctx.beginPath();
          ctx.moveTo(lx, 0);
          ctx.lineTo(lx, ly - ls * 0.45);
          ctx.stroke();
          ctx.fillStyle = pal.glow;
          ctx.fillRect(lx - ls * 0.48, ly - ls * 0.45, ls * 0.96, ls * 1.1);
          ctx.strokeRect(lx - ls * 0.48, ly - ls * 0.45, ls * 0.96, ls * 1.1);
        } else {
          // Golden dawn over reflective water
          ctx.fillStyle = '#fef3c7';
          ctx.beginPath();
          ctx.arc(cx, horizonY - minDim * 0.04, minDim * 0.11, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = pal.silMid;
          ctx.fillRect(0, horizonY, w, h - horizonY);
          ctx.fillStyle = pal.accent + '66';
          ctx.fillRect(cx - minDim * 0.18, horizonY + 24, minDim * 0.36, 8);
          ctx.fillRect(cx - minDim * 0.11, horizonY + 52, minDim * 0.22, 6);
        }
      } else {
        // Layered horizon & silhouettes for ocean, desert, forest, cyber, cosmos, studio
        ctx.fillStyle = pal.glow;
        ctx.globalAlpha = 0.85;
        ctx.beginPath();
        ctx.arc(w * (0.4 + tNorm * 0.2), horizonY - minDim * 0.12, minDim * 0.09, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;

        ctx.fillStyle = pal.silBack;
        ctx.beginPath();
        ctx.moveTo(0, horizonY + 30);
        ctx.lineTo(w * 0.25, horizonY - 70);
        ctx.lineTo(w * 0.55, horizonY + 20);
        ctx.lineTo(w * 0.8, horizonY - 85);
        ctx.lineTo(w, horizonY + 15);
        ctx.lineTo(w, h);
        ctx.lineTo(0, h);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = pal.silFront;
        ctx.fillRect(0, horizonY + 45, w, h - horizonY);
      }

      // Floating light motes
      for (let i = 0; i < 16; i++) {
        const px = (((job.seed * 23 + i * 113) % 92 + 4) / 100) * w;
        const py = (((job.seed * 41 + i * 79) % 70 + 10) / 100) * h - tNorm * 28;
        ctx.fillStyle = pal.glow;
        ctx.globalAlpha = 0.32;
        ctx.beginPath();
        ctx.arc(px, py, 2 + (i % 4), 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      // Frosted-glass bottom caption card showing clean prompt text
      const boxW = w * 0.86;
      const boxH = minDim * 0.15;
      const boxX = (w - boxW) / 2;
      const boxY = h - boxH - h * 0.07;
      ctx.fillStyle = 'rgba(2, 6, 23, 0.72)';
      ctx.strokeStyle = pal.accent + '66';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(boxX, boxY, boxW, boxH, 14);
      ctx.fill();
      ctx.stroke();

      const fontSize = Math.max(18, Math.round(minDim * 0.042));
      ctx.fillStyle = '#f8fafc';
      ctx.font = `bold ${fontSize}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.direction = isRtl ? 'rtl' : 'ltr';
      const label = cleanCaption.length > 48 ? `${cleanCaption.slice(0, 45).trim()}...` : cleanCaption;
      ctx.fillText(label, cx, boxY + boxH / 2, boxW - 28);
      ctx.direction = 'ltr';
    }
  };

  return new Promise((resolve, reject) => {
    const closeAudio = () => {
      if (audioCtx) {
        audioCtx.close().catch(() => {});
        audioCtx = null;
      }
    };

    const onAbort = () => {
      try {
        if (recorder.state !== 'inactive') recorder.stop();
      } catch {
        // Ignore
      }
      closeAudio();
      reject(new Error('Job cancelled by user.'));
    };

    if (signal.aborted) {
      onAbort();
      return;
    }
    signal.addEventListener('abort', onAbort, { once: true });

    recorder.onstop = () => {
      signal.removeEventListener('abort', onAbort);
      closeAudio();
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
      onProgress(pct, `Rendering scenes & audio in browser (${pct}%)`);
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

        const cacheKey = `v2:${job.workflow}:${job.prompt}:${job.modelId}:${job.resolution}:${job.aspectRatio}:${job.durationSec}:${job.seed}`;
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
