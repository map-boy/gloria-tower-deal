import React, { useState, useEffect } from 'react';
import { Room, RateConfig, UtilityType } from '../../1_core/domain/types';
import { getEffectiveRate } from '../../1_core/algorithms/balance';

interface RoomRateOverrideModalProps {
  isOpen: boolean;
  onClose: () => void;
  room: Room;
  rateConfigs: RateConfig[];
  onSave: (overrides: Partial<Record<UtilityType, number>>) => void;
}

const UTILITY_LABELS: Record<UtilityType, string> = {
  electricity: 'Electricity',
  water: 'Water',
  rent: 'Rent',
};

const UTILITIES: UtilityType[] = ['electricity', 'water', 'rent'];

export const RoomRateOverrideModal: React.FC<RoomRateOverrideModalProps> = ({
  isOpen,
  onClose,
  room,
  rateConfigs,
  onSave,
}) => {
  const [enabled, setEnabled] = useState<Record<UtilityType, boolean>>({
    electricity: false,
    water: false,
    rent: false,
  });
  const [values, setValues] = useState<Record<UtilityType, string>>({
    electricity: '0',
    water: '0',
    rent: '0',
  });

  useEffect(() => {
    if (!isOpen) return;
    const nextEnabled: Record<UtilityType, boolean> = { electricity: false, water: false, rent: false };
    const nextValues: Record<UtilityType, string> = { electricity: '0', water: '0', rent: '0' };
    for (const u of UTILITIES) {
      const override = room.rateOverrides?.[u];
      const effective = getEffectiveRate(room, rateConfigs, u);
      nextEnabled[u] = override !== undefined;
      nextValues[u] = (override ?? effective).toString();
    }
    setEnabled(nextEnabled);
    setValues(nextValues);
  }, [isOpen, room, rateConfigs]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const overrides: Partial<Record<UtilityType, number>> = {};
    for (const u of UTILITIES) {
      if (enabled[u]) {
        const parsed = parseFloat(values[u]);
        if (!isNaN(parsed) && parsed >= 0) {
          overrides[u] = parsed;
        }
      }
    }
    onSave(overrides);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
      <div className="bg-white border-3 border-black rounded-2xl w-full max-w-md p-6 shadow-none text-black relative">
        <div className="flex items-center justify-between pb-4 border-b-2 border-black mb-4">
          <div className="flex items-center gap-2">
            <span className="bg-black text-white p-1.5 rounded font-mono font-bold text-sm">
              &#9881;
            </span>
            <h3 className="font-serif font-black text-xl text-black">
              Room {room.roomNumber} Rate Overrides
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 bg-white hover:bg-neutral-100 border-2 border-black rounded-lg font-mono font-bold text-sm cursor-pointer"
          >
            &#10005;
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          {UTILITIES.map((u) => (
            <div key={u} className="border-2 border-black rounded-xl p-3">
              <label className="flex items-center gap-2 font-mono text-xs font-bold uppercase mb-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={enabled[u]}
                  onChange={(e) => setEnabled({ ...enabled, [u]: e.target.checked })}
                />
                Override {UTILITY_LABELS[u]}
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                disabled={!enabled[u]}
                value={values[u]}
                onChange={(e) => setValues({ ...values, [u]: e.target.value })}
                placeholder="Rate per unit"
                className="w-full bg-white text-black font-mono text-sm p-3 border-2 border-black rounded-xl focus:outline-none focus:ring-2 focus:ring-black disabled:bg-neutral-100 disabled:text-neutral-400"
              />
            </div>
          ))}
          <div className="pt-2">
            <button
              type="submit"
              className="w-full bg-black text-white hover:bg-neutral-800 font-mono font-bold text-sm py-3 rounded-xl border-2 border-black transition-transform active:scale-95 cursor-pointer"
            >
              Save Room Rate Overrides
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};