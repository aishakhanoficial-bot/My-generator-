import { AlertTriangle, Download, ShieldCheck, X } from 'lucide-react';
import { useState } from 'react';
import { VideoJob, VideoModelSpec } from '../../shared/types';
import { getVideoDownloadFilename, getVideoDownloadUrl, getVideoStreamUrl } from '../api';

interface PaidApprovalModalProps {
  open: boolean;
  model: VideoModelSpec;
  jobCount: number;
  durationSec: number;
  resolution: string;
  onCancel: () => void;
  onApprove: () => void;
}

export function PaidApprovalModal({
  open,
  model,
  jobCount,
  durationSec,
  resolution,
  onCancel,
  onApprove,
}: PaidApprovalModalProps) {
  const [acknowledged, setAcknowledged] = useState(false);
  if (!open) return null;

  const perVideoCost = Number(((model.estimatedExternalCostUsdPerSec ?? 0.05) * durationSec).toFixed(2));
  const totalCost = Number((perVideoCost * jobCount).toFixed(2));

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby="paid-approval-title"
    >
      <div className="w-full max-w-lg rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#121620] p-6 shadow-xl">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div>
              <h2
                id="paid-approval-title"
                className="text-base font-semibold text-slate-900 dark:text-slate-100"
              >
                External Paid Model Confirmation
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                EXTERNAL PAID MODEL · Explicit authorization required
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100"
            aria-label="Close modal"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-5 space-y-4 text-sm text-slate-600 dark:text-slate-300">
          <p>
            You selected <strong className="text-slate-900 dark:text-slate-100">{model.name}</strong>,
            an optional external cloud connector. Requests are never routed to paid providers without
            your explicit approval.
          </p>

          <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0B0E14] p-4 space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-slate-500 dark:text-slate-400">Provider Classification</span>
              <span className="font-medium text-amber-600 dark:text-amber-400">EXTERNAL PAID MODEL</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500 dark:text-slate-400">Batch Size &amp; Spec</span>
              <span className="font-mono tabular-nums text-slate-900 dark:text-slate-100">
                {jobCount} video(s) · {durationSec}s · {resolution}
              </span>
            </div>
            <div className="flex justify-between border-t border-slate-200 dark:border-slate-800 pt-2">
              <span className="text-slate-500 dark:text-slate-400">Estimated External Provider Cost</span>
              <span className="font-mono font-semibold tabular-nums text-slate-900 dark:text-slate-100">
                ~${totalCost.toFixed(2)} USD (${perVideoCost.toFixed(2)} / clip)
              </span>
            </div>
          </div>

          <p className="text-xs text-slate-500 dark:text-slate-400">
            External cloud generation requires a billing-enabled API key in Settings &gt; Secrets and
            is subject to provider usage fees and rate quotas. Switch back to a{' '}
            <span className="text-emerald-600 dark:text-emerald-400 font-medium">
              SELF-HOSTED FREE ENGINE
            </span>{' '}
            model at any time for $0 per-video API generation.
          </p>

          <label className="flex items-start gap-2.5 cursor-pointer select-none pt-1">
            <input
              type="checkbox"
              checked={acknowledged}
              onChange={(e) => setAcknowledged(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-slate-300 dark:border-slate-700 accent-sky-600"
            />
            <span className="text-xs text-slate-700 dark:text-slate-300">
              I approve sending {jobCount} job(s) to the external paid provider and acknowledge the
              estimated ~${totalCost.toFixed(2)} USD provider charge.
            </span>
          </label>
        </div>

        <div className="mt-6 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 whitespace-nowrap shrink-0"
          >
            Use Free Engine Instead
          </button>
          <button
            type="button"
            disabled={!acknowledged}
            onClick={() => {
              setAcknowledged(false);
              onApprove();
            }}
            className="px-4 py-2 text-xs font-medium rounded-lg bg-amber-600 text-white hover:bg-amber-500 disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap shrink-0"
          >
            Approve &amp; Submit Paid Job
          </button>
        </div>
      </div>
    </div>
  );
}

export function PolicyModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby="policy-modal-title"
    >
      <div className="w-full max-w-xl rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#121620] p-6 shadow-xl">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <h2 id="policy-modal-title" className="text-base font-semibold text-slate-900 dark:text-slate-100">
                Zero-Credit &amp; Honest Infrastructure Policy
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Transparent distinction between self-hosted execution and optional cloud APIs
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
            aria-label="Close policy dialog"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-5 space-y-4 text-sm text-slate-600 dark:text-slate-300">
          <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0B0E14] p-4 space-y-1.5">
            <div className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
              A. Self-Hosted Free Engine (Default)
            </div>
            <p className="text-xs leading-relaxed">
              Zero generation credits, zero coins, zero subscriptions, and no artificial 3-video or
              5-video daily locks. You may submit 10, 50, 100, or more jobs in a batch. Real
              throughput depends strictly on your configured GPU VRAM, worker count, CPU/encoding
              speed, and disk storage capacity—never artificial software paywalls. Electricity, GPU
              hardware, and hosting remain your infrastructure costs.
            </p>
          </div>

          <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0B0E14] p-4 space-y-1.5">
            <div className="text-xs font-semibold text-amber-600 dark:text-amber-400">
              B. External Paid Model Connectors (Optional)
            </div>
            <p className="text-xs leading-relaxed">
              Commercial cloud models such as Google Veo (Omni Flash) are strictly optional
              connectors. They are never required for the core workflow, never invoked silently, and
              require explicit per-submission approval plus cost acknowledgment. External providers
              enforce their own billing and usage quotas and do not offer unlimited free generation.
            </p>
          </div>
        </div>

        <div className="mt-6 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium rounded-lg bg-slate-900 dark:bg-sky-600 text-white hover:bg-slate-800 dark:hover:bg-sky-500"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

export function VideoPlayerModal({
  job,
  onClose,
}: {
  job: VideoJob | null;
  onClose: () => void;
}) {
  if (!job) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby="video-preview-title"
    >
      <div className="w-full max-w-4xl rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#121620] overflow-hidden shadow-2xl">
        <div className="flex items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 px-5 py-3.5">
          <div className="min-w-0">
            <h2
              id="video-preview-title"
              className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100"
            >
              {job.prompt}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums mt-0.5">
              {job.modelName} · {job.providerLabel} · {job.resolution} · {job.aspectRatio} ·{' '}
              {job.fps} fps · Seed {job.seed}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <a
              href={getVideoDownloadUrl(job.id)}
              download={getVideoDownloadFilename(job)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-sky-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-sky-500 whitespace-nowrap shrink-0"
            >
              <Download className="h-3.5 w-3.5" />
              Download
            </a>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
              aria-label="Close video preview"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="bg-black flex items-center justify-center max-h-[70vh]">
          <video
            key={job.id}
            src={getVideoStreamUrl(job.id)}
            controls
            autoPlay
            loop
            playsInline
            className="max-h-[70vh] w-full object-contain"
          />
        </div>
      </div>
    </div>
  );
}
