export type Role = 'tenant' | 'admin';

// What a room is billed for. A room may have any combination -- some have a
// cash power meter and no water meter, some are rent only.
export type ServiceType = 'electricity' | 'water' | 'rent';

export const SERVICE_TYPES: ServiceType[] = ['electricity', 'water', 'rent'];

export const SERVICE_LABELS: Record<ServiceType, string> = {
  electricity: 'Cash power',
  water: 'Water',
  rent: 'Rent',
};

// Rent is a flat charge; the other two are metered, so only they ask for a
// reading.
export function serviceHasMeter(service: ServiceType): boolean {
  return service === 'electricity' || service === 'water';
}

export interface Room {
  id: string;               // document id, the slug of the room number at creation
  roomKey: string;          // normalised room number, used to find the room on login
  roomNumber: string;       // exactly as typed; the admin can rename this freely
  tenantName: string;
  tenantPhone?: string;
  hasElectricity: boolean;  // each service is optional and set per room
  hasWater: boolean;
  hasRent: boolean;
  tenantUid: string;        // Firebase anonymous auth uid of the claiming tenant
  active: boolean;          // false once admin frees the room
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

export type SubmissionStatus = 'pending' | 'paid' | 'partial';

export interface Submission {
  id: string;
  roomId: string;
  roomNumber: string;
  tenantName: string;
  tenantUid: string;            // who filed it
  serviceType: ServiceType;     // what this payment is for
  meterReading?: string;        // free text -- meters are not in any fixed sequence
  cashPowerReading?: string;    // legacy field, still read for older records
  amountReported: number;       // what the tenant says they paid
  note?: string;
  screenshotPath?: string;      // Firebase Storage path
  screenshotExpiresAt?: string; // createdAt + 14 days, for cleanup
  screenshotDeleted?: boolean;  // true once the photo is gone, record stays
  status: SubmissionStatus;
  amountConfirmed?: number;     // admin's figure -- lower than reported means partial
  adminNote?: string;
  reviewedBy?: string;
  reviewedAt?: string;
  createdAt: string;
  updatedAt?: string;
}

// Records written before services existed are all cash power, and kept their
// reading under the old field name.
export function submissionService(submission: Submission): ServiceType {
  return submission.serviceType || 'electricity';
}

export function submissionReading(submission: Submission): string | undefined {
  return submission.meterReading || submission.cashPowerReading || undefined;
}

export type NotificationType = 'submission_created' | 'free_tier_warning';

export interface AppNotification {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  read: boolean;
  createdAt: string;
  // Present on submission_created only, so the admin can jump to the tenant.
  roomId?: string;
  roomNumber?: string;
  tenantName?: string;
  submissionId?: string;
  amountReported?: number;
  serviceType?: ServiceType;
}

// The room number as typed is display only; this is what login matches on, so
// "12 B", "12b" and "12-B" all find the same room. Must stay identical to the
// copy in functions/index.js.
export function normalizeRoomKey(roomNumber: string): string {
  return String(roomNumber).trim().toLowerCase().replace(/[^a-z0-9]/g, '');
}
