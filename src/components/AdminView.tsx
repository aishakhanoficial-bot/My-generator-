import {
  Activity,
  CheckCircle2,
  Cpu,
  HardDrive,
  Pause,
  Play,
  RefreshCw,
  Server,
  Trash2,
} from 'lucide-react';
import React, { useEffect, useState } from 'react';
import {
  AdminConfig,
  BackendExecutionMode,
  JobPriority,
  LogEntry,
  SystemMetrics,
  VideoModelSpec,
} from '../../shared/types';

interface AdminViewProps {
  config: AdminConfig;
  metrics: SystemMetrics;
  models: VideoModelSpec[];
  logs: LogEntry[];
  onSaveConfig: (patch: Partial<AdminConfig>) => Promise<void>;
  onTestGpuServer: () => Promise<{ ok: boolean; latencyMs: number; detail: string }>;
  onInstallModel: (id: string) => Promise<void>;
  onUninstallModel: (id: string) => Promise<void>;
  onClearCache: () => Promise<void>;
  onClearLogs: () => Promise<void>;
}

export function AdminView({
  config,
  metrics,
  models,
  logs,
  onSaveConfig,
  onTestGpuServer,
  onInstallModel,
  onUninstallModel,
  onClearCache,
  onClearLogs,
}: AdminViewProps) {
  const [form, setForm] = useState<AdminConfig>(config);
  const [saving, setSaving] = useState(false);
  const [saveNotice, setSaveNotice] = useState<string | null>(null);
  const [probeResult, setProbeResult] = useState<{
    ok: boolean;
    latencyMs: number;
    detail: string;
  } | null>(null);
  const [probing, setProbing] = useState(false);
  const [logFilter, setLogFilter] = useState<'all' | 'info' | 'warn' | 'error'>('all');

  useEffect(() => {
    setForm(config);
  }, [config]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaveNotice(null);
    try {
      await onSaveConfig(form);
      setSaveNotice('Configuration applied to active scheduler.');
    } catch (err) {
      setSaveNotice(err instanceof Error ? err.message : 'Failed to save configuration.');
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    setProbing(true);
    try {
      await onSaveConfig({
        gpuServerUrl: form.gpuServerUrl,
        gpuServerApiType: form.gpuServerApiType,
      });
      const res = await onTestGpuServer();
      setProbeResult(res);
    } finally {
      setProbing(false);
    }
  };

  const filteredLogs = logs.filter((l) => (logFilter === 'all' ? true : l.level === logFilter));
  const selfHostedModels = models.filter((m) => m.provider === 'self-hosted');

  return (
    <div className="space-y-6">
      {/* Server Health & Hardware Telemetry Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#121620] p-4 space-y-1">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>GPU Memory Allocation</span>
            <Cpu className="h-3.5 w-3.5" />
          </div>
          <div className="text-lg font-semibold font-mono tabular-nums text-slate-900 dark:text-slate-100">
            {metrics.gpuVramUsedGb} / {metrics.gpuVramTotalGb} GB
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
            {metrics.gpuName}
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#121620] p-4 space-y-1">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>Worker Pool</span>
            <Activity className="h-3.5 w-3.5" />
          </div>
          <div className="text-lg font-semibold font-mono tabular-nums text-slate-900 dark:text-slate-100">
            {metrics.activeWorkers} / {metrics.maxConcurrentJobs} Active
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono tabular-nums">
            {metrics.workerCount} configured · {metrics.queuePaused ? 'Paused' : 'Running'}
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#121620] p-4 space-y-1">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>Storage &amp; Disk Free</span>
            <HardDrive className="h-3.5 w-3.5" />
          </div>
          <div className="text-lg font-semibold font-mono tabular-nums text-slate-900 dark:text-slate-100">
            {metrics.diskFreeGb} GB Free
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono tabular-nums">
            {metrics.outputsUsedMb} MB outputs / {metrics.storageLimitGb} GB cap
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#121620] p-4 space-y-1">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>Host Server Health</span>
            <Server className="h-3.5 w-3.5" />
          </div>
          <div className="text-lg font-semibold font-mono tabular-nums text-slate-900 dark:text-slate-100">
            {metrics.hostCpuCount} vCPU · {metrics.hostRamFreeGb} GB RAM
          </div>
          <div className="text-[11px] text-emerald-600 dark:text-emerald-400 font-mono">
            FFmpeg: {metrics.ffmpegAvailable ? 'Ready' : 'Missing'} · Cache: {metrics.cacheEntriesCount}
          </div>
        </div>
      </div>

      {/* Main Configuration Form + Model Weight Manager */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        <form
          onSubmit={handleSave}
          className="xl:col-span-7 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#121620] p-5 space-y-5"
        >
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
            <div>
              <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                GPU Server &amp; Scheduler Configuration
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Hardware-protective limits only · Zero artificial daily generation quotas
              </p>
            </div>
            <button
              type="button"
              onClick={() => onSaveConfig({ queuePaused: !config.queuePaused })}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium border whitespace-nowrap shrink-0 ${
                config.queuePaused
                  ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                  : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              {config.queuePaused ? (
                <>
                  <Play className="h-3.5 w-3.5" />
                  Resume Queue
                </>
              ) : (
                <>
                  <Pause className="h-3.5 w-3.5" />
                  Pause Queue
                </>
              )}
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                Execution Backend
              </label>
              <select
                value={form.backendMode}
                onChange={(e) =>
                  setForm((f) => ({ ...f, backendMode: e.target.value as BackendExecutionMode }))
                }
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#0B0E14] px-3 py-2 text-xs text-slate-900 dark:text-slate-100"
              >
                <option value="local-ffmpeg">Embedded Self-Hosted Engine (FFmpeg Local)</option>
                <option value="remote-gpu">Remote Self-Hosted GPU Node (ComfyUI / Diffusers)</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                Configured GPU Label
              </label>
              <input
                type="text"
                value={form.gpuName}
                onChange={(e) => setForm((f) => ({ ...f, gpuName: e.target.value }))}
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#0B0E14] px-3 py-2 text-xs text-slate-900 dark:text-slate-100"
              />
            </div>
          </div>

          {form.backendMode === 'remote-gpu' && (
            <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0B0E14] p-4 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2 space-y-1.5">
                  <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                    Self-Hosted GPU Server URL
                  </label>
                  <input
                    type="url"
                    value={form.gpuServerUrl}
                    onChange={(e) => setForm((f) => ({ ...f, gpuServerUrl: e.target.value }))}
                    placeholder="http://127.0.0.1:8188"
                    className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#121620] px-3 py-2 text-xs font-mono text-slate-900 dark:text-slate-100"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                    Worker API Protocol
                  </label>
                  <select
                    value={form.gpuServerApiType}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        gpuServerApiType: e.target.value as 'comfyui' | 'diffusers-http',
                      }))
                    }
                    className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#121620] px-3 py-2 text-xs text-slate-900 dark:text-slate-100"
                  >
                    <option value="comfyui">ComfyUI (/prompt)</option>
                    <option value="diffusers-http">Diffusers FastAPI (/generate)</option>
                  </select>
                </div>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={handleTest}
                  disabled={probing}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#121620] px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${probing ? 'animate-spin' : ''}`} />
                  Test GPU Node Connection
                </button>
                {probeResult && (
                  <span
                    className={`text-xs font-mono ${
                      probeResult.ok
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-amber-600 dark:text-amber-400'
                    }`}
                  >
                    {probeResult.detail}
                  </span>
                )}
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                GPU VRAM (GB)
              </label>
              <input
                type="number"
                min={4}
                max={512}
                value={form.gpuVramGb}
                onChange={(e) => setForm((f) => ({ ...f, gpuVramGb: Number(e.target.value) }))}
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#0B0E14] px-3 py-2 text-xs font-mono text-slate-900 dark:text-slate-100"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                Worker Count
              </label>
              <input
                type="number"
                min={1}
                max={16}
                value={form.workerCount}
                onChange={(e) => setForm((f) => ({ ...f, workerCount: Number(e.target.value) }))}
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#0B0E14] px-3 py-2 text-xs font-mono text-slate-900 dark:text-slate-100"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                Max Concurrent Jobs
              </label>
              <input
                type="number"
                min={1}
                max={16}
                value={form.maxConcurrentJobs}
                onChange={(e) =>
                  setForm((f) => ({ ...f, maxConcurrentJobs: Number(e.target.value) }))
                }
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#0B0E14] px-3 py-2 text-xs font-mono text-slate-900 dark:text-slate-100"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                Default Queue Priority
              </label>
              <select
                value={form.defaultPriority}
                onChange={(e) =>
                  setForm((f) => ({ ...f, defaultPriority: e.target.value as JobPriority }))
                }
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#0B0E14] px-3 py-2 text-xs text-slate-900 dark:text-slate-100"
              >
                <option value="high">High</option>
                <option value="normal">Normal</option>
                <option value="low">Low</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                Storage Cap (GB)
              </label>
              <input
                type="number"
                min={1}
                max={10000}
                value={form.storageLimitGb}
                onChange={(e) =>
                  setForm((f) => ({ ...f, storageLimitGb: Number(e.target.value) }))
                }
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#0B0E14] px-3 py-2 text-xs font-mono text-slate-900 dark:text-slate-100"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-6 pt-1">
            <label className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={form.cacheEnabled}
                onChange={(e) => setForm((f) => ({ ...f, cacheEnabled: e.target.checked }))}
                className="h-4 w-4 accent-sky-600"
              />
              Enable Deterministic Render Cache
            </label>
            <label className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={form.allowExternalPaidModels}
                onChange={(e) =>
                  setForm((f) => ({ ...f, allowExternalPaidModels: e.target.checked }))
                }
                className="h-4 w-4 accent-amber-600"
              />
              Allow Optional External Paid Connectors
            </label>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 dark:border-slate-800 pt-4">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onClearCache}
                className="rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                Clear Render Cache ({metrics.cacheEntriesCount})
              </button>
              {saveNotice && (
                <span className="inline-flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  {saveNotice}
                </span>
              )}
            </div>
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-sky-600 px-4 py-2 text-xs font-semibold text-white hover:bg-sky-500 disabled:opacity-50"
            >
              {saving ? 'Applying...' : 'Save Configuration'}
            </button>
          </div>
        </form>

        {/* Right: Model Weight Installation & Storage */}
        <div className="xl:col-span-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#121620] p-5 space-y-4">
          <div className="border-b border-slate-200 dark:border-slate-800 pb-3">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Model Weight Installer
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Manage local open-source checkpoints on self-hosted storage
            </p>
          </div>
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {selfHostedModels.map((m) => (
              <div key={m.id} className="py-3 flex items-center justify-between gap-3 text-xs">
                <div className="min-w-0">
                  <div className="font-medium text-slate-900 dark:text-slate-100 truncate">
                    {m.name}
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono tabular-nums">
                    {m.license} · {m.diskSizeGb} GB
                  </div>
                </div>
                <div className="shrink-0">
                  {m.installing ? (
                    <span className="font-mono tabular-nums text-sky-600 dark:text-sky-400">
                      {m.installProgress ?? 0}%
                    </span>
                  ) : m.installed ? (
                    <button
                      type="button"
                      onClick={() => onUninstallModel(m.id)}
                      className="rounded-md border border-slate-200 dark:border-slate-700 px-2.5 py-1 text-[11px] text-slate-600 dark:text-slate-300 hover:text-rose-500"
                    >
                      Uninstall
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => onInstallModel(m.id)}
                      className="rounded-md bg-sky-600 px-2.5 py-1 text-[11px] font-medium text-white hover:bg-sky-500"
                    >
                      Install
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Generation Logs */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#121620] overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 px-5 py-3.5">
          <div>
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Generation &amp; Scheduler Logs
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Live execution history from background workers and hardware guards
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 p-1 rounded-lg bg-slate-100 dark:bg-[#0B0E14] border border-slate-200 dark:border-slate-800">
              {(['all', 'info', 'warn', 'error'] as const).map((lvl) => (
                <button
                  key={lvl}
                  type="button"
                  onClick={() => setLogFilter(lvl)}
                  className={`px-2.5 py-1 text-[11px] font-medium rounded capitalize ${
                    logFilter === lvl
                      ? 'bg-white dark:bg-[#1E2534] text-slate-900 dark:text-slate-100'
                      : 'text-slate-500 dark:text-slate-400'
                  }`}
                >
                  {lvl}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={onClearLogs}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-700 px-2.5 py-1.5 text-xs text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Clear
            </button>
          </div>
        </div>

        <div className="max-h-72 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/70 font-mono text-xs">
          {filteredLogs.length === 0 ? (
            <div className="p-6 text-center text-slate-500 dark:text-slate-400">
              No log entries recorded.
            </div>
          ) : (
            filteredLogs.map((log) => (
              <div
                key={log.id}
                className="flex items-start gap-3 px-5 py-2 hover:bg-slate-50 dark:hover:bg-[#171C29]"
              >
                <span className="text-slate-400 tabular-nums shrink-0">
                  {new Date(log.timestamp).toLocaleTimeString()}
                </span>
                <span
                  className={`uppercase w-11 shrink-0 font-semibold ${
                    log.level === 'error'
                      ? 'text-rose-500'
                      : log.level === 'warn'
                      ? 'text-amber-500'
                      : 'text-emerald-500'
                  }`}
                >
                  {log.level}
                </span>
                <span className="text-slate-700 dark:text-slate-300 break-words">{log.message}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
