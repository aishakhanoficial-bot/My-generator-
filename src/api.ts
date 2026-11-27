import {
  AdminConfig,
  BatchSubmitPayload,
  LogEntry,
  SubmitJobPayload,
  SystemMetrics,
  VideoJob,
  VideoModelSpec,
} from '../shared/types';
import { browserRuntime } from './browserEngine';

export interface BootstrapResponse {
  models: VideoModelSpec[];
  jobs: VideoJob[];
  config: AdminConfig;
  metrics: SystemMetrics;
  logs: LogEntry[];
}

let staticMode = false;

export function isStaticHostingMode(): boolean {
  return staticMode;
}

export function getVideoStreamUrl(jobId: string): string {
  if (staticMode) {
    return browserRuntime.getVideoUrl(jobId) ?? '';
  }
  return `/api/videos/${encodeURIComponent(jobId)}`;
}

export function getVideoDownloadUrl(jobId: string): string {
  if (staticMode) {
    return browserRuntime.getVideoUrl(jobId) ?? '';
  }
  return `/api/videos/${encodeURIComponent(jobId)}/download`;
}

export function getVideoDownloadFilename(job: VideoJob): string {
  const slug = job.prompt
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 36);
  const ext = job.outputMimeType?.includes('webm') ? 'webm' : 'mp4';
  return `${slug || job.id}_${job.resolution}.${ext}`;
}

export function subscribeEvents(
  onState: (payload: {
    jobs: VideoJob[];
    metrics: SystemMetrics;
    models: VideoModelSpec[];
    config: AdminConfig;
  }) => void,
  onLog: (entry: LogEntry) => void
): () => void {
  if (staticMode) {
    return browserRuntime.subscribe(onState, onLog);
  }

  const es = new EventSource('/api/events');
  es.addEventListener('state', (evt) => {
    try {
      onState(JSON.parse((evt as MessageEvent).data));
    } catch {
      // Ignore parse errors
    }
  });
  es.addEventListener('log', (evt) => {
    try {
      onLog(JSON.parse((evt as MessageEvent).data));
    } catch {
      // Ignore parse errors
    }
  });

  return () => es.close();
}

async function handleJson<T>(res: Response): Promise<T> {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((data as { error?: string }).error || `Request failed (${res.status})`);
  }
  return data as T;
}

export const api = {
  bootstrap: async (): Promise<BootstrapResponse> => {
    try {
      const res = await fetch('/api/bootstrap');
      const contentType = res.headers.get('content-type') ?? '';
      if (res.ok && contentType.includes('application/json')) {
        staticMode = false;
        return (await res.json()) as BootstrapResponse;
      }
    } catch {
      // Network/static fallback
    }
    staticMode = true;
    return browserRuntime.bootstrap();
  },

  submitJob: async (payload: SubmitJobPayload) => {
    if (staticMode) return browserRuntime.submitJob(payload);
    return fetch('/api/jobs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }).then((r) => handleJson<{ job: VideoJob }>(r));
  },

  submitBatch: async (payload: BatchSubmitPayload) => {
    if (staticMode) return browserRuntime.submitBatch(payload);
    return fetch('/api/jobs/batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }).then((r) => handleJson<{ batchId: string; count: number; jobs: VideoJob[] }>(r));
  },

  cancelJob: async (id: string) => {
    if (staticMode) return browserRuntime.cancelJob(id);
    return fetch(`/api/jobs/${encodeURIComponent(id)}/cancel`, { method: 'POST' }).then((r) =>
      handleJson<{ ok: boolean }>(r)
    );
  },

  retryJob: async (id: string) => {
    if (staticMode) return browserRuntime.retryJob(id);
    return fetch(`/api/jobs/${encodeURIComponent(id)}/retry`, { method: 'POST' }).then((r) =>
      handleJson<{ ok: boolean }>(r)
    );
  },

  deleteJob: async (id: string) => {
    if (staticMode) return browserRuntime.deleteJob(id);
    return fetch(`/api/jobs/${encodeURIComponent(id)}`, { method: 'DELETE' }).then((r) =>
      handleJson<{ ok: boolean }>(r)
    );
  },

  bulkAction: async (action: 'cancel-queued' | 'retry-failed' | 'clear-completed') => {
    if (staticMode) return browserRuntime.bulkAction(action);
    return fetch('/api/jobs/bulk-action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action }),
    }).then((r) => handleJson<{ ok: boolean; affected: number }>(r));
  },

  updateConfig: async (patch: Partial<AdminConfig>) => {
    if (staticMode) return browserRuntime.updateConfig(patch);
    return fetch('/api/admin/config', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    }).then((r) => handleJson<{ config: AdminConfig }>(r));
  },

  testGpuServer: async () => {
    if (staticMode) return browserRuntime.testGpuServer();
    return fetch('/api/admin/test-gpu-server', { method: 'POST' }).then((r) =>
      handleJson<{ ok: boolean; latencyMs: number; detail: string }>(r)
    );
  },

  installModel: async (id: string) => {
    if (staticMode) return browserRuntime.installModel(id);
    return fetch(`/api/admin/models/${encodeURIComponent(id)}/install`, { method: 'POST' }).then(
      (r) => handleJson<{ ok: boolean }>(r)
    );
  },

  uninstallModel: async (id: string) => {
    if (staticMode) return browserRuntime.uninstallModel(id);
    return fetch(`/api/admin/models/${encodeURIComponent(id)}/uninstall`, {
      method: 'POST',
    }).then((r) => handleJson<{ ok: boolean }>(r));
  },

  toggleModelEnabled: async (id: string, enabled: boolean) => {
    if (staticMode) return browserRuntime.toggleModelEnabled(id, enabled);
    return fetch(`/api/admin/models/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled }),
    }).then((r) => handleJson<{ model: VideoModelSpec }>(r));
  },

  clearCache: async () => {
    if (staticMode) return browserRuntime.clearCache();
    return fetch('/api/admin/cache/clear', { method: 'POST' }).then((r) =>
      handleJson<{ cleared: number }>(r)
    );
  },

  clearLogs: async () => {
    if (staticMode) return browserRuntime.clearLogs();
    return fetch('/api/admin/logs', { method: 'DELETE' }).then((r) =>
      handleJson<{ ok: boolean }>(r)
    );
  },
};
