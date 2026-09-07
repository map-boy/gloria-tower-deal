export type Role = 'tenant' | 'admin';

export interface Room {
  id: string;               // slug of roomNumber, e.g. "12b"
  roomNumber: string;       // exactly as the tenant typed it
  tenantName: string;
  tenantPhone?: string;
  hasElectricity: boolean;  // optional per room -- some rooms have no cash power meter
  tenantUid: string;        // Firebase anonymous auth uid of the claiming tenant
  active: boolean;          // false once admin frees the room
  createdAt: string;
  updatedAt?: string;
}

export type SubmissionStatus = 'pending' | 'paid' | 'partial';

export interface Submission {
  id: string;
  roomId: string;
  roomNumber: string;
  tenantName: string;
  tenantUid: string;            // who filed it; rules key tenant reads off this
  cashPowerReading?: string;    // free text -- meters are not in any fixed sequence
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

export interface AppNotification {
  id: string;
  type: 'submission_created';
  roomId: string;
  roomNumber: string;
  tenantName: string;
  submissionId: string;
  amountReported?: number;
  cashPowerReading?: string;
  read: boolean;
  createdAt: string;
}
