export type Role = 'tenant' | 'admin';

export interface Tenant {
  id: string;
  name: string;
  phone: string;
  email: string;
  roomId: string;
  floorNumber: number;
  moveInDate: string; // YYYY-MM-DD
  role: Role;
}

export interface Room {
  id: string;
  roomNumber: string; // e.g. "F3-114"
  floorNumber: number; // 1-8
  tenantId?: string;
  tenant?: Tenant;
  rateOverride?: number; // per floor or per room rate override
}

export interface UsageEntry {
  id: string;
  roomId: string;
  date: string; // YYYY-MM-DD
  unitsUsed: number; // kWh
  amountPaid: number; // local currency $
  note?: string;
  createdBy: string; // "tenant" | "admin" | tenant name
  createdAt: string; // ISO string
  updatedAt?: string;
}

export interface RateConfig {
  id: string;
  scope: 'building' | 'floor';
  floorNumber?: number; // null if scope is building
  ratePerUnit: number; // e.g. 0.25 ($/kWh)
  effectiveFrom: string; // YYYY-MM-DD
}

export type BalanceStatus = 'paid' | 'partial' | 'overdue' | 'no_usage';

export interface MonthlyRoomStats {
  roomId: string;
  roomNumber: string;
  tenantName: string;
  year: number;
  month: number; // 1-12
  totalUnits: number; // total kWh
  totalPaid: number; // total $ paid
  expectedCost: number; // total units * rate
  balance: number; // expectedCost - totalPaid
  status: BalanceStatus;
  daysLogged: number;
  appliedRate: number; // $/kWh
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
