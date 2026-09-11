import React, { useEffect, useMemo, useState } from 'react';
import {
  Bill, Rates, Room, SERVICE_LABELS, ServiceType, roomServices, serviceHasMeter,
} from '../../1_core/domain/types';
import { formatCurrency, formatDate } from '../../1_core/utils/formatters';
import {
  registerRoom, submitReading, watchAllBills, watchAllRooms,
} from '../../2_backend/services/dataService';
import {
  Banner, Button, Card, Empty, Field, Modal, PortalShell, Stat, Tabs, inputClass,
} from '../components/ui';

// The technician's whole job: put a client in the system with their starting
// meter number, then go around and record what each has used.
export const TechnicianPortal: React.FC<{
  email: string;
  rates: Rates;
  onLogout: () => void;
}> = ({ email, rates, onLogout }) => {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [bills, setBills] = useState<Bill[]>([]);
  const [tab, setTab] = useState('read');
  const [search, setSearch] = useState('');
  const [registering, setRegistering] = useState(false);
  const [reading, setReading] = useState<Room | null>(null);

  useEffect(() => watchAllRooms(setRooms), []);
  useEffect(() => watchAllBills(setBills), []);

  const noRates = !rates.electricityPerUnit && !rates.waterPerUnit && !rates.rentAmount;

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return rooms;
    return rooms.filter(
      (r) =>
        r.roomNumber.toLowerCase().includes(term) ||
        r.tenantName.toLowerCase().includes(term) ||
        (r.tenantPhone || '').includes(term)
    );
  }, [rooms, search]);

  const lastReadingOf = (roomId: string, service: ServiceType) => {
    const room = rooms.find((r) => r.id === roomId);
    const prior = bills
      .filter((b) => b.roomId === roomId && b.serviceType === service)
      .sort((a, b) => b.issuedAt.localeCompare(a.issuedAt))[0];
    if (prior) return prior.currentReading;
    if (!room) return 0;
    return service === 'electricity'
      ? room.startElectricityReading || 0
      : service === 'water'
      ? room.startWaterReading || 0
      : 0;
  };

  return (
    <PortalShell title="Technician" subtitle={email} onLogout={onLogout}>
      {noRates && (
        <div className="mb-4">
          <Banner tone="bad" title="No prices set yet">
            The recovery agent must set prices before any reading can become a bill.
          </Banner>
        </div>
      )}

      <div className="grid grid-cols-2 gap-2 mb-4">
        <Stat value={rooms.length} label="Clients registered" />
        <Stat value={bills.length} label="Bills raised" />
      </div>

      <Tabs
        tabs={[
          { id: 'read', label: 'Record readings' },
          { id: 'new', label: 'New client' },
        ]}
        active={tab}
        onChange={setTab}
      />

      {tab === 'new' && (
        <Card className="space-y-3">
          <p className="text-xs text-bone/70">
            Register a client with the meter numbers showing right now. Every bill they ever
            get is measured from these, so read them carefully.
          </p>
          <Button full onClick={() => setRegistering(true)}>Register a new client</Button>
        </Card>
      )}

      {tab === 'read' && (
        <div className="space-y-3">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search room, name or phone"
            className={inputClass}
          />
          {filtered.length === 0 ? (
            <Empty>No clients yet. Register one from the New client tab.</Empty>
          ) : (
            filtered.map((room) => {
              const roomBills = bills.filter((b) => b.roomId === room.id);
              const last = roomBills.sort((a, b) => b.issuedAt.localeCompare(a.issuedAt))[0];
              return (
                <Card key={room.id}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-black text-sm">Room {room.roomNumber}</div>
                      <div className="text-xs text-bone/70 truncate">{room.tenantName}</div>
                      <div className="text-[10px] uppercase text-bone/45 mt-0.5">
                        {roomServices(room).map((s) => SERVICE_LABELS[s]).join(', ') || 'no services'}
                        {last ? ` · last ${formatDate(last.issuedAt)}` : ' · never read'}
                      </div>
                    </div>
                    <Button onClick={() => setReading(room)} disabled={noRates}>Read</Button>
                  </div>
                </Card>
              );
            })
          )}
        </div>
      )}

      <RegisterModal open={registering} onClose={() => setRegistering(false)} />
      <ReadingModal
        room={reading}
        rates={rates}
        lastReadingOf={lastReadingOf}
        onClose={() => setReading(null)}
      />
    </PortalShell>
  );
};

const RegisterModal: React.FC<{ open: boolean; onClose: () => void }> = ({ open, onClose }) => {
  const [form, setForm] = useState({
    roomNumber: '', tenantName: '', tenantPhone: '',
    hasElectricity: true, hasWater: false, hasRent: false,
    startElectricityReading: '', startWaterReading: '',
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState('');

  const set = (k: string, v: unknown) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    setDone('');
    try {
      await registerRoom({
        roomNumber: form.roomNumber.trim(),
        tenantName: form.tenantName.trim(),
        tenantPhone: form.tenantPhone.trim(),
        hasElectricity: form.hasElectricity,
        hasWater: form.hasWater,
        hasRent: form.hasRent,
        startElectricityReading: Number(form.startElectricityReading) || 0,
        startWaterReading: Number(form.startWaterReading) || 0,
      });
      setDone(
        `Room ${form.roomNumber} registered. Tell them to open the app, pick "I am a client" ` +
          `and enter room ${form.roomNumber} with phone ${form.tenantPhone} to set their password.`
      );
      setForm({
        roomNumber: '', tenantName: '', tenantPhone: '',
        hasElectricity: true, hasWater: false, hasRent: false,
        startElectricityReading: '', startWaterReading: '',
      });
    } catch (e: any) {
      setError(e?.message || 'Could not register.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} title="Register a client" onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        <Field label="Room number *">
          <input required value={form.roomNumber} onChange={(e) => set('roomNumber', e.target.value)}
            placeholder="e.g. 12B" className={inputClass} />
        </Field>
        <Field label="Client name *">
          <input required value={form.tenantName} onChange={(e) => set('tenantName', e.target.value)}
            className={inputClass} />
        </Field>
        <Field label="Phone number *" hint="This is how they log in, and where their SMS goes.">
          <input required type="tel" value={form.tenantPhone}
            onChange={(e) => set('tenantPhone', e.target.value)}
            placeholder="0788123456" className={inputClass} />
        </Field>

        <div className="border border-bone/20 rounded-xl p-3 space-y-2">
          <div className="text-[10px] font-bold uppercase tracking-wider text-bone/70">
            What they pay for
          </div>
          {([
            ['Electricity', 'hasElectricity'],
            ['Water', 'hasWater'],
            ['Rent', 'hasRent'],
          ] as const).map(([label, key]) => (
            <div key={key} className="flex items-center justify-between">
              <span className="text-xs">{label}</span>
              <Button type="button" variant={form[key] ? 'primary' : 'ghost'}
                onClick={() => set(key, !form[key])}>
                {form[key] ? 'Yes' : 'No'}
              </Button>
            </div>
          ))}
        </div>

        {form.hasElectricity && (
          <Field label="Electricity meter reading now *" hint="The number on the meter today.">
            <input type="number" min="0" required value={form.startElectricityReading}
              onChange={(e) => set('startElectricityReading', e.target.value)} className={inputClass} />
          </Field>
        )}
        {form.hasWater && (
          <Field label="Water meter reading now *">
            <input type="number" min="0" required value={form.startWaterReading}
              onChange={(e) => set('startWaterReading', e.target.value)} className={inputClass} />
          </Field>
        )}

        {error && <p className="text-[11px] text-alert-soft">{error}</p>}
        {done && <Banner tone="good" title="Registered">{done}</Banner>}

        <Button type="submit" full disabled={busy}>{busy ? 'Saving...' : 'Register client'}</Button>
      </form>
    </Modal>
  );
};

const ReadingModal: React.FC<{
  room: Room | null;
  rates: Rates;
  lastReadingOf: (roomId: string, service: ServiceType) => number;
  onClose: () => void;
}> = ({ room, rates, lastReadingOf, onClose }) => {
  const services = room ? roomServices(room) : [];
  const [service, setService] = useState<ServiceType>('electricity');
  const [reading, setReading] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState('');

  useEffect(() => {
    if (!room) return;
    setService(roomServices(room)[0] ?? 'electricity');
    setReading('');
    setNote('');
    setError('');
    setDone('');
  }, [room]);

  if (!room) return null;

  const previous = lastReadingOf(room.id, service);
  const rate =
    service === 'electricity' ? rates.electricityPerUnit
    : service === 'water' ? rates.waterPerUnit
    : rates.rentAmount;
  const units = serviceHasMeter(service) ? Math.max(0, (Number(reading) || 0) - previous) : 1;
  const preview = Math.round(units * rate);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const res = await submitReading({
        roomId: room.id,
        serviceType: service,
        currentReading: serviceHasMeter(service) ? Number(reading) : previous,
        note: note.trim() || undefined,
      });
      setDone(`Bill raised: ${formatCurrency(res.amountDue)}. The client has been sent an SMS.`);
      setReading('');
      setNote('');
    } catch (e: any) {
      setError(e?.message || 'Could not save the reading.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open title={`Room ${room.roomNumber}`} onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        <Field label="Service">
          <div className="grid grid-cols-3 gap-2">
            {services.map((s) => (
              <Button key={s} type="button" variant={service === s ? 'primary' : 'ghost'}
                onClick={() => setService(s)}>
                {SERVICE_LABELS[s]}
              </Button>
            ))}
          </div>
        </Field>

        {serviceHasMeter(service) ? (
          <>
            <Banner tone="warn" title={`Last reading: ${previous}`}>
              The new one must be the same or higher.
            </Banner>
            <Field label="Meter reading now *">
              <input type="number" min={previous} required value={reading}
                onChange={(e) => setReading(e.target.value)} className={inputClass} />
            </Field>
          </>
        ) : (
          <Banner tone="warn" title="Rent is a flat charge">
            No meter to read. This raises one month of rent.
          </Banner>
        )}

        <Card className="bg-emerald-dark">
          <div className="text-[10px] uppercase text-bone/55">This will bill</div>
          <div className="font-black text-xl">{formatCurrency(preview)}</div>
          <div className="text-[10px] text-bone/55">
            {units} unit{units === 1 ? '' : 's'} × {formatCurrency(rate)} · due in 5 days
          </div>
        </Card>

        <Field label="Note (optional)">
          <input value={note} onChange={(e) => setNote(e.target.value)}
            placeholder="Anything unusual about this reading" className={inputClass} />
        </Field>

        {error && <p className="text-[11px] text-alert-soft">{error}</p>}
        {done && <Banner tone="good" title="Done">{done}</Banner>}

        <Button type="submit" full disabled={busy}>{busy ? 'Saving...' : 'Send reading'}</Button>
      </form>
    </Modal>
  );
};
