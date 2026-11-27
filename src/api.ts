import {
  AdminConfig,
  BatchSubmitPayload,
  LogEntry,
  SubmitJobPayload,
  SystemMetrics,
  VideoJob,
  VideoModelSpec,
} from '../shared/types';

export interface BootstrapResponse {
  models: VideoModelSpec[];
  jobs: VideoJob[];
  config: AdminConfig;
  metrics: SystemMetrics;
  logs: LogEntry[];
}

async function handleJson<T>(res: Response): Promise<T> {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((data as { error?: string }).error || `Request failed (${res.status})`);
  }
  return data as T;
}

export const api = {
  bootstrap: () => fetch('/api/bootstrap').then((r) => handleJson<BootstrapResponse>(r)),

  submitJob: (payload: SubmitJobPayload) =>
    fetch('/api/jobs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }).then((r) => handleJson<{ job: VideoJob }>(r)),

  submitBatch: (payload: BatchSubmitPayload) =>
    fetch('/api/jobs/batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }).then((r) => handleJson<{ batchId: string; count: number; jobs: VideoJob[] }>(r)),

  cancelJob: (id: string) =>
    fetch(`/api/jobs/${encodeURIComponent(id)}/cancel`, { method: 'POST' }).then((r) =>
      handleJson<{ ok: boolean }>(r)
    ),

  retryJob: (id: string) =>
    fetch(`/api/jobs/${encodeURIComponent(id)}/retry`, { method: 'POST' }).then((r) =>
      handleJson<{ ok: boolean }>(r)
    ),

  deleteJob: (id: string) =>
    fetch(`/api/jobs/${encodeURIComponent(id)}`, { method: 'DELETE' }).then((r) =>
      handleJson<{ ok: boolean }>(r)
    ),

  bulkAction: (action: 'cancel-queued' | 'retry-failed' | 'clear-completed') =>
    fetch('/api/jobs/bulk-action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action }),
    }).then((r) => handleJson<{ ok: boolean; affected: number }>(r)),

  updateConfig: (patch: Partial<AdminConfig>) =>
    fetch('/api/admin/config', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    }).then((r) => handleJson<{ config: AdminConfig }>(r)),

  testGpuServer: () =>
    fetch('/api/admin/test-gpu-server', { method: 'POST' }).then((r) =>
      handleJson<{ ok: boolean; latencyMs: number; detail: string }>(r)
    ),

  installModel: (id: string) =>
    fetch(`/api/admin/models/${encodeURIComponent(id)}/install`, { method: 'POST' }).then((r) =>
      handleJson<{ ok: boolean }>(r)
    ),

  uninstallModel: (id: string) =>
    fetch(`/api/admin/models/${encodeURIComponent(id)}/uninstall`, { method: 'POST' }).then((r) =>
      handleJson<{ ok: boolean }>(r)
    ),

  toggleModelEnabled: (id: string, enabled: boolean) =>
    fetch(`/api/admin/models/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled }),
    }).then((r) => handleJson<{ model: VideoModelSpec }>(r)),

  clearCache: () =>
    fetch('/api/admin/cache/clear', { method: 'POST' }).then((r) =>
      handleJson<{ cleared: number }>(r)
    ),

  clearLogs: () =>
    fetch('/api/admin/logs', { method: 'DELETE' }).then((r) => handleJson<{ ok: boolean }>(r)),
};
