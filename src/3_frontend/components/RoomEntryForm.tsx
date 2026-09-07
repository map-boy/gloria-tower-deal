import React, { useState } from 'react';

export interface RoomEntryInput {
  roomNumber: string;
  tenantName?: string;
  tenantPhone: string;
  hasElectricity?: boolean;
  password: string;
}

interface RoomEntryFormProps {
  onSubmit: (
    input: RoomEntryInput
  ) => Promise<{ ok: boolean; created?: boolean; reason?: 'taken_by_other' | 'wrong_credentials' }>;
}

const MIN_PASSWORD_LENGTH = 4;

type Mode = 'return' | 'first';

// Two ways in. Coming back needs only what the tenant already knows -- room
// number, their phone, their password -- because after a logout their browser
// identity is gone and retyping the whole registration is not a login.
export const RoomEntryForm: React.FC<RoomEntryFormProps> = ({ onSubmit }) => {
  const [mode, setMode] = useState<Mode>('return');
  const [roomNumber, setRoomNumber] = useState('');
  const [tenantName, setTenantName] = useState('');
  const [tenantPhone, setTenantPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [hasElectricity, setHasElectricity] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showTakenPopup, setShowTakenPopup] = useState(false);
  const [error, setError] = useState('');

  const isFirstTime = mode === 'first';

  const switchMode = (next: Mode) => {
    setMode(next);
    setError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!roomNumber.trim() || !tenantPhone.trim()) return;
    if (isFirstTime && !tenantName.trim()) return;
    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const result = await onSubmit({
        roomNumber: roomNumber.trim(),
        tenantPhone: tenantPhone.trim(),
        password,
        ...(isFirstTime
          ? { tenantName: tenantName.trim(), hasElectricity }
          : {}),
      });
      if (!result.ok) {
        if (result.reason === 'wrong_credentials') {
          setError(
            'Phone number or password does not match this room. Try again, or ask the admin to reset your password.'
          );
        } else if (result.reason === 'taken_by_other') {
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

  const inputClass =
    'w-full bg-white text-black text-sm p-3 border-2 border-black rounded-xl focus:outline-none';

  return (
    <div className="min-h-screen bg-neutral-200 flex items-center justify-center font-mono text-black p-4">
      <div className="bg-white border-3 border-black rounded-2xl p-6 sm:p-8 max-w-sm w-full space-y-4">
        <div className="text-center space-y-1">
          <div className="font-serif font-black text-2xl">Cash Power Tracker</div>
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => switchMode('return')}
            className={`flex-1 py-2.5 rounded-xl border-2 border-black font-bold text-[11px] uppercase cursor-pointer ${
              !isFirstTime ? 'bg-black text-white' : 'bg-white text-black'
            }`}
          >
            Go back to my room
          </button>
          <button
            type="button"
            onClick={() => switchMode('first')}
            className={`flex-1 py-2.5 rounded-xl border-2 border-black font-bold text-[11px] uppercase cursor-pointer ${
              isFirstTime ? 'bg-black text-white' : 'bg-white text-black'
            }`}
          >
            First time here
          </button>
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
              className={inputClass}
            />
          </div>

          {isFirstTime && (
            <div>
              <label className="block text-xs font-bold uppercase mb-1">Your Name *</label>
              <input
                type="text"
                required
                value={tenantName}
                onChange={(e) => setTenantName(e.target.value)}
                placeholder="Full name"
                className={inputClass}
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-bold uppercase mb-1">Phone Number *</label>
            <input
              type="tel"
              required
              value={tenantPhone}
              onChange={(e) => setTenantPhone(e.target.value)}
              placeholder="e.g. 0788123456"
              className={inputClass}
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase mb-1">Room Password *</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={isFirstTime ? 'Pick one, at least 4 characters' : 'Your room password'}
                className={`${inputClass} pr-16`}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 px-2 py-1 text-[10px] font-bold uppercase border-2 border-black rounded-lg bg-white cursor-pointer"
              >
                {showPassword ? 'Hide' : 'Show'}
              </button>
            </div>
            <p className="text-[10px] text-neutral-600 mt-1">
              {isFirstTime
                ? 'Remember this password. It is how you get back into your room on any phone.'
                : 'Same phone number and password you used before. Forgot it? The admin can reset it for you.'}
            </p>
          </div>

          {isFirstTime && (
            <div className="flex items-center justify-between border-2 border-black rounded-xl p-3">
              <span className="text-xs font-bold uppercase">
                Do you have electricity (cash power)?
              </span>
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
          )}

          {error && <p className="text-[11px] text-red-600">{error}</p>}

          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-black text-white hover:bg-neutral-800 disabled:opacity-50 font-bold text-sm py-3 rounded-xl border-2 border-black transition-transform active:scale-95 cursor-pointer"
          >
            {submitting ? 'Entering...' : isFirstTime ? 'Create my room' : 'Enter my room'}
          </button>
        </form>
      </div>

      {showTakenPopup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
          <div className="bg-white border-3 border-black rounded-2xl w-full max-w-sm p-6 text-center space-y-3">
            <div className="font-serif font-black text-xl">Room Already Taken</div>
            <p className="text-xs text-neutral-700">
              This room was claimed before passwords were added, so it cannot be checked. Ask the
              admin to set a password for it, then come back and use that password.
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
