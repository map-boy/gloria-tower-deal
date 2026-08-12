import React, { useState, useEffect } from 'react';
import { UsageEntry } from '../../1_core/domain/types';
import { formatCurrency } from '../../1_core/utils/formatters';

interface DayEntryModalProps {
  isOpen: boolean;
  onClose: () => void;
  dateStr: string;
  existingEntry?: UsageEntry;
  appliedRate: number;
  onSave: (entry: { unitsUsed: number; amountPaid: number; note: string }) => void;
  onDelete?: (entryId: string) => void;
  roomNumber: string;
}

export const DayEntryModal: React.FC<DayEntryModalProps> = ({
  isOpen,
  onClose,
  dateStr,
  existingEntry,
  appliedRate,
  onSave,
  onDelete,
  roomNumber,
}) => {
  const [unitsUsed, setUnitsUsed] = useState<string>('');
  const [amountPaid, setAmountPaid] = useState<string>('');
  const [note, setNote] = useState<string>('');

  useEffect(() => {
    if (existingEntry) {
      setUnitsUsed(existingEntry.unitsUsed.toString());
      setAmountPaid(existingEntry.amountPaid.toString());
      setNote(existingEntry.note || '');
    } else {
      setUnitsUsed('');
      setAmountPaid('');
      setNote('');
    }
  }, [existingEntry, dateStr, isOpen]);

  if (!isOpen) return null;

  const handleAutoFillAmount = () => {
    const kwh = parseFloat(unitsUsed);
    if (!isNaN(kwh)) {
      const calc = (kwh * appliedRate).toFixed(2);
      setAmountPaid(calc);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const kwh = parseFloat(unitsUsed) || 0;
    const paid = parseFloat(amountPaid) || 0;
    onSave({
      unitsUsed: kwh,
      amountPaid: paid,
      note,
    });
    onClose();
  };

  const expectedCost = (parseFloat(unitsUsed) || 0) * appliedRate;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-none">
      <div className="bg-[#feca57] border-3 border-black rounded-2xl w-full max-w-md p-6 shadow-none text-black relative">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b-2 border-black mb-4">
          <div className="flex items-center gap-2">
            <span className="bg-black text-white p-1.5 rounded font-mono font-bold text-sm">
              ⚡
            </span>
            <div>
              <h3 className="font-serif font-black text-xl text-black">
                {existingEntry ? 'Edit Entry' : 'Log Daily Usage'}
              </h3>
              <p className="font-mono text-xs text-neutral-800">
                Room {roomNumber} • Date: {dateStr}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 bg-white hover:bg-neutral-100 border-2 border-black rounded-lg font-mono font-bold text-sm cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Rate Banner */}
          <div className="bg-white border-2 border-black rounded-xl p-3 font-mono text-xs flex justify-between items-center">
            <span>Building Rate:</span>
            <span className="font-bold">${appliedRate.toFixed(2)} / kWh</span>
          </div>

          {/* Units Used (kWh) */}
          <div>
            <label className="block font-mono text-xs font-bold uppercase mb-1">
              Electricity Units Used (kWh) *
            </label>
            <input
              type="number"
              step="0.1"
              min="0"
              required
              value={unitsUsed}
              onChange={(e) => setUnitsUsed(e.target.value)}
              placeholder="e.g. 14.5"
              className="w-full bg-white text-black font-mono text-sm p-3 border-2 border-black rounded-xl focus:outline-none focus:ring-2 focus:ring-black"
            />
          </div>

          {/* Amount Paid ($) */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block font-mono text-xs font-bold uppercase">
                Amount Paid ($) *
              </label>
              <button
                type="button"
                onClick={handleAutoFillAmount}
                className="text-[10px] font-mono font-bold text-black underline hover:text-neutral-700 cursor-pointer"
              >
                Auto-calc (${expectedCost.toFixed(2)})
              </button>
            </div>
            <input
              type="number"
              step="0.01"
              min="0"
              required
              value={amountPaid}
              onChange={(e) => setAmountPaid(e.target.value)}
              placeholder="e.g. 3.63"
              className="w-full bg-white text-black font-mono text-sm p-3 border-2 border-black rounded-xl focus:outline-none focus:ring-2 focus:ring-black"
            />
          </div>

          {/* Optional Note */}
          <div>
            <label className="block font-mono text-xs font-bold uppercase mb-1">
              Optional Note
            </label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Partial payment at desk, manual reading"
              className="w-full bg-white text-black font-mono text-xs p-3 border-2 border-black rounded-xl focus:outline-none focus:ring-2 focus:ring-black"
            />
          </div>

          {/* Action buttons */}
          <div className="pt-2 flex flex-col gap-2">
            <button
              type="submit"
              className="w-full bg-black text-white hover:bg-neutral-800 font-mono font-bold text-sm py-3 rounded-xl border-2 border-black transition-transform active:scale-95 cursor-pointer"
            >
              Save Entry
            </button>

            {existingEntry && onDelete && (
              <button
                type="button"
                onClick={() => {
                  if (confirm('Delete this entry?')) {
                    onDelete(existingEntry.id);
                    onClose();
                  }
                }}
                className="w-full bg-[#ff6b6b] hover:bg-[#ff5252] text-black font-mono font-bold text-xs py-2.5 rounded-xl border-2 border-black cursor-pointer"
              >
                Delete Entry
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
};
