import { CheckCircle2, Download, ExternalLink, HardDrive, ShieldAlert, Trash2 } from 'lucide-react';
import { AdminConfig, VideoModelSpec } from '../../shared/types';

interface ModelsViewProps {
  models: VideoModelSpec[];
  config: AdminConfig;
  selectedModelId: string;
  onSelectForStudio: (id: string) => void;
  onInstallModel: (id: string) => Promise<void>;
  onUninstallModel: (id: string) => Promise<void>;
  onToggleEnabled: (id: string, enabled: boolean) => Promise<void>;
}

export function ModelsView({
  models,
  config,
  selectedModelId,
  onSelectForStudio,
  onInstallModel,
  onUninstallModel,
  onToggleEnabled,
}: ModelsViewProps) {
  const selfHostedModels = models.filter((m) => m.provider === 'self-hosted');
  const externalModels = models.filter((m) => m.provider === 'external-paid');

  return (
    <div className="space-y-8">
      {/* Open-Source Self-Hosted Engine Section */}
      <section className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-3">
          <div>
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
              Self-Hosted Open-Source Video Models
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Zero per-video fees or credits · Verified open weights, licenses, VRAM footprints, and
              commercial permissions
            </p>
          </div>
          <span className="text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400">
            Configured Node VRAM: {config.gpuVramGb} GB
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {selfHostedModels.map((model) => {
            const minVram = Math.min(...Object.values(model.vramByQuantizationGb));
            const fitsConfiguredGpu = minVram <= config.gpuVramGb;
            const isSelected = selectedModelId === model.id;

            return (
              <div
                key={model.id}
                className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#121620] p-5 flex flex-col justify-between gap-4"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                        {model.providerLabel}
                      </div>
                      <h3 className="mt-0.5 text-sm font-semibold text-slate-900 dark:text-slate-100">
                        {model.name}
                      </h3>
                      <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-500 dark:text-slate-400">
                        <span>{model.family}</span>
                        <span aria-hidden="true">·</span>
                        <span>License: {model.license}</span>
                        <span aria-hidden="true">·</span>
                        <span>Speed: {model.speedRating}</span>
                      </div>
                    </div>

                    <label className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300 cursor-pointer shrink-0">
                      <input
                        type="checkbox"
                        checked={model.enabled}
                        onChange={(e) => onToggleEnabled(model.id, e.target.checked)}
                        className="h-3.5 w-3.5 accent-sky-600"
                      />
                      Active
                    </label>
                  </div>

                  <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                    {model.description}
                  </p>

                  {/* License & Commercial Compliance Note */}
                  <div className="text-xs text-slate-500 dark:text-slate-400 border-t border-slate-100 dark:border-slate-800 pt-2.5">
                    <span className="font-medium text-slate-700 dark:text-slate-200">
                      Commercial Use:{' '}
                    </span>
                    {model.commercialNotes}
                  </div>

                  {/* Quantization / VRAM Matrix */}
                  <div className="grid grid-cols-4 gap-2 pt-1 text-center font-mono tabular-nums">
                    {model.supportedQuantizations.map((q) => {
                      const vram = model.vramByQuantizationGb[q];
                      const fits = vram <= config.gpuVramGb;
                      return (
                        <div
                          key={q}
                          className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0B0E14] px-2 py-1.5"
                        >
                          <div className="text-[10px] text-slate-500 dark:text-slate-400">
                            {q.toUpperCase()}
                          </div>
                          <div
                            className={`text-xs font-semibold ${
                              fits
                                ? 'text-slate-900 dark:text-slate-100'
                                : 'text-amber-600 dark:text-amber-400'
                            }`}
                          >
                            {vram} GB
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums">
                    <span>Workflows: {model.supportedWorkflows.join(', ')}</span>
                    <span>Weight Disk: {model.diskSizeGb} GB</span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 dark:border-slate-800 pt-3">
                  <div className="flex items-center gap-2">
                    {model.installing ? (
                      <span className="text-xs font-mono tabular-nums text-sky-600 dark:text-sky-400">
                        Installing weights {model.installProgress ?? 0}%...
                      </span>
                    ) : model.installed ? (
                      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Installed on Local Disk
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                        <HardDrive className="h-3.5 w-3.5" />
                        Not Downloaded
                      </span>
                    )}
                    {model.repoUrl && (
                      <a
                        href={model.repoUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-sky-500"
                        title="View model card"
                      >
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    {!model.installed && !model.installing && (
                      <button
                        type="button"
                        onClick={() => onInstallModel(model.id)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 whitespace-nowrap shrink-0"
                      >
                        <Download className="h-3.5 w-3.5" />
                        Install ({model.diskSizeGb} GB)
                      </button>
                    )}
                    {model.installed && (
                      <>
                        <button
                          type="button"
                          onClick={() => onUninstallModel(model.id)}
                          className="rounded-lg border border-slate-200 dark:border-slate-700 p-1.5 text-slate-400 hover:text-rose-500"
                          title="Remove weights from local disk"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onSelectForStudio(model.id)}
                          disabled={!model.enabled || !fitsConfiguredGpu}
                          className={`rounded-lg px-3.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                            isSelected
                              ? 'bg-emerald-600 text-white'
                              : 'bg-sky-600 text-white hover:bg-sky-500 disabled:opacity-40'
                          }`}
                        >
                          {isSelected ? 'Selected in Studio' : 'Use in Studio'}
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Optional External Paid Cloud Connectors */}
      <section className="space-y-4">
        <div className="border-b border-slate-200 dark:border-slate-800 pb-3">
          <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
            Optional External Paid Connectors
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Never mandatory · Never billed silently · Requires explicit cost approval per submission
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {externalModels.map((model) => (
            <div
              key={model.id}
              className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#121620] p-5 space-y-3"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-600 dark:text-amber-400">
                    <ShieldAlert className="h-3.5 w-3.5" />
                    {model.providerLabel}
                  </div>
                  <h3 className="mt-0.5 text-sm font-semibold text-slate-900 dark:text-slate-100">
                    {model.name}
                  </h3>
                  <div className="mt-1 text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums">
                    {model.family} · Est. ~${(model.estimatedExternalCostUsdPerSec ?? 0.05).toFixed(2)} / sec
                  </div>
                </div>
                <label className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300 cursor-pointer shrink-0">
                  <input
                    type="checkbox"
                    checked={model.enabled}
                    onChange={(e) => onToggleEnabled(model.id, e.target.checked)}
                    className="h-3.5 w-3.5 accent-amber-600"
                  />
                  Allow Connector
                </label>
              </div>
              <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                {model.description}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">{model.commercialNotes}</p>
              <div className="pt-2 flex justify-end border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  disabled={!model.enabled || !config.allowExternalPaidModels}
                  onClick={() => onSelectForStudio(model.id)}
                  className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3.5 py-1.5 text-xs font-medium text-amber-700 dark:text-amber-300 hover:bg-amber-500/20 disabled:opacity-40 whitespace-nowrap shrink-0"
                >
                  Select (Requires Approval)
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
