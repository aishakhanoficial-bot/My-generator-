import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';
import fs from 'fs';

export type SceneTheme =
  | 'spiritual-twilight'
  | 'ocean'
  | 'desert'
  | 'forest'
  | 'mountain'
  | 'cyber'
  | 'cosmos'
  | 'sunset'
  | 'studio';

export interface SceneStoryboard {
  theme: SceneTheme;
  sceneCaptions: [string, string, string];
  voiceoverScript: string;
  speakableAsciiFallback: string;
  voiceName: 'Charon' | 'Kore' | 'Puck' | 'Zephyr';
  voiceStyle: string;
  usedGeminiStoryboard: boolean;
}

const RTL_REGEX = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\u0590-\u05FF]/;

export function hasRtlCharacters(text: string): boolean {
  return RTL_REGEX.test(text);
}

export function xmlEscape(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export function extractVoiceoverHint(rawPrompt: string): string | null {
  const match = rawPrompt.match(
    /(?:voiceover|narration|script|dialogue|audio|spoken|urdu\s*line|caption)\s*[:：\-–]\s*["“]?([^\n|]+)["”]?/i
  );
  if (match && match[1]) {
    const cleaned = match[1].replace(/["”]+$/g, '').trim();
    if (cleaned.length >= 4) return cleaned;
  }
  return null;
}

export function cleanDisplayPrompt(rawPrompt: string): string {
  let s = rawPrompt
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, ' ')
    .replace(/\b(veo\s*3|veo|sora|runway|master\s*prompt|prompt)\b/gi, ' ')
    .replace(/\b(duration|aspect\s*ratio|resolution|camera|lighting|style)\s*[:：]\s*[^|\n]+/gi, ' ')
    .replace(/\b(exactly\s*\d+\s*seconds?|vertical\s*9:16|horizontal\s*16:9|square\s*1:1|9:16|16:9|1:1|ultra\s*realistic|photorealistic|hyper\s*realistic|cinematic\s*8k|8k|4k|hdr|uhd)\b/gi, ' ')
    .replace(/[|–—]+/g, ' · ')
    .replace(/\s*·\s*(·\s*)+/g, ' · ')
    .replace(/\s+/g, ' ')
    .replace(/^[\s·\-:,]+|[\s·\-:,]+$/g, '')
    .trim();

  if (!s) {
    s = rawPrompt.replace(/[\u{1F300}-\u{1FAFF}]/gu, '').trim().slice(0, 80) || 'OpenFrame Scene';
  }
  return s;
}

export function detectSceneTheme(prompt: string): SceneTheme {
  const p = prompt.toLowerCase();
  if (
    /آخرت|تیاری|قبر|جنت|نماز|مسجد|قرآن|دعا|اسلام|اللہ|رمضان|موت|عبادت|ایمان|akhirat|hereafter|mosque|islamic|prayer|quran|crescent|lantern|ramadan|eid|dua|eternity|soul|faith|heaven|spiritual/.test(
      p
    )
  ) {
    return 'spiritual-twilight';
  }
  if (/ocean|sea|water|whale|wave|underwater|coral|jellyfish|beach|river|سمندر|لہر|پانی|دریا|samandar/.test(p)) {
    return 'ocean';
  }
  if (/desert|sand|dune|oasis|camel|sahara|pyramid|صحرا|ریت|sahra/.test(p)) {
    return 'desert';
  }
  if (/forest|jungle|moss|tree|pine|nature|garden|leaf|wood|جنگل|درخت|باغ|پھول|jangal/.test(p)) {
    return 'forest';
  }
  if (/mountain|snow|alpine|peak|cliff|valley|aurora|waterfall|پہاڑ|برف|وادی|pahar/.test(p)) {
    return 'mountain';
  }
  if (/cyber|neon|tokyo|city|rain|futuristic|synth|street|building|car|شہر|رات|shehar/.test(p)) {
    return 'cyber';
  }
  if (/space|cosmos|galaxy|nebula|star|planet|astronaut|moon|universe|آسمان|ستارے|کائنات|چاند/.test(p)) {
    return 'cosmos';
  }
  if (/sunset|sunrise|dawn|golden hour|amber|fire|lava|candle|غروب|طلوع|سورج|شام/.test(p)) {
    return 'sunset';
  }
  return 'studio';
}

function buildSpeakableAsciiFallback(prompt: string, theme: SceneTheme): string {
  const hint = extractVoiceoverHint(prompt);
  const candidate = hint || cleanDisplayPrompt(prompt);
  const asciiOnly = candidate
    .replace(/[^\x20-\x7E]/g, ' ')
    .replace(/[|·]+/g, ', ')
    .replace(/\s+/g, ' ')
    .trim();

  if (theme === 'spiritual-twilight') {
    if (/آخرت|تیاری|akhirat|hereafter/i.test(prompt)) {
      return 'Akhirat ki tayyari. Reflect on the hereafter. Every quiet moment is a preparation for eternity.';
    }
    if (asciiOnly.length >= 16) {
      return `${asciiOnly.slice(0, 140)}. A calm spiritual reflection.`;
    }
    return 'Peaceful twilight reflection. Stillness of the heart, light upon the soul.';
  }

  if (asciiOnly.length >= 14) {
    return asciiOnly.slice(0, 160);
  }

  const themeLines: Record<SceneTheme, string> = {
    'spiritual-twilight': 'A serene twilight reflection filled with warm golden light.',
    ocean: 'Golden light shimmers across deep ocean waves beneath a calm horizon.',
    desert: 'Warm wind drifts across golden desert dunes under a twilight sky.',
    forest: 'Soft morning sunbeams filter through the quiet emerald forest.',
    mountain: 'Crisp starlight illuminates silent snow-capped mountain peaks.',
    cyber: 'Neon reflections ripple across rain-slicked city streets at night.',
    cosmos: 'Luminous nebula clouds drift slowly among distant stars.',
    sunset: 'Amber sunset light warms the evening sky and quiet horizon.',
    studio: 'Atmospheric light sweeps gently across a cinematic horizon.',
  };
  return themeLines[theme];
}

function buildLocalSceneCaptions(prompt: string, theme: SceneTheme): [string, string, string] {
  const clean = cleanDisplayPrompt(prompt);
  const shortTitle = clean.length > 52 ? `${clean.slice(0, 49).trim()}...` : clean;
  const isUrdu = /[\u0600-\u06FF]/.test(clean);

  if (theme === 'spiritual-twilight' && isUrdu) {
    return [
      shortTitle,
      'دنیا کی رونق عارضی، آخرت کی تیاری اصل سفر ہے',
      'نیک عمل، دعا اور سکونِ قلب کے ساتھ روشنی کی طرف',
    ];
  }

  if (isUrdu) {
    return [shortTitle, 'قدرت اور روشنی کا پرسکون منظر', 'اختتامی جھلک'];
  }

  const parts = clean
    .split(/[·,.]+/)
    .map((x) => x.trim())
    .filter((x) => x.length >= 4);

  if (parts.length >= 3) {
    return [parts[0].slice(0, 52), parts[1].slice(0, 52), parts[2].slice(0, 52)];
  }
  if (parts.length === 2) {
    return [parts[0].slice(0, 52), parts[1].slice(0, 52), `${parts[0].slice(0, 36)} · Finale`];
  }

  const sceneSuffixes: Record<SceneTheme, [string, string]> = {
    'spiritual-twilight': ['Lantern Light & Reflection', 'Dawn of Peace'],
    ocean: ['Beneath the Waves', 'Horizon Glow'],
    desert: ['Shifting Dunes', 'Starlit Oasis'],
    forest: ['Sunlit Canopy', 'Quiet Mist'],
    mountain: ['Alpine Ridge', 'Aurora Night'],
    cyber: ['Neon Reflections', 'Midnight Skyline'],
    cosmos: ['Nebula Drift', 'Deep Starlight'],
    sunset: ['Golden Rays', 'Twilight Calm'],
    studio: ['Atmospheric Motion', 'Final Reveal'],
  };
  const [s2, s3] = sceneSuffixes[theme];
  return [shortTitle, s2, s3];
}

export async function planStoryboardAndVoiceover(params: {
  prompt: string;
  durationSec: number;
  jobId: string;
  voiceOutPath: string;
  allowGemini: boolean;
}): Promise<{ storyboard: SceneStoryboard; voiceWavPath: string | null }> {
  const fallbackTheme = detectSceneTheme(params.prompt);
  const fallbackCaptions = buildLocalSceneCaptions(params.prompt, fallbackTheme);
  const fallbackAscii = buildSpeakableAsciiFallback(params.prompt, fallbackTheme);

  const fallbackStoryboard: SceneStoryboard = {
    theme: fallbackTheme,
    sceneCaptions: fallbackCaptions,
    voiceoverScript: extractVoiceoverHint(params.prompt) || cleanDisplayPrompt(params.prompt),
    speakableAsciiFallback: fallbackAscii,
    voiceName: fallbackTheme === 'spiritual-twilight' || fallbackTheme === 'cosmos' ? 'Charon' : 'Kore',
    voiceStyle: 'Calm, expressive, cinematic documentary narrator',
    usedGeminiStoryboard: false,
  };

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || !params.allowGemini) {
    return { storyboard: fallbackStoryboard, voiceWavPath: null };
  }

  try {
    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });

    const targetWords = Math.max(8, Math.min(34, Math.round(params.durationSec * 2.3)));

    const storyRes = await ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: `Create a 3-scene storyboard and short voiceover for a ${params.durationSec}-second video matching this user prompt:
"""
${params.prompt}
"""
Rules:
1. Detect the main language of the prompt (e.g., Urdu, Hindi, Arabic, or English).
2. Write "voiceoverScript" in that SAME language (roughly ${targetWords} words so it fits comfortably inside ${params.durationSec} seconds of natural speech). Do NOT include stage directions, camera metadata, or words like "VEO 3 MASTER PROMPT" or "Duration".
3. Write "speakableAsciiFallback" as a concise 1-2 sentence English/Roman-Urdu translation or summary of the narration.
4. Write exactly 3 short, clean "sceneCaptions" (max 8 words each) in the prompt's language for Scene 1, Scene 2, and Scene 3.
5. Pick the best matching visual "theme" from: spiritual-twilight, ocean, desert, forest, mountain, cyber, cosmos, sunset, studio.
6. Pick "voiceName" from: Charon, Kore, Puck, Zephyr.`,
      config: {
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            theme: { type: Type.STRING },
            voiceoverScript: { type: Type.STRING },
            speakableAsciiFallback: { type: Type.STRING },
            voiceName: { type: Type.STRING },
            voiceStyle: { type: Type.STRING },
            sceneCaptions: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
          },
          required: ['theme', 'voiceoverScript', 'speakableAsciiFallback', 'voiceName', 'voiceStyle', 'sceneCaptions'],
        },
      },
    });

    const parsed = JSON.parse((storyRes.text ?? '{}').trim()) as {
      theme?: string;
      voiceoverScript?: string;
      speakableAsciiFallback?: string;
      voiceName?: string;
      voiceStyle?: string;
      sceneCaptions?: string[];
    };

    const validThemes: SceneTheme[] = [
      'spiritual-twilight',
      'ocean',
      'desert',
      'forest',
      'mountain',
      'cyber',
      'cosmos',
      'sunset',
      'studio',
    ];
    const theme = validThemes.includes(parsed.theme as SceneTheme)
      ? (parsed.theme as SceneTheme)
      : fallbackTheme;

    const validVoices = ['Charon', 'Kore', 'Puck', 'Zephyr'] as const;
    const voiceName = validVoices.includes(parsed.voiceName as (typeof validVoices)[number])
      ? (parsed.voiceName as (typeof validVoices)[number])
      : fallbackStoryboard.voiceName;

    const captionsRaw = Array.isArray(parsed.sceneCaptions) ? parsed.sceneCaptions.filter(Boolean) : [];
    const sceneCaptions: [string, string, string] = [
      (captionsRaw[0] || fallbackCaptions[0]).slice(0, 64),
      (captionsRaw[1] || fallbackCaptions[1]).slice(0, 64),
      (captionsRaw[2] || fallbackCaptions[2]).slice(0, 64),
    ];

    const voiceoverScript = (parsed.voiceoverScript || fallbackStoryboard.voiceoverScript).trim();
    const speakableAsciiFallback = (parsed.speakableAsciiFallback || fallbackAscii)
      .replace(/[^\x20-\x7E]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    const voiceStyle = (parsed.voiceStyle || fallbackStoryboard.voiceStyle).trim();

    const storyboard: SceneStoryboard = {
      theme,
      sceneCaptions,
      voiceoverScript,
      speakableAsciiFallback: speakableAsciiFallback || fallbackAscii,
      voiceName,
      voiceStyle,
      usedGeminiStoryboard: true,
    };

    // Synthesize natural voiceover audio with Gemini TTS
    let voiceWavPath: string | null = null;
    try {
      const ttsRes = await ai.models.generateContent({
        model: 'gemini-3.8-flash-lite-tts',
        contents: [
          {
            role: 'user',
            parts: [
              {
                text: voiceoverScript,
                speechMetadata: {
                  style: voiceStyle,
                },
              } as never,
            ],
          },
        ],
        config: {
          responseModalities: ['AUDIO'],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName },
            },
          },
        },
      });

      const base64Audio = ttsRes.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (base64Audio) {
        const wavBuffer = Buffer.from(base64Audio, 'base64');
        if (wavBuffer.length > 44) {
          fs.writeFileSync(params.voiceOutPath, wavBuffer);
          voiceWavPath = params.voiceOutPath;
        }
      }
    } catch {
      // Fallback to local FFmpeg flite narration + ambient music below
      voiceWavPath = null;
    }

    return { storyboard, voiceWavPath };
  } catch {
    return { storyboard: fallbackStoryboard, voiceWavPath: null };
  }
}

interface ThemeColors {
  skyTop: string;
  skyMid: string;
  skyBottom: string;
  glow: string;
  accent: string;
  silBack: string;
  silMid: string;
  silFront: string;
}

const THEME_PALETTES: Record<SceneTheme, ThemeColors> = {
  'spiritual-twilight': {
    skyTop: '#060919',
    skyMid: '#182449',
    skyBottom: '#b45309',
    glow: '#fde68a',
    accent: '#fbbf24',
    silBack: '#141b33',
    silMid: '#0d1326',
    silFront: '#060914',
  },
  ocean: {
    skyTop: '#071b34',
    skyMid: '#0e4c73',
    skyBottom: '#14b8a6',
    glow: '#67e8f9',
    accent: '#2dd4bf',
    silBack: '#0a3352',
    silMid: '#07243b',
    silFront: '#041422',
  },
  desert: {
    skyTop: '#1f102b',
    skyMid: '#7c2d12',
    skyBottom: '#f59e0b',
    glow: '#fef08a',
    accent: '#fb923c',
    silBack: '#6b2710',
    silMid: '#431407',
    silFront: '#220903',
  },
  forest: {
    skyTop: '#071c16',
    skyMid: '#114232',
    skyBottom: '#3f7d47',
    glow: '#bbf7d0',
    accent: '#4ade80',
    silBack: '#0d3326',
    silMid: '#082219',
    silFront: '#04120d',
  },
  mountain: {
    skyTop: '#080e24',
    skyMid: '#1e3a5f',
    skyBottom: '#64748b',
    glow: '#a5f3fc',
    accent: '#38bdf8',
    silBack: '#263850',
    silMid: '#142033',
    silFront: '#090f1c',
  },
  cyber: {
    skyTop: '#09091c',
    skyMid: '#2e1065',
    skyBottom: '#be185d',
    glow: '#22d3ee',
    accent: '#f472b6',
    silBack: '#1e1b4b',
    silMid: '#11102e',
    silFront: '#070718',
  },
  cosmos: {
    skyTop: '#030510',
    skyMid: '#1e1b4b',
    skyBottom: '#4c1d95',
    glow: '#c4b5fd',
    accent: '#38bdf8',
    silBack: '#17153b',
    silMid: '#0e0c26',
    silFront: '#060514',
  },
  sunset: {
    skyTop: '#240b36',
    skyMid: '#9a3412',
    skyBottom: '#f59e0b',
    glow: '#fef08a',
    accent: '#fb7185',
    silBack: '#4c1d24',
    silMid: '#2a0f18',
    silFront: '#14060b',
  },
  studio: {
    skyTop: '#0b132b',
    skyMid: '#1c2541',
    skyBottom: '#3a506b',
    glow: '#bae6fd',
    accent: '#38bdf8',
    silBack: '#1b263b',
    silMid: '#111827',
    silFront: '#070b14',
  },
};

function wrapCaptionLines(caption: string, maxCharsPerLine: number): string[] {
  const words = caption.trim().split(/\s+/);
  const lines: string[] = [];
  let cur = '';
  for (const w of words) {
    if (!cur) {
      cur = w;
    } else if (cur.length + 1 + w.length <= maxCharsPerLine) {
      cur += ` ${w}`;
    } else {
      lines.push(cur);
      cur = w;
      if (lines.length >= 2) break;
    }
  }
  if (cur && lines.length < 2) lines.push(cur);
  return lines.length > 0 ? lines : ['OpenFrame Studio'];
}

function buildStarsSvg(w: number, h: number, seed: number, count: number, color: string): string {
  const stars: string[] = [];
  for (let i = 0; i < count; i++) {
    const sx = ((seed * 19 + i * 137) % 97) / 100;
    const sy = ((seed * 31 + i * 89) % 58) / 100;
    const r = 1 + ((i + seed) % 3) * 0.8;
    const op = (0.35 + ((i * 17) % 60) / 100).toFixed(2);
    stars.push(
      `<circle cx="${(sx * w).toFixed(1)}" cy="${(sy * h).toFixed(1)}" r="${r.toFixed(1)}" fill="${color}" fill-opacity="${op}"/>`
    );
  }
  return stars.join('');
}

function buildParticlesSvg(w: number, h: number, seed: number, count: number, color: string): string {
  const out: string[] = [];
  for (let i = 0; i < count; i++) {
    const px = ((seed * 23 + i * 113) % 94 + 3) / 100;
    const py = ((seed * 41 + i * 79) % 72 + 12) / 100;
    const r = 2 + ((i + seed) % 5) * 1.4;
    const op = (0.2 + ((i * 19) % 45) / 100).toFixed(2);
    out.push(
      `<circle cx="${(px * w).toFixed(1)}" cy="${(py * h).toFixed(1)}" r="${r.toFixed(1)}" fill="${color}" fill-opacity="${op}"/>`
    );
  }
  return out.join('');
}

export function renderSceneSvg(params: {
  theme: SceneTheme;
  sceneIndex: 0 | 1 | 2;
  width: number;
  height: number;
  caption: string;
  seed: number;
}): string {
  const { theme, sceneIndex, width: w, height: h, caption, seed } = params;
  const pal = THEME_PALETTES[theme];
  const minDim = Math.min(w, h);
  const horizonY = Math.round(h * (sceneIndex === 1 ? 0.64 : 0.68));
  const cx = Math.round(w * 0.5);

  let sceneElements = '';

  if (theme === 'spiritual-twilight') {
    const stars = buildStarsSvg(w, h, seed + sceneIndex * 11, 45, '#fef3c7');
    const motes = buildParticlesSvg(w, h, seed + sceneIndex * 29, 22, '#fde68a');

    if (sceneIndex === 0) {
      // Scene 1: Mosque domes & twin minarets under crescent moon & golden twilight glow
      const moonX = Math.round(w * 0.68);
      const moonY = Math.round(h * 0.22);
      const moonR = Math.round(minDim * 0.085);
      const domeW = Math.round(w * 0.42);
      const domeTop = Math.round(horizonY - minDim * 0.22);
      const minW = Math.round(minDim * 0.036);
      const leftMinX = Math.round(cx - domeW * 0.68);
      const rightMinX = Math.round(cx + domeW * 0.68 - minW);
      const minTop = Math.round(horizonY - minDim * 0.34);

      sceneElements = `
        ${stars}
        <circle cx="${cx}" cy="${Math.round(horizonY - minDim * 0.08)}" r="${Math.round(minDim * 0.45)}" fill="url(#radialGlow)"/>
        <polygon points="${moonX},${moonY} ${Math.round(w * 0.2)},${horizonY} ${Math.round(w * 0.85)},${horizonY}" fill="${pal.glow}" fill-opacity="0.06"/>
        <circle cx="${moonX}" cy="${moonY}" r="${moonR}" fill="#fef3c7"/>
        <circle cx="${moonX + Math.round(moonR * 0.34)}" cy="${moonY - Math.round(moonR * 0.24)}" r="${Math.round(moonR * 0.88)}" fill="${pal.skyTop}"/>
        <path d="M0 ${horizonY + 12} Q${Math.round(w * 0.25)} ${horizonY - 26} ${cx} ${horizonY + 8} T${w} ${horizonY - 12} L${w} ${h} L0 ${h} Z" fill="${pal.silBack}"/>
        <!-- Mosque silhouette -->
        <rect x="${leftMinX}" y="${minTop}" width="${minW}" height="${horizonY - minTop + 20}" fill="${pal.silFront}"/>
        <polygon points="${leftMinX + minW / 2},${minTop - minW * 1.4} ${leftMinX - 4},${minTop} ${leftMinX + minW + 4},${minTop}" fill="${pal.silFront}"/>
        <rect x="${rightMinX}" y="${minTop}" width="${minW}" height="${horizonY - minTop + 20}" fill="${pal.silFront}"/>
        <polygon points="${rightMinX + minW / 2},${minTop - minW * 1.4} ${rightMinX - 4},${minTop} ${rightMinX + minW + 4},${minTop}" fill="${pal.silFront}"/>
        <path d="M${cx - domeW / 2} ${horizonY + 16} L${cx - domeW / 2} ${domeTop + minDim * 0.08} Q${cx} ${domeTop - minDim * 0.12} ${cx + domeW / 2} ${domeTop + minDim * 0.08} L${cx + domeW / 2} ${horizonY + 16} Z" fill="${pal.silFront}"/>
        <rect x="${cx - domeW * 0.64}" y="${horizonY - minDim * 0.07}" width="${domeW * 1.28}" height="${h - horizonY + minDim * 0.09}" fill="${pal.silFront}"/>
        <!-- Warm arched windows -->
        <path d="M${cx - 16} ${horizonY - 8} L${cx - 16} ${horizonY - 36} Q${cx} ${horizonY - 52} ${cx + 16} ${horizonY - 36} L${cx + 16} ${horizonY - 8} Z" fill="${pal.accent}" fill-opacity="0.88"/>
        <path d="M${cx - 64} ${horizonY - 8} L${cx - 64} ${horizonY - 28} Q${cx - 52} ${horizonY - 40} ${cx - 40} ${horizonY - 28} L${cx - 40} ${horizonY - 8} Z" fill="${pal.accent}" fill-opacity="0.72"/>
        <path d="M${cx + 40} ${horizonY - 8} L${cx + 40} ${horizonY - 28} Q${cx + 52} ${horizonY - 40} ${cx + 64} ${horizonY - 28} L${cx + 64} ${horizonY - 8} Z" fill="${pal.accent}" fill-opacity="0.72"/>
        ${motes}
      `;
    } else if (sceneIndex === 1) {
      // Scene 2: Ornate glowing Islamic lantern (Fanous) inside arch with radiant light
      const lx = cx;
      const ly = Math.round(h * 0.44);
      const lSize = Math.round(minDim * 0.14);
      const archW = Math.round(minDim * 0.62);
      sceneElements = `
        ${stars}
        <circle cx="${lx}" cy="${ly}" r="${Math.round(minDim * 0.48)}" fill="url(#radialGlow)"/>
        <!-- Archway frame -->
        <path d="M0 0 H${w} V${h} H0 Z M${cx - archW / 2} ${h} L${cx - archW / 2} ${Math.round(h * 0.36)} Q${cx} ${Math.round(h * 0.14)} ${cx + archW / 2} ${Math.round(h * 0.36)} L${cx + archW / 2} ${h} Z" fill="${pal.silFront}" fill-rule="evenodd" fill-opacity="0.85"/>
        <!-- Hanging chain & lantern -->
        <line x1="${lx}" y1="0" x2="${lx}" y2="${ly - lSize}" stroke="${pal.accent}" stroke-width="4"/>
        <polygon points="${lx},${ly - lSize} ${lx - lSize * 0.6},${ly - lSize * 0.45} ${lx + lSize * 0.6},${ly - lSize * 0.45}" fill="${pal.silMid}" stroke="${pal.accent}" stroke-width="3"/>
        <rect x="${lx - lSize * 0.5}" y="${ly - lSize * 0.45}" width="${lSize}" height="${lSize * 1.15}" rx="8" fill="${pal.glow}" fill-opacity="0.92" stroke="${pal.accent}" stroke-width="4"/>
        <line x1="${lx}" y1="${ly - lSize * 0.45}" x2="${lx}" y2="${ly + lSize * 0.7}" stroke="${pal.silMid}" stroke-width="3"/>
        <polygon points="${lx - lSize * 0.55},${ly + lSize * 0.7} ${lx + lSize * 0.55},${ly + lSize * 0.7} ${lx},${ly + lSize * 1.05}" fill="${pal.silMid}" stroke="${pal.accent}" stroke-width="3"/>
        ${motes}
      `;
    } else {
      // Scene 3: Radiant golden dawn sunbeams over calm water & cypress silhouettes
      const sunY = Math.round(horizonY - minDim * 0.04);
      sceneElements = `
        ${stars}
        <circle cx="${cx}" cy="${sunY}" r="${Math.round(minDim * 0.52)}" fill="url(#radialGlow)"/>
        <polygon points="${cx},${sunY} ${Math.round(w * 0.05)},0 ${Math.round(w * 0.32)},0" fill="${pal.glow}" fill-opacity="0.09"/>
        <polygon points="${cx},${sunY} ${Math.round(w * 0.42)},0 ${Math.round(w * 0.62)},0" fill="${pal.glow}" fill-opacity="0.12"/>
        <polygon points="${cx},${sunY} ${Math.round(w * 0.7)},0 ${Math.round(w * 0.95)},0" fill="${pal.glow}" fill-opacity="0.09"/>
        <circle cx="${cx}" cy="${sunY}" r="${Math.round(minDim * 0.11)}" fill="#fef3c7" fill-opacity="0.95"/>
        <!-- Calm lake reflection -->
        <rect x="0" y="${horizonY}" width="${w}" height="${h - horizonY}" fill="${pal.silMid}"/>
        <ellipse cx="${cx}" cy="${horizonY + 28}" rx="${Math.round(minDim * 0.22)}" ry="10" fill="${pal.accent}" fill-opacity="0.45"/>
        <ellipse cx="${cx}" cy="${horizonY + 62}" rx="${Math.round(minDim * 0.16)}" ry="7" fill="${pal.accent}" fill-opacity="0.32"/>
        <ellipse cx="${cx}" cy="${horizonY + 95}" rx="${Math.round(minDim * 0.1)}" ry="5" fill="${pal.accent}" fill-opacity="0.22"/>
        <!-- Cypress tree silhouettes -->
        <ellipse cx="${Math.round(w * 0.14)}" cy="${horizonY - 45}" rx="22" ry="72" fill="${pal.silFront}"/>
        <ellipse cx="${Math.round(w * 0.22)}" cy="${horizonY - 32}" rx="16" ry="52" fill="${pal.silFront}"/>
        <ellipse cx="${Math.round(w * 0.84)}" cy="${horizonY - 48}" rx="24" ry="76" fill="${pal.silFront}"/>
        ${motes}
      `;
    }
  } else if (theme === 'ocean') {
    const bubbles = buildParticlesSvg(w, h, seed + sceneIndex * 17, 26, '#a5f3fc');
    if (sceneIndex === 0) {
      sceneElements = `
        <circle cx="${cx}" cy="${Math.round(horizonY - 30)}" r="${Math.round(minDim * 0.36)}" fill="url(#radialGlow)"/>
        <circle cx="${cx}" cy="${Math.round(horizonY - 24)}" r="${Math.round(minDim * 0.12)}" fill="#fef08a" fill-opacity="0.9"/>
        <path d="M0 ${horizonY} Q${w * 0.25} ${horizonY - 24} ${w * 0.5} ${horizonY} T${w} ${horizonY} L${w} ${h} L0 ${h} Z" fill="${pal.silBack}"/>
        <path d="M0 ${horizonY + 35} Q${w * 0.3} ${horizonY + 12} ${w * 0.6} ${horizonY + 38} T${w} ${horizonY + 25} L${w} ${h} L0 ${h} Z" fill="${pal.silMid}"/>
        <path d="M0 ${horizonY + 75} Q${w * 0.2} ${horizonY + 55} ${w * 0.55} ${horizonY + 80} T${w} ${horizonY + 65} L${w} ${h} L0 ${h} Z" fill="${pal.silFront}"/>
        ${bubbles}
      `;
    } else if (sceneIndex === 1) {
      // Underwater rays + whale silhouette
      const wx = Math.round(w * 0.52);
      const wy = Math.round(h * 0.48);
      sceneElements = `
        <polygon points="${w * 0.25},0 ${w * 0.45},0 ${w * 0.65},${h} ${w * 0.1},${h}" fill="${pal.glow}" fill-opacity="0.1"/>
        <polygon points="${w * 0.55},0 ${w * 0.72},0 ${w * 0.92},${h} ${w * 0.48},${h}" fill="${pal.glow}" fill-opacity="0.08"/>
        <path d="M${wx - 120} ${wy} Q${wx - 20} ${wy - 68} ${wx + 90} ${wy - 10} Q${wx + 140} ${wy - 45} ${wx + 165} ${wy - 22} Q${wx + 135} ${wy + 5} ${wx + 155} ${wy + 34} Q${wx + 115} ${wy + 18} ${wx + 80} ${wy + 15} Q${wx - 35} ${wy + 52} ${wx - 120} ${wy} Z" fill="${pal.silFront}"/>
        ${bubbles}
      `;
    } else {
      // Bioluminescent jellyfish
      const jx = cx;
      const jy = Math.round(h * 0.4);
      const jr = Math.round(minDim * 0.13);
      sceneElements = `
        <circle cx="${jx}" cy="${jy}" r="${Math.round(minDim * 0.4)}" fill="url(#radialGlow)"/>
        <path d="M${jx - jr} ${jy} Q${jx} ${jy - jr * 1.4} ${jx + jr} ${jy} Z" fill="${pal.accent}" fill-opacity="0.82"/>
        <path d="M${jx - jr * 0.6} ${jy} Q${jx - jr * 0.8} ${jy + jr * 1.3} ${jx - jr * 0.4} ${jy + jr * 2.1}" stroke="${pal.glow}" stroke-width="4" fill="none" stroke-opacity="0.7"/>
        <path d="M${jx} ${jy} Q${jx + jr * 0.2} ${jy + jr * 1.5} ${jx - jr * 0.1} ${jy + jr * 2.4}" stroke="${pal.glow}" stroke-width="4" fill="none" stroke-opacity="0.8"/>
        <path d="M${jx + jr * 0.6} ${jy} Q${jx + jr * 0.9} ${jy + jr * 1.3} ${jx + jr * 0.5} ${jy + jr * 2.0}" stroke="${pal.glow}" stroke-width="4" fill="none" stroke-opacity="0.7"/>
        ${bubbles}
      `;
    }
  } else if (theme === 'cyber') {
    const lights = buildParticlesSvg(w, h, seed + sceneIndex * 21, 30, pal.glow);
    const buildings: string[] = [];
    const cols = 10;
    const bw = Math.ceil(w / cols);
    for (let i = 0; i < cols; i++) {
      const bh = Math.round(h * (0.25 + (((seed + i * 37 + sceneIndex * 13) % 40) / 100)));
      const bx = i * bw;
      const by = h - bh;
      buildings.push(`<rect x="${bx}" y="${by}" width="${bw - 4}" height="${bh}" fill="${pal.silFront}"/>`);
      buildings.push(
        `<rect x="${bx + 8}" y="${by + 16}" width="${Math.max(6, bw - 22)}" height="6" fill="${i % 2 === 0 ? pal.glow : pal.accent}" fill-opacity="0.85"/>`
      );
      buildings.push(
        `<rect x="${bx + 8}" y="${by + 34}" width="${Math.max(6, bw - 28)}" height="6" fill="${i % 2 === 1 ? pal.glow : pal.accent}" fill-opacity="0.6"/>`
      );
    }
    sceneElements = `
      <circle cx="${cx}" cy="${Math.round(h * 0.36)}" r="${Math.round(minDim * 0.38)}" fill="url(#radialGlow)"/>
      <circle cx="${cx}" cy="${Math.round(h * 0.36)}" r="${Math.round(minDim * 0.14)}" fill="${pal.accent}" fill-opacity="0.4"/>
      ${buildings.join('')}
      ${lights}
    `;
  } else if (theme === 'cosmos') {
    const stars = buildStarsSvg(w, h, seed + sceneIndex * 19, 75, '#ffffff');
    const px = Math.round(w * (sceneIndex === 0 ? 0.5 : sceneIndex === 1 ? 0.38 : 0.62));
    const py = Math.round(h * 0.42);
    const pr = Math.round(minDim * (sceneIndex === 1 ? 0.18 : 0.13));
    sceneElements = `
      ${stars}
      <circle cx="${px}" cy="${py}" r="${Math.round(minDim * 0.45)}" fill="url(#radialGlow)"/>
      <circle cx="${px}" cy="${py}" r="${pr}" fill="${pal.skyBottom}"/>
      <ellipse cx="${px}" cy="${py}" rx="${Math.round(pr * 2.1)}" ry="${Math.round(pr * 0.42)}" transform="rotate(-18 ${px} ${py})" fill="none" stroke="${pal.glow}" stroke-width="6" stroke-opacity="0.7"/>
      <path d="M0 ${horizonY + 50} Q${cx} ${horizonY - 10} ${w} ${horizonY + 45} L${w} ${h} L0 ${h} Z" fill="${pal.silFront}"/>
    `;
  } else if (theme === 'desert') {
    const stars = buildStarsSvg(w, h, seed + sceneIndex * 13, 30, '#fef08a');
    const sunX = Math.round(w * (sceneIndex === 0 ? 0.5 : sceneIndex === 1 ? 0.32 : 0.68));
    const sunY = Math.round(h * (sceneIndex === 2 ? 0.28 : 0.46));
    sceneElements = `
      ${stars}
      <circle cx="${sunX}" cy="${sunY}" r="${Math.round(minDim * 0.42)}" fill="url(#radialGlow)"/>
      <circle cx="${sunX}" cy="${sunY}" r="${Math.round(minDim * 0.12)}" fill="#fef08a" fill-opacity="0.92"/>
      <path d="M0 ${horizonY} Q${w * 0.35} ${horizonY - 70} ${w} ${horizonY + 10} L${w} ${h} L0 ${h} Z" fill="${pal.silBack}"/>
      <path d="M0 ${horizonY + 40} Q${w * 0.65} ${horizonY - 40} ${w} ${horizonY + 55} L${w} ${h} L0 ${h} Z" fill="${pal.silMid}"/>
      <path d="M0 ${horizonY + 90} Q${w * 0.3} ${horizonY + 35} ${w} ${horizonY + 105} L${w} ${h} L0 ${h} Z" fill="${pal.silFront}"/>
    `;
  } else {
    // forest, mountain, sunset, studio: rich layered peaks/trees + atmospheric rays
    const stars = buildStarsSvg(w, h, seed + sceneIndex * 17, 35, '#e2e8f0');
    const motes = buildParticlesSvg(w, h, seed + sceneIndex * 23, 20, pal.glow);
    const sunX = Math.round(w * (sceneIndex === 0 ? 0.5 : sceneIndex === 1 ? 0.34 : 0.66));
    const sunY = Math.round(horizonY - minDim * 0.1);
    sceneElements = `
      ${stars}
      <circle cx="${sunX}" cy="${sunY}" r="${Math.round(minDim * 0.45)}" fill="url(#radialGlow)"/>
      <polygon points="${sunX},${sunY} ${w * 0.12},${h} ${w * 0.42},${h}" fill="${pal.glow}" fill-opacity="0.07"/>
      <polygon points="${sunX},${sunY} ${w * 0.56},${h} ${w * 0.88},${h}" fill="${pal.glow}" fill-opacity="0.07"/>
      <circle cx="${sunX}" cy="${sunY}" r="${Math.round(minDim * 0.1)}" fill="${pal.glow}" fill-opacity="0.88"/>
      <polygon points="0,${horizonY + 40} ${w * 0.22},${horizonY - 85} ${w * 0.48},${horizonY + 35} ${w * 0.74},${horizonY - 105} ${w},${horizonY + 25} ${w},${h} 0,${h}" fill="${pal.silBack}"/>
      <polygon points="0,${horizonY + 75} ${w * 0.18},${horizonY - 15} ${w * 0.42},${horizonY + 60} ${w * 0.68},${horizonY - 35} ${w},${horizonY + 70} ${w},${h} 0,${h}" fill="${pal.silMid}"/>
      <path d="M0 ${horizonY + 95} Q${cx} ${horizonY + 55} ${w} ${horizonY + 95} L${w} ${h} L0 ${h} Z" fill="${pal.silFront}"/>
      ${motes}
    `;
  }

  // Crisp RTL / LTR bottom subtitle card
  const isRtl = hasRtlCharacters(caption);
  const maxChars = w < h ? 28 : 48;
  const lines = wrapCaptionLines(caption, maxChars);
  const fontSize = Math.max(20, Math.round(minDim * 0.044));
  const boxH = lines.length === 2 ? fontSize * 3.1 : fontSize * 2.1;
  const boxW = Math.round(w * 0.86);
  const boxX = Math.round((w - boxW) / 2);
  const boxY = Math.round(h - boxH - h * 0.08);
  const fontFamily = isRtl
    ? 'Noto Naskh Arabic, Noto Nastaliq Urdu, DejaVu Sans, sans-serif'
    : 'Noto Sans, DejaVu Sans, sans-serif';

  const textTags = lines
    .map((line, i) => {
      const ty = Math.round(boxY + (lines.length === 2 ? fontSize * (1.2 + i * 1.25) : fontSize * 1.35));
      return `<text x="${cx}" y="${ty}" text-anchor="middle" font-family="${fontFamily}" font-size="${fontSize}" font-weight="bold" fill="#f8fafc"${isRtl ? ' direction="rtl"' : ''}>${xmlEscape(line)}</text>`;
    })
    .join('\n  ');

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <defs>
    <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${pal.skyTop}"/>
      <stop offset="55%" stop-color="${pal.skyMid}"/>
      <stop offset="100%" stop-color="${pal.skyBottom}"/>
    </linearGradient>
    <radialGradient id="radialGlow" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="${pal.glow}" stop-opacity="0.65"/>
      <stop offset="60%" stop-color="${pal.accent}" stop-opacity="0.22"/>
      <stop offset="100%" stop-color="${pal.accent}" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="${w}" height="${h}" fill="url(#sky)"/>
  ${sceneElements}
  <rect x="${boxX}" y="${boxY}" width="${boxW}" height="${Math.round(boxH)}" rx="16" fill="#020617" fill-opacity="0.68" stroke="${pal.accent}" stroke-opacity="0.35" stroke-width="2"/>
  ${textTags}
</svg>`;
}

export function getAmbientExprForTheme(theme: SceneTheme): string {
  // Gentle harmonic stereo ambient pad tuned to scene mood
  switch (theme) {
    case 'spiritual-twilight':
      // Calm reflective D minor 9 / fifth drone
      return '0.045*sin(2*PI*146.83*t)+0.03*sin(2*PI*220.0*t)+0.02*sin(2*PI*293.66*t)+0.015*sin(2*PI*349.23*t)';
    case 'ocean':
      // Soft rolling Cmaj7 pad
      return '0.04*sin(2*PI*130.81*t)+0.025*sin(2*PI*196.0*t)+0.02*sin(2*PI*246.94*t)';
    case 'cyber':
      // Warm synth A minor pulse
      return '0.04*sin(2*PI*110.0*t)+0.025*sin(2*PI*164.81*t)+0.02*sin(2*PI*220.0*t)*(0.7+0.3*sin(2*PI*2*t))';
    case 'cosmos':
      // Deep space F# suspended pad
      return '0.04*sin(2*PI*185.0*t)+0.025*sin(2*PI*277.18*t)+0.02*sin(2*PI*369.99*t)';
    default:
      // Warm cinematic G major 9 ambient bed
      return '0.04*sin(2*PI*196.0*t)+0.025*sin(2*PI*293.66*t)+0.02*sin(2*PI*392.0*t)';
  }
}
