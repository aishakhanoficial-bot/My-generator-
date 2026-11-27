import {
  AlertCircle,
  CheckCircle2,
  Download,
  Film,
  Layers,
  Play,
  Plus,
  Trash2,
  Upload,
} from 'lucide-react';
import React, { useMemo, useRef, useState } from 'react';
import {
  AdminConfig,
  AspectRatioOption,
  EncodingPreset,
  JobInputAssets,
  JobPriority,
  QuantizationType,
  ResolutionOption,
  SystemMetrics,
  VideoJob,
  VideoModelSpec,
  WorkflowType,
} from '../../shared/types';
import { getVideoDownloadFilename, getVideoDownloadUrl, getVideoStreamUrl } from '../api';

const WORKFLOW_TABS: Array<{ id: WorkflowType; label: string }> = [
  { id: 'text-to-video', label: 'Text to Video' },
  { id: 'image-to-video', label: 'Image to Video' },
  { id: 'reference-image', label: 'Reference Images' },
  { id: 'frame-interpolation', label: 'Frame Interpolation' },
  { id: 'video-edit', label: 'Video Editing' },
];

const SAMPLE_SCENES = [
  'Golden hour ocean waves crashing against volcanic basalt cliffs, aerial slow pan',
  'Misty evergreen pine forest at dawn with volumetric sunbeams piercing fog',
  'Neon-lit Tokyo rain-slicked street reflecting lantern glow, steady tracking shot',
  'Desert sand dunes shifting under amber twilight wind, wide anamorphic lens',
  'Snowy alpine mountain ridge beneath crisp starlight and aurora borealis',
  'Bioluminescent deep ocean jellyfish drifting gracefully in dark abyss',
  'Minimalist architectural concrete courtyard with soft afternoon shadows',
  'Warm artisan pottery studio wheel spinning wet terracotta clay, macro depth',
  'Autumn maple canopy fluttering over a calm mountain reflection pond',
  'Deep space crimson nebula clouds slowly rotating around newborn stars',
];

function buildBatchSample(count: number): string {
  const lines: string[] = [];
  const cameras = ['slow dolly in', 'wide aerial sweep', 'handheld natural drift', 'locked tripod macro', 'smooth orbit'];
  const lights = ['golden hour', 'overcast softbox', 'twilight blue hour', 'crisp midday sun', 'studio rim light'];
  for (let i = 0; i < count; i++) {
    const base = SAMPLE_SCENES[i % SAMPLE_SCENES.length];
    if (i < SAMPLE_SCENES.length) {
      lines.push(base);
    } else {
      const cam = cameras[i % cameras.length];
      const light = lights[Math.floor(i / cameras.length) % lights.length];
      lines.push(`${base}, ${cam}, ${light} (take ${i + 1})`);
    }
  }
  return lines.join('\n');
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Failed to read selected file'));
    reader.readAsDataURL(file);
  });
}

interface StudioViewProps {
  models: VideoModelSpec[];
  jobs: VideoJob[];
  config: AdminConfig;
  metrics: SystemMetrics;
  selectedModelId: string;
  onSelectModelId: (id: string) => void;
  onSubmitSingle: (payload: {
    workflow: WorkflowType;
    prompt: string;
    negativePrompt?: string;
    modelId: string;
    quantization: QuantizationType;
    encoding: EncodingPreset;
    resolution: ResolutionOption;
    aspectRatio: AspectRatioOption;
    durationSec: number;
    fps: number;
    seed?: number;
    priority: JobPriority;
    useCache: boolean;
    assets?: JobInputAssets;
  }) => Promise<void>;
  onSubmitBatch: (payload: {
    prompts: string[];
    workflow: WorkflowType;
    negativePrompt?: string;
    modelId: string;
    quantization: QuantizationType;
    encoding: EncodingPreset;
    resolution: ResolutionOption;
    aspectRatio: AspectRatioOption;
    durationSec: number;
    fps: number;
    seed?: number;
    priority: JobPriority;
    useCache: boolean;
    assets?: JobInputAssets;
  }) => Promise<void>;
  onNavigateQueue: () => void;
  onOpenPolicy: () => void;
}

export function StudioView({
  models,
  jobs,
  config,
  metrics,
  selectedModelId,
  onSelectModelId,
  onSubmitSingle,
  onSubmitBatch,
  onNavigateQueue,
  onOpenPolicy,
}: StudioViewProps) {
  const [workflow, setWorkflow] = useState<WorkflowType>('text-to-video');
  const [mode, setMode] = useState<'single' | 'batch'>('single');
  const [prompt, setPrompt] = useState(
    'Golden hour ocean waves crashing against dark volcanic cliffs, wide cinematic drone sweep'
  );
  const [batchText, setBatchText] = useState(() => buildBatchSample(10));
  const [negativePrompt, setNegativePrompt] = useState('blurry, jitter, low contrast, compression artifacts');
  const [quantization, setQuantization] = useState<QuantizationType>('fp8');
  const [encoding, setEncoding] = useState<EncodingPreset>('h264-fast');
  const [resolution, setResolution] = useState<ResolutionOption>('720p');
  const [aspectRatio, setAspectRatio] = useState<AspectRatioOption>('16:9');
  const [durationSec, setDurationSec] = useState<number>(4);
  const [fps, setFps] = useState<number>(24);
  const [seedInput, setSeedInput] = useState<string>('');
  const [priority, setPriority] = useState<JobPriority>(config.defaultPriority);
  const [useCache, setUseCache] = useState<boolean>(config.cacheEnabled);

  // Workflow media inputs
  const [imageDataUrl, setImageDataUrl] = useState<string>('');
  const [endFrameDataUrl, setEndFrameDataUrl] = useState<string>('');
  const [referenceImages, setReferenceImages] = useState<string[]>([]);
  const [sourceVideoDataUrl, setSourceVideoDataUrl] = useState<string>('');
  const [sourceVideoJobId, setSourceVideoJobId] = useState<string>('');
  const [editMode, setEditMode] = useState<NonNullable<JobInputAssets['editMode']>>('cinematic-grade');

  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [previewJobId, setPreviewJobId] = useState<string | null>(null);

  const batchFileInputRef = useRef<HTMLInputElement>(null);

  const enabledModels = useMemo(() => {
    return models.filter(
      (m) => m.enabled && (m.provider === 'self-hosted' || config.allowExternalPaidModels)
    );
  }, [models, config.allowExternalPaidModels]);

  const activeModel = useMemo(() => {
    return (
      enabledModels.find((m) => m.id === selectedModelId) ||
      enabledModels.find((m) => m.provider === 'self-hosted' && m.installed) ||
      enabledModels[0]
    );
  }, [enabledModels, selectedModelId]);

  const effectiveQuant = useMemo(() => {
    if (!activeModel) return 'fp8';
    return activeModel.supportedQuantizations.includes(quantization)
      ? quantization
      : activeModel.defaultQuantization;
  }, [activeModel, quantization]);

  const requiredVramGb = activeModel ? activeModel.vramByQuantizationGb[effectiveQuant] ?? 0 : 0;
  const vramFits = activeModel?.provider === 'external-paid' || requiredVramGb <= config.gpuVramGb;

  const parsedBatchPrompts = useMemo(() => {
    return batchText
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l.length > 0);
  }, [batchText]);

  const completedJobs = useMemo(
    () => jobs.filter((j) => j.status === 'completed' && j.outputFileName),
    [jobs]
  );

  const runningJobs = useMemo(() => jobs.filter((j) => j.status === 'running'), [jobs]);

  const previewJob = useMemo(() => {
    if (previewJobId) {
      const found = completedJobs.find((j) => j.id === previewJobId);
      if (found) return found;
    }
    return completedJobs[0] ?? null;
  }, [completedJobs, previewJobId]);

  const handleModelChange = (id: string) => {
    onSelectModelId(id);
    const next = models.find((m) => m.id === id);
    if (next && !next.supportedQuantizations.includes(quantization)) {
      setQuantization(next.defaultQuantization);
    }
  };

  const handleBatchFileImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    const lines = text
      .split(/\r?\n/)
      .map((l) => l.replace(/^["']|["']$/g, '').trim())
      .filter(Boolean);
    setBatchText(lines.join('\n'));
    e.target.value = '';
  };

  const buildAssets = (): JobInputAssets | undefined => {
    if (workflow === 'image-to-video' && imageDataUrl) {
      return { imageDataUrl };
    }
    if (workflow === 'frame-interpolation' && (imageDataUrl || endFrameDataUrl)) {
      return { imageDataUrl, endFrameDataUrl };
    }
    if (workflow === 'reference-image' && referenceImages.length > 0) {
      return { referenceImages };
    }
    if (workflow === 'video-edit') {
      return {
        sourceVideoDataUrl: sourceVideoDataUrl || undefined,
        sourceVideoJobId: sourceVideoJobId || undefined,
        editMode,
      };
    }
    return undefined;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeModel) return;
    setFeedback(null);

    if (workflow === 'image-to-video' && !imageDataUrl) {
      setFeedback({ type: 'err', text: 'Upload a starting image for Image-to-Video.' });
      return;
    }
    if (workflow === 'frame-interpolation' && (!imageDataUrl || !endFrameDataUrl)) {
      setFeedback({ type: 'err', text: 'Upload both Start Frame and End Frame images.' });
      return;
    }
    if (workflow === 'reference-image' && referenceImages.length === 0) {
      setFeedback({ type: 'err', text: 'Upload at least one reference image.' });
      return;
    }
    if (workflow === 'video-edit' && !sourceVideoDataUrl && !sourceVideoJobId) {
      setFeedback({
        type: 'err',
        text: 'Upload a source video clip or select an existing rendered job to edit.',
      });
      return;
    }

    const parsedSeed = seedInput.trim() ? Number(seedInput.trim()) : undefined;
    const assets = buildAssets();

    setSubmitting(true);
    try {
      if (mode === 'single') {
        await onSubmitSingle({
          workflow,
          prompt,
          negativePrompt: negativePrompt || undefined,
          modelId: activeModel.id,
          quantization: effectiveQuant,
          encoding,
          resolution,
          aspectRatio,
          durationSec,
          fps,
          seed: Number.isFinite(parsedSeed) ? parsedSeed : undefined,
          priority,
          useCache,
          assets,
        });
        setFeedback({ type: 'ok', text: `Queued 1 job on ${activeModel.name}.` });
      } else {
        if (parsedBatchPrompts.length === 0) {
          setFeedback({ type: 'err', text: 'Add at least one prompt line for batch generation.' });
          return;
        }
        await onSubmitBatch({
          prompts: parsedBatchPrompts,
          workflow,
          negativePrompt: negativePrompt || undefined,
          modelId: activeModel.id,
          quantization: effectiveQuant,
          encoding,
          resolution,
          aspectRatio,
          durationSec,
          fps,
          seed: Number.isFinite(parsedSeed) ? parsedSeed : undefined,
          priority,
          useCache,
          assets,
        });
        setFeedback({
          type: 'ok',
          text: `Queued ${parsedBatchPrompts.length} batch jobs on ${activeModel.name}. Zero credits deducted.`,
        });
      }
    } catch (err) {
      setFeedback({
        type: 'err',
        text: err instanceof Error ? err.message : 'Failed to queue generation job.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Workflow Bar + Single/Batch Toggle */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div className="flex flex-wrap items-center gap-1 p-1 rounded-lg bg-slate-100 dark:bg-[#121620] border border-slate-200 dark:border-slate-800">
          {WORKFLOW_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setWorkflow(tab.id)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                workflow === tab.id
                  ? 'bg-white dark:bg-[#1E2534] text-slate-900 dark:text-slate-100 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 p-1 rounded-lg bg-slate-100 dark:bg-[#121620] border border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setMode('single')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                mode === 'single'
                  ? 'bg-white dark:bg-[#1E2534] text-slate-900 dark:text-slate-100 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              Single Prompt
            </button>
            <button
              type="button"
              onClick={() => setMode('batch')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                mode === 'batch'
                  ? 'bg-white dark:bg-[#1E2534] text-slate-900 dark:text-slate-100 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              Batch Queue (10 / 50 / 100+)
            </button>
          </div>
        </div>
      </div>

      {/* Main Split Workstation */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        {/* Left: Prompt, Model, Hardware Parameters */}
        <form
          onSubmit={handleSubmit}
          className="xl:col-span-7 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#121620] p-5 space-y-5"
        >
          {/* Engine Classification Header */}
          {activeModel && (
            <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-200 dark:border-slate-800 text-xs">
              <div className="flex items-center gap-2">
                <span
                  className={
                    activeModel.provider === 'self-hosted'
                      ? 'font-semibold text-emerald-600 dark:text-emerald-400'
                      : 'font-semibold text-amber-600 dark:text-amber-400'
                  }
                >
                  {activeModel.providerLabel}
                </span>
                <span aria-hidden="true" className="text-slate-400">
                  ·
                </span>
                <span className="text-slate-600 dark:text-slate-300 font-mono tabular-nums">
                  {activeModel.provider === 'self-hosted'
                    ? `$0.00 / video · ${requiredVramGb} GB VRAM (${effectiveQuant.toUpperCase()})`
                    : `Est. ~$${((activeModel.estimatedExternalCostUsdPerSec ?? 0.05) * durationSec).toFixed(2)} / clip`}
                </span>
              </div>
              <button
                type="button"
                onClick={onOpenPolicy}
                className="text-slate-500 dark:text-slate-400 hover:text-sky-600 dark:hover:text-sky-400 underline underline-offset-2 whitespace-nowrap shrink-0"
              >
                Free Generation Policy
              </button>
            </div>
          )}

          {/* Prompt / Batch Prompts */}
          {mode === 'single' ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label
                  htmlFor="single-prompt-input"
                  className="text-xs font-semibold text-slate-700 dark:text-slate-200"
                >
                  Video Prompt
                </label>
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  No daily limits · Queue as many renders as needed
                </span>
              </div>
              <textarea
                id="single-prompt-input"
                rows={3}
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Describe subject, camera movement, lighting, and atmosphere..."
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#0B0E14] px-3.5 py-2.5 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:border-sky-500 focus:outline-none"
              />
            </div>
          ) : (
            <div className="space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label
                  htmlFor="batch-prompt-input"
                  className="text-xs font-semibold text-slate-700 dark:text-slate-200"
                >
                  Batch Prompt List (One Prompt Per Line)
                </label>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setBatchText(buildBatchSample(10))}
                    className="px-2.5 py-1 text-xs font-medium rounded-md border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 whitespace-nowrap shrink-0"
                  >
                    10 Prompts
                  </button>
                  <button
                    type="button"
                    onClick={() => setBatchText(buildBatchSample(50))}
                    className="px-2.5 py-1 text-xs font-medium rounded-md border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 whitespace-nowrap shrink-0"
                  >
                    50 Prompts
                  </button>
                  <button
                    type="button"
                    onClick={() => setBatchText(buildBatchSample(100))}
                    className="px-2.5 py-1 text-xs font-medium rounded-md border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 whitespace-nowrap shrink-0"
                  >
                    100 Prompts
                  </button>
                  <button
                    type="button"
                    onClick={() => batchFileInputRef.current?.click()}
                    className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-md border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 whitespace-nowrap shrink-0"
                  >
                    <Upload className="h-3 w-3" />
                    Import TXT/CSV
                  </button>
                  <input
                    ref={batchFileInputRef}
                    type="file"
                    accept=".txt,.csv"
                    onChange={handleBatchFileImport}
                    className="hidden"
                  />
                </div>
              </div>
              <textarea
                id="batch-prompt-input"
                rows={7}
                value={batchText}
                onChange={(e) => setBatchText(e.target.value)}
                placeholder="Enter 10, 50, 100 or more prompts (one per line)..."
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#0B0E14] px-3.5 py-2.5 font-mono text-xs leading-relaxed text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:border-sky-500 focus:outline-none"
              />
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums">
                <span>
                  {parsedBatchPrompts.length} job(s) ready · Processed by {config.workerCount} worker(s)
                  (max {config.maxConcurrentJobs} concurrent)
                </span>
                <span>Throughput scales with GPU VRAM &amp; disk capacity</span>
              </div>
            </div>
          )}

          {/* Workflow-Specific Media Inputs */}
          {workflow === 'image-to-video' && (
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200">
                Starting Frame Image
              </label>
              <div className="flex items-center gap-4">
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#0B0E14] px-3.5 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800">
                  <Upload className="h-3.5 w-3.5" />
                  Select Image
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={async (e) => {
                      const f = e.target.files?.[0];
                      if (f) setImageDataUrl(await readFileAsDataUrl(f));
                    }}
                  />
                </label>
                {imageDataUrl && (
                  <div className="flex items-center gap-3">
                    <img
                      src={imageDataUrl}
                      alt="Starting frame"
                      className="h-12 w-20 rounded-md object-cover border border-slate-200 dark:border-slate-700"
                    />
                    <button
                      type="button"
                      onClick={() => setImageDataUrl('')}
                      className="text-xs text-rose-500 hover:underline"
                    >
                      Remove
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {workflow === 'frame-interpolation' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200">
                  Start Keyframe
                </label>
                <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-[#0B0E14] p-3 text-xs text-slate-600 dark:text-slate-300 hover:border-sky-500">
                  {imageDataUrl ? (
                    <img src={imageDataUrl} alt="Start frame" className="h-16 w-full object-cover rounded" />
                  ) : (
                    <>
                      <Upload className="h-3.5 w-3.5" />
                      Upload Start Frame
                    </>
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={async (e) => {
                      const f = e.target.files?.[0];
                      if (f) setImageDataUrl(await readFileAsDataUrl(f));
                    }}
                  />
                </label>
              </div>
              <div className="space-y-2">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200">
                  End Keyframe
                </label>
                <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-[#0B0E14] p-3 text-xs text-slate-600 dark:text-slate-300 hover:border-sky-500">
                  {endFrameDataUrl ? (
                    <img src={endFrameDataUrl} alt="End frame" className="h-16 w-full object-cover rounded" />
                  ) : (
                    <>
                      <Upload className="h-3.5 w-3.5" />
                      Upload End Frame
                    </>
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={async (e) => {
                      const f = e.target.files?.[0];
                      if (f) setEndFrameDataUrl(await readFileAsDataUrl(f));
                    }}
                  />
                </label>
              </div>
            </div>
          )}

          {workflow === 'reference-image' && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                  Reference Storyboard Images (up to 3)
                </label>
                {referenceImages.length < 3 && (
                  <label className="inline-flex cursor-pointer items-center gap-1.5 text-xs font-medium text-sky-600 dark:text-sky-400 hover:underline">
                    <Plus className="h-3.5 w-3.5" />
                    Add Reference
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={async (e) => {
                        const f = e.target.files?.[0];
                        if (f) {
                          const url = await readFileAsDataUrl(f);
                          setReferenceImages((prev) => [...prev.slice(0, 2), url]);
                        }
                        e.target.value = '';
                      }}
                    />
                  </label>
                )}
              </div>
              {referenceImages.length > 0 ? (
                <div className="flex flex-wrap gap-3">
                  {referenceImages.map((img, i) => (
                    <div key={i} className="relative">
                      <img
                        src={img}
                        alt={`Reference ${i + 1}`}
                        className="h-16 w-24 rounded-md object-cover border border-slate-200 dark:border-slate-700"
                      />
                      <button
                        type="button"
                        onClick={() => setReferenceImages((prev) => prev.filter((_, idx) => idx !== i))}
                        className="absolute -top-1.5 -right-1.5 rounded-full bg-slate-900 text-white p-1"
                        aria-label="Remove reference image"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  No reference images attached yet.
                </p>
              )}
            </div>
          )}

          {workflow === 'video-edit' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200">
                  Source Video (Upload or Previous Render)
                </label>
                <div className="flex flex-col gap-2">
                  <select
                    value={sourceVideoJobId}
                    onChange={(e) => {
                      setSourceVideoJobId(e.target.value);
                      if (e.target.value) setSourceVideoDataUrl('');
                    }}
                    className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#0B0E14] px-3 py-2 text-xs text-slate-900 dark:text-slate-100"
                  >
                    <option value="">Select completed job...</option>
                    {completedJobs.map((j) => (
                      <option key={j.id} value={j.id}>
                        {j.id.slice(-8)} · {j.prompt.slice(0, 40)}
                      </option>
                    ))}
                  </select>
                  <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#0B0E14] px-3 py-2 text-xs text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800">
                    <Upload className="h-3.5 w-3.5" />
                    {sourceVideoDataUrl ? 'Uploaded MP4/WebM Ready' : 'Or Upload MP4 / WebM Clip'}
                    <input
                      type="file"
                      accept="video/mp4,video/webm"
                      className="hidden"
                      onChange={async (e) => {
                        const f = e.target.files?.[0];
                        if (f) {
                          setSourceVideoDataUrl(await readFileAsDataUrl(f));
                          setSourceVideoJobId('');
                        }
                      }}
                    />
                  </label>
                </div>
              </div>
              <div className="space-y-2">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200">
                  Video Editing Transform
                </label>
                <select
                  value={editMode}
                  onChange={(e) => setEditMode(e.target.value as NonNullable<JobInputAssets['editMode']>)}
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#0B0E14] px-3 py-2 text-xs text-slate-900 dark:text-slate-100"
                >
                  <option value="cinematic-grade">Cinematic Contrast &amp; Sharpen</option>
                  <option value="noir-contrast">Monochrome Film Noir</option>
                  <option value="cyber-cool">Cool Cyan Color Balance</option>
                  <option value="warm-film">Warm Analog Film Grade</option>
                  <option value="speed-2x">2x Time-Lapse Speed</option>
                  <option value="reverse">Reverse Motion Playback</option>
                </select>
              </div>
            </div>
          )}

          {/* Model & Optimization Controls */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label
                htmlFor="model-select"
                className="text-xs font-semibold text-slate-700 dark:text-slate-200"
              >
                Generation Model
              </label>
              <select
                id="model-select"
                value={activeModel?.id || ''}
                onChange={(e) => handleModelChange(e.target.value)}
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#0B0E14] px-3 py-2 text-xs text-slate-900 dark:text-slate-100 focus:border-sky-500 focus:outline-none"
              >
                <optgroup label="SELF-HOSTED FREE ENGINE (Default · $0 / video)">
                  {enabledModels
                    .filter((m) => m.provider === 'self-hosted')
                    .map((m) => (
                      <option key={m.id} value={m.id} disabled={!m.installed}>
                        {m.name} ({m.license}) {m.installed ? '' : '— [Not Installed]'}
                      </option>
                    ))}
                </optgroup>
                {enabledModels.some((m) => m.provider === 'external-paid') && (
                  <optgroup label="EXTERNAL PAID MODEL (Optional · Requires Approval)">
                    {enabledModels
                      .filter((m) => m.provider === 'external-paid')
                      .map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name} (External Paid API)
                        </option>
                      ))}
                  </optgroup>
                )}
              </select>
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="quantization-select"
                className="text-xs font-semibold text-slate-700 dark:text-slate-200"
              >
                Quantization &amp; VRAM Profile
              </label>
              <select
                id="quantization-select"
                value={effectiveQuant}
                onChange={(e) => setQuantization(e.target.value as QuantizationType)}
                disabled={activeModel?.provider === 'external-paid'}
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#0B0E14] px-3 py-2 text-xs font-mono text-slate-900 dark:text-slate-100 focus:border-sky-500 focus:outline-none disabled:opacity-50"
              >
                {(activeModel?.supportedQuantizations ?? ['fp8']).map((q) => (
                  <option key={q} value={q}>
                    {q.toUpperCase()} — {activeModel?.vramByQuantizationGb[q] ?? 0} GB VRAM
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Output Specifications */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-600 dark:text-slate-400">
                Resolution
              </label>
              <select
                value={resolution}
                onChange={(e) => setResolution(e.target.value as ResolutionOption)}
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#0B0E14] px-2.5 py-2 text-xs font-mono text-slate-900 dark:text-slate-100"
              >
                <option value="480p">480p Fast</option>
                <option value="720p">720p HD</option>
                <option value="1080p">1080p Full HD</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-600 dark:text-slate-400">
                Aspect Ratio
              </label>
              <select
                value={aspectRatio}
                onChange={(e) => setAspectRatio(e.target.value as AspectRatioOption)}
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#0B0E14] px-2.5 py-2 text-xs font-mono text-slate-900 dark:text-slate-100"
              >
                <option value="16:9">16:9 Landscape</option>
                <option value="9:16">9:16 Vertical</option>
                <option value="1:1">1:1 Square</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-600 dark:text-slate-400">
                Duration
              </label>
              <select
                value={durationSec}
                onChange={(e) => setDurationSec(Number(e.target.value))}
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#0B0E14] px-2.5 py-2 text-xs font-mono text-slate-900 dark:text-slate-100"
              >
                <option value={3}>3 sec</option>
                <option value={4}>4 sec</option>
                <option value={6}>6 sec</option>
                <option value={8}>8 sec</option>
                <option value={10}>10 sec</option>
                <option value={15}>15 sec</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-600 dark:text-slate-400">
                Encoding
              </label>
              <select
                value={encoding}
                onChange={(e) => setEncoding(e.target.value as EncodingPreset)}
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#0B0E14] px-2.5 py-2 text-xs font-mono text-slate-900 dark:text-slate-100"
              >
                <option value="h264-fast">H.264 Fast</option>
                <option value="h264-hq">H.264 High</option>
                <option value="hevc">H.265 HEVC</option>
                <option value="vp9">WebM VP9</option>
              </select>
            </div>
          </div>

          {/* Seed, Priority, FPS, Caching */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 pt-1">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-600 dark:text-slate-400">
                Frame Rate
              </label>
              <select
                value={fps}
                onChange={(e) => setFps(Number(e.target.value))}
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#0B0E14] px-2.5 py-2 text-xs font-mono text-slate-900 dark:text-slate-100"
              >
                <option value={24}>24 fps</option>
                <option value={30}>30 fps</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-600 dark:text-slate-400">
                Queue Priority
              </label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as JobPriority)}
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#0B0E14] px-2.5 py-2 text-xs text-slate-900 dark:text-slate-100"
              >
                <option value="high">High Priority</option>
                <option value="normal">Normal</option>
                <option value="low">Low Priority</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-600 dark:text-slate-400">
                Seed (Optional)
              </label>
              <input
                type="number"
                value={seedInput}
                onChange={(e) => setSeedInput(e.target.value)}
                placeholder="Random"
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#0B0E14] px-2.5 py-2 text-xs font-mono text-slate-900 dark:text-slate-100"
              />
            </div>

            <div className="flex items-end pb-1.5">
              <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-700 dark:text-slate-300 select-none">
                <input
                  type="checkbox"
                  checked={useCache}
                  onChange={(e) => setUseCache(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 dark:border-slate-700 accent-sky-600"
                />
                Render Cache
              </label>
            </div>
          </div>

          {/* Negative Prompt */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-600 dark:text-slate-400">
              Negative Prompt
            </label>
            <input
              type="text"
              value={negativePrompt}
              onChange={(e) => setNegativePrompt(e.target.value)}
              className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#0B0E14] px-3 py-2 text-xs text-slate-900 dark:text-slate-100"
            />
          </div>

          {!vramFits && (
            <div className="flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3.5 py-2.5 text-xs text-amber-700 dark:text-amber-300">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>
                {activeModel?.name} ({effectiveQuant.toUpperCase()}) requires {requiredVramGb} GB VRAM,
                exceeding configured {config.gpuVramGb} GB GPU memory. Select Q4/INT8 quantization or
                expand GPU capacity in Admin.
              </span>
            </div>
          )}

          {feedback && (
            <div
              className={`flex items-center justify-between gap-3 rounded-lg border px-3.5 py-2.5 text-xs ${
                feedback.type === 'ok'
                  ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                  : 'border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300'
              }`}
            >
              <div className="flex items-center gap-2">
                {feedback.type === 'ok' ? (
                  <CheckCircle2 className="h-4 w-4 shrink-0" />
                ) : (
                  <AlertCircle className="h-4 w-4 shrink-0" />
                )}
                <span>{feedback.text}</span>
              </div>
              {feedback.type === 'ok' && (
                <button
                  type="button"
                  onClick={onNavigateQueue}
                  className="font-semibold underline underline-offset-2 whitespace-nowrap shrink-0"
                >
                  Open Queue
                </button>
              )}
            </div>
          )}

          {/* Primary Action Row */}
          <div className="flex flex-wrap items-center justify-between gap-4 pt-2 border-t border-slate-200 dark:border-slate-800">
            <div className="text-xs text-slate-500 dark:text-slate-400">
              {activeModel?.provider === 'self-hosted' ? (
                <span>
                  No credits or tokens required · Renders prompt storyboard + audio locally (connect Remote GPU Node in Admin for full AI diffusion)
                </span>
              ) : (
                <span className="text-amber-600 dark:text-amber-400">
                  External provider selected · Approval dialog opens before submission
                </span>
              )}
            </div>
            <button
              type="submit"
              disabled={submitting || !activeModel}
              className={`inline-flex items-center gap-2 rounded-lg px-5 py-2.5 text-xs font-semibold text-white transition-colors disabled:opacity-50 whitespace-nowrap shrink-0 ${
                activeModel?.provider === 'external-paid'
                  ? 'bg-amber-600 hover:bg-amber-500'
                  : 'bg-sky-600 hover:bg-sky-500'
              }`}
            >
              {mode === 'single' ? (
                <>
                  <Play className="h-3.5 w-3.5" />
                  {submitting
                    ? 'Submitting...'
                    : activeModel?.provider === 'external-paid'
                    ? 'Review Paid Generation'
                    : 'Generate Video Free'}
                </>
              ) : (
                <>
                  <Layers className="h-3.5 w-3.5" />
                  {submitting
                    ? 'Queueing Batch...'
                    : `Submit ${parsedBatchPrompts.length} Batch Jobs`}
                </>
              )}
            </button>
          </div>
        </form>

        {/* Right: Active Worker Stage & Completed Preview */}
        <div className="xl:col-span-5 space-y-5">
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#121620] overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 px-5 py-3.5">
              <div>
                <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  Output Viewport
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums">
                  {metrics.activeWorkers}/{metrics.maxConcurrentJobs} active · {metrics.queuedCount}{' '}
                  queued · {metrics.completedCount} completed
                </p>
              </div>
              {previewJob && getVideoDownloadUrl(previewJob.id) && (
                <a
                  href={getVideoDownloadUrl(previewJob.id)}
                  download={getVideoDownloadFilename(previewJob)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 whitespace-nowrap shrink-0"
                >
                  <Download className="h-3.5 w-3.5" />
                  Download
                </a>
              )}
            </div>

            {previewJob && getVideoStreamUrl(previewJob.id) ? (
              <div>
                <div
                  className={`bg-black flex items-center justify-center ${
                    previewJob.aspectRatio === '9:16'
                      ? 'aspect-[9/16] max-h-[520px] mx-auto'
                      : previewJob.aspectRatio === '1:1'
                      ? 'aspect-square max-h-[480px] mx-auto'
                      : 'aspect-video'
                  }`}
                >
                  <video
                    key={previewJob.id}
                    src={getVideoStreamUrl(previewJob.id)}
                    controls
                    autoPlay
                    loop
                    playsInline
                    className="w-full h-full object-contain"
                  />
                </div>
                <div className="p-4 space-y-2 border-t border-slate-200 dark:border-slate-800">
                  <p className="text-xs font-medium text-slate-900 dark:text-slate-100 line-clamp-2">
                    {previewJob.prompt}
                  </p>
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums">
                    <span>{previewJob.modelName}</span>
                    <span aria-hidden="true">·</span>
                    <span>{previewJob.resolution}</span>
                    <span aria-hidden="true">·</span>
                    <span>{previewJob.encoding.toUpperCase()}</span>
                    <span aria-hidden="true">·</span>
                    <span>
                      {previewJob.outputBytes
                        ? `${(previewJob.outputBytes / 1024).toFixed(0)} KB`
                        : 'MP4'}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span className="text-emerald-600 dark:text-emerald-400">
                      {previewJob.cacheHit
                        ? 'Cache Hit'
                        : previewJob.renderDurationMs
                        ? `${(previewJob.renderDurationMs / 1000).toFixed(2)}s`
                        : 'Done'}
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="aspect-video flex flex-col items-center justify-center gap-3 p-6 text-center bg-slate-50 dark:bg-[#0B0E14]">
                <Film className="h-8 w-8 text-slate-400 dark:text-slate-600" />
                <div className="space-y-1 max-w-xs">
                  <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    No rendered videos yet
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Submit a prompt or batch on the left to generate MP4/WebM video locally with zero
                    credits.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Active Running Workers */}
          {runningJobs.length > 0 && (
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#121620] p-4 space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-900 dark:text-slate-100">
                  Active Workers ({runningJobs.length})
                </span>
                <span className="font-mono tabular-nums text-slate-500 dark:text-slate-400">
                  {metrics.gpuVramUsedGb} / {metrics.gpuVramTotalGb} GB VRAM
                </span>
              </div>
              <div className="space-y-3">
                {runningJobs.slice(0, 4).map((job) => (
                  <div key={job.id} className="space-y-1.5">
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <span className="truncate text-slate-700 dark:text-slate-200">{job.prompt}</span>
                      <span className="font-mono tabular-nums text-sky-600 dark:text-sky-400 shrink-0">
                        {job.progress}%
                      </span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
                      <div
                        className="h-full bg-sky-500 transition-all duration-200"
                        style={{ width: `${job.progress}%` }}
                      />
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">{job.stageMessage}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recent Completed Strip */}
          {completedJobs.length > 1 && (
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#121620] p-4 space-y-2.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-900 dark:text-slate-100">
                  Recent Outputs
                </span>
                <button
                  type="button"
                  onClick={onNavigateQueue}
                  className="text-sky-600 dark:text-sky-400 hover:underline"
                >
                  View All ({completedJobs.length})
                </button>
              </div>
              <div className="divide-y divide-slate-100 dark:divide-slate-800/80">
                {completedJobs.slice(0, 5).map((j) => (
                  <button
                    key={j.id}
                    type="button"
                    onClick={() => setPreviewJobId(j.id)}
                    className={`w-full flex items-center justify-between gap-3 py-2 text-left text-xs transition-colors hover:text-sky-600 dark:hover:text-sky-400 ${
                      previewJob?.id === j.id
                        ? 'font-semibold text-sky-600 dark:text-sky-400'
                        : 'text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    <span className="truncate">{j.prompt}</span>
                    <span className="font-mono tabular-nums text-[11px] text-slate-400 shrink-0">
                      {j.resolution} · {j.durationSec}s
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
