import React, { useEffect, useMemo, useState } from 'react';
import {
  Bill, HealthReport, Message, Rates, ROLE_LABELS, Room, SERVICE_LABELS, STAFF_ROLES,
  StaffRole, roomServices,
} from '../../1_core/domain/types';
import { isOverdue } from '../../1_core/billing/calculate';
import { formatCurrency, formatDateTime } from '../../1_core/utils/formatters';
import {
  deleteRoom, postMessage, removeStaff, runHealthCheckNow, setRoomPassword, setStaffRole,
  updateBillFields, updateRoomFields, watchAllBills, watchAllMessages, watchAllRooms,
  watchHealth, watchStaff,
} from '../../2_backend/services/dataService';
import { BillCard } from '../components/BillCard';
import { MessageThread } from '../components/MessageThread';
import {
  Banner, Button, Card, Empty, Field, Modal, PortalShell, Stat, Tabs, inputClass,
} from '../components/ui';

const BUILT_IN = [
  'techubwenge@gmail.com',
  'uwimbabazigloria05@gmail.com',
  'abdullazackniyigaba@gmail.com',
];

// Admin sees the whole system and can change any part of it.
export const AdminPortal: React.FC<{
  email: string;
  rates: Rates;
  onLogout: () => void;
}> = ({ email, rates, onLogout }) => {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [bills, setBills] = useState<Bill[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [staff, setStaff] = useState<Array<{ email: string; role: StaffRole; addedBy?: string; addedAt?: string }>>([]);
  const [health, setHealth] = useState<HealthReport | null>(null);
  const [tab, setTab] = useState('rooms');
  const [openRoom, setOpenRoom] = useState<Room | null>(null);
  const [search, setSearch] = useState('');

  useEffect(() => watchAllRooms(setRooms), []);
  useEffect(() => watchAllBills(setBills), []);
  useEffect(() => watchAllMessages(setMessages), []);
  useEffect(() => watchStaff(setStaff), []);
  useEffect(() => watchHealth(setHealth), []);

  const overdue = bills.filter((b) => isOverdue(b.dueDate, b.status));
  const collected = useMemo(() => bills.reduce((s, b) => s + (b.amountPaid || 0), 0), [bills]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return rooms;
    return rooms.filter(
      (r) => r.roomNumber.toLowerCase().includes(term) || r.tenantName.toLowerCase().includes(term)
    );
  }, [rooms, search]);

  return (
    <PortalShell title="Admin" subtitle={email} onLogout={onLogout}>
      {health && !health.ok && (
        <div className="mb-4">
          <Banner tone="bad" title="System problem">{health.notes.join(' ')}</Banner>
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
        <Stat value={rooms.length} label="Clients" />
        <Stat value={bills.length} label="Bills" />
        <Stat value={formatCurrency(collected)} label="Collected" tone="good" />
        <Stat value={overdue.length} label="Overdue" tone={overdue.length ? 'bad' : 'plain'} />
      </div>

      <Tabs
        tabs={[
          { id: 'rooms', label: 'Clients' },
          { id: 'bills', label: 'All bills' },
          { id: 'messages', label: 'All conversations' },
          { id: 'staff', label: 'Staff' },
          { id: 'system', label: 'System' },
        ]}
        active={tab}
        onChange={setTab}
      />

      {tab === 'rooms' && (
        <div className="space-y-3">
          <input value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Search room or name" className={inputClass} />
          {filtered.length === 0 ? (
            <Empty>No clients yet. A technician registers them.</Empty>
          ) : (
            filtered.map((room) => (
              <Card key={room.id}>
                <button onClick={() => setOpenRoom(room)} className="w-full text-left cursor-pointer">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-black text-sm">Room {room.roomNumber}</div>
                      <div className="text-xs text-bone/65 truncate">
                        {room.tenantName} · {room.tenantPhone}
                      </div>
                      <div className="text-[10px] uppercase text-bone/45">
                        {roomServices(room).map((s) => SERVICE_LABELS[s]).join(', ') || 'no services'}
                        {room.tenantUid ? ' · logged in' : ' · never logged in'}
                      </div>
                    </div>
                    <Button variant="ghost">Open</Button>
                  </div>
                </button>
              </Card>
            ))
          )}
        </div>
      )}

      {tab === 'bills' && (
        <div className="space-y-3">
          {bills.length === 0 ? <Empty>No bills yet.</Empty>
            : bills.map((b) => <BillCard key={b.id} bill={b} showRoom />)}
        </div>
      )}

      {tab === 'messages' && (
        <div className="space-y-3">
          {messages.length === 0 ? (
            <Empty>No conversations yet.</Empty>
          ) : (
            rooms
              .filter((r) => messages.some((m) => m.roomId === r.id))
              .map((room) => (
                <Card key={room.id}>
                  <div className="font-black text-sm mb-2">Room {room.roomNumber}</div>
                  <MessageThread
                    messages={messages.filter((m) => m.roomId === room.id)
                      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))}
                    onSend={(text) => postMessage(room.id, text)}
                    placeholder="Reply as admin"
                    emptyText="No messages."
                  />
                </Card>
              ))
          )}
        </div>
      )}

      {tab === 'staff' && <StaffPanel staff={staff} currentEmail={email} />}

      {tab === 'system' && (
        <Card className="space-y-3">
          <div className="font-black text-sm">Watchdog</div>
          {health ? (
            <>
              <Banner tone={health.ok ? 'good' : 'bad'}
                title={health.ok ? 'Healthy' : 'Problem found'}>
                Checked {formatDateTime(health.checkedAt)}
              </Banner>
              <ul className="text-[11px] text-bone/70 list-disc pl-4 space-y-0.5">
                <li>Billing {health.billingEnabled ? 'active' : 'DISABLED — the app is down'}</li>
                <li>Storage {(health.storageRatio * 100).toFixed(1)}% of the free 5 GB</li>
                {health.notes?.map((n, i) => <li key={i}>{n}</li>)}
              </ul>
            </>
          ) : <Empty>No check has run yet.</Empty>}
          <Button variant="ghost" onClick={() => runHealthCheckNow().catch(() => undefined)}>
            Run a check now
          </Button>
          <div className="text-[10px] text-bone/45">
            Prices: electricity {formatCurrency(rates.electricityPerUnit)} · water{' '}
            {formatCurrency(rates.waterPerUnit)} · rent {formatCurrency(rates.rentAmount)}
          </div>
        </Card>
      )}

      <RoomEditor
        room={openRoom}
        bills={bills.filter((b) => b.roomId === openRoom?.id)}
        onClose={() => setOpenRoom(null)}
      />
    </PortalShell>
  );
};

const StaffPanel: React.FC<{
  staff: Array<{ email: string; role: StaffRole; addedBy?: string; addedAt?: string }>;
  currentEmail: string;
}> = ({ staff, currentEmail }) => {
  const [newEmail, setNewEmail] = useState('');
  const [role, setRole] = useState<StaffRole>('technician');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState('');

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setError(''); setDone('');
    try {
      await setStaffRole(newEmail.trim().toLowerCase(), role);
      setDone(`${newEmail.trim()} is now ${ROLE_LABELS[role]}. They get access when they sign in with Google.`);
      setNewEmail('');
    } catch (e: any) {
      setError(e?.message || 'Could not add.');
    } finally {
      setBusy(false);
    }
  };

  const rows = [
    ...BUILT_IN.map((e) => ({ email: e, role: 'admin' as StaffRole, builtIn: true })),
    ...staff.filter((s) => !BUILT_IN.includes(s.email)).map((s) => ({ ...s, builtIn: false })),
  ];

  return (
    <div className="space-y-3">
      <Card>
        <form onSubmit={add} className="space-y-3">
          <div className="font-black text-sm">Give someone access</div>
          <p className="text-[11px] text-bone/65">
            Type their Google email and pick the job. They sign in with Google and land in
            their own portal — nothing to accept, nothing to set up.
          </p>
          <Field label="Google email">
            <input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)}
              placeholder="name@gmail.com" className={inputClass} />
          </Field>
          <Field label="Job">
            <div className="grid grid-cols-3 gap-2">
              {STAFF_ROLES.map((r) => (
                <Button key={r} type="button" variant={role === r ? 'primary' : 'ghost'}
                  onClick={() => setRole(r)}>
                  {ROLE_LABELS[r]}
                </Button>
              ))}
            </div>
          </Field>
          {error && <p className="text-[11px] text-alert-soft">{error}</p>}
          {done && <Banner tone="good" title="Added">{done}</Banner>}
          <Button type="submit" full disabled={busy}>{busy ? '...' : 'Give access'}</Button>
        </form>
      </Card>

      {rows.map((s) => (
        <Card key={s.email}>
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="text-xs font-bold break-all">
                {s.email}
                {s.email === currentEmail.toLowerCase() && (
                  <span className="ml-2 text-[10px] uppercase text-bone/50">you</span>
                )}
              </div>
              <div className="text-[10px] uppercase text-bone/50">
                {ROLE_LABELS[s.role]}
                {s.builtIn ? ' · built-in owner' : ` · added by ${(s as any).addedBy ?? 'an admin'}`}
              </div>
            </div>
            {!s.builtIn && s.email !== currentEmail.toLowerCase() && (
              <Button variant="danger"
                onClick={() => {
                  if (window.confirm(`Remove access for ${s.email}?`)) {
                    removeStaff(s.email).catch((e) => window.alert(e?.message));
                  }
                }}>
                Remove
              </Button>
            )}
          </div>
        </Card>
      ))}

      <p className="text-[10px] text-bone/45">
        Built-in owners are set in the code and cannot be removed here, so the building can
        never be locked out of its own system.
      </p>
    </div>
  );
};

const RoomEditor: React.FC<{ room: Room | null; bills: Bill[]; onClose: () => void }> = ({
  room, bills, onClose,
}) => {
  const [form, setForm] = useState<Partial<Room>>({});
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    if (room) setForm({ ...room });
    setPassword('');
    setMsg('');
  }, [room]);

  if (!room) return null;
  const set = (k: keyof Room, v: unknown) => setForm((f) => ({ ...f, [k]: v }));

  const save = async () => {
    setBusy(true); setMsg('');
    try {
      // Renaming has to move roomKey too, or the client can no longer find
      // their own room when they log in.
      const updates: Partial<Room> = { ...form };
      if (form.roomNumber && form.roomNumber !== room.roomNumber) {
        updates.roomKey = form.roomNumber.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
      }
      await updateRoomFields(room.id, updates);
      setMsg('Saved.');
    } catch (e: any) {
      setMsg(e?.message || 'Could not save.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open title={`Room ${room.roomNumber}`} onClose={onClose}>
      <div className="space-y-3">
        <Field label="Room number">
          <input value={form.roomNumber ?? ''} onChange={(e) => set('roomNumber', e.target.value)}
            className={inputClass} />
        </Field>
        <Field label="Client name">
          <input value={form.tenantName ?? ''} onChange={(e) => set('tenantName', e.target.value)}
            className={inputClass} />
        </Field>
        <Field label="Phone">
          <input value={form.tenantPhone ?? ''} onChange={(e) => set('tenantPhone', e.target.value)}
            className={inputClass} />
        </Field>

        <div className="border border-bone/20 rounded-xl p-3 space-y-2">
          <div className="text-[10px] font-bold uppercase text-bone/70">Billed for</div>
          {([['Electricity', 'hasElectricity'], ['Water', 'hasWater'], ['Rent', 'hasRent']] as const)
            .map(([label, key]) => (
              <div key={key} className="flex items-center justify-between">
                <span className="text-xs">{label}</span>
                <Button type="button" variant={form[key] ? 'primary' : 'ghost'}
                  onClick={() => set(key, !form[key])}>
                  {form[key] ? 'Yes' : 'No'}
                </Button>
              </div>
            ))}
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Field label="Start electricity">
            <input type="number" value={form.startElectricityReading ?? 0}
              onChange={(e) => set('startElectricityReading', Number(e.target.value))}
              className={inputClass} />
          </Field>
          <Field label="Start water">
            <input type="number" value={form.startWaterReading ?? 0}
              onChange={(e) => set('startWaterReading', Number(e.target.value))}
              className={inputClass} />
          </Field>
        </div>

        {msg && <p className="text-[11px] text-gold-soft">{msg}</p>}
        <Button full disabled={busy} onClick={save}>{busy ? 'Saving...' : 'Save changes'}</Button>

        <div className="border-t border-bone/15 pt-3 space-y-2">
          <Field label="Reset client password" hint="For a client locked out of their portal.">
            <div className="flex gap-2">
              <input value={password} onChange={(e) => setPassword(e.target.value)}
                placeholder="New password" className={inputClass} />
              <Button variant="gold" onClick={() => {
                setRoomPassword(room.id, password)
                  .then(() => setMsg(`Password set to: ${password}`))
                  .catch((e) => setMsg(e?.message));
              }}>Set</Button>
            </div>
          </Field>
        </div>

        <div className="border-t border-bone/15 pt-3">
          <Button variant="danger" full onClick={() => {
            const typed = window.prompt(
              `Delete room ${room.roomNumber} and all ${bills.length} bills? Type the room number to confirm.`
            );
            if (typed === null) return;
            if (typed.trim().toLowerCase() !== room.roomNumber.trim().toLowerCase()) {
              window.alert('That did not match. Nothing deleted.');
              return;
            }
            deleteRoom(room.id).then(onClose).catch((e) => window.alert(e?.message));
          }}>
            Delete this client for good
          </Button>
        </div>

        <div className="border-t border-bone/15 pt-3 space-y-2">
          <div className="text-[10px] uppercase text-bone/55">Bills ({bills.length})</div>
          {bills.map((b) => (
            <BillCard key={b.id} bill={b} onReview={(bill) => {
              const value = window.prompt('Set amount paid', String(bill.amountPaid));
              if (value === null) return;
              updateBillFields(bill.id, {
                amountPaid: Number(value) || 0,
                status: Number(value) >= bill.amountDue ? 'paid' : 'partial',
              }).catch((e) => window.alert(e?.message));
            }} />
          ))}
        </div>
      </div>
    </Modal>
  );
};
