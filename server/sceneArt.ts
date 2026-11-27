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
  // 1. Match quoted dialogue near dialogue/voiceover/speak instructions (supports multiline blocks)
  const dialogueSection = rawPrompt.match(
    /(?:exact(?:\s+urdu|\s+hindi)?\s*dialogue|speak\s+exactly(?:\s+this\s+dialogue)?|voiceover|narration|spoken\s+script)\s*[:：\-–]?[\s\S]{0,120}?["“«]([^"”»\n]{6,260})["”»]/i
  );
  if (dialogueSection?.[1]) {
    return dialogueSection[1].trim();
  }

  // 2. Match explicit inline label: Voiceover: ... / Dialogue: ...
  const inlineMatch = rawPrompt.match(
    /(?:voiceover|narration|script|dialogue|urdu\s*line|caption)\s*[:：\-–]\s*["“]?([^\n|]{6,220})["”]?/i
  );
  if (inlineMatch?.[1]) {
    const candidate = inlineMatch[1].replace(/["”]+$/g, '').trim();
    if (!/^the\s+(bird|character|narrator|speaker)\s+looks/i.test(candidate)) {
      return candidate;
    }
  }

  // 3. Fallback: longest non-English RTL quote if present
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
      /\b(exactly\s*\d+\s*seconds?|vertical\s*9:16|horizontal\s*16:9|square\s*1:1|9:16|16:9|1:1|ultra\s*realistic|photorealistic|hyper\s*realistic|cinematic\s*8k|8k|4k|hdr|uhd)\b/gi,
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
  // 1. Explicit timestamp camera directions anywhere in prompt (e.g. "0–2 seconds: ...")
  const timeMatches = Array.from(
    rawPrompt.matchAll(/\b\d+\s*[-–to]+\s*\d+\s*s(?:ec(?:onds?)?)?\s*[:：\-–]\s*([^\n|]+)/gi)
  )
    .map((m) => cleanDisplayPrompt(m[1]))
    .filter((s) => s.length >= 6);
  if (timeMatches.length >= 3) {
    return [timeMatches[0], timeMatches[1], timeMatches[2]];
  }

  // 2. Explicit Scene / Shot / Part markers
  const sceneMatches = Array.from(
    rawPrompt.matchAll(/(?:scene|shot|clip|part|beat)\s*\d+\s*[:：\-–]\s*([^\n|]+)/gi)
  )
    .map((m) => cleanDisplayPrompt(m[1]))
    .filter((s) => s.length >= 4);
  if (sceneMatches.length >= 3) {
    return [sceneMatches[0], sceneMatches[1], sceneMatches[2]];
  }

  // 3. Multi-line or piped segments (ignore short section headings like "1. Scene & Environment:")
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

  // 4. Sentence / clause splits
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

  // Check explicit visual settings first so a garden/bird video about Akhirat renders a garden, not a night mosque
  if (
    /garden|flower|flowers|rose|tulip|lavender|jasmine|blossom|butterfly|butterflies|meadow|exotic\s*bird|turquoise.*bird|باغ|پھول|تتلی|چمن/.test(
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
    return 'In a peaceful flower garden at golden sunrise, a colorful bird reminds us that eternal life lies ahead.';
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
3. Choose the single best visual "theme" from: garden, spiritual-twilight, ocean, desert, forest, mountain, cyber, cosmos, sunset, studio. (Note: if the visual setting is a flower garden/bird/sunrise, pick "garden" even if the dialogue mentions spirituality.)
4. Write 3 short "sceneCaptions" (max 8 words each) in the dialogue's language matching Scenes 1, 2, 3.
5. For "sceneObjectTags", return 3 arrays of short visual keywords for Scenes 1, 2, 3 (e.g. ["garden","sunrise","tree","bird","stream","flowers","butterflies"], ["bird-closeup","beak","blossoms","sunlight"], ["garden","stream","butterflies","flowers","sunrise"]).
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
    skyTop: '#1e3a8a',
    skyMid: '#f59e0b',
    skyBottom: '#fde68a',
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

function buildRainSvg(w: number, h: number, seed: number): string {
  const streaks: string[] = [];
  for (let i = 0; i < 40; i++) {
    const x = (((seed * 29 + i * 97) % 98) / 100) * w;
    const y = (((seed * 17 + i * 67) % 85) / 100) * h;
    streaks.push(
      `<line x1="${x.toFixed(1)}" y1="${y.toFixed(1)}" x2="${(x - 10).toFixed(1)}" y2="${(y + 34).toFixed(1)}" stroke="#bae6fd" stroke-opacity="0.45" stroke-width="2"/>`
    );
  }
  return streaks.join('');
}

function drawExoticBirdSvg(bx: number, by: number, scale: number, openBeak: boolean): string {
  const s = scale;
  const parts: string[] = [];
  // Tail feathers (turquoise + violet)
  parts.push(`<path d="M${bx - 16 * s} ${by + 16 * s} L${bx - 52 * s} ${by + 64 * s} L${bx - 22 * s} ${by + 58 * s} L${bx - 6 * s} ${by + 24 * s} Z" fill="#6d28d9"/>`);
  // Turquoise body
  parts.push(`<ellipse cx="${bx}" cy="${by + 12 * s}" rx="${28 * s}" ry="${38 * s}" transform="rotate(-12 ${bx} ${by + 12 * s})" fill="#06b6d4"/>`);
  // Golden-yellow chest
  parts.push(`<ellipse cx="${bx + 9 * s}" cy="${by + 16 * s}" rx="${16 * s}" ry="${26 * s}" fill="#facc15"/>`);
  // Violet wing
  parts.push(`<path d="M${bx - 22 * s} ${by - 4 * s} Q${bx - 36 * s} ${by + 20 * s} ${bx - 12 * s} ${by + 42 * s} Q${bx + 6 * s} ${by + 24 * s} ${bx - 2 * s} ${by - 2 * s} Z" fill="#7c3aed"/>`);
  // Head & crest
  parts.push(`<circle cx="${bx + 6 * s}" cy="${by - 26 * s}" r="${21 * s}" fill="#0891b2"/>`);
  parts.push(`<path d="M${bx - 2 * s} ${by - 42 * s} Q${bx - 14 * s} ${by - 62 * s} ${bx - 24 * s} ${by - 50 * s} Q${bx - 10 * s} ${by - 42 * s} ${bx + 4 * s} ${by - 44 * s} Z" fill="#a855f7"/>`);
  // Expressive sparkling eye
  parts.push(`<circle cx="${bx + 13 * s}" cy="${by - 29 * s}" r="${6.2 * s}" fill="#0f172a"/>`);
  parts.push(`<circle cx="${bx + 15 * s}" cy="${by - 31 * s}" r="${2.2 * s}" fill="#ffffff"/>`);
  // Tiny orange beak (open when speaking in Scene 1)
  if (openBeak) {
    parts.push(`<polygon points="${bx + 24 * s},${by - 29 * s} ${bx + 44 * s},${by - 27 * s} ${bx + 24 * s},${by - 21 * s}" fill="#f97316"/>`);
    parts.push(`<polygon points="${bx + 24 * s},${by - 21 * s} ${bx + 41 * s},${by - 15 * s} ${bx + 23 * s},${by - 16 * s}" fill="#ea580c"/>`);
  } else {
    parts.push(`<polygon points="${bx + 24 * s},${by - 29 * s} ${bx + 44 * s},${by - 23 * s} ${bx + 24 * s},${by - 17 * s}" fill="#f97316"/>`);
  }
  return parts.join('\n  ');
}

function drawGardenSceneSvg(w: number, h: number, sceneIndex: 0 | 1 | 2, seed: number): string {
  const minDim = Math.min(w, h);
  const cx = Math.round(w * 0.5);
  const horizonY = Math.round(h * 0.62);
  const layers: string[] = [];

  // Golden sunrise glow & sunbeams
  const sunX = Math.round(w * (sceneIndex === 1 ? 0.72 : 0.5));
  const sunY = Math.round(horizonY - minDim * 0.14);
  layers.push(`<circle cx="${sunX}" cy="${sunY}" r="${Math.round(minDim * 0.48)}" fill="url(#radialGlow)"/>`);
  layers.push(`<circle cx="${sunX}" cy="${sunY}" r="${Math.round(minDim * 0.13)}" fill="#fef9c3" fill-opacity="0.95"/>`);

  // Soft sunlit rays
  for (let i = -2; i <= 2; i++) {
    layers.push(
      `<polygon points="${sunX},${sunY} ${cx + i * w * 0.28 - 40},${h} ${cx + i * w * 0.28 + 40},${h}" fill="#fef08a" fill-opacity="0.09"/>`
    );
  }

  // Meadow hills + crystal-clear flowing stream
  layers.push(`<path d="M0 ${horizonY + 12} Q${w * 0.3} ${horizonY - 40} ${w} ${horizonY + 8} L${w} ${h} L0 ${h} Z" fill="#15803d"/>`);
  layers.push(`<path d="M0 ${horizonY + 45} Q${w * 0.65} ${horizonY + 10} ${w} ${horizonY + 48} L${w} ${h} L0 ${h} Z" fill="#166534"/>`);
  if (sceneIndex !== 1) {
    layers.push(
      `<path d="M${w * 0.42} ${horizonY + 16} Q${w * 0.62} ${horizonY + 95} ${w * 0.35} ${h} L${w * 0.68} ${h} Q${w * 0.8} ${horizonY + 95} ${w * 0.52} ${horizonY + 16} Z" fill="#38bdf8" fill-opacity="0.82"/>`
    );
    layers.push(
      `<ellipse cx="${w * 0.52}" cy="${horizonY + 90}" rx="${minDim * 0.08}" ry="5" fill="#e0f2fe" fill-opacity="0.7"/>`
    );
  }

  // Curved flowering tree branch across frame
  const branchY = sceneIndex === 1 ? Math.round(h * 0.56) : Math.round(h * 0.44);
  layers.push(
    `<path d="M0 ${branchY + 55} Q${w * 0.38} ${branchY - 10} ${w * 0.86} ${branchY + 18}" stroke="#57341a" stroke-width="${Math.round(minDim * 0.04)}" fill="none" stroke-linecap="round"/>`
  );
  // Tree blossoms (pink & white)
  const blossomPts = [0.16, 0.28, 0.42, 0.64, 0.78, 0.86];
  blossomPts.forEach((px, idx) => {
    const bx = Math.round(w * px);
    const by = Math.round(branchY + (idx % 2 === 0 ? -18 : 14));
    const r = Math.round(minDim * (sceneIndex === 1 ? 0.042 : 0.032));
    layers.push(`<circle cx="${bx}" cy="${by}" r="${r}" fill="${idx % 2 === 0 ? '#fbcfe8' : '#ffffff'}" fill-opacity="0.92"/>`);
    layers.push(`<circle cx="${bx}" cy="${by}" r="${Math.round(r * 0.36)}" fill="#facc15"/>`);
  });

  // Colorful garden flowers in foreground (roses, tulips, lavender)
  const flowerColors = ['#ffffff', '#f472b6', '#a855f7', '#fb7185', '#fef08a', '#c084fc'];
  for (let i = 0; i < 14; i++) {
    const fx = Math.round((((seed * 13 + i * 71) % 90) + 5) * (w / 100));
    const fy = Math.round(horizonY + 55 + ((i * 29) % Math.max(40, Math.round(h * 0.22))));
    const fr = Math.round(minDim * 0.024);
    const col = flowerColors[i % flowerColors.length];
    layers.push(`<line x1="${fx}" y1="${fy}" x2="${fx}" y2="${fy + 26}" stroke="#14532d" stroke-width="3"/>`);
    layers.push(`<circle cx="${fx}" cy="${fy}" r="${fr}" fill="${col}"/>`);
    layers.push(`<circle cx="${fx}" cy="${fy}" r="${Math.round(fr * 0.35)}" fill="#fde047"/>`);
  }

  // Exotic Turquoise/Violet/Gold Bird perched on the branch
  const birdScale = sceneIndex === 1 ? minDim / 300 : minDim / 520;
  const birdX = Math.round(w * 0.5);
  const birdY = Math.round(branchY - 12 * birdScale);
  layers.push(drawExoticBirdSvg(birdX, birdY, birdScale, sceneIndex === 1));

  // Graceful colorful butterflies
  const butterflies = [
    { x: w * 0.22, y: h * 0.32, c: '#f472b6' },
    { x: w * 0.78, y: h * 0.28, c: '#38bdf8' },
    { x: w * 0.28, y: h * 0.72, c: '#facc15' },
  ];
  for (const b of butterflies) {
    layers.push(`<ellipse cx="${b.x - 8}" cy="${b.y}" rx="9" ry="6" fill="${b.c}" fill-opacity="0.88"/>`);
    layers.push(`<ellipse cx="${b.x + 8}" cy="${b.y}" rx="9" ry="6" fill="${b.c}" fill-opacity="0.88"/>`);
    layers.push(`<line x1="${b.x}" y1="${b.y - 6}" x2="${b.x}" y2="${b.y + 6}" stroke="#1e293b" stroke-width="2"/>`);
  }

  layers.push(buildParticlesSvg(w, h, seed + sceneIndex * 19, 24, '#fef9c3'));
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
}): string {
  const { theme, sceneIndex, width: w, height: h, caption, beatPrompt, objectTags, fullPrompt, seed } = params;
  const detectedBeatTheme = beatPrompt ? detectSceneTheme(beatPrompt) : theme;
  const effectiveTheme =
    theme === 'garden'
      ? 'garden'
      : detectedBeatTheme !== 'studio'
      ? detectedBeatTheme
      : theme;
  const pal = THEME_PALETTES[effectiveTheme];

  const textForObjects = `${beatPrompt || ''} ${caption} ${(objectTags ?? []).join(' ')}`.toLowerCase();
  const minDim = Math.min(w, h);
  const horizonY = Math.round(h * (sceneIndex === 1 ? 0.64 : 0.68));
  const cx = Math.round(w * 0.5);

  let innerLayers = '';

  if (
    effectiveTheme === 'garden' ||
    /flower|garden|butterfly|butterflies|blossom|tulip|rose|lavender|exotic\s*bird|stream/.test(
      `${fullPrompt || ''} ${textForObjects}`.toLowerCase()
    )
  ) {
    innerLayers = drawGardenSceneSvg(w, h, sceneIndex, seed);
  } else {
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

    const layers: string[] = [];

    if (hasNight) {
      layers.push(buildStarsSvg(w, h, seed + sceneIndex * 11, 52, '#fef3c7'));
    }

    const glowY = sceneIndex === 1 ? Math.round(h * 0.42) : Math.round(horizonY - minDim * 0.1);
    layers.push(`<circle cx="${cx}" cy="${glowY}" r="${Math.round(minDim * 0.46)}" fill="url(#radialGlow)"/>`);

    if (effectiveTheme === 'cosmos' || /planet|earth|space/.test(textForObjects)) {
      const px = Math.round(w * (sceneIndex === 1 ? 0.4 : 0.56));
      const py = Math.round(h * 0.36);
      const pr = Math.round(minDim * 0.13);
      layers.push(`<circle cx="${px}" cy="${py}" r="${pr}" fill="${pal.skyBottom}"/>`);
      layers.push(
        `<ellipse cx="${px}" cy="${py}" rx="${Math.round(pr * 2.1)}" ry="${Math.round(pr * 0.4)}" transform="rotate(-16 ${px} ${py})" fill="none" stroke="${pal.glow}" stroke-width="5" stroke-opacity="0.72"/>`
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
      const sx = Math.round(w * (sceneIndex === 0 ? 0.5 : sceneIndex === 1 ? 0.35 : 0.55));
      const sy = Math.round(horizonY - minDim * 0.12);
      layers.push(`<circle cx="${sx}" cy="${sy}" r="${Math.round(minDim * 0.11)}" fill="${pal.glow}" fill-opacity="0.92"/>`);
    }

    if (hasClouds) {
      const cy = Math.round(h * 0.24);
      layers.push(
        `<ellipse cx="${w * 0.3}" cy="${cy}" rx="${minDim * 0.18}" ry="${minDim * 0.06}" fill="#cbd5e1" fill-opacity="0.22"/>`
      );
      layers.push(
        `<ellipse cx="${w * 0.68}" cy="${cy + 24}" rx="${minDim * 0.22}" ry="${minDim * 0.07}" fill="#cbd5e1" fill-opacity="0.18"/>`
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
          `<rect x="${bx + 8}" y="${by + 18}" width="${Math.max(6, bw - 22)}" height="5" fill="${i % 2 === 0 ? pal.glow : pal.accent}" fill-opacity="0.85"/>`
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
      layers.push(
        `<path d="M0 ${horizonY} Q${w * 0.25} ${horizonY - 20} ${w * 0.5} ${horizonY} T${w} ${horizonY} L${w} ${h} L0 ${h} Z" fill="${pal.silMid}"/>`
      );
      layers.push(
        `<ellipse cx="${cx}" cy="${horizonY + 28}" rx="${Math.round(minDim * 0.2)}" ry="8" fill="${pal.accent}" fill-opacity="0.45"/>`
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
      const lx = cx;
      const ly = Math.round(h * 0.43);
      const ls = Math.round(minDim * 0.13);
      layers.push(`<line x1="${lx}" y1="0" x2="${lx}" y2="${ly - ls}" stroke="${pal.accent}" stroke-width="4"/>`);
      layers.push(
        `<rect x="${lx - ls * 0.5}" y="${ly - ls * 0.45}" width="${ls}" height="${ls * 1.15}" rx="8" fill="${pal.glow}" fill-opacity="0.92" stroke="${pal.accent}" stroke-width="4"/>`
      );
    }

    if (hasCandleOrFire) {
      const fx = Math.round(w * 0.5);
      const fy = Math.round(horizonY - 12);
      layers.push(`<rect x="${fx - 14}" y="${fy - 45}" width="28" height="65" rx="4" fill="#fef3c7"/>`);
      layers.push(`<path d="M${fx} ${fy - 95} Q${fx + 22} ${fy - 62} ${fx} ${fy - 46} Q${fx - 22} ${fy - 62} ${fx} ${fy - 95} Z" fill="#fb923c"/>`);
      layers.push(`<path d="M${fx} ${fy - 80} Q${fx + 10} ${fy - 58} ${fx} ${fy - 48} Q${fx - 10} ${fy - 58} ${fx} ${fy - 80} Z" fill="#fef08a"/>`);
    }

    if (hasClock) {
      const kx = cx;
      const ky = Math.round(h * 0.44);
      const kr = Math.round(minDim * 0.14);
      layers.push(`<circle cx="${kx}" cy="${ky}" r="${kr}" fill="#020617" fill-opacity="0.7" stroke="${pal.accent}" stroke-width="5"/>`);
      layers.push(`<line x1="${kx}" y1="${ky}" x2="${kx}" y2="${ky - kr * 0.65}" stroke="#fef3c7" stroke-width="4" stroke-linecap="round"/>`);
      layers.push(`<line x1="${kx}" y1="${ky}" x2="${kx + kr * 0.48}" y2="${ky + kr * 0.2}" stroke="${pal.accent}" stroke-width="4" stroke-linecap="round"/>`);
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
        layers.push(`<polygon points="${tx},${horizonY - 95} ${tx - 28},${horizonY + 12} ${tx + 28},${horizonY + 12}" fill="${pal.silFront}"/>`);
      }
    }

    if (hasCar) {
      const rx = cx;
      const ry = horizonY + 36;
      layers.push(`<polygon points="${rx - 60},${ry - 18} ${rx + 60},${ry - 18} ${rx + 180},${h} ${rx - 180},${h}" fill="#1e293b"/>`);
      layers.push(`<rect x="${rx - 44}" y="${ry - 32}" width="88" height="26" rx="8" fill="#ef4444"/>`);
      layers.push(`<circle cx="${rx - 28}" cy="${ry - 6}" r="9" fill="#0f172a"/>`);
      layers.push(`<circle cx="${rx + 28}" cy="${ry - 6}" r="9" fill="#0f172a"/>`);
    }

    if (hasBoat) {
      const bx = Math.round(w * 0.48);
      const by = horizonY + 24;
      layers.push(`<polygon points="${bx - 55},${by} ${bx + 55},${by} ${bx + 36},${by + 24} ${bx - 36},${by + 24}" fill="${pal.silFront}"/>`);
      layers.push(`<polygon points="${bx},${by - 72} ${bx},${by - 4} ${bx + 40},${by - 4}" fill="#fef3c7" fill-opacity="0.85"/>`);
    }

    if (hasTraveler) {
      const px = Math.round(w * (hasMosque ? 0.24 : 0.5));
      const py = horizonY + 26;
      layers.push(`<circle cx="${px}" cy="${py - 56}" r="14" fill="${pal.silFront}"/>`);
      layers.push(`<path d="M${px - 18} ${py} L${px - 12} ${py - 40} L${px + 12} ${py - 40} L${px + 18} ${py} Z" fill="${pal.silFront}"/>`);
    }

    if (hasBirds) {
      for (let i = 0; i < 5; i++) {
        const bx = Math.round(w * (0.24 + i * 0.12));
        const by = Math.round(h * (0.22 + (i % 2) * 0.05));
        layers.push(
          `<path d="M${bx - 12} ${by} Q${bx - 6} ${by - 8} ${bx} ${by} Q${bx + 6} ${by - 8} ${bx + 12} ${by}" fill="none" stroke="${pal.glow}" stroke-width="2.5"/>`
        );
      }
    }

    if (hasRain) {
      layers.push(buildRainSvg(w, h, seed + sceneIndex));
    } else {
      layers.push(buildParticlesSvg(w, h, seed + sceneIndex * 23, 20, pal.glow));
    }

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
