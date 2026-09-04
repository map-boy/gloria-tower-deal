import React, { useState, useEffect } from 'react';
import { Room, RateConfig, UsageEntry, UtilityType } from '../../1_core/domain/types';
import { formatCurrency } from '../../1_core/utils/formatters';
import { getEffectiveRate } from '../../1_core/algorithms/balance';

interface DayEntryModalProps {
  isOpen: boolean;
  onClose: () => void;
  dateStr: string;
  entries: UsageEntry[]; // all entries for this room on this date, one per utility at most
  room: Room;
  rateConfigs: RateConfig[];
  onSave: (entry: { utilityType: UtilityType; unitsUsed: number; note: string }) => void;
  onDelete?: (entryId: string) => void;
  roomNumber: string;
}

const UTILITY_OPTIONS: { value: UtilityType; label: string }[] = [
  { value: 'electricity', label: 'Electricity' },
  { value: 'water', label: 'Water' },
  { value: 'rent', label: 'Rental' },
];

export const DayEntryModal: React.FC<DayEntryModalProps> = ({
  isOpen,
  onClose,
  dateStr,
  entries,
  room,
  rateConfigs,
  onSave,
  onDelete,
  roomNumber,
}) => {
  const [utilityType, setUtilityType] = useState<UtilityType>('electricity');
  const [unitsUsed, setUnitsUsed] = useState<string>('');
  const [note, setNote] = useState<string>('');

  const existingEntry = entries.find((e) => (e.utilityType || 'electricity') === utilityType);

  // When the modal opens, default to the first utility that already has an
  // entry for this date (if any), otherwise electricity.
  useEffect(() => {
    if (!isOpen) return;
    const firstLogged = entries[0];
    setUtilityType((firstLogged?.utilityType as UtilityType) || 'electricity');
  }, [isOpen, dateStr]);

  // When the selected utility changes, load whatever entry already exists
  // for that utility on this date (or clear the form if none).
  useEffect(() => {
    if (existingEntry) {
      setUnitsUsed(existingEntry.unitsUsed.toString());
      setNote(existingEntry.note || '');
    } else {
      setUnitsUsed('');
      setNote('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [utilityType, dateStr, isOpen]);

  if (!isOpen) return null;

  const appliedRate = getEffectiveRate(room, rateConfigs, utilityType);
  const isMetered = utilityType === 'electricity' || utilityType === 'water';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const kwh = parseFloat(unitsUsed) || 0;
    onSave({
      utilityType,
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
                {existingEntry ? 'Edit Entry' : 'Log Entry'}
              </h3>
              <p className="font-mono text-xs text-neutral-800">
                Room {roomNumber} &bull; {new Date(dateStr).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
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
          <div>
            <label className="block font-mono text-xs font-bold uppercase mb-1">
              Utility Type *
            </label>
            <select
              value={utilityType}
              onChange={(e) => setUtilityType(e.target.value as UtilityType)}
              className="w-full bg-white text-black font-mono text-sm p-3 border-2 border-black rounded-xl focus:outline-none focus:ring-2 focus:ring-black cursor-pointer"
            >
              {UTILITY_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                  {entries.find((e) => (e.utilityType || 'electricity') === opt.value) ? ' (logged)' : ''}
                </option>
              ))}
            </select>
          </div>

          <div className="bg-white border-2 border-black rounded-xl p-3 font-mono text-xs flex justify-between items-center">
            <span>Building Rate:</span>
            <span className="font-bold">
              {formatCurrency(appliedRate)}{isMetered ? ' / kWh' : ''}
            </span>
          </div>

          <div>
            <label className="block font-mono text-xs font-bold uppercase mb-1">
              {isMetered ? `${UTILITY_OPTIONS.find((o) => o.value === utilityType)?.label} Units Used (kWh) *` : 'Rent Amount Due *'}
            </label>
            <input
              type="number"
              step="0.1"
              min="0"
              required
              value={unitsUsed}
              onChange={(e) => setUnitsUsed(e.target.value)}
              placeholder={isMetered ? 'e.g. 14.5' : 'e.g. 1'}
              className="w-full bg-white text-black font-mono text-sm p-3 border-2 border-black rounded-xl focus:outline-none focus:ring-2 focus:ring-black"
            />
          </div>

          <div className="bg-neutral-100 border-2 border-black rounded-xl p-3 font-mono text-xs flex justify-between items-center">
            <span>Expected Cost (auto):</span>
            <span className="font-bold">{formatCurrency(expectedCost)}</span>
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