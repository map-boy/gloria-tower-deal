export type Role = 'tenant' | 'admin';

export const FLOOR_NUMBERS: number[] = [-1, 0, 1, 2, 3, 4, 5, 6, 7, 8];
export const ROOMS_PER_FLOOR = 200;
export const TOTAL_ROOMS = FLOOR_NUMBERS.length * ROOMS_PER_FLOOR;

export type UtilityType = 'electricity' | 'water' | 'rent';

export interface Tenant {
  id: string;
  name: string;
  phone: string;
  email: string;
  roomId: string;
  floorNumber: number;
  moveInDate: string;
  role: Role;
}

export interface Room {
  id: string;
  roomNumber: string;
  floorNumber: number;
  tenantId?: string;
  tenant?: Tenant;
  rateOverride?: number;
}

export interface UsageEntry {
  id: string;
  roomId: string;
  tenantId?: string;
  date: string;
  utilityType?: UtilityType;
  unitsUsed: number;
  amountPaid: number;
  note?: string;
  createdBy: string;
  createdAt: string;
  updatedAt?: string;
}

export interface RateConfig {
  id: string;
  scope: 'building' | 'floor';
  floorNumber?: number;
  utilityType?: UtilityType;
  ratePerUnit: number;
  effectiveFrom: string;
}

export type BalanceStatus = 'paid' | 'partial' | 'overdue' | 'no_usage';

export interface MonthlyRoomStats {
  roomId: string;
  roomNumber: string;
  tenantName: string;
  year: number;
  month: number;
  totalUnits: number;
  totalPaid: number;
  expectedCost: number;
  balance: number;
  status: BalanceStatus;
  daysLogged: number;
  appliedRate: number;
}

export interface FloorSummary {
  floorNumber: number;
  totalRooms: number;
  occupiedRooms: number;
  totalUnits: number;
  totalCollected: number;
  totalOutstanding: number;
  paidCount: number;
  partialCount: number;
  overdueCount: number;
  ratePerUnit: number;
}

export interface BuildingSummary {
  buildingName: string;
  totalFloors: number;
  totalRooms: number;
  occupiedRooms: number;
  totalCollectedThisMonth: number;
  totalOutstandingThisMonth: number;
  totalUnitsThisMonth: number;
  paidRoomsCount: number;
  partialRoomsCount: number;
  overdueRoomsCount: number;
  defaultRatePerUnit: number;
  perFloorSummaries: FloorSummary[];
}
