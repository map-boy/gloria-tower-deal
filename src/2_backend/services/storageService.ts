import { Room, Tenant, UsageEntry, RateConfig, BuildingSummary, MonthlyRoomStats } from '../../1_core/domain/types';
import { generateInitialBuildingData } from '../../4_ops/scripts/seedBuilding';
import { calculateBuildingSummary, calculateRoomMonthlyStats, getEffectiveRate } from '../../1_core/algorithms/balance';
import { getCurrentYearMonth } from '../../1_core/utils/dateUtils';

const STORAGE_KEY_ROOMS = 'voltra_tower_rooms_v1';
const STORAGE_KEY_TENANTS = 'voltra_tower_tenants_v1';
const STORAGE_KEY_ENTRIES = 'voltra_tower_entries_v1';
const STORAGE_KEY_RATES = 'voltra_tower_rates_v1';

export class StorageService {
  private rooms: Room[] = [];
  private tenants: Tenant[] = [];
  private usageEntries: UsageEntry[] = [];
  private rateConfigs: RateConfig[] = [];
  private listeners: Array<() => void> = [];

  constructor() {
    this.loadFromStorage();
  }

  private loadFromStorage() {
    try {
      const storedRooms = localStorage.getItem(STORAGE_KEY_ROOMS);
      const storedTenants = localStorage.getItem(STORAGE_KEY_TENANTS);
      const storedEntries = localStorage.getItem(STORAGE_KEY_ENTRIES);
      const storedRates = localStorage.getItem(STORAGE_KEY_RATES);

      if (storedRooms && storedTenants && storedEntries && storedRates) {
        this.rooms = JSON.parse(storedRooms);
        this.tenants = JSON.parse(storedTenants);
        this.usageEntries = JSON.parse(storedEntries);
        this.rateConfigs = JSON.parse(storedRates);
        return;
      }
    } catch (e) {
      console.error('Failed to load from localStorage, initializing fresh data', e);
    }

    // Initialize with seed data
    this.resetToSeedData();
  }

  public resetToSeedData() {
    const dataset = generateInitialBuildingData();
    this.rooms = dataset.rooms;
    this.tenants = dataset.tenants;
    this.usageEntries = dataset.usageEntries;
    this.rateConfigs = dataset.rateConfigs;
    this.saveToStorage();
    this.notifyListeners();
  }

  private saveToStorage() {
    try {
      localStorage.setItem(STORAGE_KEY_ROOMS, JSON.stringify(this.rooms));
      localStorage.setItem(STORAGE_KEY_TENANTS, JSON.stringify(this.tenants));
      localStorage.setItem(STORAGE_KEY_ENTRIES, JSON.stringify(this.usageEntries));
      localStorage.setItem(STORAGE_KEY_RATES, JSON.stringify(this.rateConfigs));
    } catch (e) {
      console.error('Failed to save to localStorage', e);
    }
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

  // --- Read Operations ---
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

  // --- Write Operations ---
  public saveUsageEntry(entry: Omit<UsageEntry, 'id' | 'createdAt'> & { id?: string }): UsageEntry {
    let savedEntry: UsageEntry;

    if (entry.id) {
      // Update existing
      const index = this.usageEntries.findIndex((e) => e.id === entry.id);
      if (index !== -1) {
        savedEntry = {
          ...this.usageEntries[index],
          ...entry,
          id: entry.id,
          updatedAt: new Date().toISOString(),
        };
        this.usageEntries[index] = savedEntry;
      } else {
        savedEntry = {
          ...entry,
          id: entry.id,
          createdAt: new Date().toISOString(),
        };
        this.usageEntries.push(savedEntry);
      }
    } else {
      // Create new
      const newId = `entry-${entry.roomId}-${entry.date}`;
      // Remove any existing entry for that same date and room
      this.usageEntries = this.usageEntries.filter(
        (e) => !(e.roomId === entry.roomId && e.date === entry.date)
      );

      savedEntry = {
        ...entry,
        id: newId,
        createdAt: new Date().toISOString(),
      };
      this.usageEntries.push(savedEntry);
    }

    this.saveToStorage();
    this.notifyListeners();
    return savedEntry;
  }

  public deleteUsageEntry(entryId: string) {
    this.usageEntries = this.usageEntries.filter((e) => e.id !== entryId);
    this.saveToStorage();
    this.notifyListeners();
  }

  public setRateConfig(config: Omit<RateConfig, 'id'> & { id?: string }) {
    if (config.scope === 'building') {
      // Remove previous building rate
      this.rateConfigs = this.rateConfigs.filter((r) => r.scope !== 'building');
      this.rateConfigs.push({
        id: 'rate-building-default',
        scope: 'building',
        ratePerUnit: config.ratePerUnit,
        effectiveFrom: config.effectiveFrom,
      });
    } else if (config.scope === 'floor' && config.floorNumber !== undefined) {
      this.rateConfigs = this.rateConfigs.filter(
        (r) => !(r.scope === 'floor' && r.floorNumber === config.floorNumber)
      );
      this.rateConfigs.push({
        id: `rate-floor-${config.floorNumber}`,
        scope: 'floor',
        floorNumber: config.floorNumber,
        ratePerUnit: config.ratePerUnit,
        effectiveFrom: config.effectiveFrom,
      });
    }
    this.saveToStorage();
    this.notifyListeners();
  }

  public assignTenantToRoom(roomId: string, tenantData: { name: string; phone: string; moveInDate: string }): Tenant {
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

    this.tenants.push(newTenant);
    room.tenantId = tenantId;

    this.saveToStorage();
    this.notifyListeners();
    return newTenant;
  }
}

export const storageService = new StorageService();
