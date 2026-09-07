import React, { useState } from 'react';
import {
  Room,
  SERVICE_LABELS,
  ServiceType,
  roomServices,
  serviceHasMeter,
} from '../../1_core/domain/types';

interface SubmissionModalProps {
  isOpen: boolean;
  onClose: () => void;
  room: Room;
  onUploadScreenshot: (file: File) => Promise<string>;
  onSubmit: (input: {
    serviceType: ServiceType;
    meterReading?: string;
    amountReported: number;
    note?: string;
    screenshotPath?: string;
  }) => Promise<void>;
}

export const SubmissionModal: React.FC<SubmissionModalProps> = ({
  isOpen,
  onClose,
  room,
  onUploadScreenshot,
  onSubmit,
}) => {
  const services = roomServices(room);
  const [serviceType, setServiceType] = useState<ServiceType>(services[0] ?? 'electricity');
  const [meterReading, setMeterReading] = useState('');
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
        serviceType,
        meterReading: serviceHasMeter(serviceType) ? meterReading.trim() || undefined : undefined,
        amountReported: amount,
        note: note.trim() || undefined,
        screenshotPath,
      });
      setMeterReading('');
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

  const inputClass =
    'w-full bg-white text-black text-sm p-3 border-2 border-black rounded-xl focus:outline-none';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
      <div className="bg-white border-3 border-black rounded-2xl w-full max-w-md p-6 text-black relative max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between pb-4 border-b-2 border-black mb-4">
          <h3 className="font-serif font-black text-xl">Send a payment</h3>
          <button
            onClick={onClose}
            className="p-1 bg-white hover:bg-neutral-100 border-2 border-black rounded-lg font-mono font-bold text-sm cursor-pointer"
          >
            &#10005;
          </button>
        </div>

        {services.length === 0 ? (
          <p className="font-mono text-xs text-neutral-700">
            This room has no services turned on yet. Ask the admin to set what you pay for.
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 font-mono text-xs">
            <div>
              <label className="block font-bold uppercase mb-1">What are you paying for?</label>
              <div className="grid grid-cols-3 gap-2">
                {services.map((s) => (
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

            {serviceHasMeter(serviceType) && (
              <div>
                <label className="block font-bold uppercase mb-1">
                  {SERVICE_LABELS[serviceType]} meter reading
                </label>
                <input
                  type="text"
                  value={meterReading}
                  onChange={(e) => setMeterReading(e.target.value)}
                  placeholder="Whatever number your meter shows"
                  className={inputClass}
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
                className={inputClass}
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
                Photos are deleted after 14 days. What you paid stays on record.
              </p>
            </div>

            <div>
              <label className="block font-bold uppercase mb-1">Note (optional)</label>
              <input
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Anything else the admin should know"
                className={inputClass}
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
        )}
      </div>
    </div>
  );
};
