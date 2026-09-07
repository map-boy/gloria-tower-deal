import React, { useState } from 'react';

interface RoomEntryFormProps {
  onSubmit: (input: { roomNumber: string; tenantName: string; tenantPhone: string; hasElectricity: boolean }) => Promise<{ ok: boolean; reason?: 'taken_by_other' }>;
}

export const RoomEntryForm: React.FC<RoomEntryFormProps> = ({ onSubmit }) => {
  const [roomNumber, setRoomNumber] = useState('');
  const [tenantName, setTenantName] = useState('');
  const [tenantPhone, setTenantPhone] = useState('');
  const [hasElectricity, setHasElectricity] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showTakenPopup, setShowTakenPopup] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!roomNumber.trim() || !tenantName.trim()) return;
    setSubmitting(true);
    setError('');
    try {
      const result = await onSubmit({
        roomNumber: roomNumber.trim(),
        tenantName: tenantName.trim(),
        tenantPhone: tenantPhone.trim(),
        hasElectricity,
      });
      if (!result.ok) {
        if (result.reason === 'taken_by_other') {
          setShowTakenPopup(true);
        } else {
          setError('Could not enter room. Please try again.');
        }
      }
    } catch (e: any) {
      setError(e?.message || 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-neutral-200 flex items-center justify-center font-mono text-black p-4">
      <div className="bg-white border-3 border-black rounded-2xl p-6 sm:p-8 max-w-sm w-full space-y-4">
        <div className="text-center space-y-1">
          <div className="font-serif font-black text-2xl">Cash Power Tracker</div>
          <p className="text-xs text-neutral-600">Enter your room number and name to continue</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold uppercase mb-1">Room Number *</label>
            <input
              type="text"
              required
              value={roomNumber}
              onChange={(e) => setRoomNumber(e.target.value)}
              placeholder="e.g. 12B"
              className="w-full bg-white text-black text-sm p-3 border-2 border-black rounded-xl focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase mb-1">Your Name *</label>
            <input
              type="text"
              required
              value={tenantName}
              onChange={(e) => setTenantName(e.target.value)}
              placeholder="Full name"
              className="w-full bg-white text-black text-sm p-3 border-2 border-black rounded-xl focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase mb-1">Phone (optional)</label>
            <input
              type="text"
              value={tenantPhone}
              onChange={(e) => setTenantPhone(e.target.value)}
              placeholder="e.g. 07XXXXXXXX"
              className="w-full bg-white text-black text-sm p-3 border-2 border-black rounded-xl focus:outline-none"
            />
          </div>

          <div className="flex items-center justify-between border-2 border-black rounded-xl p-3">
            <span className="text-xs font-bold uppercase">Do you have electricity (cash power)?</span>
            <button
              type="button"
              onClick={() => setHasElectricity((v) => !v)}
              className={`px-3 py-1.5 rounded-lg border-2 border-black font-bold text-xs cursor-pointer ${
                hasElectricity ? 'bg-black text-white' : 'bg-white text-black'
              }`}
            >
              {hasElectricity ? 'Yes' : 'No'}
            </button>
          </div>

          {error && <p className="text-[11px] text-red-600">{error}</p>}

          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-black text-white hover:bg-neutral-800 disabled:opacity-50 font-bold text-sm py-3 rounded-xl border-2 border-black transition-transform active:scale-95 cursor-pointer"
          >
            {submitting ? 'Entering...' : 'Continue'}
          </button>
        </form>
      </div>

      {showTakenPopup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
          <div className="bg-white border-3 border-black rounded-2xl w-full max-w-sm p-6 text-center space-y-3">
            <div className="font-serif font-black text-xl">Room Already Taken</div>
            <p className="text-xs text-neutral-700">
              This room number is already registered to another tenant. Please talk to the admin to sort this out.
            </p>
            <button
              onClick={() => setShowTakenPopup(false)}
              className="w-full bg-black text-white hover:bg-neutral-800 font-bold text-sm py-2.5 rounded-xl border-2 border-black cursor-pointer"
            >
              OK
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
