import React, { useState } from 'react';
import { RateConfig } from '../../1_core/domain/types';

interface RateConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentRates: RateConfig[];
  onSaveRate: (config: { scope: 'building' | 'floor'; floorNumber?: number; ratePerUnit: number }) => void;
}

export const RateConfigModal: React.FC<RateConfigModalProps> = ({
  isOpen,
  onClose,
  currentRates,
  onSaveRate,
}) => {
  const buildingRate = currentRates.find((r) => r.scope === 'building')?.ratePerUnit || 0.25;
  const [scope, setScope] = useState<'building' | 'floor'>('building');
  const [selectedFloor, setSelectedFloor] = useState<number>(1);
  const [rateInput, setRateInput] = useState<string>(buildingRate.toString());

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const rate = parseFloat(rateInput);
    if (isNaN(rate) || rate < 0) return;

    onSaveRate({
      scope,
      floorNumber: scope === 'floor' ? selectedFloor : undefined,
      ratePerUnit: rate,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
      <div className="bg-[#a8e6cf] border-3 border-black rounded-2xl w-full max-w-md p-6 shadow-none text-black relative">
        <div className="flex items-center justify-between pb-4 border-b-2 border-black mb-4">
          <div className="flex items-center gap-2">
            <span className="bg-black text-white p-1.5 rounded font-mono font-bold text-sm">
              ⚙
            </span>
            <h3 className="font-serif font-black text-xl text-black">
              Configure Electricity Rate
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 bg-white hover:bg-neutral-100 border-2 border-black rounded-lg font-mono font-bold text-sm cursor-pointer"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Scope Selector */}
          <div>
            <label className="block font-mono text-xs font-bold uppercase mb-1">
              Configuration Scope
            </label>
            <div className="grid grid-cols-2 gap-2 font-mono text-xs">
              <button
                type="button"
                onClick={() => setScope('building')}
                className={`p-2.5 rounded-xl border-2 font-bold cursor-pointer ${
                  scope === 'building'
                    ? 'bg-black text-white border-black'
                    : 'bg-white text-black border-black'
                }`}
              >
                Building Wide
              </button>
              <button
                type="button"
                onClick={() => setScope('floor')}
                className={`p-2.5 rounded-xl border-2 font-bold cursor-pointer ${
                  scope === 'floor'
                    ? 'bg-black text-white border-black'
                    : 'bg-white text-black border-black'
                }`}
              >
                Specific Floor
              </button>
            </div>
          </div>

          {/* Floor selection if floor scope */}
          {scope === 'floor' && (
            <div>
              <label className="block font-mono text-xs font-bold uppercase mb-1">
                Select Floor (1-8)
              </label>
              <select
                value={selectedFloor}
                onChange={(e) => setSelectedFloor(Number(e.target.value))}
                className="w-full bg-white text-black font-mono text-sm p-3 border-2 border-black rounded-xl focus:outline-none"
              >
                {[1, 2, 3, 4, 5, 6, 7, 8].map((f) => (
                  <option key={f} value={f}>
                    Floor {f}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Rate input */}
          <div>
            <label className="block font-mono text-xs font-bold uppercase mb-1">
              Rate per kWh ($/unit)
            </label>
            <input
              type="number"
              step="0.01"
              min="0.01"
              required
              value={rateInput}
              onChange={(e) => setRateInput(e.target.value)}
              placeholder="0.25"
              className="w-full bg-white text-black font-mono text-sm p-3 border-2 border-black rounded-xl focus:outline-none focus:ring-2 focus:ring-black"
            />
          </div>

          <div className="pt-2">
            <button
              type="submit"
              className="w-full bg-black text-white hover:bg-neutral-800 font-mono font-bold text-sm py-3 rounded-xl border-2 border-black transition-transform active:scale-95 cursor-pointer"
            >
              Update Rate Configuration
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
