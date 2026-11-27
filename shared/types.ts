export type WorkflowType =
  | 'text-to-video'
  | 'image-to-video'
  | 'reference-image'
  | 'frame-interpolation'
  | 'video-edit';

export type ProviderType = 'self-hosted' | 'external-paid';

export type QuantizationType = 'bf16' | 'fp8' | 'int8' | 'q4';

export type EncodingPreset = 'h264-fast' | 'h264-hq' | 'hevc' | 'vp9';

export type JobStatus = 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';

export type JobPriority = 'high' | 'normal' | 'low';

export type ResolutionOption = '480p' | '720p' | '1080p';

export type AspectRatioOption = '16:9' | '9:16' | '1:1';

export type BackendExecutionMode = 'local-ffmpeg' | 'remote-gpu';

export interface VideoModelSpec {
  id: string;
  name: string;
  family: string;
  provider: ProviderType;
  providerLabel: 'SELF-HOSTED FREE ENGINE' | 'EXTERNAL PAID MODEL';
  license: string;
  commercialUse: boolean;
  commercialNotes: string;
  supportedWorkflows: WorkflowType[];
  supportedQuantizations: QuantizationType[];
  defaultQuantization: QuantizationType;
  vramByQuantizationGb: Record<QuantizationType, number>;
  diskSizeGb: number;
  speedRating: 'Ultra-Fast' | 'Fast' | 'Balanced' | 'Cinema';
  estimatedSecPerVideo: number;
  description: string;
  repoUrl?: string;
  installed: boolean;
  installProgress?: number;
  installing?: boolean;
  enabled: boolean;
  estimatedExternalCostUsdPerSec?: number;
}

export interface JobInputAssets {
  imageDataUrl?: string;
  endFrameDataUrl?: string;
  referenceImages?: string[];
  sourceVideoDataUrl?: string;
  sourceVideoJobId?: string;
  editMode?: 'cinematic-grade' | 'noir-contrast' | 'cyber-cool' | 'warm-film' | 'speed-2x' | 'reverse';
}

export interface VideoJob {
  id: string;
  batchId?: string;
  batchIndex?: number;
  batchTotal?: number;
  workflow: WorkflowType;
  prompt: string;
  negativePrompt?: string;
  modelId: string;
  modelName: string;
  provider: ProviderType;
  providerLabel: 'SELF-HOSTED FREE ENGINE' | 'EXTERNAL PAID MODEL';
  quantization: QuantizationType;
  encoding: EncodingPreset;
  resolution: ResolutionOption;
  aspectRatio: AspectRatioOption;
  durationSec: number;
  fps: number;
  seed: number;
  priority: JobPriority;
  useCache: boolean;
  cacheHit: boolean;
  status: JobStatus;
  progress: number;
  stageMessage: string;
  vramAllocatedGb: number;
  estimatedCostUsd: number;
  paidProviderApproved: boolean;
  createdAt: number;
  startedAt?: number;
  completedAt?: number;
  renderDurationMs?: number;
  outputFileName?: string;
  outputMimeType?: string;
  outputBytes?: number;
  error?: string;
  hasAssets?: boolean;
}

export interface AdminConfig {
  gpuName: string;
  gpuVramGb: number;
  backendMode: BackendExecutionMode;
  gpuServerUrl: string;
  gpuServerApiType: 'comfyui' | 'diffusers-http';
  workerCount: number;
  maxConcurrentJobs: number;
  defaultPriority: JobPriority;
  storageLimitGb: number;
  cacheEnabled: boolean;
  queuePaused: boolean;
  allowExternalPaidModels: boolean;
}

export interface SystemMetrics {
  gpuName: string;
  gpuVramTotalGb: number;
  gpuVramUsedGb: number;
  backendMode: BackendExecutionMode;
  gpuServerUrl: string;
  workerCount: number;
  activeWorkers: number;
  maxConcurrentJobs: number;
  queuedCount: number;
  runningCount: number;
  completedCount: number;
  failedCount: number;
  cancelledCount: number;
  cacheHitsCount: number;
  cacheEntriesCount: number;
  diskFreeGb: number;
  diskTotalGb: number;
  outputsUsedMb: number;
  storageLimitGb: number;
  hostCpuCount: number;
  hostRamFreeGb: number;
  hostRamTotalGb: number;
  ffmpegAvailable: boolean;
  queuePaused: boolean;
}

export interface LogEntry {
  id: string;
  timestamp: number;
  level: 'info' | 'warn' | 'error';
  jobId?: string;
  modelId?: string;
  message: string;
}

export interface SubmitJobPayload {
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
  priority?: JobPriority;
  useCache?: boolean;
  paidProviderApproved?: boolean;
  assets?: JobInputAssets;
}

export interface BatchSubmitPayload {
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
  priority?: JobPriority;
  useCache?: boolean;
  paidProviderApproved?: boolean;
  assets?: JobInputAssets;
}
