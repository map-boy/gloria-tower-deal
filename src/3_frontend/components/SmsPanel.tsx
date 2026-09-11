import React, { useMemo, useState } from 'react';
import { Room } from '../../1_core/domain/types';
import {
  CustomSmsResult, SMS_BODY_LIMIT, SMS_COST_RWF, SmsDiagnostics,
  sendCustomSms, smsDiagnostics,
} from '../../2_backend/services/dataService';
import { formatCurrency } from '../../1_core/utils/formatters';
import { Banner, Button, Card, Empty, Field, inputClass } from './ui';

interface SmsPanelProps {
  smsBalance?: number | null;
  rooms: Room[];
}

export const SmsPanel: React.FC<SmsPanelProps> = ({ smsBalance, rooms }) => {
  const [phone, setPhone] = useState('');
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<SmsDiagnostics | null>(null);
  const [error, setError] = useState('');

  const balance = result?.balance ?? smsBalance ?? null;
  const messagesLeft = balance === null ? null : Math.floor(balance / SMS_COST_RWF);

  const runTest = async (e: React.FormEvent) => {
    e.preventDefault();
    setTesting(true);
    setError('');
    setResult(null);
    try {
      setResult(await smsDiagnostics(phone.trim()));
    } catch (e: any) {
      setError(e?.message || 'Could not run the test.');
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="space-y-3">
      <Card className="space-y-3">
        <div className="font-black text-sm">SMS wallet</div>
        {balance !== null ? (
          <Banner
            tone={balance <= 450 ? 'bad' : balance <= 1500 ? 'warn' : 'good'}
            title={`${formatCurrency(balance)} left`}
          >
            About {messagesLeft} message{messagesLeft === 1 ? '' : 's'} at {SMS_COST_RWF} RWF each.
            {balance <= 450 && ' Top up at smsconnect.tech or reminders stop.'}
          </Banner>
        ) : (
          <p className="text-[11px] text-bone/55">
            Balance unknown. Run a test below, or wait for the next system check.
          </p>
        )}

        <form onSubmit={runTest} className="space-y-2">
          <Field label="Test the connection"
            hint={`Sends one real message and costs ${SMS_COST_RWF} RWF. Use your own number.`}>
            <div className="flex gap-2">
              <input value={phone} onChange={(e) => setPhone(e.target.value)}
                placeholder="0788123456" className={inputClass} />
              <Button type="submit" disabled={testing}>{testing ? '...' : 'Test'}</Button>
            </div>
          </Field>
        </form>

        {error && <p className="text-[11px] text-alert-soft">{error}</p>}

        {result && (
          <div className="space-y-2">
            <Banner tone={result.ok ? 'good' : 'bad'}
              title={result.ok ? 'SMS works' : 'SMS failed'}>
              {result.summary}
            </Banner>
            <div className="text-[10px] text-bone/55">
              Sent to {result.recipient}
              {result.workingScheme && ` · headers: ${result.workingScheme}`}
            </div>
            <ul className="text-[10px] text-bone/50 space-y-0.5">
              {result.attempts.map((a, i) => (
                <li key={i} className={a.ok ? 'text-gold-soft font-bold' : ''}>
                  {a.base} [{a.scheme}] → {a.httpStatus ?? 'no response'}{' '}
                  {a.providerMessage ?? ''}
                </li>
              ))}
            </ul>
          </div>
        )}
      </Card>

      <ComposePanel rooms={rooms} />
    </div>
  );
};

// Writing a message to clients by hand -- a notice, a warning, anything the
// automatic reminders do not cover.
const ComposePanel: React.FC<{ rooms: Room[] }> = ({ rooms }) => {
  const [message, setMessage] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<CustomSmsResult | null>(null);
  const [error, setError] = useState('');

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return rooms;
    return rooms.filter(
      (r) => r.roomNumber.toLowerCase().includes(term) || r.tenantName.toLowerCase().includes(term)
    );
  }, [rooms, search]);

  const over = message.length > SMS_BODY_LIMIT;
  const cost = selected.length * SMS_COST_RWF;

  const toggle = (id: string) =>
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() || selected.length === 0) return;
    if (!window.confirm(
      `Send to ${selected.length} client${selected.length === 1 ? '' : 's'} for ${cost} RWF?`
    )) return;
    setBusy(true);
    setError('');
    setResult(null);
    try {
      setResult(await sendCustomSms(selected, message.trim()));
      setMessage('');
      setSelected([]);
    } catch (e: any) {
      setError(e?.message || 'Could not send.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="space-y-3">
      <div className="font-black text-sm">Write a message</div>

      <form onSubmit={send} className="space-y-3">
        <Field label="Message">
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={3}
            placeholder="e.g. Water will be off on Saturday from 8am to 2pm."
            className={`${inputClass} resize-none`}
          />
          <div className={`text-[10px] mt-1 ${over ? 'text-alert-soft font-bold' : 'text-bone/50'}`}>
            {message.length} / {SMS_BODY_LIMIT} characters
            {over && ' — will be cut short'}
          </div>
          <p className="text-[10px] text-bone/45 mt-0.5">
            The provider adds its own link to every message, which is why the limit is{' '}
            {SMS_BODY_LIMIT} and not 160.
          </p>
        </Field>

        <Field label={`Send to (${selected.length} picked)`}>
          <div className="flex gap-2 mb-2">
            <input value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Search room or name" className={inputClass} />
            <Button type="button" variant="ghost"
              onClick={() => setSelected(
                selected.length === filtered.length ? [] : filtered.map((r) => r.id)
              )}>
              {selected.length === filtered.length && filtered.length > 0 ? 'None' : 'All'}
            </Button>
          </div>
          <div className="max-h-48 overflow-y-auto space-y-1 border border-bone/15 rounded-xl p-2">
            {filtered.length === 0 ? (
              <Empty>No clients.</Empty>
            ) : (
              filtered.map((r) => (
                <button key={r.id} type="button" onClick={() => toggle(r.id)}
                  className={`w-full text-left px-2 py-1.5 rounded-lg text-xs cursor-pointer ${
                    selected.includes(r.id)
                      ? 'bg-emerald-mid text-bone'
                      : 'bg-emerald-dark text-bone/70 hover:text-bone'
                  }`}>
                  <span className="font-bold">Room {r.roomNumber}</span>
                  <span className="opacity-70"> · {r.tenantName} · {r.tenantPhone}</span>
                </button>
              ))
            )}
          </div>
        </Field>

        {selected.length > 0 && (
          <Banner tone="warn" title={`${formatCurrency(cost)} to send`}>
            {selected.length} message{selected.length === 1 ? '' : 's'} at {SMS_COST_RWF} RWF each.
          </Banner>
        )}

        {error && <p className="text-[11px] text-alert-soft">{error}</p>}
        {result && (
          <Banner tone={result.failed === 0 ? 'good' : 'warn'}
            title={`${result.sent} sent, ${result.failed} failed`}>
            {formatCurrency(result.costRwf)} spent.
            {result.failed > 0 &&
              ` Failed: ${result.results.filter((r) => !r.ok).map((r) => r.roomNumber ?? r.roomId).join(', ')}`}
          </Banner>
        )}

        <Button type="submit" full
          disabled={busy || !message.trim() || selected.length === 0}>
          {busy ? 'Sending...' : `Send to ${selected.length || 'nobody'}`}
        </Button>
      </form>
    </Card>
  );
};
