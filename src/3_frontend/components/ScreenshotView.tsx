import React, { useEffect, useState } from 'react';
import { Submission } from '../../1_core/domain/types';
import { daysUntil } from '../../1_core/utils/formatters';

interface ScreenshotViewProps {
  submission: Submission;
  getScreenshotUrl: (path: string) => Promise<string>;
}

// Payment proof is a photo or screenshot the tenant sends -- no payment API
// involved. The image is deleted 14 days after upload; the record of what was
// paid stays in the submission forever.
export const ScreenshotView: React.FC<ScreenshotViewProps> = ({ submission, getScreenshotUrl }) => {
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setUrl(null);
    setFailed(false);
    if (!submission.screenshotPath || submission.screenshotDeleted) return;
    getScreenshotUrl(submission.screenshotPath)
      .then((u) => { if (!cancelled) setUrl(u); })
      .catch(() => { if (!cancelled) setFailed(true); });
    return () => { cancelled = true; };
  }, [submission.screenshotPath, submission.screenshotDeleted, getScreenshotUrl]);

  if (submission.screenshotDeleted) {
    return (
      <p className="font-mono text-[10px] text-neutral-500 border-2 border-dashed border-neutral-400 rounded-lg p-2">
        Photo deleted after 14 days &mdash; payment record kept in the archive.
      </p>
    );
  }

  if (!submission.screenshotPath) {
    return (
      <p className="font-mono text-[10px] text-neutral-500">No photo attached.</p>
    );
  }

  if (failed) {
    return <p className="font-mono text-[10px] text-red-600">Photo could not be loaded.</p>;
  }

  const remaining = daysUntil(submission.screenshotExpiresAt);

  return (
    <div className="space-y-1">
      {url ? (
        <a href={url} target="_blank" rel="noreferrer">
          <img
            src={url}
            alt="Payment proof"
            className="max-h-56 w-auto border-2 border-black rounded-lg object-contain bg-neutral-100"
          />
        </a>
      ) : (
        <div className="h-24 border-2 border-black rounded-lg bg-neutral-100 flex items-center justify-center font-mono text-[10px]">
          Loading photo...
        </div>
      )}
      {remaining !== null && (
        <p className="font-mono text-[10px] text-neutral-500">
          Photo auto-deletes in {remaining} day{remaining === 1 ? '' : 's'}.
        </p>
      )}
    </div>
  );
};
