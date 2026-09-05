import { doc, getDoc, getDocs, setDoc, deleteDoc, onSnapshot, collection, query, where, orderBy } from 'firebase/firestore';
import { db } from './firebaseConfig';
import { Room, Tenant, UsageEntry, RateConfig, BuildingSummary, MonthlyRoomStats, UtilityType } from '../../1_core/domain/types';
import { generateInitialBuildingData } from '../../4_ops/scripts/seedBuilding';
import { calculateBuildingSummary, calculateRoomMonthlyStats } from '../../1_core/algorithms/balance';
import { getCurrentYearMonth } from '../../1_core/utils/dateUtils';

const buildingDocRef = doc(db, 'voltraTower', 'building');
const tenantsCollectionRef = collection(db, 'tenants');
const usageEntriesCollectionRef = collection(db, 'usageEntries');
const paymentsCollectionRef = collection(db, 'payments');
const invoicesCollectionRef = collection(db, 'invoices');

export interface PaymentRecord {
  id: string;
  invoiceId: string;
  provider: string;
  transactionId: string;
  amount: number;
  receivedAt?: string;
}

export interface InvoiceRecord {
  id: string;
  roomId: string;
  roomNumber: string;
  month: string;
  unitsUsed: number;
  amount: number;
  referenceCode: string;
  status: string;
  paidAt?: string;
  amountPaid?: number;
}

export class StorageService {
  private rooms: Room[] = [];
  private tenants: Tenant[] = [];
  private usageEntries: UsageEntry[] = [];
  private rateConfigs: RateConfig[] = [];
  private payments: PaymentRecord[] = [];
  private invoices: InvoiceRecord[] = [];
  private tenantsUnsub: (() => void) | null = null;
  private invoicesUnsub: (() => void) | null = null;
  private paymentsUnsub: (() => void) | null = null;
  private listeners: Array<() => void> = [];

  constructor() {
    this.initFirestore();
  }

  private async initFirestore() {
    try {
      const buildingSnap = await getDoc(buildingDocRef);
      if (!buildingSnap.exists()) {
        const dataset = generateInitialBuildingData();
        await setDoc(buildingDocRef, { rooms: dataset.rooms, rateConfigs: dataset.rateConfigs });
      }
    } catch (e) {
      console.error('Failed to initialize Firestore building data', e);
    }

    onSnapshot(buildingDocRef, (snap) => {
      const data = snap.data();
      if (data) {
        this.rooms = data.rooms || [];
        this.rateConfigs = data.rateConfigs || [];
        this.notifyListeners();
      }
    });

    onSnapshot(usageEntriesCollectionRef, (snap) => {
      this.usageEntries = snap.docs.map((d) => d.data() as UsageEntry);
      this.notifyListeners();
    });


  }

  public async resetToSeedData() {
    const dataset = generateInitialBuildingData();
    await setDoc(buildingDocRef, { rooms: dataset.rooms, rateConfigs: dataset.rateConfigs });

    const existingTenants = await getDocs(tenantsCollectionRef);
    await Promise.all(existingTenants.docs.map((d) => deleteDoc(d.ref)));

    const existingEntries = await getDocs(usageEntriesCollectionRef);
    await Promise.all(existingEntries.docs.map((d) => deleteDoc(d.ref)));
  }

  public subscribe(listener: () => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  private notifyListeners() {
    this.listeners.forEach((listener) => listener());
  }

  // Subscribes to tenants scoped to what this signed-in user is actually
  // allowed to list: admins get everyone, tenants get a query filtered to
  // their own email (an unfiltered list query would be rejected outright,
  // since Firestore can't prove every doc in it passes the per-tenant rule).
  public setAuthContext(role: 'admin' | 'tenant' | null, email: string | null) {
    if (this.tenantsUnsub) { this.tenantsUnsub(); this.tenantsUnsub = null; }
    if (this.invoicesUnsub) { this.invoicesUnsub(); this.invoicesUnsub = null; }
    if (this.paymentsUnsub) { this.paymentsUnsub(); this.paymentsUnsub = null; }

    if (!role || (role === 'tenant' && !email)) {
      this.tenants = [];
      this.invoices = [];
      this.payments = [];
      this.notifyListeners();
      return;
    }

    const tenantsQuery =
      role === 'admin'
        ? tenantsCollectionRef
        : query(tenantsCollectionRef, where('email', '==', email!.toLowerCase()));
    this.tenantsUnsub = onSnapshot(tenantsQuery, (snap) => {
      this.tenants = snap.docs.map((d) => d.data() as Tenant);
      this.notifyListeners();
    });

    // Building-wide financial data stays admin-only, both to prevent a
    // tenant seeing other rooms' invoices/payments, and to avoid syncing
    // data a tenant screen never needed in the first place.
    if (role === 'admin') {
      this.paymentsUnsub = onSnapshot(paymentsCollectionRef, (snap) => {
        this.payments = snap.docs.map((d) => {
          const data = d.data() as any;
          return {
            id: d.id,
            invoiceId: data.invoiceId,
            provider: data.provider,
            transactionId: data.transactionId,
            amount: data.amount,
            receivedAt: data.receivedAt ? data.receivedAt.toDate?.().toISOString() ?? String(data.receivedAt) : undefined,
          } as PaymentRecord;
        });
        this.notifyListeners();
      });
      this.invoicesUnsub = onSnapshot(invoicesCollectionRef, (snap) => {
        this.invoices = snap.docs.map((d) => {
          const data = d.data() as any;
          return {
            id: d.id,
            roomId: data.roomId,
            roomNumber: data.roomNumber,
            month: data.month,
            unitsUsed: data.unitsUsed,
            amount: data.amount,
            referenceCode: data.referenceCode,
            status: data.status,
            paidAt: data.paidAt ? data.paidAt.toDate?.().toISOString() ?? String(data.paidAt) : undefined,
            amountPaid: data.amountPaid,
          } as InvoiceRecord;
        });
        this.notifyListeners();
      });
    } else {
      this.invoices = [];
      this.payments = [];
    }
  }

  // --- Read Operations (from local cache, kept in sync via onSnapshot) ---
  public getRooms(): Room[] {
    return [...this.rooms];
  }

  public getTenants(): Tenant[] {
    return [...this.tenants];
  }

  public getUsageEntries(): UsageEntry[] {
    return [...this.usageEntries];
  }

  public getRateConfigs(): RateConfig[] {
    return [...this.rateConfigs];
  }

  public getPayments(): PaymentRecord[] {
    return [...this.payments].sort((a, b) => (b.receivedAt || '').localeCompare(a.receivedAt || ''));
  }

  public getInvoices(): InvoiceRecord[] {
    return [...this.invoices];
  }

  public getRoomById(roomId: string): Room | undefined {
    return this.rooms.find((r) => r.id === roomId);
  }

  public getTenantById(tenantId: string): Tenant | undefined {
    return this.tenants.find((t) => t.id === tenantId);
  }

  public getTenantForRoom(roomId: string): Tenant | undefined {
    return this.tenants.find((t) => t.roomId === roomId);
  }

  public getRoomUsageEntries(roomId: string): UsageEntry[] {
    return this.usageEntries.filter((e) => e.roomId === roomId);
  }

  // Full history for a tenant across room changes and time â€” survives room
  // turnover, so a returning tenant's old records stay reachable via their
  // tenantId even years later.
  public getTenantUsageHistory(tenantId: string): UsageEntry[] {
    return this.usageEntries
      .filter((e) => e.tenantId === tenantId)
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  public getUnseenPaymentsCount(): number {
    const lastSeen = localStorage.getItem('adminPaymentsLastSeen') || '';
    return this.payments.filter((p) => (p.receivedAt || '') > lastSeen).length;
  }

  public markPaymentsSeen(): void {
    localStorage.setItem('adminPaymentsLastSeen', new Date().toISOString());
  }

  public getRoomMonthlyStats(
    roomId: string,
    year: number,
    month: number
  ): MonthlyRoomStats | undefined {
    const room = this.getRoomById(roomId);
    if (!room) return undefined;
    const tenant = this.getTenantForRoom(roomId);
    const roomEntries = this.getRoomUsageEntries(roomId);
    return calculateRoomMonthlyStats(room, tenant, roomEntries, this.rateConfigs, year, month);
  }

  public getBuildingSummary(year?: number, month?: number): BuildingSummary {
    const curr = getCurrentYearMonth();
    const targetYear = year || curr.year;
    const targetMonth = month || curr.month;
    return calculateBuildingSummary(
      this.rooms,
      this.tenants,
      this.usageEntries,
      this.rateConfigs,
      targetYear,
      targetMonth
    );
  }

  // --- Write Operations (now async Firestore writes) ---
  public async saveUsageEntry(
    entry: Omit<UsageEntry, 'id' | 'createdAt'> & { id?: string }
  ): Promise<UsageEntry> {
    let savedEntry: UsageEntry;

    if (entry.id) {
      const existing = this.usageEntries.find((e) => e.id === entry.id);
      savedEntry = {
        ...(existing as UsageEntry),
        ...entry,
        id: entry.id,
        createdAt: existing?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await setDoc(doc(db, 'usageEntries', entry.id), savedEntry, { merge: true });
    } else {
      const newId = `entry-${entry.roomId}-${entry.date}-${entry.utilityType || 'electricity'}`;
      const currentTenant = this.getTenantForRoom(entry.roomId);
      savedEntry = {
        ...entry,
        tenantId: entry.tenantId ?? currentTenant?.id,
        id: newId,
        createdAt: new Date().toISOString(),
      };
      await setDoc(doc(db, 'usageEntries', newId), savedEntry);
    }

    return savedEntry;
  }

  public async deleteUsageEntry(entryId: string) {
    await deleteDoc(doc(db, 'usageEntries', entryId));
  }

  public async setRateConfig(config: Omit<RateConfig, 'id'> & { id?: string }) {
    let newRateConfigs = [...this.rateConfigs];
    const utility: UtilityType = config.utilityType || 'electricity';

    if (config.scope === 'building') {
      newRateConfigs = newRateConfigs.filter(
        (r) => !(r.scope === 'building' && (r.utilityType || 'electricity') === utility)
      );
      newRateConfigs.push({
        id: `rate-building-${utility}`,
        scope: 'building',
        utilityType: utility,
        ratePerUnit: config.ratePerUnit,
        effectiveFrom: config.effectiveFrom,
      });
    } else if (config.scope === 'floor' && config.floorNumber !== undefined) {
      newRateConfigs = newRateConfigs.filter(
        (r) =>
          !(
            r.scope === 'floor' &&
            r.floorNumber === config.floorNumber &&
            (r.utilityType || 'electricity') === utility
          )
      );
      newRateConfigs.push({
        id: `rate-floor-${config.floorNumber}-${utility}`,
        scope: 'floor',
        floorNumber: config.floorNumber,
        utilityType: utility,
        ratePerUnit: config.ratePerUnit,
        effectiveFrom: config.effectiveFrom,
      });
    }

    await setDoc(buildingDocRef, { rooms: this.rooms, rateConfigs: newRateConfigs });
  }

  public async assignTenantToRoom(
    roomId: string,
    tenantData: { name: string; phone: string; email: string; moveInDate: string }
  ): Promise<Tenant> {
    const room = this.getRoomById(roomId);
    if (!room) throw new Error('Room not found');

    // If room already has a tenant, vacate them first (move-out) instead of
    // silently orphaning their tenant record.
    const existingInRoom = this.tenants.filter((t) => t.roomId === roomId);
    await Promise.all(existingInRoom.map((t) => deleteDoc(doc(db, 'tenants', t.id))));

    const tenantId = tenantData.email.trim().toLowerCase();
    const newTenant: Tenant = {
      id: tenantId,
      name: tenantData.name,
      phone: tenantData.phone,
      email: tenantData.email.trim().toLowerCase(),
      roomId,
      floorNumber: room.floorNumber,
      moveInDate: tenantData.moveInDate,
      role: 'tenant',
    };

    const newRooms = this.rooms.map((r) => (r.id === roomId ? { ...r, tenantId } : r));

    await setDoc(doc(db, 'tenants', tenantId), newTenant);
    await setDoc(buildingDocRef, { rooms: newRooms, rateConfigs: this.rateConfigs });

    return newTenant;
  }

  // Edits an existing tenant's own details in place (name/phone/move-in date
  // only, never email) instead of delete+recreate, so their id -- and every
  // usage entry stamped with it -- stays intact.
  public async updateTenantProfile(
    tenantId: string,
    updates: { name: string; phone: string; moveInDate: string }
  ): Promise<void> {
    const existing = this.tenants.find((t) => t.id === tenantId);
    if (!existing) throw new Error('Tenant not found');
    const updated: Tenant = { ...existing, ...updates };
    await setDoc(doc(db, 'tenants', tenantId), updated);
  }

  public async vacateRoom(roomId: string): Promise<void> {
    const existingInRoom = this.tenants.filter((t) => t.roomId === roomId);
    await Promise.all(existingInRoom.map((t) => deleteDoc(doc(db, 'tenants', t.id))));
    const newRooms = this.rooms.map((r) => (r.id === roomId ? { ...r, tenantId: undefined } : r));

    await setDoc(buildingDocRef, { rooms: newRooms, rateConfigs: this.rateConfigs });
  }

  public async moveTenant(
    fromRoomId: string,
    toRoomId: string
  ): Promise<void> {
    const fromRoom = this.getRoomById(fromRoomId);
    const toRoom = this.getRoomById(toRoomId);
    if (!fromRoom || !toRoom) throw new Error('Room not found');
    if (!fromRoom.tenantId) throw new Error('No tenant in source room');
    if (toRoom.tenantId) throw new Error('Destination room already occupied');

    const tenant = this.getTenantById(fromRoom.tenantId);
    if (!tenant) throw new Error('Tenant record not found');

    const updatedTenant: Tenant = { ...tenant, roomId: toRoomId, floorNumber: toRoom.floorNumber };
    const newRooms = this.rooms.map((r) => {
      if (r.id === fromRoomId) return { ...r, tenantId: undefined };
      if (r.id === toRoomId) return { ...r, tenantId: tenant.id };
      return r;
    });

    await setDoc(doc(db, 'tenants', tenant.id), updatedTenant);
    await setDoc(buildingDocRef, { rooms: newRooms, rateConfigs: this.rateConfigs });
  }

  public async setRoomRateOverrides(
    roomId: string,
    overrides: Partial<Record<UtilityType, number>>
  ): Promise<void> {
    const newRooms = this.rooms.map((r) =>
      r.id === roomId ? { ...r, rateOverrides: overrides } : r
    );
    await setDoc(buildingDocRef, { rooms: newRooms, rateConfigs: this.rateConfigs });
  }
}

export const storageService = new StorageService();
