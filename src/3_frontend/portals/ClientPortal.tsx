import React, { useEffect, useMemo, useState } from 'react';
import {
  Bill, Message, Rates, Room, SERVICE_LABELS, ServiceType, roomServices, serviceHasMeter,
} from '../../1_core/domain/types';
import { isOverdue } from '../../1_core/billing/calculate';
import { formatCurrency, formatDate } from '../../1_core/utils/formatters';
import {
  postMessage, submitProof, uploadProof, watchRoomBills, watchRoomMessages,
} from '../../2_backend/services/dataService';
import { BillCard } from '../components/BillCard';
import { MessageThread } from '../components/MessageThread';
import {
  Banner, Button, Card, Empty, Field, Modal, PortalShell, Stat, Tabs, inputClass,
} from '../components/ui';

interface ClientPortalProps {
  room: Room;
  rates: Rates;
  onLogout: () => void;
}

// What the client sees: what they owe, how to pay it, and a way to ask a
// question. Nothing about other rooms, nothing about the building.
export const ClientPortal: React.FC<ClientPortalProps> = ({ room, rates, onLogout }) => {
  const [bills, setBills] = useState<Bill[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [tab, setTab] = useState('bills');
  const [paying, setPaying] = useState<Bill | null>(null);

  useEffect(() => watchRoomBills(room.id, setBills), [room.id]);
  useEffect(() => watchRoomMessages(room.id, setMessages), [room.id]);

  const totals = useMemo(() => {
    const outstanding = bills
      .filter((b) => b.status !== 'paid')
      .reduce((sum, b) => sum + Math.max(0, b.amountDue - b.amountPaid), 0);
    const overdue = bills.filter((b) => isOverdue(b.dueDate, b.status));
    return { outstanding, overdue };
  }, [bills]);

  const unpaid = bills.filter((b) => b.status !== 'paid');
  const settled = bills.filter((b) => b.status === 'paid');

  // Latest meter position per service, so a client can check the reading they
  // are being billed on against the meter on their own wall.
  const meterNow = useMemo(() => {
    return roomServices(room)
      .filter(serviceHasMeter)
      .map((service) => {
        const latest = bills
          .filter((b) => b.serviceType === service)
          .sort((a, b) => b.issuedAt.localeCompare(a.issuedAt))[0];
        return latest
          ? {
              service: service as ServiceType,
              from: latest.previousReading,
              to: latest.currentReading,
              when: latest.issuedAt,
            }
          : null;
      })
      .filter((x): x is { service: ServiceType; from: number; to: number; when: string } => x !== null);
  }, [bills, room]);

  return (
    <PortalShell
      title={`Room ${room.roomNumber}`}
      subtitle={room.tenantName}
      onLogout={onLogout}
    >
      {totals.overdue.length > 0 && (
        <div className="mb-4">
          <Banner tone="bad" title={`${totals.overdue.length} bill past the 5 day limit`}>
            Pay as soon as you can. The recovery agent has been told.
          </Banner>
        </div>
      )}

      <div className="grid grid-cols-2 gap-2 mb-4">
        <Stat
          value={formatCurrency(totals.outstanding)}
          label="You owe"
          tone={totals.outstanding > 0 ? (totals.overdue.length ? 'bad' : 'warn') : 'good'}
        />
        <Stat value={unpaid.length} label="Open bills" />
      </div>

      <Tabs
        tabs={[
          { id: 'bills', label: 'My bills', badge: unpaid.length || undefined },
          { id: 'history', label: 'History' },
          { id: 'ask', label: 'Ask a question' },
          { id: 'me', label: 'My details' },
        ]}
        active={tab}
        onChange={setTab}
      />

      {tab === 'bills' && (
        <div className="space-y-3">
          {unpaid.length === 0 ? (
            <Empty>Nothing to pay right now. Bills appear when the technician reads your meter.</Empty>
          ) : (
            unpaid.map((b) => <BillCard key={b.id} bill={b} onPay={setPaying} />)
          )}
        </div>
      )}

      {tab === 'history' && (
        <div className="space-y-3">
          {settled.length === 0 ? (
            <Empty>No paid bills yet.</Empty>
          ) : (
            settled.map((b) => <BillCard key={b.id} bill={b} />)
          )}
        </div>
      )}

      {tab === 'ask' && (
        <MessageThread
          messages={messages}
          onSend={(text) => postMessage(room.id, text)}
          placeholder="Ask the recovery agent"
          emptyText="No questions yet. Ask anything about your bill here."
        />
      )}

      {tab === 'me' && (
        <Card className="space-y-3">
          <dl className="grid grid-cols-2 gap-y-2 text-xs">
            <dt className="text-bone/55 text-[10px] uppercase">Room</dt>
            <dd className="font-bold">{room.roomNumber}</dd>
            <dt className="text-bone/55 text-[10px] uppercase">Name</dt>
            <dd className="font-bold break-all">{room.tenantName}</dd>
            <dt className="text-bone/55 text-[10px] uppercase">Phone</dt>
            <dd className="font-bold">{room.tenantPhone}</dd>
          </dl>

          <div>
            <div className="text-[10px] uppercase text-bone/55 mb-1">You are billed for</div>
            <div className="flex flex-wrap gap-2">
              {roomServices(room).map((s) => (
                <span
                  key={s}
                  className="px-2 py-1 bg-emerald-mid rounded-lg text-[10px] font-bold uppercase"
                >
                  {SERVICE_LABELS[s]}
                </span>
              ))}
            </div>
          </div>

          <div>
            <div className="text-[10px] uppercase text-bone/55 mb-1">
              Where your meters started
            </div>
            <p className="text-[10px] text-bone/50 mb-1">
              Set by the technician on {formatDate(room.createdAt)}. Your very first bill was
              measured from these numbers.
            </p>
            <ul className="text-xs space-y-0.5">
              {room.hasElectricity && (
                <li>Electricity started at <b>{room.startElectricityReading ?? 0}</b></li>
              )}
              {room.hasWater && (
                <li>Water started at <b>{room.startWaterReading ?? 0}</b></li>
              )}
              {!room.hasElectricity && !room.hasWater && (
                <li className="text-bone/50">No meters on this room.</li>
              )}
            </ul>
          </div>

          <div>
            <div className="text-[10px] uppercase text-bone/55 mb-1">Your meters now</div>
            {meterNow.length === 0 ? (
              <p className="text-[10px] text-bone/50">
                No readings taken yet. The technician records them on their round.
              </p>
            ) : (
              <ul className="text-xs space-y-0.5">
                {meterNow.map(({ service, from, to, when }) => (
                  <li key={service}>
                    {SERVICE_LABELS[service]}: <b>{to}</b>
                    <span className="text-bone/50">
                      {' '}(was {from}, read {formatDate(when)})
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div>
            <div className="text-[10px] uppercase text-bone/55 mb-1">Current prices</div>
            <ul className="text-xs space-y-0.5">
              <li>Electricity: {formatCurrency(rates.electricityPerUnit)} per unit</li>
              <li>Water: {formatCurrency(rates.waterPerUnit)} per unit</li>
              <li>Rent: {formatCurrency(rates.rentAmount)} per month</li>
            </ul>
          </div>

          <p className="text-[10px] text-bone/45">
            A number here looks wrong? Ask a question — only staff can change these, and the
            recovery agent will sort it out.
          </p>
        </Card>
      )}

      <PayModal bill={paying} room={room} onClose={() => setPaying(null)} />
    </PortalShell>
  );
};

const PayModal: React.FC<{ bill: Bill | null; room: Room; onClose: () => void }> = ({
  bill, room, onClose,
}) => {
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!bill) return;
    setAmount(String(Math.max(0, bill.amountDue - bill.amountPaid)));
    setNote('');
    setFile(null);
    setError('');
  }, [bill]);

  if (!bill) return null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const value = parseFloat(amount);
    if (isNaN(value) || value < 0) {
      setError('Enter the amount you paid.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      let proofPath: string | undefined;
      if (file) proofPath = await uploadProof(room.id, file);
      await submitProof({
        billId: bill.id,
        amountReported: value,
        proofPath,
        proofNote: note.trim() || undefined,
      });
      onClose();
    } catch (e: any) {
      setError(e?.message || 'Could not send. Try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open title={`Pay ${SERVICE_LABELS[bill.serviceType]}`} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <Banner tone="warn" title={`${formatCurrency(bill.amountDue - bill.amountPaid)} to pay`}>
          Pay however you normally do, then send the proof here.
        </Banner>

        <Field label="Amount you paid *">
          <input
            type="number" min="0" step="1" required value={amount}
            onChange={(e) => setAmount(e.target.value)} className={inputClass}
          />
        </Field>

        <Field label="Photo or screenshot of payment" hint="Deleted after 7 days. Your payment record stays.">
          <input
            type="file" accept="image/*"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            className="w-full text-[11px] text-bone/70 file:mr-2 file:px-3 file:py-2 file:rounded-lg file:border-0 file:bg-gold file:text-emerald-dark file:font-bold file:text-[11px]"
          />
        </Field>

        <Field label="Note (optional)">
          <input
            value={note} onChange={(e) => setNote(e.target.value)}
            placeholder="Anything the recovery agent should know" className={inputClass}
          />
        </Field>

        {error && <p className="text-[11px] text-alert-soft">{error}</p>}
        <Button type="submit" full disabled={busy}>
          {busy ? 'Sending...' : 'Send to recovery agent'}
        </Button>
      </form>
    </Modal>
  );
};
