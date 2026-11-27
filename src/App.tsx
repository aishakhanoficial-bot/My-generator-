import {
  Box,
  Cpu,
  Film,
  ListVideo,
  Menu,
  Moon,
  ShieldCheck,
  Sliders,
  Sun,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import {
  AdminConfig,
  BatchSubmitPayload,
  LogEntry,
  SubmitJobPayload,
  SystemMetrics,
  VideoJob,
  VideoModelSpec,
} from '../shared/types';
import { api } from './api';
import { AdminView } from './components/AdminView';
import { ModelsView } from './components/ModelsView';
import { PaidApprovalModal, PolicyModal, VideoPlayerModal } from './components/Modals';
import { QueueView } from './components/QueueView';
import { StudioView } from './components/StudioView';

type NavTab = 'studio' | 'queue' | 'models' | 'admin';

export default function App() {
  const [activeTab, setActiveTab] = useState<NavTab>('studio');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(true);

  const [models, setModels] = useState<VideoModelSpec[]>([]);
  const [jobs, setJobs] = useState<VideoJob[]>([]);
  const [config, setConfig] = useState<AdminConfig | null>(null);
  const [metrics, setMetrics] = useState<SystemMetrics | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [selectedModelId, setSelectedModelId] = useState<string>('ltx-video-distilled');

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [policyOpen, setPolicyOpen] = useState(false);
  const [previewJob, setPreviewJob] = useState<VideoJob | null>(null);

  // Pending paid-provider confirmation state
  const [pendingPaidSubmission, setPendingPaidSubmission] = useState<
    | { kind: 'single'; payload: SubmitJobPayload; model: VideoModelSpec }
    | { kind: 'batch'; payload: BatchSubmitPayload; model: VideoModelSpec }
    | null
  >(null);

  useEffect(() => {
    const root = document.documentElement;
    if (darkMode) root.classList.add('dark');
    else root.classList.remove('dark');
  }, [darkMode]);

  const loadBootstrap = useCallback(async () => {
    try {
      const data = await api.bootstrap();
      setModels(data.models);
      setJobs(data.jobs);
      setConfig(data.config);
      setMetrics(data.metrics);
      setLogs(data.logs);
      setLoadError(null);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Failed to connect to OpenFrame server.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadBootstrap();

    const es = new EventSource('/api/events');
    es.addEventListener('state', (evt) => {
      try {
        const data = JSON.parse((evt as MessageEvent).data) as {
          jobs: VideoJob[];
          metrics: SystemMetrics;
          models: VideoModelSpec[];
          config: AdminConfig;
        };
        setJobs(data.jobs);
        setMetrics(data.metrics);
        setModels(data.models);
        setConfig(data.config);
      } catch {
        // Ignore parse errors
      }
    });
    es.addEventListener('log', (evt) => {
      try {
        const entry = JSON.parse((evt as MessageEvent).data) as LogEntry;
        setLogs((prev) => [entry, ...prev].slice(0, 400));
      } catch {
        // Ignore parse errors
      }
    });

    return () => {
      es.close();
    };
  }, [loadBootstrap]);

  const handleSubmitSingle = async (payload: SubmitJobPayload) => {
    const model = models.find((m) => m.id === payload.modelId);
    if (model && model.provider === 'external-paid' && !payload.paidProviderApproved) {
      setPendingPaidSubmission({ kind: 'single', payload, model });
      return;
    }
    await api.submitJob(payload);
  };

  const handleSubmitBatch = async (payload: BatchSubmitPayload) => {
    const model = models.find((m) => m.id === payload.modelId);
    if (model && model.provider === 'external-paid' && !payload.paidProviderApproved) {
      setPendingPaidSubmission({ kind: 'batch', payload, model });
      return;
    }
    await api.submitBatch(payload);
  };

  const handleApprovePaid = async () => {
    if (!pendingPaidSubmission) return;
    const item = pendingPaidSubmission;
    setPendingPaidSubmission(null);
    if (item.kind === 'single') {
      await api.submitJob({ ...item.payload, paidProviderApproved: true });
    } else {
      await api.submitBatch({ ...item.payload, paidProviderApproved: true });
    }
  };

  const handleCancelPaid = () => {
    setPendingPaidSubmission(null);
    const defaultFree = models.find((m) => m.provider === 'self-hosted' && m.installed && m.enabled);
    if (defaultFree) setSelectedModelId(defaultFree.id);
  };

  const tabTitles: Record<NavTab, string> = {
    studio: 'Generation Studio',
    queue: 'Generation Queue',
    models: 'Open-Source Models',
    admin: 'Infrastructure & Admin',
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-[#0B0E14] text-sm text-slate-600 dark:text-slate-300">
        Connecting to self-hosted video workstation...
      </div>
    );
  }

  if (loadError || !config || !metrics) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 bg-slate-50 dark:bg-[#0B0E14] p-6 text-center">
        <p className="text-sm font-semibold text-rose-500">{loadError || 'Server unavailable'}</p>
        <button
          type="button"
          onClick={() => {
            setLoading(true);
            void loadBootstrap();
          }}
          className="rounded-lg bg-sky-600 px-4 py-2 text-xs font-medium text-white hover:bg-sky-500"
        >
          Retry Connection
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex bg-slate-50 dark:bg-[#0B0E14] text-slate-900 dark:text-slate-100">
      {/* Mobile Sidebar Backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Left Workstation Sidebar (256px) */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 shrink-0 border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-[#10141D] flex flex-col justify-between transition-transform duration-150 lg:static lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="p-5 space-y-6">
          {/* Brand Wordmark (single-line, zero pills/dots) */}
          <div className="flex items-center justify-between">
            <span className="text-base font-bold tracking-tight text-slate-900 dark:text-slate-100 whitespace-nowrap shrink-0">
              OpenFrame Studio
            </span>
            <button
              type="button"
              onClick={() => setSidebarOpen(false)}
              className="lg:hidden rounded-lg p-1 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
              aria-label="Close navigation"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Primary Navigation */}
          <nav className="space-y-1" aria-label="Workspace navigation">
            {(
              [
                { id: 'studio', label: 'Studio', icon: Film },
                {
                  id: 'queue',
                  label: `Queue (${metrics.queuedCount + metrics.runningCount})`,
                  icon: ListVideo,
                },
                { id: 'models', label: 'Models', icon: Box },
                { id: 'admin', label: 'Admin', icon: Sliders },
              ] as const
            ).map((item) => {
              const Icon = item.icon;
              const active = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setActiveTab(item.id);
                    setSidebarOpen(false);
                  }}
                  className={`w-full flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                    active
                      ? 'bg-sky-600/10 text-sky-600 dark:text-sky-400'
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-slate-100'
                  }`}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className="font-mono tabular-nums">{item.label}</span>
                </button>
              );
            })}
          </nav>

          {/* Hardware & Queue Status Panel (replaces all credit UI) */}
          <div className="border-t border-slate-200 dark:border-slate-800 pt-4 space-y-3 text-xs">
            <div className="font-semibold text-slate-700 dark:text-slate-200">
              Self-Hosted Status
            </div>
            <div className="space-y-2 font-mono tabular-nums text-[11px]">
              <div className="flex items-center justify-between gap-2">
                <span className="text-slate-500 dark:text-slate-400">GPU VRAM</span>
                <span className="text-slate-900 dark:text-slate-100">
                  {metrics.gpuVramUsedGb}/{metrics.gpuVramTotalGb} GB
                </span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-slate-500 dark:text-slate-400">Active Jobs</span>
                <span className="text-slate-900 dark:text-slate-100">
                  {metrics.runningCount} / {metrics.maxConcurrentJobs}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-slate-500 dark:text-slate-400">Queued</span>
                <span className="text-slate-900 dark:text-slate-100">{metrics.queuedCount}</span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-slate-500 dark:text-slate-400">Completed</span>
                <span className="text-emerald-600 dark:text-emerald-400">
                  {metrics.completedCount}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-slate-500 dark:text-slate-400">Disk Free</span>
                <span className="text-slate-900 dark:text-slate-100">{metrics.diskFreeGb} GB</span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-slate-500 dark:text-slate-400">Scheduler</span>
                <span
                  className={
                    metrics.queuePaused
                      ? 'text-amber-600 dark:text-amber-400'
                      : 'text-emerald-600 dark:text-emerald-400'
                  }
                >
                  {metrics.queuePaused ? 'Paused' : 'Active'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Sidebar Footer: Policy & Theme Switch */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-800 space-y-2">
          <button
            type="button"
            onClick={() => setPolicyOpen(true)}
            className="w-full flex items-center gap-2 rounded-lg px-3 py-2 text-xs text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
            <span className="truncate">Zero-Credit Policy</span>
          </button>
          <button
            type="button"
            onClick={() => setDarkMode((d) => !d)}
            className="w-full flex items-center justify-between rounded-lg px-3 py-2 text-xs text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <span className="flex items-center gap-2">
              {darkMode ? <Moon className="h-3.5 w-3.5" /> : <Sun className="h-3.5 w-3.5" />}
              {darkMode ? 'Dark Studio' : 'Light Studio'}
            </span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Top Bar Contract: Breadcrumb + Hardware Telemetry + 1 Primary Action */}
        <header className="h-14 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-[#10141D] px-4 sm:px-6 flex items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden rounded-lg p-1.5 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
              aria-label="Open menu"
            >
              <Menu className="h-4 w-4" />
            </button>
            <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 truncate">
              <span className="hidden sm:inline">Workspace</span>
              <span className="hidden sm:inline" aria-hidden="true">
                /
              </span>
              <span className="font-semibold text-sm text-slate-900 dark:text-slate-100 truncate">
                {tabTitles[activeTab]}
              </span>
            </div>
          </div>

          {/* Unboxed Hardware Telemetry Strip */}
          <div className="hidden md:flex items-center gap-2.5 text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums whitespace-nowrap">
            <Cpu className="h-3.5 w-3.5 text-slate-400" />
            <span>
              {metrics.backendMode === 'local-ffmpeg' ? 'Local Engine' : 'Remote GPU Node'}
            </span>
            <span aria-hidden="true">·</span>
            <span>
              VRAM {metrics.gpuVramUsedGb}/{metrics.gpuVramTotalGb} GB
            </span>
            <span aria-hidden="true">·</span>
            <span>
              Queue {metrics.queuedCount} pending / {metrics.runningCount} active
            </span>
            <span aria-hidden="true">·</span>
            <span>{metrics.diskFreeGb} GB free</span>
          </div>

          <div className="shrink-0">
            {activeTab !== 'studio' ? (
              <button
                type="button"
                onClick={() => setActiveTab('studio')}
                className="rounded-lg bg-sky-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-sky-500 whitespace-nowrap shrink-0"
              >
                New Generation
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setActiveTab('queue')}
                className="rounded-lg border border-slate-200 dark:border-slate-700 px-3.5 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 whitespace-nowrap shrink-0"
              >
                View Queue ({metrics.queuedCount + metrics.runningCount})
              </button>
            )}
          </div>
        </header>

        {/* Active Route Viewport */}
        <main className="flex-1 p-4 sm:p-6 max-w-[1440px] w-full mx-auto">
          {activeTab === 'studio' && (
            <StudioView
              models={models}
              jobs={jobs}
              config={config}
              metrics={metrics}
              selectedModelId={selectedModelId}
              onSelectModelId={setSelectedModelId}
              onSubmitSingle={handleSubmitSingle}
              onSubmitBatch={handleSubmitBatch}
              onNavigateQueue={() => setActiveTab('queue')}
              onOpenPolicy={() => setPolicyOpen(true)}
            />
          )}

          {activeTab === 'queue' && (
            <QueueView
              jobs={jobs}
              metrics={metrics}
              onCancelJob={async (id) => {
                await api.cancelJob(id);
              }}
              onRetryJob={async (id) => {
                await api.retryJob(id);
              }}
              onDeleteJob={async (id) => {
                await api.deleteJob(id);
              }}
              onBulkAction={async (action) => {
                await api.bulkAction(action);
              }}
              onPreviewJob={(job) => setPreviewJob(job)}
              onNavigateStudio={() => setActiveTab('studio')}
            />
          )}

          {activeTab === 'models' && (
            <ModelsView
              models={models}
              config={config}
              selectedModelId={selectedModelId}
              onSelectForStudio={(id) => {
                setSelectedModelId(id);
                setActiveTab('studio');
              }}
              onInstallModel={async (id) => {
                await api.installModel(id);
              }}
              onUninstallModel={async (id) => {
                await api.uninstallModel(id);
              }}
              onToggleEnabled={async (id, enabled) => {
                await api.toggleModelEnabled(id, enabled);
              }}
            />
          )}

          {activeTab === 'admin' && (
            <AdminView
              config={config}
              metrics={metrics}
              models={models}
              logs={logs}
              onSaveConfig={async (patch) => {
                await api.updateConfig(patch);
              }}
              onTestGpuServer={() => api.testGpuServer()}
              onInstallModel={async (id) => {
                await api.installModel(id);
              }}
              onUninstallModel={async (id) => {
                await api.uninstallModel(id);
              }}
              onClearCache={async () => {
                await api.clearCache();
              }}
              onClearLogs={async () => {
                await api.clearLogs();
                setLogs([]);
              }}
            />
          )}
        </main>
      </div>

      {/* Modals */}
      {pendingPaidSubmission && (
        <PaidApprovalModal
          open={Boolean(pendingPaidSubmission)}
          model={pendingPaidSubmission.model}
          jobCount={
            pendingPaidSubmission.kind === 'batch'
              ? pendingPaidSubmission.payload.prompts.length
              : 1
          }
          durationSec={pendingPaidSubmission.payload.durationSec}
          resolution={pendingPaidSubmission.payload.resolution}
          onCancel={handleCancelPaid}
          onApprove={() => {
            void handleApprovePaid();
          }}
        />
      )}

      <PolicyModal open={policyOpen} onClose={() => setPolicyOpen(false)} />
      <VideoPlayerModal job={previewJob} onClose={() => setPreviewJob(null)} />
    </div>
  );
}
