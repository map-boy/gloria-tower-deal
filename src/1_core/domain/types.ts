export type Role = 'tenant' | 'admin';

export interface Room {
  id: string;              // slug of roomNumber, e.g. "12b"
  roomNumber: string;      // exactly as the tenant typed it
  tenantName: string;
  tenantPhone?: string;
  hasElectricity: boolean; // set once, when the tenant first joins
  tenantUid: string;        // Firebase anonymous auth uid of the claiming tenant
  active: boolean;         // false once admin frees the room
  createdAt: string;
}

export type SubmissionStatus = 'pending' | 'paid' | 'partial';

export interface Submission {
  id: string;
  roomId: string;
  roomNumber: string;
  tenantName: string;
  cashPowerReading?: string;    // free text, only when room.hasElectricity
  amountReported: number;       // what the tenant says they paid
  note?: string;
  screenshotPath?: string;      // Firebase Storage path
  screenshotExpiresAt?: string; // createdAt + 14 days, for cleanup
  screenshotDeleted?: boolean;
  status: SubmissionStatus;
  amountConfirmed?: number;     // admin's figure if different (partial)
  reviewedBy?: string;
  reviewedAt?: string;
  createdAt: string;
}

export interface AppNotification {
  id: string;
  type: 'submission_created';
  roomId: string;
  roomNumber: string;
  tenantName: string;
  submissionId: string;
  read: boolean;
  createdAt: string;
}