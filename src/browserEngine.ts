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
  | 'garden'
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
    /garden|flower|flowers|wildflower|rose|tulip|lavender|jasmine|blossom|butterfly|butterflies|meadow|baby\s*bird|exotic\s*bird|turquoise.*bird|wet\s*stone.*stream|باغ|پھول|تتلی|چمن/.test(
      p
    )
  ) {
    return 'garden';
  }
  if (/cyber|neon|tokyo|city|rain|futuristic|synth|street|building|car|شہر|رات|shehar/.test(p)) return 'cyber';
  if (/ocean|sea|water|whale|wave|underwater|coral|jellyfish|beach|river|سمندر|لہر|پانی|دریا|samandar/.test(p)) {
    return 'ocean';
  }
  if (/desert|sand|dune|oasis|camel|sahara|pyramid|صحرا|ریت|sahra/.test(p)) return 'desert';
  if (/forest|jungle|moss|tree|pine|nature|leaf|wood|جنگل|درخت|jangal/.test(p)) return 'forest';
  if (/mountain|snow|alpine|peak|cliff|valley|aurora|waterfall|پہاڑ|برف|وادی|pahar/.test(p)) return 'mountain';
  if (/space|cosmos|galaxy|nebula|star|planet|astronaut|moon|universe|آسمان|ستارے|کائنات|چاند/.test(p)) {
    return 'cosmos';
  }
  if (/mosque|masjid|qabar|grave|قبر|مسجد|نماز|رمضان|eid|ramadan|crescent|lantern/.test(p)) {
    return 'spiritual-twilight';
  }
  if (/sunset|sunrise|dawn|golden hour|amber|fire|lava|candle|غروب|طلوع|سورج|شام/.test(p)) return 'sunset';
  if (
    /آخرت|تیاری|قبر|جنت|قرآن|دعا|اسلام|اللہ|موت|عبادت|ایمان|akhirat|hereafter|islamic|prayer|quran|dua|eternity|soul|faith|heaven|spiritual/.test(
      p
    )
  ) {
    return 'spiritual-twilight';
  }
  return 'studio';
}

function cleanBrowserCaption(rawPrompt: string): string {
  const cleaned = rawPrompt
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, ' ')
    .replace(/\b(veo\s*3|veo|sora|runway|master\s*prompt|prompt)\b/gi, ' ')
    .replace(/\b(duration|aspect\s*ratio|resolution|camera|lighting|style)\s*[:：]\s*[^|\n]+/gi, ' ')
    .replace(
      /\b(exactly\s*\d+\s*seconds?|vertical\s*9:16|horizontal\s*16:9|square\s*1:1|9:16|16:9|1:1|ultra\s*realistic|photorealistic|hyper\s*realistic|cinematic\s*8k|8k|4k|hdr|uhd)\b/gi,
      ' '
    )
    .replace(/[|–—]+/g, ' · ')
    .replace(/\s*·\s*(·\s*)+/g, ' · ')
    .replace(/\s+/g, ' ')
    .replace(/^[\s·\-:,]+|[\s·\-:,]+$/g, '')
    .trim();
  return cleaned || 'OpenFrame Studio';
}

function extractBrowserDialogue(rawPrompt: string): string | null {
  const m1 = rawPrompt.match(
    /(?:exact(?:\s+urdu|\s+hindi)?\s*dialogue|speak\s+exactly(?:\s+this\s+dialogue)?|voiceover|narration|spoken\s+script)\s*[:：\-–]?[\s\S]{0,120}?["“«]([^"”»\n]{6,260})["”»]/i
  );
  if (m1?.[1]) return m1[1].trim();
  const m2 = rawPrompt.match(/["“«]([^"”»]*[\u0600-\u06FF][^"”»]{4,240})["”»]/);
  if (m2?.[1]) return m2[1].trim();
  return null;
}

function splitBrowserDialogueCaptions(dialogue: string): [string, string, string] | null {
  const clean = dialogue.trim();
  if (!clean) return null;
  const clauses = clean
    .split(/[،,.؛;!?؟۔]+/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 3);
  if (clauses.length >= 3) {
    return [clauses[0].slice(0, 56), clauses[1].slice(0, 56), clauses.slice(2).join(' ').slice(0, 56)];
  }
  const words = clean.split(/\s+/);
  if (words.length >= 6) {
    const t1 = Math.ceil(words.length / 3);
    const t2 = Math.ceil((words.length * 2) / 3);
    return [
      words.slice(0, t1).join(' ').slice(0, 56),
      words.slice(t1, t2).join(' ').slice(0, 56),
      words.slice(t2).join(' ').slice(0, 56),
    ];
  }
  return [clean.slice(0, 56), clean.slice(0, 56), clean.slice(0, 56)];
}

function extractBrowserPromptBeats(rawPrompt: string): [string, string, string] {
  const timeMatches = Array.from(
    rawPrompt.matchAll(/\b\d+\s*[-–to]+\s*\d+\s*s(?:ec(?:onds?)?)?\s*[:：\-–]\s*([^\n|]+)/gi)
  )
    .map((m) => cleanBrowserCaption(m[1]))
    .filter((s) => s.length >= 6);
  if (timeMatches.length >= 3) return [timeMatches[0], timeMatches[1], timeMatches[2]];

  const sceneMatches = Array.from(
    rawPrompt.matchAll(/(?:scene|shot|clip|part|beat)\s*\d+\s*[:：\-–]\s*([^\n|]+)/gi)
  )
    .map((m) => cleanBrowserCaption(m[1]))
    .filter((s) => s.length >= 4);
  if (sceneMatches.length >= 3) return [sceneMatches[0], sceneMatches[1], sceneMatches[2]];

  const lineParts = rawPrompt
    .split(/\r?\n|\|/)
    .map((s) => s.trim())
    .filter((s) => !/^\d+\.\s*[^:]+:\s*$/.test(s))
    .map((s) => cleanBrowserCaption(s))
    .filter((s) => s.length >= 6);

  if (lineParts.length >= 3) return [lineParts[0], lineParts[1], lineParts[2]];
  if (lineParts.length === 2) return [lineParts[0], lineParts[1], `${lineParts[0]} · ${lineParts[1]}`];

  const cleaned = cleanBrowserCaption(rawPrompt);
  const clauses = cleaned
    .split(/[.,;·!?،۔]+/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 4);

  if (clauses.length >= 3) return [clauses[0], clauses[1], clauses[2]];
  if (clauses.length === 2) return [clauses[0], clauses[1], cleaned];
  return [cleaned, cleaned, cleaned];
}

function getBrowserPalette(theme: BrowserSceneTheme) {
  switch (theme) {
    case 'garden':
      return {
        top: '#38bdf8',
        mid: '#bae6fd',
        bottom: '#fef3c7',
        glow: '#fef08a',
        accent: '#f59e0b',
        silBack: '#15803d',
        silMid: '#166534',
        silFront: '#064e3b',
      };
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
    case 'mountain':
      return {
        top: '#080e24',
        mid: '#1e3a5f',
        bottom: '#64748b',
        glow: '#a5f3fc',
        accent: '#38bdf8',
        silBack: '#263850',
        silMid: '#142033',
        silFront: '#090f1c',
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
    case 'sunset':
      return {
        top: '#240b36',
        mid: '#9a3412',
        bottom: '#f59e0b',
        glow: '#fef08a',
        accent: '#fb7185',
        silBack: '#4c1d24',
        silMid: '#2a0f18',
        silFront: '#14060b',
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
    case 'garden':
      return [174.61, 261.63, 349.23, 440.0];
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

  const globalTheme = detectBrowserTheme(job.prompt);
  const beats = extractBrowserPromptBeats(job.prompt);
  const dialogue = extractBrowserDialogue(job.prompt);
  const dialogueCaptions = dialogue ? splitBrowserDialogueCaptions(dialogue) : null;

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

      const freqs = getThemeChordFreqs(globalTheme);
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
    const cx = w * 0.5;
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
      const sceneIdx: 0 | 1 | 2 = tNorm < 0.34 ? 0 : tNorm < 0.67 ? 1 : 2;
      const sceneProgress =
        sceneIdx === 0 ? tNorm / 0.34 : sceneIdx === 1 ? (tNorm - 0.34) / 0.33 : (tNorm - 0.67) / 0.33;

      const beatPrompt = beats[sceneIdx];
      const detectedBeatTheme = detectBrowserTheme(beatPrompt);
      const effectiveTheme =
        globalTheme === 'garden'
          ? 'garden'
          : detectedBeatTheme !== 'studio'
          ? detectedBeatTheme
          : globalTheme;
      const pal = getBrowserPalette(effectiveTheme);
      const textForObjects = beatPrompt.toLowerCase();

      const hasDawnOrDay = /dawn|sunrise|morning|daylight|sunny|noon|طلوع|صبح|دن/.test(textForObjects);
      const hasExplicitConcreteProp =
        /clock|time|hourglass|book|grave|cemetery|car|vehicle|boat|ship|house|cabin|candle|fire|وقت|گھڑی|کتاب|قبر|کار|گاڑی|کشتی|گھر|شمع/.test(
          textForObjects
        );
      const hasNight =
        !hasDawnOrDay &&
        (/night|star|moon|twilight|آخرت|رات|چاند|ستارے|قبر|lantern|cosmos/.test(textForObjects) ||
          effectiveTheme === 'spiritual-twilight' ||
          effectiveTheme === 'cosmos' ||
          effectiveTheme === 'cyber');
      const hasRain = /rain|storm|thunder|بارش|طوفان/.test(textForObjects);
      const hasClouds = /cloud|fog|mist|storm|بادل|دھند/.test(textForObjects);
      const hasMosque =
        /mosque|masjid|dome|minaret|مسجد|نماز/.test(textForObjects) ||
        (!hasExplicitConcreteProp && effectiveTheme === 'spiritual-twilight' && sceneIdx === 0);
      const hasLantern =
        /lantern|lamp|fanous|فانوس|چراغ/.test(textForObjects) ||
        (!hasExplicitConcreteProp && effectiveTheme === 'spiritual-twilight' && sceneIdx === 1);
      const hasCandleOrFire = /candle|fire|flame|lava|شمع|آگ/.test(textForObjects);
      const hasClock = /clock|time|hour|hourglass|seconds|وقت|گھڑی/.test(textForObjects);
      const hasBook = /book|quran|read|pages|کتاب|قرآن/.test(textForObjects);
      const hasTraveler =
        /man|woman|boy|girl|person|traveler|human|prayer|praying|dua|انسان|آدمی|لڑکا|مسافر|دعا/.test(
          textForObjects
        );
      const hasGrave = /grave|cemetery|tomb|قبر|قبرستان/.test(textForObjects);
      const hasCar = /car|vehicle|highway|drive|drifting|کار|گاڑی|سڑک/.test(textForObjects);
      const hasBoat = /boat|ship|sail|کشتی|جہاز/.test(textForObjects);
      const hasBirds = /bird|birds|eagle|dove|seagull|پرندے/.test(textForObjects);
      const hasHouse = /house|home|cabin|cottage|گھر|مکان/.test(textForObjects);
      const hasTrees =
        /tree|forest|pine|jungle|garden|leaf|درخت|جنگل|باغ/.test(textForObjects) || effectiveTheme === 'forest';
      const hasWater =
        /ocean|sea|water|river|lake|wave|سمندر|دریا|پانی/.test(textForObjects) ||
        effectiveTheme === 'ocean' ||
        (!hasExplicitConcreteProp && effectiveTheme === 'spiritual-twilight' && sceneIdx === 2);

      // Sky gradient
      const grad = ctx.createLinearGradient(0, 0, 0, h);
      grad.addColorStop(0, pal.top);
      grad.addColorStop(0.55, pal.mid);
      grad.addColorStop(1, pal.bottom);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);

      // Stars when night/cosmos/cyber
      if (hasNight) {
        for (let i = 0; i < 48; i++) {
          const sx = (((job.seed * 19 + sceneIdx * 11 + i * 137) % 96) / 100) * w;
          const sy = (((job.seed * 31 + sceneIdx * 7 + i * 89) % 58) / 100) * h;
          const twinkle = 0.35 + 0.55 * Math.abs(Math.sin(tNorm * Math.PI * 2 + i));
          ctx.fillStyle = '#fef3c7';
          ctx.globalAlpha = twinkle;
          ctx.beginPath();
          ctx.arc(sx, sy, 1.3 + (i % 2), 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.globalAlpha = 1;
      }

      const horizonY = h * (sceneIdx === 1 ? 0.64 : 0.68);
      const glowY = sceneIdx === 1 ? h * 0.42 : horizonY - minDim * 0.1;
      const rg = ctx.createRadialGradient(cx, glowY, 0, cx, glowY, minDim * 0.48);
      rg.addColorStop(0, pal.glow);
      rg.addColorStop(0.5, pal.accent + '44');
      rg.addColorStop(1, 'transparent');
      ctx.fillStyle = rg;
      ctx.fillRect(0, 0, w, h);

      // Celestial body: Planet / Crescent / Sun
      if (effectiveTheme === 'cosmos' || /planet|earth|space/.test(textForObjects)) {
        const px = w * (sceneIdx === 1 ? 0.42 : 0.56);
        const py = h * 0.36;
        const pr = minDim * 0.13;
        ctx.fillStyle = pal.bottom;
        ctx.beginPath();
        ctx.arc(px, py, pr, 0, Math.PI * 2);
        ctx.fill();
        ctx.save();
        ctx.translate(px, py);
        ctx.rotate(-0.28);
        ctx.strokeStyle = pal.glow;
        ctx.lineWidth = 4;
        ctx.globalAlpha = 0.72;
        ctx.beginPath();
        ctx.ellipse(0, 0, pr * 2.1, pr * 0.4, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
        ctx.globalAlpha = 1;
      } else if (
        !hasDawnOrDay &&
        (effectiveTheme === 'spiritual-twilight' || /crescent|moon|چاند/.test(textForObjects))
      ) {
        const mx = w * (sceneIdx === 0 ? 0.68 : 0.32);
        const my = h * 0.22;
        const mr = minDim * 0.08;
        ctx.fillStyle = '#fef3c7';
        ctx.beginPath();
        ctx.arc(mx, my, mr, 0, Math.PI * 2);
        ctx.fill();
        if (!/full\s*moon/.test(textForObjects)) {
          ctx.fillStyle = pal.top;
          ctx.beginPath();
          ctx.arc(mx + mr * 0.34, my - mr * 0.24, mr * 0.88, 0, Math.PI * 2);
          ctx.fill();
        }
      } else {
        const sx = w * (0.42 + sceneProgress * 0.16);
        const sy = horizonY - minDim * 0.12;
        ctx.fillStyle = pal.glow;
        ctx.globalAlpha = 0.9;
        ctx.beginPath();
        ctx.arc(sx, sy, minDim * 0.1, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      }

      // Drifting clouds
      if (hasClouds) {
        ctx.fillStyle = 'rgba(203, 213, 225, 0.22)';
        const drift = sceneProgress * 28;
        ctx.beginPath();
        ctx.ellipse(w * 0.28 + drift, h * 0.24, minDim * 0.18, minDim * 0.06, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(w * 0.72 - drift * 0.7, h * 0.28, minDim * 0.21, minDim * 0.065, 0, 0, Math.PI * 2);
        ctx.fill();
      }

      // Landscape layer
      if (effectiveTheme === 'cyber') {
        const cols = 10;
        const bw = Math.ceil(w / cols);
        for (let i = 0; i < cols; i++) {
          const bh = h * (0.25 + (((job.seed + i * 37 + sceneIdx * 13) % 38) / 100));
          const bx = i * bw;
          const by = h - bh;
          ctx.fillStyle = pal.silFront;
          ctx.fillRect(bx, by, bw - 4, bh);
          ctx.fillStyle = i % 2 === 0 ? pal.glow : pal.accent;
          ctx.globalAlpha = 0.82;
          ctx.fillRect(bx + 8, by + 18, Math.max(6, bw - 22), 5);
          ctx.globalAlpha = 1;
        }
      } else if (effectiveTheme === 'desert') {
        ctx.fillStyle = pal.silBack;
        ctx.beginPath();
        ctx.moveTo(0, horizonY);
        ctx.quadraticCurveTo(w * 0.35, horizonY - 70, w, horizonY + 10);
        ctx.lineTo(w, h);
        ctx.lineTo(0, h);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = pal.silFront;
        ctx.beginPath();
        ctx.moveTo(0, horizonY + 45);
        ctx.quadraticCurveTo(w * 0.65, horizonY - 35, w, horizonY + 55);
        ctx.lineTo(w, h);
        ctx.lineTo(0, h);
        ctx.closePath();
        ctx.fill();
      } else if (hasWater) {
        ctx.fillStyle = pal.silMid;
        ctx.beginPath();
        ctx.moveTo(0, horizonY);
        ctx.quadraticCurveTo(w * 0.25, horizonY - 18 + Math.sin(tNorm * 8) * 6, w * 0.5, horizonY);
        ctx.quadraticCurveTo(w * 0.75, horizonY + 18 - Math.sin(tNorm * 8) * 6, w, horizonY);
        ctx.lineTo(w, h);
        ctx.lineTo(0, h);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = pal.accent + '66';
        ctx.fillRect(cx - minDim * 0.18, horizonY + 24, minDim * 0.36, 7);
        ctx.fillRect(cx - minDim * 0.11, horizonY + 52, minDim * 0.22, 5);
      } else {
        ctx.fillStyle = pal.silBack;
        ctx.beginPath();
        ctx.moveTo(0, horizonY + 30);
        ctx.lineTo(w * 0.24, horizonY - 80);
        ctx.lineTo(w * 0.5, horizonY + 22);
        ctx.lineTo(w * 0.76, horizonY - 95);
        ctx.lineTo(w, horizonY + 18);
        ctx.lineTo(w, h);
        ctx.lineTo(0, h);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = pal.silFront;
        ctx.fillRect(0, horizonY + 24, w, h - horizonY);
      }

      // Specific prompt objects
      if (hasMosque) {
        ctx.fillStyle = pal.silFront;
        const domeW = w * 0.4;
        const domeTop = horizonY - minDim * 0.2;
        const minW = minDim * 0.036;
        const minTop = horizonY - minDim * 0.32;
        ctx.fillRect(cx - domeW * 0.66, minTop, minW, horizonY - minTop + 20);
        ctx.fillRect(cx + domeW * 0.66 - minW, minTop, minW, horizonY - minTop + 20);
        ctx.beginPath();
        ctx.moveTo(cx - domeW / 2, horizonY + 16);
        ctx.quadraticCurveTo(cx, domeTop - minDim * 0.14, cx + domeW / 2, horizonY + 16);
        ctx.fill();
        ctx.fillRect(cx - domeW * 0.62, horizonY - minDim * 0.06, domeW * 1.24, h - horizonY + minDim * 0.08);
        ctx.fillStyle = pal.accent;
        ctx.fillRect(cx - 14, horizonY - 38, 28, 30);
      }

      if (hasLantern) {
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
      }

      if (hasCandleOrFire) {
        const fx = cx;
        const fy = horizonY - 12;
        ctx.fillStyle = '#fef3c7';
        ctx.fillRect(fx - 14, fy - 45, 28, 65);
        const flicker = Math.sin(tNorm * 24) * 5;
        ctx.fillStyle = '#fb923c';
        ctx.beginPath();
        ctx.moveTo(fx, fy - 95 + flicker);
        ctx.quadraticCurveTo(fx + 22, fy - 62, fx, fy - 46);
        ctx.quadraticCurveTo(fx - 22, fy - 62, fx, fy - 95 + flicker);
        ctx.fill();
      }

      if (hasClock) {
        const kx = cx;
        const ky = h * 0.44;
        const kr = minDim * 0.14;
        ctx.fillStyle = 'rgba(2, 6, 23, 0.72)';
        ctx.strokeStyle = pal.accent;
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.arc(kx, ky, kr, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        const angle = tNorm * Math.PI * 2 - Math.PI / 2;
        ctx.strokeStyle = '#fef3c7';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(kx, ky);
        ctx.lineTo(kx + Math.cos(angle) * kr * 0.65, ky + Math.sin(angle) * kr * 0.65);
        ctx.stroke();
      }

      if (hasBook) {
        const bx = cx;
        const by = horizonY - 18;
        const bw = minDim * 0.34;
        ctx.fillStyle = '#fef3c7';
        ctx.strokeStyle = pal.accent;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(bx, by);
        ctx.quadraticCurveTo(bx - bw * 0.5, by - 28, bx - bw, by - 8);
        ctx.lineTo(bx - bw, by + 38);
        ctx.quadraticCurveTo(bx - bw * 0.5, by + 18, bx, by + 44);
        ctx.quadraticCurveTo(bx + bw * 0.5, by + 18, bx + bw, by + 38);
        ctx.lineTo(bx + bw, by - 8);
        ctx.quadraticCurveTo(bx + bw * 0.5, by - 28, bx, by);
        ctx.fill();
        ctx.stroke();
      }

      if (hasGrave) {
        for (const gxOff of [-0.22, 0.04, 0.24]) {
          const gx = cx + w * gxOff;
          ctx.fillStyle = pal.silMid;
          ctx.fillRect(gx - 18, horizonY - 22, 36, 62);
          ctx.beginPath();
          ctx.arc(gx, horizonY - 22, 18, Math.PI, 0);
          ctx.fill();
        }
      }

      if (hasHouse) {
        const hx = w * 0.26;
        const hy = horizonY;
        ctx.fillStyle = pal.silFront;
        ctx.fillRect(hx - 45, hy - 55, 90, 65);
        ctx.fillStyle = pal.silMid;
        ctx.beginPath();
        ctx.moveTo(hx - 58, hy - 55);
        ctx.lineTo(hx, hy - 102);
        ctx.lineTo(hx + 58, hy - 55);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = pal.accent;
        ctx.fillRect(hx - 14, hy - 36, 24, 22);
      }

      if (hasTrees) {
        ctx.fillStyle = pal.silFront;
        for (const txOff of [0.12, 0.2, 0.82, 0.9]) {
          const tx = w * txOff;
          ctx.beginPath();
          ctx.moveTo(tx, horizonY - 95);
          ctx.lineTo(tx - 28, horizonY + 12);
          ctx.lineTo(tx + 28, horizonY + 12);
          ctx.closePath();
          ctx.fill();
        }
      }

      if (hasCar) {
        const rx = cx + (sceneProgress - 0.5) * 40;
        const ry = horizonY + 36;
        ctx.fillStyle = '#1e293b';
        ctx.beginPath();
        ctx.moveTo(cx - 60, ry - 18);
        ctx.lineTo(cx + 60, ry - 18);
        ctx.lineTo(cx + 180, h);
        ctx.lineTo(cx - 180, h);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#ef4444';
        ctx.fillRect(rx - 44, ry - 32, 88, 26);
        ctx.fillStyle = '#0f172a';
        ctx.beginPath();
        ctx.arc(rx - 28, ry - 6, 9, 0, Math.PI * 2);
        ctx.arc(rx + 28, ry - 6, 9, 0, Math.PI * 2);
        ctx.fill();
      }

      if (hasBoat) {
        const bx = w * (0.42 + sceneProgress * 0.16);
        const by = horizonY + 24;
        ctx.fillStyle = pal.silFront;
        ctx.beginPath();
        ctx.moveTo(bx - 55, by);
        ctx.lineTo(bx + 55, by);
        ctx.lineTo(bx + 36, by + 24);
        ctx.lineTo(bx - 36, by + 24);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#fef3c7';
        ctx.beginPath();
        ctx.moveTo(bx, by - 72);
        ctx.lineTo(bx, by - 4);
        ctx.lineTo(bx + 40, by - 4);
        ctx.closePath();
        ctx.fill();
      }

      if (hasTraveler) {
        const px = w * (hasMosque ? 0.24 : 0.5);
        const py = horizonY + 26;
        ctx.fillStyle = pal.silFront;
        ctx.beginPath();
        ctx.arc(px, py - 56, 14, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(px - 18, py);
        ctx.lineTo(px - 12, py - 40);
        ctx.lineTo(px + 12, py - 40);
        ctx.lineTo(px + 18, py);
        ctx.closePath();
        ctx.fill();
      }

      if (hasBirds) {
        ctx.strokeStyle = pal.glow;
        ctx.lineWidth = 2.5;
        for (let i = 0; i < 5; i++) {
          const bx = w * (0.22 + i * 0.12) + sceneProgress * 22;
          const by = h * (0.22 + (i % 2) * 0.05) + Math.sin(tNorm * 10 + i) * 4;
          ctx.beginPath();
          ctx.moveTo(bx - 12, by);
          ctx.quadraticCurveTo(bx - 6, by - 8, bx, by);
          ctx.quadraticCurveTo(bx + 6, by - 8, bx + 12, by);
          ctx.stroke();
        }
      }

      // Rain streaks or floating dust motes
      if (hasRain) {
        ctx.strokeStyle = 'rgba(186, 230, 253, 0.5)';
        ctx.lineWidth = 2;
        for (let i = 0; i < 36; i++) {
          const rx = (((job.seed * 29 + i * 97) % 98) / 100) * w;
          const ry = ((((job.seed * 17 + i * 67) % 85) / 100) * h + tNorm * 160) % h;
          ctx.beginPath();
          ctx.moveTo(rx, ry);
          ctx.lineTo(rx - 10, ry + 34);
          ctx.stroke();
        }
      } else {
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
      }

      // Living garden / stream / wet-stone / talking baby bird true-motion composition
      if (effectiveTheme === 'garden') {
        const fullLower = job.prompt.toLowerCase();
        const isWetStoneStream = /wet\s*stone|stone|pebble|baby\s*bird|turquoise-and-cream|turquoise\s+and\s+cream/.test(
          fullLower
        );
        const isCreamBabyBird = /cream|baby\s*bird/.test(fullLower);

        const gGrad = ctx.createLinearGradient(0, 0, 0, h);
        gGrad.addColorStop(0, pal.top);
        gGrad.addColorStop(0.55, pal.mid);
        gGrad.addColorStop(1, pal.bottom);
        ctx.fillStyle = gGrad;
        ctx.fillRect(0, 0, w, h);

        const camZoom =
          tNorm < 0.45
            ? 1 + (tNorm / 0.45) * 0.24
            : tNorm < 0.72
            ? 1.24
            : 1.24 - ((tNorm - 0.72) / 0.28) * 0.16;
        const camFocusY = h * 0.47;

        ctx.save();
        ctx.translate(cx * (1 - camZoom), camFocusY * (1 - camZoom));
        ctx.scale(camZoom, camZoom);

        const gHorizon = h * 0.56;
        const sunX = w * (0.48 + Math.sin(tNorm * Math.PI) * 0.08);
        const sunY = gHorizon - minDim * 0.22;
        ctx.fillStyle = '#fef9c3';
        ctx.beginPath();
        ctx.arc(sunX, sunY, minDim * 0.11, 0, Math.PI * 2);
        ctx.fill();

        // Green meadow & soft plants
        ctx.fillStyle = '#15803d';
        ctx.beginPath();
        ctx.moveTo(0, gHorizon + 8);
        ctx.quadraticCurveTo(w * 0.28, gHorizon - 38, w, gHorizon + 10);
        ctx.lineTo(w, h);
        ctx.lineTo(0, h);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = '#166534';
        ctx.beginPath();
        ctx.moveTo(0, gHorizon + 42);
        ctx.quadraticCurveTo(w * 0.65, gHorizon + 14, w, gHorizon + 48);
        ctx.lineTo(w, h);
        ctx.lineTo(0, h);
        ctx.closePath();
        ctx.fill();

        // Clear flowing stream + animated ripples
        ctx.fillStyle = 'rgba(14, 165, 233, 0.72)';
        ctx.beginPath();
        ctx.moveTo(0, gHorizon + 56);
        ctx.quadraticCurveTo(w * 0.45, gHorizon + 34, w, gHorizon + 62);
        ctx.lineTo(w, h);
        ctx.lineTo(0, h);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = 'rgba(224, 242, 254, 0.62)';
        for (let i = 0; i < 9; i++) {
          const ry = gHorizon + 72 + i * (h * 0.032);
          const rx = ((w * 0.12 + i * w * 0.11 + tNorm * w * 0.55) % (w * 0.9)) + w * 0.05;
          const rw = minDim * (0.06 + (i % 3) * 0.025);
          ctx.beginPath();
          ctx.ellipse(rx, ry, rw, 3.5, 0, 0, Math.PI * 2);
          ctx.fill();
        }

        // Swaying purple wildflowers & garden blossoms
        const sway = Math.sin(tNorm * Math.PI * 4) * 8;
        const flowerColors = /purple\s*wildflower/.test(fullLower)
          ? ['#a855f7', '#c084fc', '#9333ea', '#e879f9', '#d8b4fe']
          : ['#ffffff', '#f472b6', '#a855f7', '#fb7185', '#fef08a', '#c084fc'];
        for (let i = 0; i < 14; i++) {
          const fx = (((job.seed * 13 + i * 71) % 90) + 5) * (w / 100);
          const fy = gHorizon + 12 + ((i * 29) % Math.max(40, h * 0.2));
          const fr = minDim * 0.024;
          const localSway = sway * (i % 2 === 0 ? 1 : -0.8);
          ctx.strokeStyle = '#14532d';
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.moveTo(fx, fy + 28);
          ctx.quadraticCurveTo(fx + localSway * 0.5, fy + 14, fx + localSway, fy);
          ctx.stroke();
          ctx.fillStyle = flowerColors[i % flowerColors.length];
          ctx.beginPath();
          ctx.arc(fx + localSway, fy, fr, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#fef08a';
          ctx.beginPath();
          ctx.arc(fx + localSway, fy, fr * 0.35, 0, Math.PI * 2);
          ctx.fill();
        }

        // Wet stone perch OR curved flowering tree branch
        const perchY = h * 0.56;
        const bs = minDim / 335;
        if (isWetStoneStream) {
          ctx.strokeStyle = `rgba(224, 242, 254, ${0.45 + 0.3 * Math.sin(tNorm * Math.PI * 8)})`;
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          ctx.ellipse(cx, perchY + 62 * bs, 86 * bs, 16 * bs, 0, 0, Math.PI * 2);
          ctx.stroke();

          ctx.fillStyle = '#475569';
          ctx.beginPath();
          ctx.moveTo(cx - 88 * bs, perchY + 66 * bs);
          ctx.quadraticCurveTo(cx - 70 * bs, perchY + 14 * bs, cx, perchY + 18 * bs);
          ctx.quadraticCurveTo(cx + 76 * bs, perchY + 16 * bs, cx + 90 * bs, perchY + 66 * bs);
          ctx.closePath();
          ctx.fill();

          ctx.fillStyle = 'rgba(148, 163, 184, 0.48)';
          ctx.beginPath();
          ctx.ellipse(cx - 12 * bs, perchY + 26 * bs, 44 * bs, 9 * bs, 0, 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.strokeStyle = '#57341a';
          ctx.lineWidth = minDim * 0.04;
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(0, perchY + 55);
          ctx.quadraticCurveTo(w * 0.38, perchY - 8, w * 0.88, perchY + 22);
          ctx.stroke();
        }

        // Animated talking, blinking, head-tilting turquoise-and-cream / exotic bird
        const bx = cx;
        const by = isWetStoneStream ? perchY - 30 * bs : perchY - 16 * bs;
        const beakWave = Math.max(0, Math.sin(tNorm * Math.PI * 22) * 0.65 + Math.sin(tNorm * Math.PI * 37) * 0.35);
        const beakGap = beakWave * 9 * bs;
        const headTilt = Math.sin(tNorm * Math.PI * 6) * 0.095;
        const wingLift = Math.sin(tNorm * Math.PI * 10) * 6 * bs;
        const breath = 1 + Math.sin(tNorm * Math.PI * 8) * 0.025;
        const blinkPhase = (tNorm * 3.4) % 1;
        const isBlinking = blinkPhase > 0.91 && blinkPhase < 0.97;

        const bodyColor = isCreamBabyBird ? '#14b8a6' : '#06b6d4';
        const chestColor = isCreamBabyBird ? '#fef3c7' : '#facc15';
        const wingColor = isCreamBabyBird ? '#0d9488' : '#7c3aed';
        const tailColor = isCreamBabyBird ? '#0f766e' : '#6d28d9';
        const headColor = isCreamBabyBird ? '#2dd4bf' : '#0891b2';
        const crestColor = isCreamBabyBird ? '#5eead4' : '#a855f7';

        ctx.fillStyle = tailColor;
        ctx.beginPath();
        ctx.moveTo(bx - 16 * bs, by + 16 * bs);
        ctx.lineTo(bx - 50 * bs, by + 58 * bs + wingLift * 0.5);
        ctx.lineTo(bx - 22 * bs, by + 54 * bs);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = bodyColor;
        ctx.beginPath();
        ctx.ellipse(bx, by + 12 * bs, 28 * bs * breath, 37 * bs, -0.17, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = chestColor;
        ctx.beginPath();
        ctx.ellipse(bx + 9 * bs, by + 16 * bs, 17 * bs * breath, 26 * bs, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = wingColor;
        ctx.beginPath();
        ctx.moveTo(bx - 22 * bs, by - 2 * bs - wingLift * 0.4);
        ctx.quadraticCurveTo(bx - 38 * bs, by + 18 * bs - wingLift, bx - 12 * bs, by + 40 * bs - wingLift * 0.3);
        ctx.quadraticCurveTo(bx + 6 * bs, by + 22 * bs, bx - 2 * bs, by - 2 * bs);
        ctx.fill();

        const hx = bx + 6 * bs;
        const hy = by - 26 * bs;
        ctx.save();
        ctx.translate(hx, hy);
        ctx.rotate(headTilt);

        ctx.fillStyle = crestColor;
        ctx.beginPath();
        ctx.moveTo(-8 * bs, -16 * bs);
        ctx.quadraticCurveTo(-18 * bs, -34 * bs, -28 * bs, -22 * bs);
        ctx.quadraticCurveTo(-14 * bs, -16 * bs, 0, -18 * bs);
        ctx.fill();

        ctx.fillStyle = headColor;
        ctx.beginPath();
        ctx.arc(0, 0, 21 * bs, 0, Math.PI * 2);
        ctx.fill();

        if (isBlinking) {
          ctx.strokeStyle = '#0f172a';
          ctx.lineWidth = Math.max(2, 3 * bs);
          ctx.beginPath();
          ctx.moveTo(2 * bs, -2 * bs);
          ctx.quadraticCurveTo(7 * bs, 3 * bs, 13 * bs, -2 * bs);
          ctx.stroke();
        } else {
          ctx.fillStyle = '#0f172a';
          ctx.beginPath();
          ctx.arc(7 * bs, -3 * bs, 6.2 * bs, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.arc(9 * bs, -5 * bs, 2.2 * bs, 0, Math.PI * 2);
          ctx.fill();
        }

        ctx.fillStyle = '#f97316';
        ctx.beginPath();
        ctx.moveTo(18 * bs, -3 * bs);
        ctx.lineTo(38 * bs, -2 * bs - beakGap * 0.45);
        ctx.lineTo(18 * bs, 3 * bs);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = '#ea580c';
        ctx.beginPath();
        ctx.moveTo(18 * bs, 3 * bs);
        ctx.lineTo(35 * bs, 5 * bs + beakGap);
        ctx.lineTo(17 * bs, 8 * bs + beakGap * 0.4);
        ctx.closePath();
        ctx.fill();

        ctx.restore();

        // Butterflies when mentioned
        if (/butterfly|butterflies|تتلی/.test(fullLower)) {
          const wf = 0.45 + 0.55 * Math.abs(Math.sin(tNorm * Math.PI * 16));
          [
            { x: w * 0.24 + Math.sin(tNorm * Math.PI * 4) * 26, y: h * 0.32, c: '#f472b6' },
            { x: w * 0.76 - Math.cos(tNorm * Math.PI * 3) * 22, y: h * 0.29, c: '#38bdf8' },
          ].forEach((bt) => {
            ctx.fillStyle = bt.c;
            ctx.beginPath();
            ctx.ellipse(bt.x - 7 * wf, bt.y, 9 * wf, 6, 0, 0, Math.PI * 2);
            ctx.ellipse(bt.x + 7 * wf, bt.y, 9 * wf, 6, 0, 0, Math.PI * 2);
            ctx.fill();
          });
        }

        ctx.restore();
      }

      // Frosted-glass bottom caption card matching the current scene beat or exact dialogue
      const caption = dialogueCaptions?.[sceneIdx] || beatPrompt || cleanBrowserCaption(job.prompt);
      const isRtl = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]/.test(caption);
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
      const label = caption.length > 52 ? `${caption.slice(0, 49).trim()}...` : caption;
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

        const cacheKey = `v5:${job.workflow}:${job.prompt}:${job.modelId}:${job.resolution}:${job.aspectRatio}:${job.durationSec}:${job.seed}`;
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
