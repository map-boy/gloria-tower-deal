import {
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  collection,
  query,
  where,
  orderBy,
} from 'firebase/firestore';
import {
  ref as storageRef,
  uploadBytes,
  getDownloadURL,
} from 'firebase/storage';
import { db, storage } from './firebaseConfig';
import { Room, ServiceType, Submission, normalizeRoomKey } from '../../1_core/domain/types';

const roomsCollectionRef = collection(db, 'rooms');
const submissionsCollectionRef = collection(db, 'submissions');

const SCREENSHOT_LIFETIME_DAYS = 14;

export class StorageService {
  private rooms: Room[] = [];
  private submissions: Submission[] = [];
  private roomsUnsub: (() => void) | null = null;
  private submissionsUnsub: (() => void) | null = null;
  private singleRoomUnsub: (() => void) | null = null;
  private listeners: Array<() => void> = [];

  public subscribe(listener: () => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  private notifyListeners() {
    this.listeners.forEach((listener) => listener());
  }

  // Admin sees every room + every submission. A tenant only ever needs their
  // own room doc and their own submissions -- scoping the subscriptions here
  // keeps a tenant's browser from ever holding another tenant's data.
  public setAuthContext(
    role: 'admin' | 'tenant' | null,
    roomId: string | null,
    uid: string | null = null
  ) {
    if (this.roomsUnsub) { this.roomsUnsub(); this.roomsUnsub = null; }
    if (this.submissionsUnsub) { this.submissionsUnsub(); this.submissionsUnsub = null; }
    if (this.singleRoomUnsub) { this.singleRoomUnsub(); this.singleRoomUnsub = null; }

    this.rooms = [];
    this.submissions = [];

    if (role === 'admin') {
      this.roomsUnsub = onSnapshot(roomsCollectionRef, (snap) => {
        this.rooms = snap.docs.map((d) => d.data() as Room);
        this.notifyListeners();
      });
      const q = query(submissionsCollectionRef, orderBy('createdAt', 'desc'));
      this.submissionsUnsub = onSnapshot(q, (snap) => {
        this.submissions = snap.docs.map((d) => d.data() as Submission);
        this.notifyListeners();
      });
    } else if (role === 'tenant' && roomId && uid) {
      this.singleRoomUnsub = onSnapshot(doc(db, 'rooms', roomId), (snap) => {
        this.rooms = snap.exists() ? [snap.data() as Room] : [];
        this.notifyListeners();
      });
      // Scoped by room, not by browser identity: a tenant who logs back in
      // from a new phone gets a fresh uid, and their history has to follow the
      // room rather than the device.
      const q = query(submissionsCollectionRef, where('roomId', '==', roomId));
      this.submissionsUnsub = onSnapshot(q, (snap) => {
        this.submissions = snap.docs.map((d) => d.data() as Submission);
        this.notifyListeners();
      });
    } else {
      this.notifyListeners();
    }
  }

  // --- Reads (from local cache, kept in sync via onSnapshot) ---
  public getRooms(): Room[] {
    return [...this.rooms].sort((a, b) =>
      a.roomNumber.localeCompare(b.roomNumber, undefined, { numeric: true })
    );
  }

  public getRoomById(roomId: string): Room | undefined {
    return this.rooms.find((r) => r.id === roomId);
  }

  public getSubmissions(): Submission[] {
    return [...this.submissions].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  public getSubmissionsForRoom(roomId: string): Submission[] {
    return this.submissions
      .filter((s) => s.roomId === roomId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  public getSubmissionById(submissionId: string): Submission | undefined {
    return this.submissions.find((s) => s.id === submissionId);
  }

  // --- Writes ---

  public async uploadPaymentScreenshot(roomId: string, file: File): Promise<string> {
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const path = `paymentScreenshots/${roomId}/${Date.now()}-${safeName}`;
    const fileRef = storageRef(storage, path);
    await uploadBytes(fileRef, file);
    return path;
  }

  public async getScreenshotUrl(path: string): Promise<string> {
    return getDownloadURL(storageRef(storage, path));
  }

  public async createSubmission(input: {
    roomId: string;
    roomNumber: string;
    tenantName: string;
    tenantUid: string;
    serviceType: ServiceType;
    meterReading?: string;
    amountReported: number;
    note?: string;
    screenshotPath?: string;
  }): Promise<Submission> {
    const id = `sub-${input.roomId}-${Date.now()}`;
    const createdAt = new Date().toISOString();
    const expiresAt = new Date(
      Date.now() + SCREENSHOT_LIFETIME_DAYS * 24 * 60 * 60 * 1000
    ).toISOString();

    const submission: Submission = {
      id,
      roomId: input.roomId,
      roomNumber: input.roomNumber,
      tenantName: input.tenantName,
      tenantUid: input.tenantUid,
      serviceType: input.serviceType,
      meterReading: input.meterReading,
      amountReported: input.amountReported,
      note: input.note,
      screenshotPath: input.screenshotPath,
      screenshotExpiresAt: input.screenshotPath ? expiresAt : undefined,
      screenshotDeleted: false,
      status: 'pending',
      createdAt,
    };

    await setDoc(doc(db, 'submissions', id), submission);
    return submission;
  }

  // Admin marks a submission paid, or partial with the figure actually
  // received, and can correct anything the tenant typed on the way through --
  // a wrong meter reading, a mistyped amount, a note. One write, one record.
  public async reviewSubmission(
    submissionId: string,
    reviewedBy: string,
    updates: Partial<
      Pick<
        Submission,
        'status' | 'amountConfirmed' | 'amountReported' | 'cashPowerReading' | 'note' | 'adminNote'
      >
    >
  ): Promise<void> {
    const now = new Date().toISOString();
    await updateDoc(doc(db, 'submissions', submissionId), {
      ...updates,
      reviewedBy,
      reviewedAt: now,
      updatedAt: now,
    });
  }

  public async deleteSubmission(submissionId: string): Promise<void> {
    await deleteDoc(doc(db, 'submissions', submissionId));
  }

  // Admin-only edits to a room's own fields. Renaming a room has to move its
  // roomKey too, or the tenant could no longer find the room when logging in.
  public async updateRoom(
    roomId: string,
    updates: Partial<
      Pick<
        Room,
        | 'roomNumber'
        | 'tenantName'
        | 'tenantPhone'
        | 'hasElectricity'
        | 'hasWater'
        | 'hasRent'
        | 'active'
      >
    >
  ): Promise<void> {
    const patch: Record<string, unknown> = { ...updates, updatedAt: new Date().toISOString() };
    if (updates.roomNumber !== undefined) {
      patch.roomKey = normalizeRoomKey(updates.roomNumber);
    }
    await updateDoc(doc(db, 'rooms', roomId), patch);
  }

  // Frees a room that's showing as taken but shouldn't be (tenant moved out,
  // mistaken claim) so someone new can claim that room number again.
  public async freeRoom(roomId: string): Promise<void> {
    await updateDoc(doc(db, 'rooms', roomId), {
      active: false,
      updatedAt: new Date().toISOString(),
    });
  }
}

export const storageService = new StorageService();
