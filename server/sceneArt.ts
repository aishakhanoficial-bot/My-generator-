import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';
import fs from 'fs';

export type SceneTheme =
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

export interface SceneStoryboard {
  theme: SceneTheme;
  sceneCaptions: [string, string, string];
  sceneBeats: [string, string, string];
  sceneObjectTags?: [string[], string[], string[]];
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
  const dialogueSection = rawPrompt.match(
    /(?:exact(?:\s+urdu|\s+hindi)?\s*dialogue|speak\s+exactly(?:\s+this\s+dialogue)?|voiceover|narration|spoken\s+script)\s*[:：\-–]?[\s\S]{0,120}?["“«]([^"”»\n]{6,260})["”»]/i
  );
  if (dialogueSection?.[1]) {
    return dialogueSection[1].trim();
  }

  const inlineMatch = rawPrompt.match(
    /(?:voiceover|narration|script|dialogue|urdu\s*line|caption)\s*[:：\-–]\s*["“]?([^\n|]{6,220})["”]?/i
  );
  if (inlineMatch?.[1]) {
    const candidate = inlineMatch[1].replace(/["”]+$/g, '').trim();
    if (!/^the\s+(bird|character|narrator|speaker)\s+looks/i.test(candidate)) {
      return candidate;
    }
  }

  const rtlQuote = rawPrompt.match(/["“«]([^"”»]*[\u0600-\u06FF][^"”»]{4,240})["”»]/);
  if (rtlQuote?.[1]) {
    return rtlQuote[1].trim();
  }

  return null;
}

export function cleanDisplayPrompt(rawPrompt: string): string {
  let s = rawPrompt
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, ' ')
    .replace(/\b(veo\s*3|veo|sora|runway|master\s*prompt|prompt)\b/gi, ' ')
    .replace(/\b(duration|aspect\s*ratio|resolution|camera|lighting|style)\s*[:：]\s*[^|\n]+/gi, ' ')
    .replace(
      /\b(exactly\s*\d+\s*seconds?|vertical\s*9:16|horizontal\s*16:9|square\s*1:1|9:16|16:9|1:1|ultra\s*realistic|photorealistic|hyper\s*realistic|cinematic\s*8k|8k|4k|hdr|uhd|high-detail\s*3d\s*animated\s*video\s*of)\b/gi,
      ' '
    )
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

export function extractPromptBeats(rawPrompt: string): [string, string, string] {
  const timeMatches = Array.from(
    rawPrompt.matchAll(/\b\d+\s*[-–to]+\s*\d+\s*s(?:ec(?:onds?)?)?\s*[:：\-–]\s*([^\n|]+)/gi)
  )
    .map((m) => cleanDisplayPrompt(m[1]))
    .filter((s) => s.length >= 6);
  if (timeMatches.length >= 3) {
    return [timeMatches[0], timeMatches[1], timeMatches[2]];
  }

  const sceneMatches = Array.from(
    rawPrompt.matchAll(/(?:scene|shot|clip|part|beat)\s*\d+\s*[:：\-–]\s*([^\n|]+)/gi)
  )
    .map((m) => cleanDisplayPrompt(m[1]))
    .filter((s) => s.length >= 4);
  if (sceneMatches.length >= 3) {
    return [sceneMatches[0], sceneMatches[1], sceneMatches[2]];
  }

  const lineParts = rawPrompt
    .split(/\r?\n|\|/)
    .map((s) => s.trim())
    .filter((s) => !/^\d+\.\s*[^:]+:\s*$/.test(s))
    .map((s) => cleanDisplayPrompt(s))
    .filter((s) => s.length >= 6);

  if (lineParts.length >= 3) {
    return [lineParts[0], lineParts[1], lineParts[2]];
  }
  if (lineParts.length === 2) {
    return [lineParts[0], lineParts[1], `${lineParts[0]} · ${lineParts[1]}`];
  }

  const cleaned = cleanDisplayPrompt(rawPrompt);
  const clauses = cleaned
    .split(/[.,;·!?،۔]+/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 4);

  if (clauses.length >= 3) {
    return [clauses[0], clauses[1], clauses[2]];
  }
  if (clauses.length === 2) {
    return [clauses[0], clauses[1], cleaned];
  }

  return [cleaned, cleaned, cleaned];
}

function splitDialogueCaptions(dialogue: string): [string, string, string] | null {
  const clean = dialogue.trim();
  if (!clean) return null;
  const clauses = clean
    .split(/[،,.؛;!?؟۔]+/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 3);
  if (clauses.length >= 3) {
    return [clauses[0].slice(0, 62), clauses[1].slice(0, 62), clauses.slice(2).join(' ').slice(0, 62)];
  }
  const words = clean.split(/\s+/);
  if (words.length >= 6) {
    const t1 = Math.ceil(words.length / 3);
    const t2 = Math.ceil((words.length * 2) / 3);
    return [
      words.slice(0, t1).join(' ').slice(0, 62),
      words.slice(t1, t2).join(' ').slice(0, 62),
      words.slice(t2).join(' ').slice(0, 62),
    ];
  }
  return [clean.slice(0, 62), clean.slice(0, 62), clean.slice(0, 62)];
}

export function detectSceneTheme(prompt: string): SceneTheme {
  const p = prompt.toLowerCase();

  if (
    /garden|flower|flowers|wildflower|rose|tulip|lavender|jasmine|blossom|butterfly|butterflies|meadow|baby\s*bird|exotic\s*bird|turquoise.*bird|wet\s*stone.*stream|باغ|پھول|تتلی|چمن/.test(
      p
    )
  ) {
    return 'garden';
  }
  if (/cyber|neon|tokyo|city|rain|futuristic|synth|street|building|car|شہر|رات|shehar/.test(p)) {
    return 'cyber';
  }
  if (/ocean|sea|water|whale|wave|underwater|coral|jellyfish|beach|river|سمندر|لہر|پانی|دریا|samandar/.test(p)) {
    return 'ocean';
  }
  if (/desert|sand|dune|oasis|camel|sahara|pyramid|صحرا|ریت|sahra/.test(p)) {
    return 'desert';
  }
  if (/forest|jungle|moss|tree|pine|nature|leaf|wood|جنگل|درخت|jangal/.test(p)) {
    return 'forest';
  }
  if (/mountain|snow|alpine|peak|cliff|valley|aurora|waterfall|پہاڑ|برف|وادی|pahar/.test(p)) {
    return 'mountain';
  }
  if (/space|cosmos|galaxy|nebula|star|planet|astronaut|moon|universe|آسمان|ستارے|کائنات|چاند/.test(p)) {
    return 'cosmos';
  }
  if (/mosque|masjid|qabar|grave|قبر|مسجد|نماز|رمضان|eid|ramadan|crescent|lantern/.test(p)) {
    return 'spiritual-twilight';
  }
  if (/sunset|sunrise|dawn|golden hour|amber|fire|lava|candle|غروب|طلوع|سورج|شام/.test(p)) {
    return 'sunset';
  }
  if (
    /آخرت|تیاری|قبر|جنت|قرآن|دعا|اسلام|اللہ|موت|عبادت|ایمان|akhirat|hereafter|islamic|prayer|quran|dua|eternity|soul|faith|heaven|spiritual/.test(
      p
    )
  ) {
    return 'spiritual-twilight';
  }
  return 'studio';
}

function buildSpeakableAsciiFallback(prompt: string, theme: SceneTheme): string {
  const hint = extractVoiceoverHint(prompt);
  if (hint && /مسافر خانہ|آخرت|زادِ راہ/.test(hint)) {
    return 'Yeh duniya to chand din ka musafir khana hai, asal ghar to akhirat hai, is liye wahan ke liye bhi zaad e raah jama karte raho.';
  }

  const candidate = hint || cleanDisplayPrompt(prompt);
  const asciiOnly = candidate
    .replace(/[^\x20-\x7E]/g, ' ')
    .replace(/[|·]+/g, ', ')
    .replace(/\s+/g, ' ')
    .trim();

  if (theme === 'garden') {
    if (asciiOnly.length >= 16 && !/master prompt|veo|duration/i.test(asciiOnly)) {
      return asciiOnly.slice(0, 160);
    }
    return 'Beside a clear gentle stream and blooming wildflowers, a turquoise bird speaks softly in warm natural daylight.';
  }

  if (theme === 'spiritual-twilight') {
    if (/آخرت|تیاری|akhirat|hereafter/i.test(prompt)) {
      return 'Akhirat ki tayyari. Reflect on the hereafter. Every moment of life is a preparation for eternity.';
    }
    if (asciiOnly.length >= 16) {
      return `${asciiOnly.slice(0, 140)}. A calm spiritual reflection.`;
    }
    return 'Peaceful twilight reflection. Stillness of the heart, light upon the soul.';
  }

  if (asciiOnly.length >= 14) {
    return asciiOnly.slice(0, 180);
  }

  const themeLines: Record<SceneTheme, string> = {
    garden: 'Sunlight shines through a blooming flower garden beside a crystal-clear stream.',
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

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
    promise.then(
      (val) => {
        clearTimeout(timer);
        resolve(val);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      }
    );
  });
}

export async function planStoryboardAndVoiceover(params: {
  prompt: string;
  durationSec: number;
  width: number;
  height: number;
  jobId: string;
  voiceOutPath: string;
  allowGemini: boolean;
}): Promise<{ storyboard: SceneStoryboard; voiceWavPath: string | null }> {
  const fallbackTheme = detectSceneTheme(params.prompt);
  const beats = extractPromptBeats(params.prompt);
  const extractedDialogue = extractVoiceoverHint(params.prompt);
  const dialogueCaptions = extractedDialogue ? splitDialogueCaptions(extractedDialogue) : null;

  const fallbackCaptions: [string, string, string] = dialogueCaptions ?? [
    beats[0].slice(0, 62),
    beats[1].slice(0, 62),
    beats[2].slice(0, 62),
  ];
  const fallbackAscii = buildSpeakableAsciiFallback(params.prompt, fallbackTheme);

  const fallbackStoryboard: SceneStoryboard = {
    theme: fallbackTheme,
    sceneCaptions: fallbackCaptions,
    sceneBeats: beats,
    voiceoverScript: extractedDialogue || cleanDisplayPrompt(params.prompt),
    speakableAsciiFallback: fallbackAscii,
    voiceName:
      fallbackTheme === 'garden'
        ? 'Kore'
        : fallbackTheme === 'spiritual-twilight' || fallbackTheme === 'cosmos'
        ? 'Charon'
        : 'Kore',
    voiceStyle: 'Calm, expressive, heartfelt narrator',
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
        timeout: 12000,
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });

    const targetWords = Math.max(8, Math.min(34, Math.round(params.durationSec * 2.3)));

    const storyRes = await withTimeout(
      ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: `Analyze this video prompt and extract an accurate 3-scene storyboard + exact spoken voiceover:
"""
${params.prompt.slice(0, 3500)}
"""
Rules:
1. If the prompt provides an exact dialogue/voiceover (in Urdu, Hindi, Arabic, or English), set "voiceoverScript" to that EXACT spoken line. Otherwise write a ${targetWords}-word voiceover in the prompt's main language.
2. Write "speakableAsciiFallback" as a brief Roman-Urdu or English version of the voiceover.
3. Choose the single best visual "theme" from: garden, spiritual-twilight, ocean, desert, forest, mountain, cyber, cosmos, sunset, studio.
4. Write 3 short "sceneCaptions" (max 8 words each) in the dialogue's language matching Scenes 1, 2, 3.
5. For "sceneObjectTags", return 3 arrays of short visual keywords for Scenes 1, 2, 3.
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
              sceneCaptions: { type: Type.ARRAY, items: { type: Type.STRING } },
              sceneObjectTags: {
                type: Type.ARRAY,
                items: { type: Type.ARRAY, items: { type: Type.STRING } },
              },
            },
            required: [
              'theme',
              'voiceoverScript',
              'speakableAsciiFallback',
              'voiceName',
              'voiceStyle',
              'sceneCaptions',
              'sceneObjectTags',
            ],
          },
        },
      }),
      12000,
      'Gemini storyboard'
    );

    const parsed = JSON.parse((storyRes.text ?? '{}').trim()) as {
      theme?: string;
      voiceoverScript?: string;
      speakableAsciiFallback?: string;
      voiceName?: string;
      voiceStyle?: string;
      sceneCaptions?: string[];
      sceneObjectTags?: string[][];
    };

    const validThemes: SceneTheme[] = [
      'garden',
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

    const rawTags = Array.isArray(parsed.sceneObjectTags) ? parsed.sceneObjectTags : [];
    const sceneObjectTags: [string[], string[], string[]] = [
      Array.isArray(rawTags[0]) ? rawTags[0].map(String) : [],
      Array.isArray(rawTags[1]) ? rawTags[1].map(String) : [],
      Array.isArray(rawTags[2]) ? rawTags[2].map(String) : [],
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
      sceneBeats: beats,
      sceneObjectTags,
      voiceoverScript,
      speakableAsciiFallback: speakableAsciiFallback || fallbackAscii,
      voiceName,
      voiceStyle,
      usedGeminiStoryboard: true,
    };

    let voiceWavPath: string | null = null;
    try {
      const ttsRes = await withTimeout(
        ai.models.generateContent({
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
        }),
        12000,
        'Gemini TTS'
      );

      const base64Audio = ttsRes.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (base64Audio) {
        const wavBuffer = Buffer.from(base64Audio, 'base64');
        if (wavBuffer.length > 44) {
          fs.writeFileSync(params.voiceOutPath, wavBuffer);
          voiceWavPath = params.voiceOutPath;
        }
      }
    } catch {
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
  garden: {
    skyTop: '#38bdf8',
    skyMid: '#bae6fd',
    skyBottom: '#fef3c7',
    glow: '#fef08a',
    accent: '#f59e0b',
    silBack: '#15803d',
    silMid: '#166534',
    silFront: '#064e3b',
  },
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

function buildStarsSvg(w: number, h: number, seed: number, count: number, color: string, tNorm: number): string {
  const stars: string[] = [];
  for (let i = 0; i < count; i++) {
    const sx = ((seed * 19 + i * 137) % 97) / 100;
    const sy = ((seed * 31 + i * 89) % 58) / 100;
    const r = 1 + ((i + seed) % 3) * 0.8;
    const op = (0.35 + 0.55 * Math.abs(Math.sin(tNorm * Math.PI * 3 + i))).toFixed(2);
    stars.push(
      `<circle cx="${(sx * w).toFixed(1)}" cy="${(sy * h).toFixed(1)}" r="${r.toFixed(1)}" fill="${color}" fill-opacity="${op}"/>`
    );
  }
  return stars.join('');
}

function buildParticlesSvg(w: number, h: number, seed: number, count: number, color: string, tNorm: number): string {
  const out: string[] = [];
  for (let i = 0; i < count; i++) {
    const px = (((seed * 23 + i * 113) % 94) + 3) / 100 + Math.sin(tNorm * Math.PI * 2 + i) * 0.025;
    const py = (((((seed * 41 + i * 79) % 72) + 12) / 100 - tNorm * 0.18 + 1) % 0.85);
    const r = 2 + ((i + seed) % 5) * 1.3;
    const op = (0.28 + 0.35 * Math.abs(Math.cos(tNorm * Math.PI * 4 + i))).toFixed(2);
    out.push(
      `<circle cx="${(px * w).toFixed(1)}" cy="${(py * h).toFixed(1)}" r="${r.toFixed(1)}" fill="${color}" fill-opacity="${op}"/>`
    );
  }
  return out.join('');
}

function buildRainSvg(w: number, h: number, seed: number, tNorm: number): string {
  const streaks: string[] = [];
  for (let i = 0; i < 42; i++) {
    const x = (((seed * 29 + i * 97) % 98) / 100) * w;
    const y = (((((seed * 17 + i * 67) % 85) / 100) + tNorm * 1.8) % 1) * h;
    streaks.push(
      `<line x1="${x.toFixed(1)}" y1="${y.toFixed(1)}" x2="${(x - 10).toFixed(1)}" y2="${(y + 34).toFixed(1)}" stroke="#bae6fd" stroke-opacity="0.52" stroke-width="2.2"/>`
    );
  }
  return streaks.join('');
}

function drawAnimatedBirdSvg(
  bx: number,
  by: number,
  scale: number,
  tNorm: number,
  isCreamBabyBird: boolean
): string {
  const s = scale;
  // Continuous speech-like beak opening & closing
  const beakWave = Math.max(0, Math.sin(tNorm * Math.PI * 22) * 0.65 + Math.sin(tNorm * Math.PI * 37) * 0.35);
  const beakGap = beakWave * 9 * s;
  // Gentle expressive head tilt
  const headTilt = Math.sin(tNorm * Math.PI * 6) * 5.5;
  // Subtle wing flutter & body breathing
  const wingLift = Math.sin(tNorm * Math.PI * 10) * 6 * s;
  const breath = 1 + Math.sin(tNorm * Math.PI * 8) * 0.025;
  // Periodic natural eye blink
  const blinkPhase = (tNorm * 3.4) % 1;
  const isBlinking = blinkPhase > 0.91 && blinkPhase < 0.97;

  const bodyColor = isCreamBabyBird ? '#14b8a6' : '#06b6d4';
  const chestColor = isCreamBabyBird ? '#fef3c7' : '#facc15';
  const wingColor = isCreamBabyBird ? '#0d9488' : '#7c3aed';
  const tailColor = isCreamBabyBird ? '#0f766e' : '#6d28d9';
  const headColor = isCreamBabyBird ? '#2dd4bf' : '#0891b2';
  const crestColor = isCreamBabyBird ? '#5eead4' : '#a855f7';

  const hx = bx + 6 * s;
  const hy = by - 26 * s;

  const parts: string[] = [];
  // Tail feathers gently bobbing
  parts.push(
    `<path d="M${bx - 16 * s} ${by + 16 * s} L${bx - 50 * s} ${by + 58 * s + wingLift * 0.5} L${bx - 22 * s} ${by + 54 * s} L${bx - 6 * s} ${by + 24 * s} Z" fill="${tailColor}"/>`
  );
  // Plump baby/exotic bird torso with breathing motion
  parts.push(
    `<ellipse cx="${bx}" cy="${by + 12 * s}" rx="${28 * s * breath}" ry="${37 * s}" transform="rotate(-10 ${bx} ${by + 12 * s})" fill="${bodyColor}"/>`
  );
  // Soft cream or golden-yellow chest
  parts.push(
    `<ellipse cx="${bx + 9 * s}" cy="${by + 16 * s}" rx="${17 * s * breath}" ry="${26 * s}" fill="${chestColor}"/>`
  );
  // Flapping wing with subtle feather motion
  parts.push(
    `<path d="M${bx - 22 * s} ${by - 2 * s - wingLift * 0.4} Q${bx - 38 * s} ${by + 18 * s - wingLift} ${bx - 12 * s} ${by + 40 * s - wingLift * 0.3} Q${bx + 6 * s} ${by + 22 * s} ${bx - 2 * s} ${by - 2 * s} Z" fill="${wingColor}"/>`
  );

  // Tilting head group (crest + head + blinking eye + talking beak)
  parts.push(`<g transform="rotate(${headTilt.toFixed(2)} ${hx.toFixed(1)} ${hy.toFixed(1)})">`);
  parts.push(
    `<path d="M${hx - 8 * s} ${hy - 16 * s} Q${hx - 18 * s} ${hy - 34 * s} ${hx - 28 * s} ${hy - 22 * s} Q${hx - 14 * s} ${hy - 16 * s} ${hx} ${hy - 18 * s} Z" fill="${crestColor}"/>`
  );
  parts.push(`<circle cx="${hx}" cy="${hy}" r="${21 * s}" fill="${headColor}"/>`);

  // Sparkling eye or closed blink arc
  if (isBlinking) {
    parts.push(
      `<path d="M${hx + 2 * s} ${hy - 2 * s} Q${hx + 7 * s} ${hy + 3 * s} ${hx + 13 * s} ${hy - 2 * s}" fill="none" stroke="#0f172a" stroke-width="${Math.max(2, 3 * s)}" stroke-linecap="round"/>`
    );
  } else {
    parts.push(`<circle cx="${hx + 7 * s}" cy="${hy - 3 * s}" r="${6.2 * s}" fill="#0f172a"/>`);
    parts.push(`<circle cx="${hx + 9 * s}" cy="${hy - 5 * s}" r="${2.2 * s}" fill="#ffffff"/>`);
  }

  // Upper & lower moving beak synced with speech wave
  parts.push(
    `<polygon points="${hx + 18 * s},${hy - 3 * s} ${hx + 38 * s},${hy - 2 * s - beakGap * 0.45} ${hx + 18 * s},${hy + 3 * s}" fill="#f97316"/>`
  );
  parts.push(
    `<polygon points="${hx + 18 * s},${hy + 3 * s} ${hx + 35 * s},${hy + 5 * s + beakGap} ${hx + 17 * s},${hy + 8 * s + beakGap * 0.4}" fill="#ea580c"/>`
  );
  parts.push(`</g>`);

  // Little orange feet gripping perch
  parts.push(
    `<line x1="${bx - 5 * s}" y1="${by + 45 * s}" x2="${bx - 8 * s}" y2="${by + 56 * s}" stroke="#ea580c" stroke-width="${Math.max(2, 3.2 * s)}" stroke-linecap="round"/>`
  );
  parts.push(
    `<line x1="${bx + 9 * s}" y1="${by + 45 * s}" x2="${bx + 11 * s}" y2="${by + 56 * s}" stroke="#ea580c" stroke-width="${Math.max(2, 3.2 * s)}" stroke-linecap="round"/>`
  );

  return parts.join('\n  ');
}

function drawLivingGardenSceneSvg(params: {
  w: number;
  h: number;
  seed: number;
  tNorm: number;
  fullText: string;
}): string {
  const { w, h, seed, tNorm, fullText } = params;
  const minDim = Math.min(w, h);
  const cx = Math.round(w * 0.5);
  const horizonY = Math.round(h * 0.56);

  const isWetStoneStream = /wet\s*stone|stone|pebble|baby\s*bird|turquoise-and-cream|turquoise\s+and\s+cream/.test(
    fullText
  );
  const isCreamBabyBird = /cream|baby\s*bird/.test(fullText);

  // Smooth cinematic camera push-in to close-up followed by gentle pullback
  const camZoom =
    tNorm < 0.45
      ? 1 + (tNorm / 0.45) * 0.24
      : tNorm < 0.72
      ? 1.24
      : 1.24 - ((tNorm - 0.72) / 0.28) * 0.16;
  const camFocusY = h * 0.47;

  const layers: string[] = [];
  layers.push(
    `<g transform="translate(${(cx * (1 - camZoom)).toFixed(1)} ${(camFocusY * (1 - camZoom)).toFixed(1)}) scale(${camZoom.toFixed(4)})">`
  );

  // Soft daylight / golden sunrise glow
  const sunX = Math.round(w * (0.48 + Math.sin(tNorm * Math.PI) * 0.08));
  const sunY = Math.round(horizonY - minDim * 0.22);
  layers.push(`<circle cx="${sunX}" cy="${sunY}" r="${Math.round(minDim * 0.52)}" fill="url(#radialGlow)"/>`);
  layers.push(`<circle cx="${sunX}" cy="${sunY}" r="${Math.round(minDim * 0.11)}" fill="#fef9c3" fill-opacity="0.95"/>`);

  // Soft-focus green meadow banks & plants
  layers.push(`<path d="M0 ${horizonY + 8} Q${w * 0.28} ${horizonY - 38} ${w} ${horizonY + 10} L${w} ${h} L0 ${h} Z" fill="#15803d"/>`);
  layers.push(`<path d="M0 ${horizonY + 42} Q${w * 0.65} ${horizonY + 14} ${w} ${horizonY + 48} L${w} ${h} L0 ${h} Z" fill="#166534"/>`);

  // Clear gentle flowing stream with continuous animated water ripples
  layers.push(
    `<path d="M0 ${horizonY + 56} Q${w * 0.45} ${horizonY + 34} ${w} ${horizonY + 62} L${w} ${h} L0 ${h} Z" fill="#0ea5e9" fill-opacity="0.72"/>`
  );
  layers.push(
    `<path d="M0 ${horizonY + 95} Q${w * 0.55} ${horizonY + 72} ${w} ${horizonY + 98} L${w} ${h} L0 ${h} Z" fill="#0284c7" fill-opacity="0.55"/>`
  );
  for (let i = 0; i < 9; i++) {
    const ry = horizonY + 72 + i * (h * 0.032);
    const rx = ((w * 0.12 + i * w * 0.11 + tNorm * w * 0.55) % (w * 0.9)) + w * 0.05;
    const rw = minDim * (0.06 + (i % 3) * 0.025);
    layers.push(
      `<ellipse cx="${rx.toFixed(1)}" cy="${ry.toFixed(1)}" rx="${rw.toFixed(1)}" ry="3.5" fill="#e0f2fe" fill-opacity="0.65"/>`
    );
  }

  // Swaying green plants & purple wildflowers in background/foreground
  const sway = Math.sin(tNorm * Math.PI * 4) * 8;
  const flowerColors = /purple\s*wildflower/.test(fullText)
    ? ['#a855f7', '#c084fc', '#9333ea', '#e879f9', '#d8b4fe']
    : ['#ffffff', '#f472b6', '#a855f7', '#fb7185', '#fef08a', '#c084fc'];

  for (let i = 0; i < 14; i++) {
    const fx = (((seed * 13 + i * 71) % 90) + 5) * (w / 100);
    const fy = horizonY + 12 + ((i * 29) % Math.round(h * 0.2));
    const fr = minDim * 0.024;
    const col = flowerColors[i % flowerColors.length];
    const localSway = sway * (i % 2 === 0 ? 1 : -0.8);
    layers.push(
      `<path d="M${fx.toFixed(1)} ${(fy + 30).toFixed(1)} Q${(fx + localSway * 0.5).toFixed(1)} ${(fy + 14).toFixed(1)} ${(fx + localSway).toFixed(1)} ${fy.toFixed(1)}" stroke="#14532d" stroke-width="3.2" fill="none"/>`
    );
    layers.push(`<circle cx="${(fx + localSway).toFixed(1)}" cy="${fy.toFixed(1)}" r="${fr.toFixed(1)}" fill="${col}"/>`);
    layers.push(
      `<circle cx="${(fx + localSway).toFixed(1)}" cy="${fy.toFixed(1)}" r="${(fr * 0.35).toFixed(1)}" fill="#fef08a"/>`
    );
  }

  // Perch: either wet mossy river stone in stream OR curved flowering branch
  const perchY = Math.round(h * 0.56);
  const birdScale = minDim / 335;
  if (isWetStoneStream) {
    // Wet glossy stream stone + soft water ring ripple around stone base
    layers.push(
      `<ellipse cx="${cx}" cy="${perchY + 62 * birdScale}" rx="${86 * birdScale}" ry="${16 * birdScale}" fill="none" stroke="#e0f2fe" stroke-opacity="${(0.45 + 0.3 * Math.sin(tNorm * Math.PI * 8)).toFixed(2)}" stroke-width="2.5"/>`
    );
    layers.push(
      `<path d="M${cx - 88 * birdScale} ${perchY + 66 * birdScale} Q${cx - 70 * birdScale} ${perchY + 14 * birdScale} ${cx} ${perchY + 18 * birdScale} Q${cx + 76 * birdScale} ${perchY + 16 * birdScale} ${cx + 90 * birdScale} ${perchY + 66 * birdScale} Z" fill="#475569"/>`
    );
    layers.push(
      `<ellipse cx="${cx - 12 * birdScale}" cy="${perchY + 26 * birdScale}" rx="${44 * birdScale}" ry="${9 * birdScale}" fill="#94a3b8" fill-opacity="0.48"/>`
    );
  } else {
    layers.push(
      `<path d="M0 ${perchY + 55} Q${w * 0.38} ${perchY - 8} ${w * 0.88} ${perchY + 22}" stroke="#57341a" stroke-width="${Math.round(minDim * 0.04)}" fill="none" stroke-linecap="round"/>`
    );
    [0.16, 0.28, 0.66, 0.8].forEach((px, idx) => {
      const bx = Math.round(w * px + sway * 0.4);
      const by = Math.round(perchY + (idx % 2 === 0 ? -14 : 16));
      const r = Math.round(minDim * 0.032);
      layers.push(`<circle cx="${bx}" cy="${by}" r="${r}" fill="${idx % 2 === 0 ? '#fbcfe8' : '#ffffff'}" fill-opacity="0.92"/>`);
      layers.push(`<circle cx="${bx}" cy="${by}" r="${Math.round(r * 0.36)}" fill="#facc15"/>`);
    });
  }

  // Animated talking bird perched right on the stone/branch
  const birdY = isWetStoneStream ? perchY - 30 * birdScale : perchY - 16 * birdScale;
  layers.push(drawAnimatedBirdSvg(cx, birdY, birdScale, tNorm, isCreamBabyBird));

  // Fluttering butterflies if not purely wet-stone minimal, or subtle floating motes
  if (/butterfly|butterflies|تتلی/.test(fullText)) {
    const wingFlap = 0.45 + 0.55 * Math.abs(Math.sin(tNorm * Math.PI * 16));
    const b1x = w * 0.24 + Math.sin(tNorm * Math.PI * 4) * 26;
    const b1y = h * 0.32 + Math.cos(tNorm * Math.PI * 3) * 18;
    const b2x = w * 0.76 - Math.cos(tNorm * Math.PI * 3) * 22;
    const b2y = h * 0.29 + Math.sin(tNorm * Math.PI * 5) * 14;
    for (const b of [
      { x: b1x, y: b1y, c: '#f472b6' },
      { x: b2x, y: b2y, c: '#38bdf8' },
    ]) {
      layers.push(`<ellipse cx="${(b.x - 7 * wingFlap).toFixed(1)}" cy="${b.y.toFixed(1)}" rx="${(9 * wingFlap).toFixed(1)}" ry="6" fill="${b.c}" fill-opacity="0.88"/>`);
      layers.push(`<ellipse cx="${(b.x + 7 * wingFlap).toFixed(1)}" cy="${b.y.toFixed(1)}" rx="${(9 * wingFlap).toFixed(1)}" ry="6" fill="${b.c}" fill-opacity="0.88"/>`);
    }
  }

  layers.push(buildParticlesSvg(w, h, seed, 22, '#fef9c3', tNorm));
  layers.push(`</g>`);
  return layers.join('\n  ');
}

function buildCaptionOverlaySvg(w: number, h: number, caption: string, accent: string): string {
  const minDim = Math.min(w, h);
  const cx = Math.round(w * 0.5);
  const isRtl = hasRtlCharacters(caption);
  const maxChars = w < h ? 28 : 48;
  const lines = wrapCaptionLines(caption, maxChars);
  const fontSize = Math.max(20, Math.round(minDim * 0.044));
  const boxH = lines.length === 2 ? fontSize * 3.1 : fontSize * 2.1;
  const boxW = Math.round(w * 0.86);
  const boxX = Math.round((w - boxW) / 2);
  const boxY = Math.round(h - boxH - h * 0.075);
  const fontFamily = isRtl
    ? 'Noto Naskh Arabic, Noto Nastaliq Urdu, DejaVu Sans, sans-serif'
    : 'Noto Sans, DejaVu Sans, sans-serif';

  const textTags = lines
    .map((line, i) => {
      const ty = Math.round(boxY + (lines.length === 2 ? fontSize * (1.2 + i * 1.25) : fontSize * 1.35));
      return `<text x="${cx}" y="${ty}" text-anchor="middle" font-family="${fontFamily}" font-size="${fontSize}" font-weight="bold" fill="#f8fafc"${isRtl ? ' direction="rtl"' : ''}>${xmlEscape(line)}</text>`;
    })
    .join('\n  ');

  return `
  <rect x="${boxX}" y="${boxY}" width="${boxW}" height="${Math.round(boxH)}" rx="16" fill="#020617" fill-opacity="0.68" stroke="${accent}" stroke-opacity="0.35" stroke-width="2"/>
  ${textTags}`;
}

export function renderSceneSvg(params: {
  theme: SceneTheme;
  sceneIndex: 0 | 1 | 2;
  width: number;
  height: number;
  caption: string;
  beatPrompt?: string;
  objectTags?: string[];
  fullPrompt?: string;
  seed: number;
  tNorm?: number;
}): string {
  const {
    theme,
    sceneIndex,
    width: w,
    height: h,
    caption,
    beatPrompt,
    objectTags,
    fullPrompt,
    seed,
    tNorm = 0.5,
  } = params;
  const detectedBeatTheme = beatPrompt ? detectSceneTheme(beatPrompt) : theme;
  const effectiveTheme =
    theme === 'garden' ? 'garden' : detectedBeatTheme !== 'studio' ? detectedBeatTheme : theme;
  const pal = THEME_PALETTES[effectiveTheme];

  const textForObjects = `${beatPrompt || ''} ${caption} ${(objectTags ?? []).join(' ')}`.toLowerCase();
  const fullLower = `${fullPrompt || ''} ${textForObjects}`.toLowerCase();
  const minDim = Math.min(w, h);
  const horizonY = Math.round(h * (sceneIndex === 1 ? 0.64 : 0.68));
  const cx = Math.round(w * 0.5);

  let innerLayers = '';

  if (
    effectiveTheme === 'garden' ||
    /flower|wildflower|garden|butterfly|butterflies|blossom|tulip|rose|lavender|baby\s*bird|exotic\s*bird|wet\s*stone/.test(
      fullLower
    )
  ) {
    innerLayers = drawLivingGardenSceneSvg({ w, h, seed, tNorm, fullText: fullLower });
  } else {
    const sceneProgress =
      sceneIndex === 0 ? tNorm / 0.34 : sceneIndex === 1 ? (tNorm - 0.34) / 0.33 : (tNorm - 0.67) / 0.33;
    const clampedProg = Math.max(0, Math.min(1, sceneProgress));

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
      (!hasExplicitConcreteProp && effectiveTheme === 'spiritual-twilight' && sceneIndex === 0);
    const hasLantern =
      /lantern|lamp|fanous|فانوس|چراغ/.test(textForObjects) ||
      (!hasExplicitConcreteProp && effectiveTheme === 'spiritual-twilight' && sceneIndex === 1);
    const hasCandleOrFire = /candle|fire|flame|lava|شمع|آگ/.test(textForObjects);
    const hasClock = /clock|time|hour|hourglass|seconds|وقت|گھڑی/.test(textForObjects);
    const hasBook = /book|quran|read|pages|کتاب|قرآن/.test(textForObjects);
    const hasTraveler = /man|woman|boy|girl|person|traveler|human|prayer|praying|dua|انسان|آدمی|لڑکا|مسافر|دعا/.test(
      textForObjects
    );
    const hasGrave = /grave|cemetery|tomb|قبر|قبرستان/.test(textForObjects);
    const hasCar = /car|vehicle|highway|drive|drifting|کار|گاڑی|سڑک/.test(textForObjects);
    const hasBoat = /boat|ship|sail|کشتی|جہاز/.test(textForObjects);
    const hasBirds = /bird|birds|eagle|dove|seagull|پرندے|پرندہ/.test(textForObjects);
    const hasHouse = /house|home|cabin|cottage|گھر|مکان/.test(textForObjects);
    const hasTrees =
      /tree|forest|pine|jungle|garden|leaf|درخت|جنگل|باغ/.test(textForObjects) || effectiveTheme === 'forest';
    const hasWater =
      /ocean|sea|water|river|lake|wave|stream|سمندر|دریا|پانی/.test(textForObjects) ||
      effectiveTheme === 'ocean' ||
      (!hasExplicitConcreteProp && effectiveTheme === 'spiritual-twilight' && sceneIndex === 2);

    const camScale = 1 + Math.sin(clampedProg * Math.PI) * 0.08;
    const layers: string[] = [
      `<g transform="translate(${(cx * (1 - camScale)).toFixed(1)} ${(horizonY * (1 - camScale)).toFixed(1)}) scale(${camScale.toFixed(4)})">`,
    ];

    if (hasNight) {
      layers.push(buildStarsSvg(w, h, seed + sceneIndex * 11, 52, '#fef3c7', tNorm));
    }

    const glowY = sceneIndex === 1 ? Math.round(h * 0.42) : Math.round(horizonY - minDim * 0.1);
    layers.push(`<circle cx="${cx}" cy="${glowY}" r="${Math.round(minDim * 0.46)}" fill="url(#radialGlow)"/>`);

    if (effectiveTheme === 'cosmos' || /planet|earth|space/.test(textForObjects)) {
      const px = Math.round(w * (sceneIndex === 1 ? 0.4 : 0.56));
      const py = Math.round(h * 0.36);
      const pr = Math.round(minDim * 0.13);
      layers.push(`<circle cx="${px}" cy="${py}" r="${pr}" fill="${pal.skyBottom}"/>`);
      layers.push(
        `<ellipse cx="${px}" cy="${py}" rx="${Math.round(pr * 2.1)}" ry="${Math.round(pr * 0.4)}" transform="rotate(${(-16 + clampedProg * 6).toFixed(1)} ${px} ${py})" fill="none" stroke="${pal.glow}" stroke-width="5" stroke-opacity="0.72"/>`
      );
    } else if (!hasDawnOrDay && (effectiveTheme === 'spiritual-twilight' || /crescent|moon|چاند/.test(textForObjects))) {
      const mx = Math.round(w * (sceneIndex === 0 ? 0.68 : 0.32));
      const my = Math.round(h * 0.22);
      const mr = Math.round(minDim * 0.08);
      layers.push(`<circle cx="${mx}" cy="${my}" r="${mr}" fill="#fef3c7"/>`);
      if (!/full\s*moon/.test(textForObjects)) {
        layers.push(
          `<circle cx="${mx + Math.round(mr * 0.34)}" cy="${my - Math.round(mr * 0.24)}" r="${Math.round(mr * 0.88)}" fill="${pal.skyTop}"/>`
        );
      }
    } else {
      const sx = Math.round(w * (0.42 + clampedProg * 0.16));
      const sy = Math.round(horizonY - minDim * 0.12);
      layers.push(`<circle cx="${sx}" cy="${sy}" r="${Math.round(minDim * 0.11)}" fill="${pal.glow}" fill-opacity="0.92"/>`);
    }

    if (hasClouds) {
      const cy = Math.round(h * 0.24);
      const drift = clampedProg * 30;
      layers.push(
        `<ellipse cx="${(w * 0.3 + drift).toFixed(1)}" cy="${cy}" rx="${minDim * 0.18}" ry="${minDim * 0.06}" fill="#cbd5e1" fill-opacity="0.22"/>`
      );
      layers.push(
        `<ellipse cx="${(w * 0.68 - drift * 0.7).toFixed(1)}" cy="${cy + 24}" rx="${minDim * 0.22}" ry="${minDim * 0.07}" fill="#cbd5e1" fill-opacity="0.18"/>`
      );
    }

    if (effectiveTheme === 'cyber') {
      const cols = 10;
      const bw = Math.ceil(w / cols);
      for (let i = 0; i < cols; i++) {
        const bh = Math.round(h * (0.25 + (((seed + i * 37 + sceneIndex * 13) % 38) / 100)));
        const bx = i * bw;
        const by = h - bh;
        layers.push(`<rect x="${bx}" y="${by}" width="${bw - 4}" height="${bh}" fill="${pal.silFront}"/>`);
        layers.push(
          `<rect x="${bx + 8}" y="${by + 18}" width="${Math.max(6, bw - 22)}" height="5" fill="${i % 2 === 0 ? pal.glow : pal.accent}" fill-opacity="${(0.65 + 0.3 * Math.sin(tNorm * 14 + i)).toFixed(2)}"/>`
        );
      }
    } else if (effectiveTheme === 'desert') {
      layers.push(
        `<path d="M0 ${horizonY} Q${w * 0.35} ${horizonY - 70} ${w} ${horizonY + 10} L${w} ${h} L0 ${h} Z" fill="${pal.silBack}"/>`
      );
      layers.push(
        `<path d="M0 ${horizonY + 45} Q${w * 0.65} ${horizonY - 35} ${w} ${horizonY + 55} L${w} ${h} L0 ${h} Z" fill="${pal.silFront}"/>`
      );
    } else if (hasWater) {
      const waveShift = Math.sin(tNorm * Math.PI * 6) * 14;
      layers.push(
        `<path d="M0 ${horizonY} Q${w * 0.25} ${(horizonY - 16 + waveShift).toFixed(1)} ${w * 0.5} ${horizonY} T${w} ${horizonY} L${w} ${h} L0 ${h} Z" fill="${pal.silMid}"/>`
      );
      layers.push(
        `<ellipse cx="${cx}" cy="${horizonY + 28}" rx="${Math.round(minDim * (0.18 + 0.03 * Math.sin(tNorm * 10)))}" ry="8" fill="${pal.accent}" fill-opacity="0.45"/>`
      );
      layers.push(
        `<ellipse cx="${cx}" cy="${horizonY + 60}" rx="${Math.round(minDim * 0.13)}" ry="6" fill="${pal.accent}" fill-opacity="0.3"/>`
      );
    } else {
      layers.push(
        `<polygon points="0,${horizonY + 30} ${w * 0.22},${horizonY - 85} ${w * 0.48},${horizonY + 25} ${w * 0.74},${horizonY - 100} ${w},${horizonY + 20} ${w},${h} 0,${h}" fill="${pal.silBack}"/>`
      );
      layers.push(`<rect x="0" y="${horizonY + 20}" width="${w}" height="${h - horizonY}" fill="${pal.silFront}"/>`);
    }

    if (hasMosque) {
      const domeW = Math.round(w * 0.4);
      const domeTop = Math.round(horizonY - minDim * 0.2);
      const minW = Math.round(minDim * 0.036);
      const leftMinX = Math.round(cx - domeW * 0.66);
      const rightMinX = Math.round(cx + domeW * 0.66 - minW);
      const minTop = Math.round(horizonY - minDim * 0.32);
      layers.push(`<rect x="${leftMinX}" y="${minTop}" width="${minW}" height="${horizonY - minTop + 20}" fill="${pal.silFront}"/>`);
      layers.push(
        `<polygon points="${leftMinX + minW / 2},${minTop - minW * 1.4} ${leftMinX - 4},${minTop} ${leftMinX + minW + 4},${minTop}" fill="${pal.silFront}"/>`
      );
      layers.push(`<rect x="${rightMinX}" y="${minTop}" width="${minW}" height="${horizonY - minTop + 20}" fill="${pal.silFront}"/>`);
      layers.push(
        `<polygon points="${rightMinX + minW / 2},${minTop - minW * 1.4} ${rightMinX - 4},${minTop} ${rightMinX + minW + 4},${minTop}" fill="${pal.silFront}"/>`
      );
      layers.push(
        `<path d="M${cx - domeW / 2} ${horizonY + 16} L${cx - domeW / 2} ${domeTop + minDim * 0.08} Q${cx} ${domeTop - minDim * 0.12} ${cx + domeW / 2} ${domeTop + minDim * 0.08} L${cx + domeW / 2} ${horizonY + 16} Z" fill="${pal.silFront}"/>`
      );
      layers.push(
        `<path d="M${cx - 15} ${horizonY - 8} L${cx - 15} ${horizonY - 36} Q${cx} ${horizonY - 50} ${cx + 15} ${horizonY - 36} L${cx + 15} ${horizonY - 8} Z" fill="${pal.accent}" fill-opacity="0.88"/>`
      );
    }

    if (hasLantern) {
      const swayDeg = Math.sin(tNorm * Math.PI * 4) * 4;
      const lx = cx;
      const ly = Math.round(h * 0.43);
      const ls = Math.round(minDim * 0.13);
      layers.push(`<g transform="rotate(${swayDeg.toFixed(2)} ${lx} 0)">`);
      layers.push(`<line x1="${lx}" y1="0" x2="${lx}" y2="${ly - ls}" stroke="${pal.accent}" stroke-width="4"/>`);
      layers.push(
        `<rect x="${lx - ls * 0.5}" y="${ly - ls * 0.45}" width="${ls}" height="${ls * 1.15}" rx="8" fill="${pal.glow}" fill-opacity="0.92" stroke="${pal.accent}" stroke-width="4"/>`
      );
      layers.push(`</g>`);
    }

    if (hasCandleOrFire) {
      const fx = Math.round(w * 0.5);
      const fy = Math.round(horizonY - 12);
      const flick = Math.sin(tNorm * Math.PI * 18) * 6;
      layers.push(`<rect x="${fx - 14}" y="${fy - 45}" width="28" height="65" rx="4" fill="#fef3c7"/>`);
      layers.push(`<path d="M${(fx + flick * 0.4).toFixed(1)} ${(fy - 95 + flick).toFixed(1)} Q${fx + 22} ${fy - 62} ${fx} ${fy - 46} Q${fx - 22} ${fy - 62} ${(fx + flick * 0.4).toFixed(1)} ${(fy - 95 + flick).toFixed(1)} Z" fill="#fb923c"/>`);
      layers.push(`<path d="M${(fx + flick * 0.2).toFixed(1)} ${(fy - 80 + flick * 0.6).toFixed(1)} Q${fx + 10} ${fy - 58} ${fx} ${fy - 48} Q${fx - 10} ${fy - 58} ${(fx + flick * 0.2).toFixed(1)} ${(fy - 80 + flick * 0.6).toFixed(1)} Z" fill="#fef08a"/>`);
    }

    if (hasClock) {
      const kx = cx;
      const ky = Math.round(h * 0.44);
      const kr = Math.round(minDim * 0.14);
      const ang = tNorm * Math.PI * 6 - Math.PI / 2;
      layers.push(`<circle cx="${kx}" cy="${ky}" r="${kr}" fill="#020617" fill-opacity="0.7" stroke="${pal.accent}" stroke-width="5"/>`);
      layers.push(`<line x1="${kx}" y1="${ky}" x2="${(kx + Math.cos(ang) * kr * 0.65).toFixed(1)}" y2="${(ky + Math.sin(ang) * kr * 0.65).toFixed(1)}" stroke="#fef3c7" stroke-width="4" stroke-linecap="round"/>`);
      layers.push(`<line x1="${kx}" y1="${ky}" x2="${(kx + Math.cos(ang * 0.15) * kr * 0.45).toFixed(1)}" y2="${(ky + Math.sin(ang * 0.15) * kr * 0.45).toFixed(1)}" stroke="${pal.accent}" stroke-width="4" stroke-linecap="round"/>`);
    }

    if (hasBook) {
      const bx = cx;
      const by = Math.round(horizonY - 18);
      const bw = Math.round(minDim * 0.34);
      layers.push(
        `<path d="M${bx} ${by} Q${bx - bw * 0.5} ${by - 28} ${bx - bw} ${by - 8} L${bx - bw} ${by + 38} Q${bx - bw * 0.5} ${by + 18} ${bx} ${by + 44} Q${bx + bw * 0.5} ${by + 18} ${bx + bw} ${by + 38} L${bx + bw} ${by - 8} Q${bx + bw * 0.5} ${by - 28} ${bx} ${by} Z" fill="#fef3c7" stroke="${pal.accent}" stroke-width="3"/>`
      );
    }

    if (hasGrave) {
      for (const gxOff of [-0.22, 0.04, 0.24]) {
        const gx = Math.round(cx + w * gxOff);
        layers.push(
          `<path d="M${gx - 18} ${horizonY + 42} L${gx - 18} ${horizonY - 18} Q${gx} ${horizonY - 38} ${gx + 18} ${horizonY - 18} L${gx + 18} ${horizonY + 42} Z" fill="${pal.silMid}" stroke="${pal.accent}" stroke-opacity="0.28" stroke-width="2"/>`
        );
      }
    }

    if (hasHouse) {
      const hx = Math.round(w * 0.26);
      const hy = horizonY;
      layers.push(`<rect x="${hx - 45}" y="${hy - 55}" width="90" height="65" fill="${pal.silFront}"/>`);
      layers.push(`<polygon points="${hx - 58},${hy - 55} ${hx},${hy - 102} ${hx + 58},${hy - 55}" fill="${pal.silMid}"/>`);
      layers.push(`<rect x="${hx - 14}" y="${hy - 36}" width="24" height="22" fill="${pal.accent}" fill-opacity="0.88"/>`);
    }

    if (hasTrees) {
      for (const txOff of [0.12, 0.2, 0.82, 0.9]) {
        const tx = Math.round(w * txOff);
        const swayTip = Math.sin(tNorm * Math.PI * 4 + txOff * 10) * 5;
        layers.push(`<polygon points="${(tx + swayTip).toFixed(1)},${horizonY - 95} ${tx - 28},${horizonY + 12} ${tx + 28},${horizonY + 12}" fill="${pal.silFront}"/>`);
      }
    }

    if (hasCar) {
      const rx = cx + (clampedProg - 0.5) * 60;
      const ry = horizonY + 36;
      layers.push(`<polygon points="${cx - 60},${ry - 18} ${cx + 60},${ry - 18} ${cx + 180},${h} ${cx - 180},${h}" fill="#1e293b"/>`);
      layers.push(`<rect x="${(rx - 44).toFixed(1)}" y="${ry - 32}" width="88" height="26" rx="8" fill="#ef4444"/>`);
      layers.push(`<circle cx="${(rx - 28).toFixed(1)}" cy="${ry - 6}" r="9" fill="#0f172a"/>`);
      layers.push(`<circle cx="${(rx + 28).toFixed(1)}" cy="${ry - 6}" r="9" fill="#0f172a"/>`);
    }

    if (hasBoat) {
      const bx = w * (0.42 + clampedProg * 0.18);
      const by = horizonY + 24 + Math.sin(tNorm * Math.PI * 8) * 4;
      layers.push(`<polygon points="${(bx - 55).toFixed(1)},${by.toFixed(1)} ${(bx + 55).toFixed(1)},${by.toFixed(1)} ${(bx + 36).toFixed(1)},${(by + 24).toFixed(1)} ${(bx - 36).toFixed(1)},${(by + 24).toFixed(1)}" fill="${pal.silFront}"/>`);
      layers.push(`<polygon points="${bx.toFixed(1)},${(by - 72).toFixed(1)} ${bx.toFixed(1)},${(by - 4).toFixed(1)} ${(bx + 40).toFixed(1)},${(by - 4).toFixed(1)}" fill="#fef3c7" fill-opacity="0.85"/>`);
    }

    if (hasTraveler) {
      const px = Math.round(w * (hasMosque ? 0.24 : 0.5) + (clampedProg - 0.5) * 18);
      const py = horizonY + 26;
      layers.push(`<circle cx="${px}" cy="${py - 56}" r="14" fill="${pal.silFront}"/>`);
      layers.push(`<path d="M${px - 18} ${py} L${px - 12} ${py - 40} L${px + 12} ${py - 40} L${px + 18} ${py} Z" fill="${pal.silFront}"/>`);
    }

    if (hasBirds) {
      for (let i = 0; i < 5; i++) {
        const bx = w * (0.2 + i * 0.12) + clampedProg * 34;
        const flap = Math.sin(tNorm * Math.PI * 14 + i) * 7;
        const by = h * (0.22 + (i % 2) * 0.05) + flap * 0.4;
        layers.push(
          `<path d="M${(bx - 12).toFixed(1)} ${by.toFixed(1)} Q${(bx - 6).toFixed(1)} ${(by - 8 + flap).toFixed(1)} ${bx.toFixed(1)} ${by.toFixed(1)} Q${(bx + 6).toFixed(1)} ${(by - 8 + flap).toFixed(1)} ${(bx + 12).toFixed(1)} ${by.toFixed(1)}" fill="none" stroke="${pal.glow}" stroke-width="2.5"/>`
        );
      }
    }

    if (hasRain) {
      layers.push(buildRainSvg(w, h, seed + sceneIndex, tNorm));
    } else {
      layers.push(buildParticlesSvg(w, h, seed + sceneIndex * 23, 20, pal.glow, tNorm));
    }

    layers.push(`</g>`);
    innerLayers = layers.join('\n  ');
  }

  const captionSvg = buildCaptionOverlaySvg(w, h, caption, pal.accent);

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
  ${innerLayers}
  ${captionSvg}
</svg>`;
}

export function getAmbientExprForTheme(theme: SceneTheme): string {
  switch (theme) {
    case 'garden':
      return '0.04*sin(2*PI*174.61*t)+0.025*sin(2*PI*261.63*t)+0.02*sin(2*PI*349.23*t)+0.015*sin(2*PI*440.0*t)';
    case 'spiritual-twilight':
      return '0.045*sin(2*PI*146.83*t)+0.03*sin(2*PI*220.0*t)+0.02*sin(2*PI*293.66*t)+0.015*sin(2*PI*349.23*t)';
    case 'ocean':
      return '0.04*sin(2*PI*130.81*t)+0.025*sin(2*PI*196.0*t)+0.02*sin(2*PI*246.94*t)';
    case 'cyber':
      return '0.04*sin(2*PI*110.0*t)+0.025*sin(2*PI*164.81*t)+0.02*sin(2*PI*220.0*t)*(0.7+0.3*sin(2*PI*2*t))';
    case 'cosmos':
      return '0.04*sin(2*PI*185.0*t)+0.025*sin(2*PI*277.18*t)+0.02*sin(2*PI*369.99*t)';
    default:
      return '0.04*sin(2*PI*196.0*t)+0.025*sin(2*PI*293.66*t)+0.02*sin(2*PI*392.0*t)';
  }
}
