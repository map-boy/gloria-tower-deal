import { doc, getDoc, getDocs, setDoc, deleteDoc, onSnapshot, collection } from 'firebase/firestore';
import { db } from './firebaseConfig';
import { Room, Tenant, UsageEntry, RateConfig, BuildingSummary, MonthlyRoomStats } from '../../1_core/domain/types';
import { generateInitialBuildingData } from '../../4_ops/scripts/seedBuilding';
import { calculateBuildingSummary, calculateRoomMonthlyStats } from '../../1_core/algorithms/balance';
import { getCurrentYearMonth } from '../../1_core/utils/dateUtils';

const buildingDocRef = doc(db, 'voltraTower', 'building');
const tenantsDocRef = doc(db, 'voltraTower', 'tenants');
const usageEntriesCollectionRef = collection(db, 'usageEntries');

export class StorageService {
  private rooms: Room[] = [];
  private tenants: Tenant[] = [];
  private usageEntries: UsageEntry[] = [];
  private rateConfigs: RateConfig[] = [];
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
        await setDoc(tenantsDocRef, { list: dataset.tenants });
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

    onSnapshot(tenantsDocRef, (snap) => {
      const data = snap.data();
      if (data) {
        this.tenants = data.list || [];
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
    await setDoc(tenantsDocRef, { list: dataset.tenants });

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

  public getRoomById(roomId: string): Room | undefined {
    return this.rooms.find((r) => r.id === roomId);
  }

  public getTenantById(tenantId: string): Tenant | undefined {
    return this.tenants.find((t) => t.id === tenantId);
  }

  public getTenantForRoom(roomId: string): Tenant | undefined {
    const room = this.getRoomById(roomId);
    if (!room || !room.tenantId) return undefined;
    return this.getTenantById(room.tenantId);
  }

  public getRoomUsageEntries(roomId: string): UsageEntry[] {
    return this.usageEntries.filter((e) => e.roomId === roomId);
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
      const newId = `entry-${entry.roomId}-${entry.date}`;
      savedEntry = {
        ...entry,
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

    if (config.scope === 'building') {
      newRateConfigs = newRateConfigs.filter((r) => r.scope !== 'building');
      newRateConfigs.push({
        id: 'rate-building-default',
        scope: 'building',
        ratePerUnit: config.ratePerUnit,
        effectiveFrom: config.effectiveFrom,
      });
    } else if (config.scope === 'floor' && config.floorNumber !== undefined) {
      newRateConfigs = newRateConfigs.filter(
        (r) => !(r.scope === 'floor' && r.floorNumber === config.floorNumber)
      );
      newRateConfigs.push({
        id: `rate-floor-${config.floorNumber}`,
        scope: 'floor',
        floorNumber: config.floorNumber,
        ratePerUnit: config.ratePerUnit,
        effectiveFrom: config.effectiveFrom,
      });
    }

    await setDoc(buildingDocRef, { rooms: this.rooms, rateConfigs: newRateConfigs });
  }

  public async assignTenantToRoom(
    roomId: string,
    tenantData: { name: string; phone: string; moveInDate: string }
  ): Promise<Tenant> {
    const room = this.getRoomById(roomId);
    if (!room) throw new Error('Room not found');

    const tenantId = `tenant-custom-${Date.now()}`;
    const newTenant: Tenant = {
      id: tenantId,
      name: tenantData.name,
      phone: tenantData.phone,
      email: `${tenantData.name.toLowerCase().replace(/\s+/g, '.')}@voltratower.com`,
      roomId,
      floorNumber: room.floorNumber,
      moveInDate: tenantData.moveInDate,
      role: 'tenant',
    };

    const newTenants = [...this.tenants, newTenant];
    const newRooms = this.rooms.map((r) => (r.id === roomId ? { ...r, tenantId } : r));

    await setDoc(tenantsDocRef, { list: newTenants });
    await setDoc(buildingDocRef, { rooms: newRooms, rateConfigs: this.rateConfigs });

    return newTenant;
  }
}

export const storageService = new StorageService();
