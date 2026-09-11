import React, { useState } from 'react';
import { ROLE_LABELS, StaffRole } from '../../1_core/domain/types';
import { claimRoom } from '../../2_backend/services/dataService';
import { signInWithGoogle } from '../../2_backend/services/authService';
import { Banner, Button, Card, Field, inputClass } from './ui';

interface LoginScreenProps {
  onClientIn: (session: { roomId: string; roomNumber: string }) => void;
  signedInEmail?: string;
  notStaff?: boolean;
  onSignOut: () => void;
}

type View = 'choose' | 'client' | 'staff';

const STAFF_DOORS: Array<{ role: StaffRole; blurb: string }> = [
  { role: 'technician', blurb: 'Register clients and record meter readings' },
  { role: 'recovery', blurb: 'Set prices, check payments, chase what is late' },
  { role: 'admin', blurb: 'Run the whole system and assign who does what' },
];

export const LoginScreen: React.FC<LoginScreenProps> = ({
  onClientIn, signedInEmail, notStaff, onSignOut,
}) => {
  const [view, setView] = useState<View>('choose');
  // Which door they knocked on. Their real portal still comes from the role an
  // admin gave them -- this only lets us say so plainly if the two differ.
  const [intent, setIntent] = useState<StaffRole | null>(null);
  const [busy, setBusy] = useState(false);

  const signIn = async (role: StaffRole) => {
    setIntent(role);
    setBusy(true);
    try {
      await signInWithGoogle();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-emerald-dark text-bone flex items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-4">
        <div className="text-center">
          <div className="text-3xl font-black tracking-tight">MIC Tower</div>
          <p className="text-[11px] text-bone/55 mt-1">Electricity, water and rent</p>
        </div>

        {view === 'choose' && (
          <div className="space-y-3">
            <Card>
              <button onClick={() => setView('client')}
                className="w-full text-left cursor-pointer">
                <div className="font-black text-base">I am a client</div>
                <p className="text-[11px] text-bone/65 mt-0.5">
                  See what you owe, pay, and ask a question
                </p>
              </button>
            </Card>
            <Card>
              <button onClick={() => setView('staff')}
                className="w-full text-left cursor-pointer">
                <div className="font-black text-base">I work here</div>
                <p className="text-[11px] text-bone/65 mt-0.5">
                  Technician, recovery agent or admin
                </p>
              </button>
            </Card>
          </div>
        )}

        {view === 'client' && (
          <ClientLogin onClientIn={onClientIn} onBack={() => setView('choose')} />
        )}

        {view === 'staff' && (
          <div className="space-y-3">
            {notStaff && signedInEmail ? (
              <Card className="space-y-3">
                <Banner tone="bad" title="No access yet">
                  {signedInEmail} is signed in but has no job assigned
                  {intent ? `, so the ${ROLE_LABELS[intent].toLowerCase()} portal will not open` : ''}.
                  Ask an admin to add you.
                </Banner>
                <Button full variant="ghost" onClick={onSignOut}>Sign out</Button>
              </Card>
            ) : (
              <>
                <p className="text-[11px] text-bone/60 text-center">
                  Pick your job. Each one opens its own portal.
                </p>
                {STAFF_DOORS.map(({ role, blurb }) => (
                  <Card key={role}>
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="font-black text-sm">{ROLE_LABELS[role]}</div>
                        <p className="text-[11px] text-bone/60">{blurb}</p>
                      </div>
                      <Button disabled={busy} onClick={() => signIn(role)}>
                        {busy && intent === role ? '...' : 'Sign in'}
                      </Button>
                    </div>
                  </Card>
                ))}
                <p className="text-[10px] text-bone/45 text-center">
                  All three sign in with Google. You land in the portal your admin assigned,
                  whichever door you knock on.
                </p>
              </>
            )}
            <Button full variant="ghost" onClick={() => setView('choose')}>Back</Button>
          </div>
        )}
      </div>
    </div>
  );
};

const ClientLogin: React.FC<{
  onClientIn: (s: { roomId: string; roomNumber: string }) => void;
  onBack: () => void;
}> = ({ onClientIn, onBack }) => {
  const [roomNumber, setRoomNumber] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const enter = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 4) {
      setError('Password must be at least 4 characters.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const res = await claimRoom({
        roomNumber: roomNumber.trim(),
        tenantPhone: phone.trim(),
        password,
      });
      if (res.ok && res.roomId) {
        onClientIn({ roomId: res.roomId, roomNumber: roomNumber.trim() });
        return;
      }
      setError(
        res.reason === 'not_registered'
          ? 'This room is not in the system yet. A technician has to register you first.'
          : 'Phone number or password does not match this room.'
      );
    } catch (e: any) {
      setError(e?.message || 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <form onSubmit={enter} className="space-y-3">
        <Field label="Room number *">
          <input required value={roomNumber} onChange={(e) => setRoomNumber(e.target.value)}
            placeholder="e.g. 12B" className={inputClass} />
        </Field>
        <Field label="Phone number *">
          <input required type="tel" value={phone} onChange={(e) => setPhone(e.target.value)}
            placeholder="0788123456" className={inputClass} />
        </Field>
        <Field label="Password *"
          hint="First time? Pick one now and remember it — it is how you get back in on any phone.">
          <div className="relative">
            <input required type={show ? 'text' : 'password'} value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 4 characters" className={`${inputClass} pr-16`} />
            <button type="button" onClick={() => setShow((v) => !v)}
              className="absolute right-2 top-1/2 -translate-y-1/2 px-2 py-1 text-[10px] font-bold uppercase rounded-lg border border-bone/25 cursor-pointer">
              {show ? 'Hide' : 'Show'}
            </button>
          </div>
        </Field>
        {error && <p className="text-[11px] text-alert-soft">{error}</p>}
        <Button type="submit" full disabled={busy}>
          {busy ? 'Checking...' : 'Enter my portal'}
        </Button>
        <Button type="button" full variant="ghost" onClick={onBack}>Back</Button>
      </form>
    </Card>
  );
};
