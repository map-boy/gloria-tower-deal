import React, { useState } from 'react';
import { Room } from '../../1_core/domain/types';

interface SubmissionModalProps {
  isOpen: boolean;
  onClose: () => void;
  room: Room;
  onUploadScreenshot: (file: File) => Promise<string>;
  onSubmit: (input: { cashPowerReading?: string; amountReported: number; note?: string; screenshotPath?: string }) => Promise<void>;
}

export const SubmissionModal: React.FC<SubmissionModalProps> = ({
  isOpen,
  onClose,
  room,
  onUploadScreenshot,
  onSubmit,
}) => {
  const [cashPowerReading, setCashPowerReading] = useState('');
  const [amountReported, setAmountReported] = useState('');
  const [note, setNote] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseFloat(amountReported);
    if (isNaN(amount) || amount < 0) {
      setError('Enter a valid amount.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      let screenshotPath: string | undefined;
      if (file) {
        screenshotPath = await onUploadScreenshot(file);
      }
      await onSubmit({
        cashPowerReading: room.hasElectricity ? cashPowerReading.trim() || undefined : undefined,
        amountReported: amount,
        note: note.trim() || undefined,
        screenshotPath,
      });
      setCashPowerReading('');
      setAmountReported('');
      setNote('');
      setFile(null);
      onClose();
    } catch (e: any) {
      setError(e?.message || 'Failed to submit. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
      <div className="bg-white border-3 border-black rounded-2xl w-full max-w-md p-6 text-black relative max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between pb-4 border-b-2 border-black mb-4">
          <h3 className="font-serif font-black text-xl">Submit Payment</h3>
          <button
            onClick={onClose}
            className="p-1 bg-white hover:bg-neutral-100 border-2 border-black rounded-lg font-mono font-bold text-sm cursor-pointer"
          >
            &#10005;
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 font-mono text-xs">
          {room.hasElectricity && (
            <div>
              <label className="block font-bold uppercase mb-1">Cash Power Reading</label>
              <input
                type="text"
                value={cashPowerReading}
                onChange={(e) => setCashPowerReading(e.target.value)}
                placeholder="Whatever number your meter shows"
                className="w-full bg-white text-black text-sm p-3 border-2 border-black rounded-xl focus:outline-none"
              />
            </div>
          )}

          <div>
            <label className="block font-bold uppercase mb-1">Amount Paid *</label>
            <input
              type="number"
              step="1"
              min="0"
              required
              value={amountReported}
              onChange={(e) => setAmountReported(e.target.value)}
              placeholder="e.g. 15000"
              className="w-full bg-white text-black text-sm p-3 border-2 border-black rounded-xl focus:outline-none"
            />
          </div>

          <div>
            <label className="block font-bold uppercase mb-1">Payment Screenshot / Photo</label>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              className="w-full bg-white text-black text-xs p-2 border-2 border-black rounded-xl focus:outline-none"
            />
            <p className="text-[10px] text-neutral-600 mt-1">
              Screenshots are automatically deleted after 14 days. Admin keeps a record of what you paid.
            </p>
          </div>

          <div>
            <label className="block font-bold uppercase mb-1">Note (optional)</label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Anything else the admin should know"
              className="w-full bg-white text-black text-xs p-3 border-2 border-black rounded-xl focus:outline-none"
            />
          </div>

          {error && <p className="text-[11px] text-red-600">{error}</p>}

          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-black text-white hover:bg-neutral-800 disabled:opacity-50 font-bold text-sm py-3 rounded-xl border-2 border-black transition-transform active:scale-95 cursor-pointer"
          >
            {submitting ? 'Submitting...' : 'Send to Admin'}
          </button>
        </form>
      </div>
    </div>
  );
};
