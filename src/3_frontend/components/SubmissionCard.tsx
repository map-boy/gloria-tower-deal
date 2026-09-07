import React from 'react';
import {
  SERVICE_LABELS,
  Submission,
  submissionReading,
  submissionService,
} from '../../1_core/domain/types';
import {
  formatCurrency,
  formatDateTime,
  getStatusBadgeStyle,
  getStatusLabel,
} from '../../1_core/utils/formatters';
import { ScreenshotView } from './ScreenshotView';

interface SubmissionCardProps {
  submission: Submission;
  getScreenshotUrl: (path: string) => Promise<string>;
  showRoom?: boolean;
  onReview?: (submission: Submission) => void;
}

export const SubmissionCard: React.FC<SubmissionCardProps> = ({
  submission,
  getScreenshotUrl,
  showRoom = false,
  onReview,
}) => {
  const badge = getStatusBadgeStyle(submission.status);
  const service = submissionService(submission);
  const reading = submissionReading(submission);
  const shortfall =
    submission.status === 'partial' && submission.amountConfirmed !== undefined
      ? submission.amountReported - submission.amountConfirmed
      : 0;

  return (
    <div className="bg-white border-2 border-black rounded-xl p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          {showRoom && (
            <div className="font-serif font-black text-base">
              Room {submission.roomNumber}
              <span className="font-mono font-normal text-xs text-neutral-600"> &middot; {submission.tenantName}</span>
            </div>
          )}
          <div className="font-mono text-[10px] uppercase tracking-wider text-neutral-500">
            {SERVICE_LABELS[service]} &middot; {formatDateTime(submission.createdAt)}
          </div>
        </div>
        <span
          className={`shrink-0 px-2 py-1 rounded-lg border-2 font-mono font-bold text-[10px] uppercase ${badge.bg} ${badge.text} ${badge.border}`}
        >
          {getStatusLabel(submission.status)}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2 font-mono text-xs">
        <div className="border-2 border-black rounded-lg p-2">
          <div className="text-[10px] uppercase text-neutral-500">Reported paid</div>
          <div className="font-bold text-sm">{formatCurrency(submission.amountReported)}</div>
        </div>
        <div className="border-2 border-black rounded-lg p-2">
          <div className="text-[10px] uppercase text-neutral-500">Confirmed by admin</div>
          <div className="font-bold text-sm">
            {submission.amountConfirmed !== undefined
              ? formatCurrency(submission.amountConfirmed)
              : '--'}
          </div>
        </div>
      </div>

      {reading && (
        <div className="font-mono text-xs">
          <span className="text-[10px] uppercase text-neutral-500">
            {SERVICE_LABELS[service]} reading:{' '}
          </span>
          <span className="font-bold break-all">{reading}</span>
        </div>
      )}

      {shortfall > 0 && (
        <p className="font-mono text-[11px] text-red-600">
          Short by {formatCurrency(shortfall)}.
        </p>
      )}

      {submission.note && (
        <p className="font-mono text-[11px] text-neutral-700">Tenant note: {submission.note}</p>
      )}
      {submission.adminNote && (
        <p className="font-mono text-[11px] text-neutral-700">Admin note: {submission.adminNote}</p>
      )}

      <ScreenshotView submission={submission} getScreenshotUrl={getScreenshotUrl} />

      {submission.reviewedAt && (
        <p className="font-mono text-[10px] text-neutral-500">
          Reviewed {formatDateTime(submission.reviewedAt)}
          {submission.reviewedBy ? ` by ${submission.reviewedBy}` : ''}
        </p>
      )}

      {onReview && (
        <button
          onClick={() => onReview(submission)}
          className="w-full bg-black text-white hover:bg-neutral-800 font-mono font-bold text-xs py-2.5 rounded-xl border-2 border-black cursor-pointer"
        >
          {submission.status === 'pending' ? 'Review & mark paid' : 'Edit this record'}
        </button>
      )}
    </div>
  );
};
