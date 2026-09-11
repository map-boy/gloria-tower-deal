// --- Roles -------------------------------------------------------------
// Four portals, four jobs. Staff roles are granted by email and take effect
// the first time that person signs in with Google. Clients never sign in
// with Google -- they enter with their room number, phone and password.
export type StaffRole = 'admin' | 'recovery' | 'technician';
export type Role = StaffRole | 'client';

export const STAFF_ROLES: StaffRole[] = ['admin', 'recovery', 'technician'];

export const ROLE_LABELS: Record<Role, string> = {
  admin: 'Admin',
  recovery: 'Recovery agent',
  technician: 'Technician',
  client: 'Client',
};

export interface StaffMember {
  email: string;
  role: StaffRole;
  builtIn: boolean;     // built-in owners cannot be removed from the app
  addedBy?: string;
  addedAt?: string;
}

// --- Services and rates ------------------------------------------------
export type ServiceType = 'electricity' | 'water' | 'rent';

export const SERVICE_TYPES: ServiceType[] = ['electricity', 'water', 'rent'];

export const SERVICE_LABELS: Record<ServiceType, string> = {
  electricity: 'Electricity',
  water: 'Water',
  rent: 'Rent',
};

export function serviceHasMeter(service: ServiceType): boolean {
  return service === 'electricity' || service === 'water';
}

// Set by the recovery agent. One price list for the whole building.
export interface Rates {
  electricityPerUnit: number;
  waterPerUnit: number;
  rentAmount: number;
  updatedBy?: string;
  updatedAt?: string;
}

export const DEFAULT_RATES: Rates = {
  electricityPerUnit: 0,
  waterPerUnit: 0,
  rentAmount: 0,
};

// --- Rooms and clients -------------------------------------------------
export interface Room {
  id: string;
  roomKey: string;          // normalised room number, used to find the room at login
  roomNumber: string;       // as typed; staff can rename freely
  tenantName: string;
  tenantPhone: string;
  hasElectricity: boolean;
  hasWater: boolean;
  hasRent: boolean;
  // Meter readings at the moment the technician registered the room. Every
  // first bill is measured from these.
  startElectricityReading: number;
  startWaterReading: number;
  tenantUid?: string;       // set when the client first claims the room
  active: boolean;
  registeredBy?: string;    // technician email
  createdAt: string;
  updatedAt?: string;
}

export function roomServices(room: Room): ServiceType[] {
  const services: ServiceType[] = [];
  if (room.hasElectricity) services.push('electricity');
  if (room.hasWater) services.push('water');
  if (room.hasRent) services.push('rent');
  return services;
}

// --- Bills -------------------------------------------------------------
// A technician's reading turns straight into a bill using the current rates,
// so the client sees what they owe without anyone doing sums by hand.
export type BillStatus = 'unpaid' | 'awaiting_review' | 'partial' | 'paid';

export const BILL_STATUS_LABELS: Record<BillStatus, string> = {
  unpaid: 'Not paid',
  awaiting_review: 'Waiting for recovery',
  partial: 'Part paid',
  paid: 'Paid',
};

export interface Bill {
  id: string;
  roomId: string;
  roomNumber: string;
  tenantName: string;
  tenantPhone: string;
  serviceType: ServiceType;

  previousReading: number;
  currentReading: number;
  unitsUsed: number;
  unitPrice: number;        // the rate at the moment of billing, frozen here
  amountDue: number;
  amountPaid: number;

  status: BillStatus;
  issuedAt: string;
  dueDate: string;          // issuedAt + 5 days
  secondReminderAt: string; // issuedAt + 3 days
  firstReminderSentAt?: string;
  secondReminderSentAt?: string;

  readingBy?: string;       // technician email
  note?: string;

  // Proof of payment, sent by the client.
  proofPath?: string;
  proofExpiresAt?: string;  // uploaded + 7 days
  proofDeleted?: boolean;
  proofSubmittedAt?: string;
  proofNote?: string;
  amountReported?: number;  // what the client says they sent
  proofDownloadedAt?: string; // set when recovery downloads it

  reviewedBy?: string;
  reviewedAt?: string;
  recoveryNote?: string;

  createdAt: string;
  updatedAt?: string;
}

// --- Client questions --------------------------------------------------
// A flat thread per room. Clients ask, recovery answers, admin reads it all.
export interface Message {
  id: string;
  roomId: string;
  roomNumber: string;
  tenantName: string;
  text: string;
  authorRole: Role;
  authorLabel: string;      // email for staff, tenant name for clients
  readByStaff: boolean;
  readByClient: boolean;
  createdAt: string;
}

// --- Notifications -----------------------------------------------------
export type NotificationType =
  | 'bill_issued'
  | 'payment_reminder'
  | 'proof_submitted'
  | 'question_asked'
  | 'overdue'
  | 'free_tier_warning'
  | 'system_alert';

// Who should see a given alert. Clients get theirs by SMS and in their own
// portal; staff alerts land in the bell.
export type NotificationAudience = 'recovery' | 'admin' | 'all_staff';

export interface AppNotification {
  id: string;
  type: NotificationType;
  audience: NotificationAudience;
  title: string;
  body: string;
  severity: 'info' | 'warning' | 'critical';
  read: boolean;
  createdAt: string;
  roomId?: string;
  roomNumber?: string;
  billId?: string;
}

// --- System health (the watchdog) --------------------------------------
export interface HealthReport {
  id: string;
  checkedAt: string;
  ok: boolean;
  functionErrors: number;
  storageBytes: number;
  storageRatio: number;
  billingEnabled: boolean;
  notes: string[];
}

// --- Shared helpers ----------------------------------------------------
// Must stay identical to normalizeRoomKey in functions/index.js.
export function normalizeRoomKey(roomNumber: string): string {
  return String(roomNumber).trim().toLowerCase().replace(/[^a-z0-9]/g, '');
}

export function normalizePhone(phone: string): string {
  const digits = String(phone || '').replace(/\D/g, '');
  return digits.length > 9 ? digits.slice(-9) : digits;
}
