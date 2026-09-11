import React, { useState } from 'react';
import { SmsDiagnostics, smsDiagnostics } from '../../2_backend/services/dataService';
import { formatCurrency } from '../../1_core/utils/formatters';
import { Banner, Button, Card, Field, inputClass } from './ui';

// The provider's dashboard and its docs page disagree about the path and the
// auth headers, so this sends one real message and reports which combination
// actually worked.
export const SmsPanel: React.FC<{ smsBalance?: number | null }> = ({ smsBalance }) => {
  const [phone, setPhone] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<SmsDiagnostics | null>(null);
  const [error, setError] = useState('');

  const run = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    setResult(null);
    try {
      setResult(await smsDiagnostics(phone.trim()));
    } catch (e: any) {
      setError(e?.message || 'Could not run the test.');
    } finally {
      setBusy(false);
    }
  };

  const balance = result?.balance ?? smsBalance ?? null;
  const messagesLeft = balance === null ? null : Math.floor(balance / 10);

  return (
    <Card className="space-y-3">
      <div className="font-black text-sm">SMS</div>

      {balance !== null && (
        <Banner
          tone={balance <= 500 ? 'bad' : balance <= 2000 ? 'warn' : 'good'}
          title={`Wallet: ${formatCurrency(balance)}`}
        >
          About {messagesLeft} message{messagesLeft === 1 ? '' : 's'} left at 10 RWF each.
          {balance <= 500 && ' Top up at smsconnect.tech or reminders stop.'}
        </Banner>
      )}

      <form onSubmit={run} className="space-y-2">
        <Field label="Send a test message" hint="Costs 10 RWF. Use your own number.">
          <div className="flex gap-2">
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="0788123456"
              className={inputClass}
            />
            <Button type="submit" disabled={busy}>{busy ? '...' : 'Test'}</Button>
          </div>
        </Field>
      </form>

      {error && <p className="text-[11px] text-alert-soft">{error}</p>}

      {result && (
        <div className="space-y-2">
          <Banner tone={result.ok ? 'good' : 'bad'} title={result.ok ? 'SMS works' : 'SMS failed'}>
            {result.summary}
          </Banner>
          <div className="text-[10px] text-bone/55 space-y-0.5">
            <div>Sent to: {result.recipient}</div>
            <div>Auth: X-API-Key{result.usingSecret ? ' + bearer/secret' : ' only'}</div>
            {result.workingBase && <div>Endpoint: {result.workingBase}</div>}
          </div>
          <ul className="text-[10px] text-bone/55 space-y-0.5">
            {result.attempts.map((a, i) => (
              <li key={i} className={a.ok ? 'text-emerald-mid' : ''}>
                {a.base} → {a.httpStatus ?? 'no response'} {a.providerMessage ?? ''}
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
};
