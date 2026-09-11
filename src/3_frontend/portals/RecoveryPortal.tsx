import React, { useEffect, useMemo, useState } from 'react';
import {
  AppNotification, Bill, BillStatus, HealthReport, Message, Rates, Room, SERVICE_LABELS,
} from '../../1_core/domain/types';
import { isOverdue } from '../../1_core/billing/calculate';
import { formatCurrency, formatDateTime } from '../../1_core/utils/formatters';
import {
  downloadProof, markNotificationRead, markThreadRead, postMessage, reviewBill,
  runHealthCheckNow, setRates, watchAllBills, watchAllMessages, watchAllRooms,
  watchHealth, watchNotifications,
} from '../../2_backend/services/dataService';
import { BillCard } from '../components/BillCard';
import { MessageThread } from '../components/MessageThread';
import { ProofImage } from '../components/ProofImage';
import {
  Banner, Button, Card, Empty, Field, Modal, PortalShell, Stat, Tabs, inputClass,
} from '../components/ui';

// The recovery agent runs the money: sets prices, checks proof, marks paid,
// chases whoever is past the 5 day limit, and keeps the records before the
// photos expire.
export const RecoveryPortal: React.FC<{
  email: string;
  rates: Rates;
  onLogout: () => void;
}> = ({ email, rates, onLogout }) => {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [bills, setBills] = useState<Bill[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [health, setHealth] = useState<HealthReport | null>(null);
  const [tab, setTab] = useState('review');
  const [reviewing, setReviewing] = useState<Bill | null>(null);
  const [threadRoom, setThreadRoom] = useState<Room | null>(null);

  useEffect(() => watchAllRooms(setRooms), []);
  useEffect(() => watchAllBills(setBills), []);
  useEffect(() => watchAllMessages(setMessages), []);
  useEffect(() => watchNotifications(setNotifications), []);
  useEffect(() => watchHealth(setHealth), []);

  const awaiting = bills.filter((b) => b.status === 'awaiting_review');
  const overdue = bills.filter((b) => isOverdue(b.dueDate, b.status));
  const undownloaded = bills.filter(
    (b) => b.proofPath && !b.proofDeleted && !b.proofDownloadedAt
  );
  const openQuestions = messages.filter((m) => m.authorRole === 'client' && !m.readByStaff);

  const collected = useMemo(
    () => bills.reduce((sum, b) => sum + (b.amountPaid || 0), 0),
    [bills]
  );
  const outstanding = useMemo(
    () =>
      bills
        .filter((b) => b.status !== 'paid')
        .reduce((sum, b) => sum + Math.max(0, b.amountDue - b.amountPaid), 0),
    [bills]
  );

  const unreadAlerts = notifications.filter((n) => !n.read);

  return (
    <PortalShell
      title="Recovery"
      subtitle={email}
      onLogout={onLogout}
      right={
        unreadAlerts.length > 0 ? (
          <span className="px-2 py-1 rounded-lg bg-alert text-bone text-[10px] font-black">
            {unreadAlerts.length}
          </span>
        ) : undefined
      }
    >
      {health && !health.ok && (
        <div className="mb-4">
          <Banner tone="bad" title="System problem detected">
            {health.notes.join(' ')}
          </Banner>
        </div>
      )}
      {overdue.length > 0 && (
        <div className="mb-4">
          <Banner tone="bad" title={`${overdue.length} client past the 5 day limit`}>
            Open the Overdue tab to see who.
          </Banner>
        </div>
      )}
      {undownloaded.length > 0 && (
        <div className="mb-4">
          <Banner tone="warn" title={`${undownloaded.length} payment photo not downloaded`}>
            Photos are deleted 7 days after upload. Download what you need to keep.
          </Banner>
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
        <Stat value={formatCurrency(collected)} label="Collected" tone="good" />
        <Stat value={formatCurrency(outstanding)} label="Outstanding" tone={outstanding ? 'warn' : 'plain'} />
        <Stat value={awaiting.length} label="To check" tone={awaiting.length ? 'warn' : 'plain'} />
        <Stat value={overdue.length} label="Overdue" tone={overdue.length ? 'bad' : 'plain'} />
      </div>

      <Tabs
        tabs={[
          { id: 'review', label: 'To check', badge: awaiting.length || undefined },
          { id: 'overdue', label: 'Overdue', badge: overdue.length || undefined },
          { id: 'all', label: 'All bills' },
          { id: 'questions', label: 'Questions', badge: openQuestions.length || undefined },
          { id: 'prices', label: 'Prices' },
          { id: 'alerts', label: 'Alerts', badge: unreadAlerts.length || undefined },
        ]}
        active={tab}
        onChange={setTab}
      />

      {tab === 'review' && (
        <div className="space-y-3">
          {awaiting.length === 0 ? (
            <Empty>Nothing waiting. Proof sent by clients lands here.</Empty>
          ) : (
            awaiting.map((b) => (
              <BillCard key={b.id} bill={b} showRoom onReview={setReviewing}
                onDownloadProof={downloadProof}>
                <ProofImage bill={b} />
              </BillCard>
            ))
          )}
        </div>
      )}

      {tab === 'overdue' && (
        <div className="space-y-3">
          {overdue.length === 0 ? (
            <Empty>Nobody is past the 5 day limit. </Empty>
          ) : (
            overdue.map((b) => (
              <BillCard key={b.id} bill={b} showRoom onReview={setReviewing}
                onDownloadProof={downloadProof} />
            ))
          )}
        </div>
      )}

      {tab === 'all' && (
        <div className="space-y-3">
          {bills.length === 0 ? (
            <Empty>No bills yet. The technician raises them by recording readings.</Empty>
          ) : (
            bills.map((b) => (
              <BillCard key={b.id} bill={b} showRoom onReview={setReviewing}
                onDownloadProof={downloadProof} />
            ))
          )}
        </div>
      )}

      {tab === 'questions' && (
        <div className="space-y-3">
          {rooms.filter((r) => messages.some((m) => m.roomId === r.id)).length === 0 ? (
            <Empty>No questions yet.</Empty>
          ) : (
            rooms
              .filter((r) => messages.some((m) => m.roomId === r.id))
              .map((room) => {
                const roomMsgs = messages.filter((m) => m.roomId === room.id);
                const unread = roomMsgs.filter((m) => m.authorRole === 'client' && !m.readByStaff);
                const latest = roomMsgs[0];
                return (
                  <Card key={room.id}>
                    <button onClick={() => setThreadRoom(room)}
                      className="w-full text-left cursor-pointer">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="font-black text-sm">
                            Room {room.roomNumber}
                            {unread.length > 0 && (
                              <span className="ml-2 px-1.5 py-0.5 rounded-full bg-alert text-[9px]">
                                {unread.length} new
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-bone/65 truncate">{latest?.text}</div>
                          <div className="text-[10px] text-bone/45">
                            {formatDateTime(latest?.createdAt)}
                          </div>
                        </div>
                        <Button variant="ghost">Open</Button>
                      </div>
                    </button>
                  </Card>
                );
              })
          )}
        </div>
      )}

      {tab === 'prices' && <PricesPanel rates={rates} />}

      {tab === 'alerts' && (
        <div className="space-y-3">
          <Card className="space-y-2">
            <div className="font-black text-sm">System watchdog</div>
            {health ? (
              <>
                <Banner tone={health.ok ? 'good' : 'bad'}
                  title={health.ok ? 'Everything looks healthy' : 'Problem found'}>
                  Last checked {formatDateTime(health.checkedAt)}
                </Banner>
                {health.notes?.length > 0 && (
                  <ul className="text-[11px] text-bone/70 list-disc pl-4 space-y-0.5">
                    {health.notes.map((n, i) => <li key={i}>{n}</li>)}
                  </ul>
                )}
                <div className="text-[10px] text-bone/50">
                  Billing {health.billingEnabled ? 'active' : 'DISABLED'} · storage{' '}
                  {(health.storageRatio * 100).toFixed(0)}% of free tier
                </div>
              </>
            ) : (
              <Empty>No check has run yet.</Empty>
            )}
            <Button variant="ghost" onClick={() => runHealthCheckNow().catch(() => undefined)}>
              Run a check now
            </Button>
          </Card>

          {notifications.length === 0 ? (
            <Empty>No alerts.</Empty>
          ) : (
            notifications.map((n) => (
              <Card key={n.id} className={n.read ? 'opacity-60' : ''}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className={`font-bold text-sm ${
                      n.severity === 'critical' ? 'text-alert-soft'
                      : n.severity === 'warning' ? 'text-gold-soft' : ''
                    }`}>
                      {n.title}
                    </div>
                    <div className="text-[11px] text-bone/65">{n.body}</div>
                    <div className="text-[10px] text-bone/40">{formatDateTime(n.createdAt)}</div>
                  </div>
                  {!n.read && (
                    <Button variant="ghost"
                      onClick={() => markNotificationRead(n.id).catch(() => undefined)}>
                      Mark read
                    </Button>
                  )}
                </div>
              </Card>
            ))
          )}
        </div>
      )}

      <ReviewModal bill={reviewing} onClose={() => setReviewing(null)} />

      <Modal open={!!threadRoom} title={`Room ${threadRoom?.roomNumber ?? ''}`}
        onClose={() => setThreadRoom(null)}>
        {threadRoom && (
          <MessageThread
            messages={messages.filter((m) => m.roomId === threadRoom.id)
              .sort((a, b) => a.createdAt.localeCompare(b.createdAt))}
            onSend={(text) => postMessage(threadRoom.id, text)}
            placeholder="Reply to the client"
            emptyText="No messages yet."
          />
        )}
      </Modal>
    </PortalShell>
  );
};

const PricesPanel: React.FC<{ rates: Rates }> = ({ rates }) => {
  const [form, setForm] = useState({
    electricityPerUnit: String(rates.electricityPerUnit ?? 0),
    waterPerUnit: String(rates.waterPerUnit ?? 0),
    rentAmount: String(rates.rentAmount ?? 0),
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState('');

  useEffect(() => {
    setForm({
      electricityPerUnit: String(rates.electricityPerUnit ?? 0),
      waterPerUnit: String(rates.waterPerUnit ?? 0),
      rentAmount: String(rates.rentAmount ?? 0),
    });
  }, [rates.electricityPerUnit, rates.waterPerUnit, rates.rentAmount]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    setDone('');
    try {
      await setRates({
        electricityPerUnit: Number(form.electricityPerUnit) || 0,
        waterPerUnit: Number(form.waterPerUnit) || 0,
        rentAmount: Number(form.rentAmount) || 0,
      });
      setDone('Prices saved. New bills use these; bills already raised keep their old price.');
    } catch (e: any) {
      setError(e?.message || 'Could not save.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <form onSubmit={save} className="space-y-3">
        <p className="text-xs text-bone/70">
          A bill freezes the price it was raised at, so changing these never rewrites what a
          client was already told to pay.
        </p>
        <Field label="Electricity, price per unit">
          <input type="number" min="0" step="1" value={form.electricityPerUnit}
            onChange={(e) => setForm((f) => ({ ...f, electricityPerUnit: e.target.value }))}
            className={inputClass} />
        </Field>
        <Field label="Water, price per unit">
          <input type="number" min="0" step="1" value={form.waterPerUnit}
            onChange={(e) => setForm((f) => ({ ...f, waterPerUnit: e.target.value }))}
            className={inputClass} />
        </Field>
        <Field label="Rent, per month">
          <input type="number" min="0" step="1" value={form.rentAmount}
            onChange={(e) => setForm((f) => ({ ...f, rentAmount: e.target.value }))}
            className={inputClass} />
        </Field>
        {rates.updatedAt && (
          <p className="text-[10px] text-bone/45">
            Last changed {formatDateTime(rates.updatedAt)} by {rates.updatedBy}
          </p>
        )}
        {error && <p className="text-[11px] text-alert-soft">{error}</p>}
        {done && <Banner tone="good" title="Saved">{done}</Banner>}
        <Button type="submit" full disabled={busy}>{busy ? 'Saving...' : 'Save prices'}</Button>
      </form>
    </Card>
  );
};

const ReviewModal: React.FC<{ bill: Bill | null; onClose: () => void }> = ({ bill, onClose }) => {
  const [status, setStatus] = useState<BillStatus>('paid');
  const [amountPaid, setAmountPaid] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!bill) return;
    setStatus(bill.status === 'awaiting_review' ? 'paid' : bill.status);
    setAmountPaid(String(bill.amountPaid || (bill as any).amountReported || bill.amountDue));
    setNote(bill.recoveryNote || '');
    setError('');
  }, [bill]);

  if (!bill) return null;

  const paid = Number(amountPaid) || 0;
  const short = Math.max(0, bill.amountDue - paid);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await reviewBill({ billId: bill.id, status, amountPaid: paid, recoveryNote: note.trim() });
      onClose();
    } catch (e: any) {
      setError(e?.message || 'Could not save.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open title={`Room ${bill.roomNumber} · ${SERVICE_LABELS[bill.serviceType]}`} onClose={onClose}>
      <form onSubmit={save} className="space-y-3">
        <ProofImage bill={bill} />

        {(bill as any).amountReported !== undefined && (
          <Banner tone="warn" title={`Client says they paid ${formatCurrency((bill as any).amountReported)}`}>
            Bill is {formatCurrency(bill.amountDue)}.
          </Banner>
        )}

        <Field label="Mark as">
          <div className="grid grid-cols-3 gap-2">
            {(['paid', 'partial', 'unpaid'] as BillStatus[]).map((s) => (
              <Button key={s} type="button" variant={status === s ? 'primary' : 'ghost'}
                onClick={() => setStatus(s)}>
                {s === 'unpaid' ? 'Not paid' : s === 'partial' ? 'Part' : 'Paid'}
              </Button>
            ))}
          </div>
        </Field>

        <Field label="Amount actually received"
          hint={short > 0 ? `Still short ${formatCurrency(short)}` : 'Covers the full bill.'}>
          <input type="number" min="0" step="1" value={amountPaid}
            onChange={(e) => setAmountPaid(e.target.value)} className={inputClass} />
        </Field>

        <Field label="Note for the record">
          <input value={note} onChange={(e) => setNote(e.target.value)}
            placeholder="e.g. paid the rest in cash" className={inputClass} />
        </Field>

        {bill.proofPath && !bill.proofDeleted && (
          <Button type="button" variant="ghost" full
            onClick={() => downloadProof(bill).catch(() => undefined)}>
            Download the photo to keep
          </Button>
        )}

        {error && <p className="text-[11px] text-alert-soft">{error}</p>}
        <Button type="submit" full disabled={busy}>{busy ? 'Saving...' : 'Save'}</Button>
      </form>
    </Modal>
  );
};
