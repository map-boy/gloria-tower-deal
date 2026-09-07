import {
  doc,
  setDoc,
  updateDoc,
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
import { Room, Submission, SubmissionStatus } from '../../1_core/domain/types';

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

  // Admin sees every room + every submission (rules require isAdmin() for
  // an unfiltered list query). A tenant only ever needs their own room doc
  // and the submissions tied to it -- scoping the subscriptions here keeps
  // a tenant's browser from ever holding another tenant's data in memory.
  public setAuthContext(role: 'admin' | 'tenant' | null, roomId: string | null) {
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
    } else if (role === 'tenant' && roomId) {
      this.singleRoomUnsub = onSnapshot(doc(db, 'rooms', roomId), (snap) => {
        this.rooms = snap.exists() ? [snap.data() as Room] : [];
        this.notifyListeners();
      });
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
    return [...this.rooms];
  }

  public getRoomById(roomId: string): Room | undefined {
    return this.rooms.find((r) => r.id === roomId);
  }

  public getSubmissions(): Submission[] {
    return [...this.submissions];
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
    const path = `paymentScreenshots/${roomId}/${Date.now()}-${file.name}`;
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
    cashPowerReading?: string;
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
      cashPowerReading: input.cashPowerReading,
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

  public async reviewSubmission(
    submissionId: string,
    status: SubmissionStatus,
    amountConfirmed: number,
    reviewedBy: string
  ): Promise<void> {
    await updateDoc(doc(db, 'submissions', submissionId), {
      status,
      amountConfirmed,
      reviewedBy,
      reviewedAt: new Date().toISOString(),
    });
  }

  // Admin-only edits to a room's own fields (name typo, phone, electricity flag).
  public async updateRoom(
    roomId: string,
    updates: Partial<Pick<Room, 'tenantName' | 'tenantPhone' | 'hasElectricity'>>
  ): Promise<void> {
    await updateDoc(doc(db, 'rooms', roomId), updates);
  }

  // Frees a room that's showing as taken but shouldn't be (tenant moved out,
  // mistaken claim, etc.) so someone new can claim that room number again.
  public async freeRoom(roomId: string): Promise<void> {
    await updateDoc(doc(db, 'rooms', roomId), { active: false });
  }
}

export const storageService = new StorageService();