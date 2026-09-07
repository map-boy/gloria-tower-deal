import React, { useEffect, useState } from 'react';
import {
  SERVICE_LABELS,
  SERVICE_TYPES,
  ServiceType,
  Submission,
  SubmissionStatus,
  submissionReading,
  submissionService,
} from '../../1_core/domain/types';
import { formatCurrency } from '../../1_core/utils/formatters';
import { ScreenshotView } from './ScreenshotView';

interface ReviewSubmissionModalProps {
  submission: Submission | null;
  onClose: () => void;
  getScreenshotUrl: (path: string) => Promise<string>;
  onSave: (
    submissionId: string,
    updates: {
      status: SubmissionStatus;
      amountConfirmed: number;
      amountReported: number;
      serviceType: ServiceType;
      meterReading?: string;
      adminNote?: string;
    }
  ) => Promise<void>;
  onDelete: (submissionId: string) => Promise<void>;
}

// The admin sits with the tenant's photo in front of them and says: this one
// paid, or this one paid only part of it. Every field stays editable.
export const ReviewSubmissionModal: React.FC<ReviewSubmissionModalProps> = ({
  submission,
  onClose,
  getScreenshotUrl,
  onSave,
  onDelete,
}) => {
  const [status, setStatus] = useState<SubmissionStatus>('paid');
  const [amountConfirmed, setAmountConfirmed] = useState('');
  const [amountReported, setAmountReported] = useState('');
  const [meterReading, setMeterReading] = useState('');
  const [serviceType, setServiceType] = useState<ServiceType>('electricity');
  const [adminNote, setAdminNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!submission) return;
    setStatus(submission.status === 'pending' ? 'paid' : submission.status);
    setAmountConfirmed(
      String(submission.amountConfirmed ?? submission.amountReported ?? 0)
    );
    setAmountReported(String(submission.amountReported ?? 0));
    setMeterReading(submissionReading(submission) ?? '');
    setServiceType(submissionService(submission));
    setAdminNote(submission.adminNote ?? '');
    setError('');
  }, [submission]);

  if (!submission) return null;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const confirmed = parseFloat(amountConfirmed);
    const reported = parseFloat(amountReported);
    if (isNaN(confirmed) || confirmed < 0 || isNaN(reported) || reported < 0) {
      setError('Enter valid amounts.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await onSave(submission.id, {
        status,
        amountConfirmed: confirmed,
        amountReported: reported,
        serviceType,
        meterReading: meterReading.trim(),
        adminNote: adminNote.trim(),
      });
      onClose();
    } catch (e: any) {
      setError(e?.message || 'Could not save. Try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('Delete this record for good?')) return;
    setSaving(true);
    try {
      await onDelete(submission.id);
      onClose();
    } catch (e: any) {
      setError(e?.message || 'Could not delete.');
    } finally {
      setSaving(false);
    }
  };

  const inputClass =
    'w-full bg-white text-black text-sm p-3 border-2 border-black rounded-xl focus:outline-none';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
      <div className="bg-white border-3 border-black rounded-2xl w-full max-w-md p-6 text-black max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between pb-4 border-b-2 border-black mb-4">
          <div>
            <h3 className="font-serif font-black text-xl">
              Room {submission.roomNumber}
            </h3>
            <p className="font-mono text-[11px] text-neutral-600">{submission.tenantName}</p>
          </div>
          <button
            onClick={onClose}
            className="p-1 bg-white hover:bg-neutral-100 border-2 border-black rounded-lg font-mono font-bold text-sm cursor-pointer"
          >
            &#10005;
          </button>
        </div>

        <div className="mb-4">
          <ScreenshotView submission={submission} getScreenshotUrl={getScreenshotUrl} />
        </div>

        {submission.note && (
          <p className="font-mono text-[11px] text-neutral-700 mb-4">
            Tenant note: {submission.note}
          </p>
        )}

        <form onSubmit={handleSave} className="space-y-4 font-mono text-xs">
          <div>
            <label className="block font-bold uppercase mb-1">Status</label>
            <div className="grid grid-cols-3 gap-2">
              {(['paid', 'partial', 'pending'] as SubmissionStatus[]).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setStatus(s)}
                  className={`py-2 rounded-lg border-2 border-black font-bold text-[11px] uppercase cursor-pointer ${
                    status === s ? 'bg-black text-white' : 'bg-white text-black'
                  }`}
                >
                  {s === 'pending' ? 'Not yet' : s}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block font-bold uppercase mb-1">
              Amount actually received {status === 'partial' && '(what they really paid)'}
            </label>
            <input
              type="number"
              min="0"
              step="1"
              value={amountConfirmed}
              onChange={(e) => setAmountConfirmed(e.target.value)}
              className={inputClass}
            />
            <p className="text-[10px] text-neutral-600 mt-1">
              Tenant reported {formatCurrency(submission.amountReported)}.
            </p>
          </div>

          <div>
            <label className="block font-bold uppercase mb-1">Amount the tenant reported</label>
            <input
              type="number"
              min="0"
              step="1"
              value={amountReported}
              onChange={(e) => setAmountReported(e.target.value)}
              className={inputClass}
            />
          </div>

          <div>
            <label className="block font-bold uppercase mb-1">What this payment is for</label>
            <div className="grid grid-cols-3 gap-2">
              {SERVICE_TYPES.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setServiceType(s)}
                  className={`py-2 rounded-lg border-2 border-black font-bold text-[11px] uppercase cursor-pointer ${
                    serviceType === s ? 'bg-black text-white' : 'bg-white text-black'
                  }`}
                >
                  {SERVICE_LABELS[s]}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block font-bold uppercase mb-1">Meter reading</label>
            <input
              type="text"
              value={meterReading}
              onChange={(e) => setMeterReading(e.target.value)}
              placeholder="Correct it if the tenant mistyped"
              className={inputClass}
            />
          </div>

          <div>
            <label className="block font-bold uppercase mb-1">Admin note</label>
            <input
              type="text"
              value={adminNote}
              onChange={(e) => setAdminNote(e.target.value)}
              placeholder="e.g. still owes 5000"
              className={inputClass}
            />
          </div>

          {error && <p className="text-[11px] text-red-600">{error}</p>}

          <button
            type="submit"
            disabled={saving}
            className="w-full bg-black text-white hover:bg-neutral-800 disabled:opacity-50 font-bold text-sm py-3 rounded-xl border-2 border-black transition-transform active:scale-95 cursor-pointer"
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={saving}
            className="w-full bg-white text-red-600 hover:bg-neutral-100 disabled:opacity-50 font-bold text-xs py-2.5 rounded-xl border-2 border-black cursor-pointer"
          >
            Delete this record
          </button>
        </form>
      </div>
    </div>
  );
};
