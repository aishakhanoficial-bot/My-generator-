import {
  AlertCircle,
  Ban,
  CheckCircle2,
  Clock,
  Download,
  Loader2,
  Play,
  RotateCcw,
  Search,
  Trash2,
  XCircle,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { JobStatus, SystemMetrics, VideoJob } from '../../shared/types';
import { getVideoDownloadFilename, getVideoDownloadUrl } from '../api';

interface QueueViewProps {
  jobs: VideoJob[];
  metrics: SystemMetrics;
  onCancelJob: (id: string) => Promise<void>;
  onRetryJob: (id: string) => Promise<void>;
  onDeleteJob: (id: string) => Promise<void>;
  onBulkAction: (action: 'cancel-queued' | 'retry-failed' | 'clear-completed') => Promise<void>;
  onPreviewJob: (job: VideoJob) => void;
  onNavigateStudio: () => void;
}

const PAGE_SIZE = 25;

function StatusCell({ job }: { job: VideoJob }) {
  if (job.status === 'running') {
    return (
      <div className="flex items-center gap-1.5 text-xs font-medium text-sky-600 dark:text-sky-400">
        <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0" />
        <span className="font-mono tabular-nums">Rendering {job.progress}%</span>
      </div>
    );
  }
  if (job.status === 'completed') {
    return (
      <div className="flex items-center gap-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
        <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
        <span>{job.cacheHit ? 'Completed (Cache)' : 'Completed'}</span>
      </div>
    );
  }
  if (job.status === 'queued') {
    return (
      <div className="flex items-center gap-1.5 text-xs font-medium text-slate-600 dark:text-slate-300">
        <Clock className="h-3.5 w-3.5 shrink-0" />
        <span>Queued</span>
      </div>
    );
  }
  if (job.status === 'failed') {
    return (
      <div className="flex items-center gap-1.5 text-xs font-medium text-rose-600 dark:text-rose-400">
        <AlertCircle className="h-3.5 w-3.5 shrink-0" />
        <span>Failed</span>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-1.5 text-xs font-medium text-slate-500 dark:text-slate-400">
      <Ban className="h-3.5 w-3.5 shrink-0" />
      <span>Cancelled</span>
    </div>
  );
}

export function QueueView({
  jobs,
  metrics,
  onCancelJob,
  onRetryJob,
  onDeleteJob,
  onBulkAction,
  onPreviewJob,
  onNavigateStudio,
}: QueueViewProps) {
  const [filter, setFilter] = useState<'all' | JobStatus>('all');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return jobs.filter((j) => {
      if (filter !== 'all' && j.status !== filter) return false;
      if (!q) return true;
      return (
        j.prompt.toLowerCase().includes(q) ||
        j.modelName.toLowerCase().includes(q) ||
        j.id.toLowerCase().includes(q) ||
        (j.batchId && j.batchId.toLowerCase().includes(q))
      );
    });
  }, [jobs, filter, query]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageItems = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  return (
    <div className="space-y-5">
      {/* Unboxed Queue Summary Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#121620] p-4">
        <div>
          <div className="text-xs text-slate-500 dark:text-slate-400">Queued Jobs</div>
          <div className="mt-1 text-lg font-semibold font-mono tabular-nums text-slate-900 dark:text-slate-100">
            {metrics.queuedCount}
          </div>
        </div>
        <div>
          <div className="text-xs text-slate-500 dark:text-slate-400">Active Generations</div>
          <div className="mt-1 text-lg font-semibold font-mono tabular-nums text-sky-600 dark:text-sky-400">
            {metrics.runningCount} / {metrics.maxConcurrentJobs}
          </div>
        </div>
        <div>
          <div className="text-xs text-slate-500 dark:text-slate-400">Completed Videos</div>
          <div className="mt-1 text-lg font-semibold font-mono tabular-nums text-emerald-600 dark:text-emerald-400">
            {metrics.completedCount}
          </div>
        </div>
        <div>
          <div className="text-xs text-slate-500 dark:text-slate-400">Failed / Cancelled</div>
          <div className="mt-1 text-lg font-semibold font-mono tabular-nums text-slate-900 dark:text-slate-100">
            {metrics.failedCount} / {metrics.cancelledCount}
          </div>
        </div>
        <div>
          <div className="text-xs text-slate-500 dark:text-slate-400">Cache Hits</div>
          <div className="mt-1 text-lg font-semibold font-mono tabular-nums text-slate-900 dark:text-slate-100">
            {metrics.cacheHitsCount}
          </div>
        </div>
      </div>

      {/* Filter & Bulk Action Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1 p-1 rounded-lg bg-slate-100 dark:bg-[#121620] border border-slate-200 dark:border-slate-800">
          {(
            [
              { id: 'all', label: `All (${jobs.length})` },
              { id: 'running', label: `Active (${metrics.runningCount})` },
              { id: 'queued', label: `Queued (${metrics.queuedCount})` },
              { id: 'completed', label: `Completed (${metrics.completedCount})` },
              { id: 'failed', label: `Failed (${metrics.failedCount})` },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => {
                setFilter(tab.id);
                setPage(1);
              }}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 font-mono tabular-nums ${
                filter === tab.id
                  ? 'bg-white dark:bg-[#1E2534] text-slate-900 dark:text-slate-100 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setPage(1);
              }}
              placeholder="Search prompts, models, batch ID..."
              className="w-56 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#121620] pl-8 pr-3 py-1.5 text-xs text-slate-900 dark:text-slate-100 focus:border-sky-500 focus:outline-none"
            />
          </div>
          <button
            type="button"
            onClick={() => onBulkAction('retry-failed')}
            disabled={metrics.failedCount + metrics.cancelledCount === 0}
            className="px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 whitespace-nowrap shrink-0"
          >
            Retry Failed
          </button>
          <button
            type="button"
            onClick={() => onBulkAction('cancel-queued')}
            disabled={metrics.queuedCount === 0}
            className="px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 whitespace-nowrap shrink-0"
          >
            Cancel Queued
          </button>
          <button
            type="button"
            onClick={() => onBulkAction('clear-completed')}
            disabled={metrics.completedCount + metrics.cancelledCount === 0}
            className="px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 whitespace-nowrap shrink-0"
          >
            Clear Completed
          </button>
        </div>
      </div>

      {/* High-Density Queue Table */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#121620] overflow-hidden">
        {pageItems.length === 0 ? (
          <div className="py-14 px-6 text-center space-y-3">
            <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
              {jobs.length === 0 ? 'Generation queue is empty' : 'No jobs match your filter'}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {jobs.length === 0
                ? 'Submit a single prompt or a batch of 10, 50, or 100+ prompts from Studio.'
                : 'Adjust your search query or status filter.'}
            </p>
            {jobs.length === 0 && (
              <button
                type="button"
                onClick={onNavigateStudio}
                className="inline-flex items-center gap-1.5 rounded-lg bg-sky-600 px-4 py-2 text-xs font-medium text-white hover:bg-sky-500"
              >
                Open Studio
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-[11px] font-semibold text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-[#0E121B]">
                  <th className="py-2.5 px-4">Prompt &amp; Workflow</th>
                  <th className="py-2.5 px-4">Model &amp; Provider</th>
                  <th className="py-2.5 px-4">Spec</th>
                  <th className="py-2.5 px-4">Status</th>
                  <th className="py-2.5 px-4 text-right">Duration / Size</th>
                  <th className="py-2.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 text-xs">
                {pageItems.map((job) => (
                  <tr
                    key={job.id}
                    className="hover:bg-slate-50/70 dark:hover:bg-[#171C29] transition-colors"
                  >
                    <td className="py-3 px-4 max-w-md">
                      <div className="font-medium text-slate-900 dark:text-slate-100 line-clamp-1">
                        {job.prompt}
                      </div>
                      <div className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400 font-mono tabular-nums">
                        {job.workflow}
                        {job.batchId ? ` · Batch ${job.batchIndex}/${job.batchTotal}` : ''}
                        {' · '}
                        Priority: {job.priority}
                      </div>
                      {job.error && (
                        <div className="mt-1 text-[11px] text-rose-600 dark:text-rose-400 line-clamp-2">
                          {job.error}
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <div className="font-medium text-slate-800 dark:text-slate-200">
                        {job.modelName}
                      </div>
                      <div
                        className={`text-[11px] font-mono ${
                          job.provider === 'self-hosted'
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : 'text-amber-600 dark:text-amber-400'
                        }`}
                      >
                        {job.provider === 'self-hosted'
                          ? `SELF-HOSTED FREE · ${job.quantization.toUpperCase()}`
                          : `EXTERNAL PAID ($${job.estimatedCostUsd.toFixed(2)})`}
                      </div>
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap font-mono tabular-nums text-slate-600 dark:text-slate-300">
                      {job.resolution} · {job.aspectRatio} · {job.durationSec}s · {job.fps}fps
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <StatusCell job={job} />
                      {job.status === 'running' && (
                        <div className="mt-1.5 h-1 w-28 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
                          <div
                            className="h-full bg-sky-500 transition-all duration-200"
                            style={{ width: `${job.progress}%` }}
                          />
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right whitespace-nowrap font-mono tabular-nums text-slate-600 dark:text-slate-300">
                      {job.renderDurationMs
                        ? `${(job.renderDurationMs / 1000).toFixed(2)}s`
                        : '—'}
                      {job.outputBytes
                        ? ` · ${(job.outputBytes / 1024).toFixed(0)} KB`
                        : ''}
                    </td>
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <div className="inline-flex items-center justify-end gap-1.5">
                        {job.status === 'completed' && job.outputFileName && getVideoDownloadUrl(job.id) && (
                          <>
                            <button
                              type="button"
                              onClick={() => onPreviewJob(job)}
                              className="inline-flex items-center gap-1 rounded-md border border-slate-200 dark:border-slate-700 px-2 py-1 text-[11px] font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                              title="Play preview"
                            >
                              <Play className="h-3 w-3" />
                              Play
                            </button>
                            <a
                              href={getVideoDownloadUrl(job.id)}
                              download={getVideoDownloadFilename(job)}
                              className="inline-flex items-center gap-1 rounded-md bg-sky-600 px-2 py-1 text-[11px] font-medium text-white hover:bg-sky-500"
                              title="Download video"
                            >
                              <Download className="h-3 w-3" />
                              Save
                            </a>
                          </>
                        )}
                        {(job.status === 'queued' || job.status === 'running') && (
                          <button
                            type="button"
                            onClick={() => onCancelJob(job.id)}
                            className="inline-flex items-center gap-1 rounded-md border border-slate-200 dark:border-slate-700 px-2 py-1 text-[11px] font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                          >
                            <XCircle className="h-3 w-3" />
                            Cancel
                          </button>
                        )}
                        {(job.status === 'failed' || job.status === 'cancelled') && (
                          <button
                            type="button"
                            onClick={() => onRetryJob(job.id)}
                            className="inline-flex items-center gap-1 rounded-md border border-slate-200 dark:border-slate-700 px-2 py-1 text-[11px] font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                          >
                            <RotateCcw className="h-3 w-3" />
                            Retry
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => onDeleteJob(job.id)}
                          className="rounded-md p-1 text-slate-400 hover:text-rose-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                          aria-label="Delete job"
                          title="Delete job and output file"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums">
          <span>
            Showing {(safePage - 1) * PAGE_SIZE + 1}–
            {Math.min(safePage * PAGE_SIZE, filtered.length)} of {filtered.length} jobs
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={safePage <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="rounded-md border border-slate-200 dark:border-slate-700 px-3 py-1 disabled:opacity-40 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              Previous
            </button>
            <span>
              Page {safePage} / {totalPages}
            </span>
            <button
              type="button"
              disabled={safePage >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="rounded-md border border-slate-200 dark:border-slate-700 px-3 py-1 disabled:opacity-40 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
