import fs from 'fs';
import os from 'os';
import path from 'path';
import { AdminConfig, LogEntry, VideoJob, VideoModelSpec } from '../shared/types.js';
import { DEFAULT_ADMIN_CONFIG, INITIAL_MODELS } from './models.js';

export const DATA_DIR = path.resolve(process.cwd(), 'data');
export const OUTPUTS_DIR = path.resolve(DATA_DIR, 'outputs');
export const UPLOADS_DIR = path.resolve(DATA_DIR, 'uploads');
const STATE_FILE = path.resolve(DATA_DIR, 'studio-state.json');

export interface CacheEntry {
  cacheKey: string;
  fileName: string;
  mimeType: string;
  bytes: number;
  createdAt: number;
}

export interface StudioState {
  config: AdminConfig;
  models: VideoModelSpec[];
  jobs: VideoJob[];
  logs: LogEntry[];
  cache: Record<string, CacheEntry>;
}

function ensureDirs() {
  for (const dir of [DATA_DIR, OUTPUTS_DIR, UPLOADS_DIR]) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }
}

export function resolveSafeFilePath(baseDir: string, fileName: string): string | null {
  if (!fileName || typeof fileName !== 'string') return null;
  const cleanName = path.basename(fileName);
  if (cleanName !== fileName) return null;
  const resolved = path.resolve(baseDir, cleanName);
  if (!resolved.startsWith(baseDir + path.sep)) {
    return null;
  }
  return resolved;
}

class StudioStore {
  private state: StudioState;
  private saveTimer: NodeJS.Timeout | null = null;

  constructor() {
    ensureDirs();
    this.state = this.loadState();
  }

  private loadState(): StudioState {
    if (fs.existsSync(STATE_FILE)) {
      try {
        const raw = fs.readFileSync(STATE_FILE, 'utf8');
        const parsed = JSON.parse(raw) as Partial<StudioState>;
        const mergedModels = INITIAL_MODELS.map((defaultModel) => {
          const saved = parsed.models?.find((m) => m.id === defaultModel.id);
          return saved
            ? {
                ...defaultModel,
                installed: saved.installed,
                enabled: saved.enabled,
                installing: false,
                installProgress: undefined,
              }
            : { ...defaultModel };
        });

        // Recover any jobs interrupted while running during a server restart
        const recoveredJobs = (parsed.jobs ?? []).map((job) =>
          job.status === 'running'
            ? {
                ...job,
                status: 'queued' as const,
                progress: 0,
                vramAllocatedGb: 0,
                stageMessage: 'Re-queued after server restart',
              }
            : job
        );

        return {
          config: { ...DEFAULT_ADMIN_CONFIG, ...(parsed.config ?? {}) },
          models: mergedModels,
          jobs: recoveredJobs,
          logs: (parsed.logs ?? []).slice(0, 400),
          cache: parsed.cache ?? {},
        };
      } catch (err) {
        console.error('Failed to load persisted studio state, initializing fresh store:', err);
      }
    }
    return {
      config: { ...DEFAULT_ADMIN_CONFIG },
      models: INITIAL_MODELS.map((m) => ({ ...m })),
      jobs: [],
      logs: [
        {
          id: `log_${Date.now()}`,
          timestamp: Date.now(),
          level: 'info',
          message: 'OpenFrame Studio initialized in zero-credit self-hosted mode.',
        },
      ],
      cache: {},
    };
  }

  private schedulePersist() {
    if (this.saveTimer) return;
    this.saveTimer = setTimeout(() => {
      this.saveTimer = null;
      this.persistNow();
    }, 120);
  }

  persistNow() {
    try {
      ensureDirs();
      const tmp = `${STATE_FILE}.tmp`;
      fs.writeFileSync(tmp, JSON.stringify(this.state, null, 2), 'utf8');
      fs.renameSync(tmp, STATE_FILE);
    } catch (err) {
      console.error('Failed to persist studio state:', err);
    }
  }

  getConfig(): AdminConfig {
    return this.state.config;
  }

  updateConfig(patch: Partial<AdminConfig>): AdminConfig {
    this.state.config = { ...this.state.config, ...patch };
    this.schedulePersist();
    return this.state.config;
  }

  getModels(): VideoModelSpec[] {
    return this.state.models;
  }

  getModelById(id: string): VideoModelSpec | undefined {
    return this.state.models.find((m) => m.id === id);
  }

  updateModel(id: string, patch: Partial<VideoModelSpec>): VideoModelSpec | undefined {
    const idx = this.state.models.findIndex((m) => m.id === id);
    if (idx === -1) return undefined;
    this.state.models[idx] = { ...this.state.models[idx], ...patch };
    this.schedulePersist();
    return this.state.models[idx];
  }

  getJobs(): VideoJob[] {
    return this.state.jobs;
  }

  getJobById(id: string): VideoJob | undefined {
    return this.state.jobs.find((j) => j.id === id);
  }

  addJobs(newJobs: VideoJob[]) {
    // Prepend newest jobs or append? We store newest first for fast retrieval, worker picks oldest queued by priority
    this.state.jobs.unshift(...newJobs);
    this.schedulePersist();
  }

  updateJob(id: string, patch: Partial<VideoJob>): VideoJob | undefined {
    const idx = this.state.jobs.findIndex((j) => j.id === id);
    if (idx === -1) return undefined;
    this.state.jobs[idx] = { ...this.state.jobs[idx], ...patch };
    this.schedulePersist();
    return this.state.jobs[idx];
  }

  deleteJob(id: string): boolean {
    const idx = this.state.jobs.findIndex((j) => j.id === id);
    if (idx === -1) return false;
    const [removed] = this.state.jobs.splice(idx, 1);
    if (removed?.outputFileName) {
      // Only delete file if no other job or cache entry points to it
      const referencedByOtherJob = this.state.jobs.some((j) => j.outputFileName === removed.outputFileName);
      const referencedByCache = Object.values(this.state.cache).some(
        (c) => c.fileName === removed.outputFileName
      );
      if (!referencedByOtherJob && !referencedByCache) {
        const p = resolveSafeFilePath(OUTPUTS_DIR, removed.outputFileName);
        if (p && fs.existsSync(p)) {
          fs.unlinkSync(p);
        }
      }
    }
    this.schedulePersist();
    return true;
  }

  getLogs(): LogEntry[] {
    return this.state.logs;
  }

  addLog(level: LogEntry['level'], message: string, extra?: { jobId?: string; modelId?: string }): LogEntry {
    const entry: LogEntry = {
      id: `log_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      timestamp: Date.now(),
      level,
      message,
      jobId: extra?.jobId,
      modelId: extra?.modelId,
    };
    this.state.logs.unshift(entry);
    if (this.state.logs.length > 400) {
      this.state.logs.length = 400;
    }
    this.schedulePersist();
    return entry;
  }

  clearLogs() {
    this.state.logs = [];
    this.schedulePersist();
  }

  getCacheEntry(cacheKey: string): CacheEntry | undefined {
    const entry = this.state.cache[cacheKey];
    if (!entry) return undefined;
    const safePath = resolveSafeFilePath(OUTPUTS_DIR, entry.fileName);
    if (!safePath || !fs.existsSync(safePath)) {
      delete this.state.cache[cacheKey];
      this.schedulePersist();
      return undefined;
    }
    return entry;
  }

  setCacheEntry(entry: CacheEntry) {
    this.state.cache[entry.cacheKey] = entry;
    this.schedulePersist();
  }

  clearCache(): number {
    const cacheFiles = new Set(Object.values(this.state.cache).map((c) => c.fileName));
    const jobFiles = new Set(this.state.jobs.map((j) => j.outputFileName).filter(Boolean));
    let removedFiles = 0;
    for (const f of cacheFiles) {
      if (!jobFiles.has(f)) {
        const safePath = resolveSafeFilePath(OUTPUTS_DIR, f);
        if (safePath && fs.existsSync(safePath)) {
          fs.unlinkSync(safePath);
          removedFiles++;
        }
      }
    }
    const count = Object.keys(this.state.cache).length;
    this.state.cache = {};
    this.schedulePersist();
    return count + removedFiles * 0;
  }

  getCacheCount(): number {
    return Object.keys(this.state.cache).length;
  }

  getDiskStats(): { diskFreeGb: number; diskTotalGb: number; outputsUsedMb: number } {
    let diskFreeGb = 50;
    let diskTotalGb = 100;
    try {
      const stats = fs.statfsSync(DATA_DIR);
      diskFreeGb = Number(((stats.bavail * stats.bsize) / 1024 ** 3).toFixed(2));
      diskTotalGb = Number(((stats.blocks * stats.bsize) / 1024 ** 3).toFixed(2));
    } catch {
      // Fallback if statfsSync unsupported
    }

    let outputsBytes = 0;
    try {
      const files = fs.readdirSync(OUTPUTS_DIR);
      for (const file of files) {
        const p = resolveSafeFilePath(OUTPUTS_DIR, file);
        if (p) {
          const st = fs.statSync(p);
          outputsBytes += st.size;
        }
      }
    } catch {
      // Ignore
    }

    return {
      diskFreeGb,
      diskTotalGb,
      outputsUsedMb: Number((outputsBytes / 1024 ** 2).toFixed(2)),
    };
  }

  getHostStats() {
    return {
      hostCpuCount: os.cpus().length,
      hostRamFreeGb: Number((os.freemem() / 1024 ** 3).toFixed(2)),
      hostRamTotalGb: Number((os.totalmem() / 1024 ** 3).toFixed(2)),
    };
  }
}

export const store = new StudioStore();
