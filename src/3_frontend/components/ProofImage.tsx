import React, { useEffect, useState } from 'react';
import { Bill } from '../../1_core/domain/types';
import { proofUrl } from '../../2_backend/services/dataService';

export const ProofImage: React.FC<{ bill: Bill }> = ({ bill }) => {
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setUrl(null);
    setFailed(false);
    if (!bill.proofPath || bill.proofDeleted) return;
    proofUrl(bill.proofPath)
      .then((u) => !cancelled && setUrl(u))
      .catch(() => !cancelled && setFailed(true));
    return () => { cancelled = true; };
  }, [bill.proofPath, bill.proofDeleted]);

  if (bill.proofDeleted) {
    return (
      <p className="text-[10px] text-bone/45 border border-dashed border-bone/20 rounded-xl p-2">
        Photo deleted after 7 days.
      </p>
    );
  }
  if (!bill.proofPath) {
    return <p className="text-[10px] text-bone/45">No photo attached.</p>;
  }
  if (failed) return <p className="text-[10px] text-alert-soft">Photo could not load.</p>;
  if (!url) {
    return (
      <div className="h-24 rounded-xl bg-emerald-dark flex items-center justify-center text-[10px] text-bone/50">
        Loading photo...
      </div>
    );
  }
  return (
    <a href={url} target="_blank" rel="noreferrer">
      <img
        src={url}
        alt="Payment proof"
        className="max-h-56 w-auto rounded-xl border border-bone/20 object-contain bg-emerald-dark"
      />
    </a>
  );
};
