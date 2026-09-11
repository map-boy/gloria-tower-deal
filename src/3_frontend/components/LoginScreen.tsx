import React, { useState } from 'react';
import { claimRoom } from '../../2_backend/services/dataService';
import { signInWithGoogle } from '../../2_backend/services/authService';
import { Banner, Button, Card, Field, inputClass } from './ui';

interface LoginScreenProps {
  onClientIn: (session: { roomId: string; roomNumber: string }) => void;
  signedInEmail?: string;
  notStaff?: boolean;
  onSignOut: () => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({
  onClientIn, signedInEmail, notStaff, onSignOut,
}) => {
  const [mode, setMode] = useState<'client' | 'staff'>('client');
  const [roomNumber, setRoomNumber] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [firstTime, setFirstTime] = useState(false);

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
        if (res.firstTime) setFirstTime(true);
        onClientIn({ roomId: res.roomId, roomNumber: roomNumber.trim() });
        return;
      }
      if (res.reason === 'not_registered') {
        setError(
          'This room is not in the system yet. The technician has to register you first.'
        );
      } else {
        setError('Phone number or password does not match this room.');
      }
    } catch (e: any) {
      setError(e?.message || 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-emerald-dark text-bone flex items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-4">
        <div className="text-center">
          <div className="text-2xl font-black tracking-tight">Gloria Tower</div>
          <p className="text-[11px] text-bone/55">Electricity, water and rent</p>
        </div>

        <div className="flex gap-2">
          <Button full variant={mode === 'client' ? 'primary' : 'ghost'}
            onClick={() => { setMode('client'); setError(''); }}>
            I am a client
          </Button>
          <Button full variant={mode === 'staff' ? 'primary' : 'ghost'}
            onClick={() => { setMode('staff'); setError(''); }}>
            I work here
          </Button>
        </div>

        {mode === 'client' ? (
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
              {firstTime && <Banner tone="good" title="Password set">Welcome in.</Banner>}
              <Button type="submit" full disabled={busy}>
                {busy ? 'Checking...' : 'Enter my portal'}
              </Button>
            </form>
          </Card>
        ) : (
          <Card className="space-y-3">
            <p className="text-xs text-bone/70">
              Technicians, recovery agents and admins sign in with Google. Your portal opens
              automatically based on your job.
            </p>
            {notStaff && signedInEmail && (
              <Banner tone="bad" title="No access">
                {signedInEmail} is not set up as staff. Ask an admin to add you.
              </Banner>
            )}
            {notStaff && signedInEmail ? (
              <Button full variant="ghost" onClick={onSignOut}>Sign out</Button>
            ) : (
              <Button full onClick={() => signInWithGoogle()}>Sign in with Google</Button>
            )}
          </Card>
        )}
      </div>
    </div>
  );
};
