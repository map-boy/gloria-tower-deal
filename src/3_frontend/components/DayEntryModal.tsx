import React, { useState, useEffect } from 'react';
import { UsageEntry } from '../../1_core/domain/types';
import { formatCurrency } from '../../1_core/utils/formatters';

interface DayEntryModalProps {
  isOpen: boolean;
  onClose: () => void;
  dateStr: string;
  existingEntry?: UsageEntry;
  appliedRate: number;
  onSave: (entry: { unitsUsed: number; note: string }) => void;
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
  const [note, setNote] = useState<string>('');

  useEffect(() => {
    if (existingEntry) {
      setUnitsUsed(existingEntry.unitsUsed.toString());
      setNote(existingEntry.note || '');
    } else {
      setUnitsUsed('');
      setNote('');
    }
  }, [existingEntry, dateStr, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const kwh = parseFloat(unitsUsed) || 0;
    onSave({
      unitsUsed: kwh,
      note,
    });
    onClose();
  };

  const expectedCost = (parseFloat(unitsUsed) || 0) * appliedRate;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-none">
      <div className="bg-white border-3 border-black rounded-2xl w-full max-w-md p-6 shadow-none text-black relative">
        <div className="flex items-center justify-between pb-4 border-b-2 border-black mb-4">
          <div className="flex items-center gap-2">
            <span className="bg-black text-white p-1.5 rounded font-mono font-bold text-sm">
              &#9889;
            </span>
            <div>
              <h3 className="font-serif font-black text-xl text-black">
                {existingEntry ? 'Edit Meter Reading' : 'Log Meter Reading'}
              </h3>
              <p className="font-mono text-xs text-neutral-800">
                Room {roomNumber} &bull; Date: {dateStr}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 bg-white hover:bg-neutral-100 border-2 border-black rounded-lg font-mono font-bold text-sm cursor-pointer"
          >
            &#10005;
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="bg-white border-2 border-black rounded-xl p-3 font-mono text-xs flex justify-between items-center">
            <span>Building Rate:</span>
            <span className="font-bold">${appliedRate.toFixed(2)} / kWh</span>
          </div>

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

          <div className="bg-neutral-100 border-2 border-black rounded-xl p-3 font-mono text-xs flex justify-between items-center">
            <span>Expected Cost (auto):</span>
            <span className="font-bold">${expectedCost.toFixed(2)}</span>
          </div>

          <p className="text-[10px] font-mono text-neutral-600 leading-snug">
            Payment amount is recorded automatically once the tenant pays via Irembo/BK and cannot
            be entered manually here.
          </p>

          <div>
            <label className="block font-mono text-xs font-bold uppercase mb-1">
              Optional Note
            </label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Meter photographed, tenant not present"
              className="w-full bg-white text-black font-mono text-xs p-3 border-2 border-black rounded-xl focus:outline-none focus:ring-2 focus:ring-black"
            />
          </div>

          <div className="pt-2 flex flex-col gap-2">
            <button
              type="submit"
              className="w-full bg-black text-white hover:bg-neutral-800 font-mono font-bold text-sm py-3 rounded-xl border-2 border-black transition-transform active:scale-95 cursor-pointer"
            >
              Save Reading
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
                className="w-full bg-white hover:bg-neutral-100 text-black font-mono font-bold text-xs py-2.5 rounded-xl border-2 border-black cursor-pointer"
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
