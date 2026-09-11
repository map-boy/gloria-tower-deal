import {
  collection, doc, onSnapshot, orderBy, query, updateDoc, where,
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import {
  ref as storageRef, uploadBytes, getDownloadURL, getBlob,
} from 'firebase/storage';
import { db, functions, storage } from './firebaseConfig';
import {
  AppNotification, Bill, BillStatus, DEFAULT_RATES, HealthReport, Message,
  Rates, Room, ServiceType, StaffRole,
} from '../../1_core/domain/types';

// --- Callables ---------------------------------------------------------
// Every write that carries a rule (who may do it, what it may become) lives
// in a function, so the browser cannot be the thing that enforces it.

const call = <I, O>(name: string) => httpsCallable<I, O>(functions, name);

export const setStaffRole = (email: string, role: StaffRole) =>
  call<{ email: string; role: StaffRole }, { ok: boolean }>('setStaffRole')({ email, role }).then(() => undefined);

export const removeStaff = (email: string) =>
  call<{ email: string }, { ok: boolean }>('removeStaff')({ email }).then(() => undefined);

export const setRates = (rates: Omit<Rates, 'updatedBy' | 'updatedAt'>) =>
  call<typeof rates, { ok: boolean }>('setRates')(rates).then(() => undefined);

export const registerRoom = (input: {
  roomNumber: string; tenantName: string; tenantPhone: string;
  hasElectricity: boolean; hasWater: boolean; hasRent: boolean;
  startElectricityReading: number; startWaterReading: number;
}) => call<typeof input, { ok: boolean; roomId: string }>('registerRoom')(input).then((r) => r.data);

export const submitReading = (input: {
  roomId: string; serviceType: ServiceType; currentReading: number; note?: string;
}) =>
  call<typeof input, { ok: boolean; billId: string; amountDue: number; unitsUsed: number }>(
    'submitReading'
  )(input).then((r) => r.data);

export const claimRoom = (input: { roomNumber: string; tenantPhone: string; password: string }) =>
  call<
    typeof input,
    { ok: boolean; roomId?: string; firstTime?: boolean; reason?: 'not_registered' | 'wrong_credentials' }
  >('claimRoom')(input).then((r) => r.data);

export const setRoomPassword = (roomId: string, password: string) =>
  call<{ roomId: string; password: string }, { ok: boolean }>('setRoomPassword')({ roomId, password }).then(() => undefined);

export const submitProof = (input: {
  billId: string; amountReported: number; proofPath?: string; proofNote?: string;
}) => call<typeof input, { ok: boolean }>('submitProof')(input).then(() => undefined);

export const postMessage = (roomId: string, text: string) =>
  call<{ roomId: string; text: string }, { ok: boolean }>('postMessage')({ roomId, text }).then(() => undefined);

export const reviewBill = (input: {
  billId: string; status: BillStatus; amountPaid: number; recoveryNote?: string;
}) => call<typeof input, { ok: boolean }>('reviewBill')(input).then(() => undefined);

export const markProofDownloaded = (billId: string) =>
  call<{ billId: string }, { ok: boolean }>('markProofDownloaded')({ billId }).then(() => undefined);

export const deleteRoom = (roomId: string) =>
  call<{ roomId: string }, { ok: boolean; deletedBills: number }>('deleteRoom')({ roomId }).then((r) => r.data);

export const runHealthCheckNow = () =>
  call<Record<string, never>, HealthReport>('runHealthCheckNow')({}).then((r) => r.data);

// --- Direct writes the rules already cover ------------------------------

export const markNotificationRead = (id: string) =>
  updateDoc(doc(db, 'notifications', id), { read: true });

// Clears the unread badge once a staff member has actually opened the thread.
export async function markThreadRead(messages: Message[]): Promise<void> {
  await Promise.all(
    messages
      .filter((m) => m.authorRole === 'client' && !m.readByStaff)
      .map((m) => updateDoc(doc(db, 'messages', m.id), { readByStaff: true }))
  );
}

// Admin-only field edits. The rules reject these for anyone else.
export const updateRoomFields = (roomId: string, updates: Partial<Room>) =>
  updateDoc(doc(db, 'rooms', roomId), { ...updates, updatedAt: new Date().toISOString() });

export const updateBillFields = (billId: string, updates: Partial<Bill>) =>
  updateDoc(doc(db, 'bills', billId), { ...updates, updatedAt: new Date().toISOString() });

// --- Storage -----------------------------------------------------------

export async function uploadProof(roomId: string, file: File): Promise<string> {
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const path = `paymentProofs/${roomId}/${Date.now()}-${safeName}`;
  await uploadBytes(storageRef(storage, path), file);
  return path;
}

export const proofUrl = (path: string) => getDownloadURL(storageRef(storage, path));

// Pulls the actual bytes so the recovery agent keeps a copy after the 7 day
// deletion. Saving it is the whole point, so the download is what marks the
// proof as kept.
export async function downloadProof(bill: Bill): Promise<void> {
  if (!bill.proofPath) throw new Error('This bill has no photo.');
  const blob = await getBlob(storageRef(storage, bill.proofPath));
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${bill.roomNumber}-${bill.serviceType}-${bill.issuedAt.slice(0, 10)}.jpg`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  await markProofDownloaded(bill.id);
}

// --- Live reads --------------------------------------------------------

export function watchRates(cb: (rates: Rates) => void) {
  return onSnapshot(doc(db, 'config', 'rates'), (snap) => {
    cb(snap.exists() ? ({ ...DEFAULT_RATES, ...(snap.data() as Rates) }) : DEFAULT_RATES);
  });
}

export function watchAllRooms(cb: (rooms: Room[]) => void) {
  return onSnapshot(collection(db, 'rooms'), (snap) => {
    cb(
      snap.docs
        .map((d) => d.data() as Room)
        .sort((a, b) => a.roomNumber.localeCompare(b.roomNumber, undefined, { numeric: true }))
    );
  });
}

export function watchRoom(
  roomId: string,
  cb: (room: Room | null) => void,
  onGone?: () => void
) {
  return onSnapshot(
    doc(db, 'rooms', roomId),
    (snap) => {
      if (!snap.exists()) {
        // The room was deleted out from under them.
        onGone?.();
        cb(null);
        return;
      }
      cb(snap.data() as Room);
    },
    // Permission denied means the room was handed to another device, so the
    // session held here is stale and has to end rather than spin.
    () => onGone?.()
  );
}

export function watchAllBills(cb: (bills: Bill[]) => void) {
  return onSnapshot(collection(db, 'bills'), (snap) => {
    cb(
      snap.docs
        .map((d) => d.data() as Bill)
        .sort((a, b) => b.issuedAt.localeCompare(a.issuedAt))
    );
  });
}

export function watchRoomBills(roomId: string, cb: (bills: Bill[]) => void) {
  return onSnapshot(query(collection(db, 'bills'), where('roomId', '==', roomId)), (snap) => {
    cb(
      snap.docs
        .map((d) => d.data() as Bill)
        .sort((a, b) => b.issuedAt.localeCompare(a.issuedAt))
    );
  });
}

export function watchRoomMessages(roomId: string, cb: (messages: Message[]) => void) {
  return onSnapshot(query(collection(db, 'messages'), where('roomId', '==', roomId)), (snap) => {
    cb(
      snap.docs
        .map((d) => d.data() as Message)
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    );
  });
}

export function watchAllMessages(cb: (messages: Message[]) => void) {
  return onSnapshot(collection(db, 'messages'), (snap) => {
    cb(
      snap.docs
        .map((d) => d.data() as Message)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    );
  });
}

export function watchNotifications(cb: (items: AppNotification[]) => void) {
  return onSnapshot(query(collection(db, 'notifications'), orderBy('createdAt', 'desc')), (snap) => {
    cb(snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }) as AppNotification).slice(0, 50));
  });
}

export function watchStaff(
  cb: (staff: Array<{ email: string; role: StaffRole; addedBy?: string; addedAt?: string }>) => void
) {
  return onSnapshot(collection(db, 'staff'), (snap) => {
    cb(snap.docs.map((d) => ({ email: d.id, ...(d.data() as any) })));
  });
}

export function watchHealth(cb: (report: HealthReport | null) => void) {
  return onSnapshot(doc(db, 'health', 'latest'), (snap) =>
    cb(snap.exists() ? ({ id: 'latest', ...(snap.data() as any) } as HealthReport) : null)
  );
}
