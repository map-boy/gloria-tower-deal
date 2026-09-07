import { getFunctions, httpsCallable } from 'firebase/functions';
import { signInAnonymously } from 'firebase/auth';
import { auth, firebaseApp } from './firebaseConfig';
import { Room } from '../../1_core/domain/types';

const functions = getFunctions(firebaseApp);

export class RoomTakenError extends Error {
  constructor() {
    super('This room is already claimed by another tenant. Please talk to the admin.');
    this.name = 'RoomTakenError';
  }
}

export interface ClaimRoomInput {
  roomNumber: string;
  tenantName: string;
  tenantPhone?: string;
  hasElectricity: boolean;
}

export interface ClaimRoomResult {
  room: Room;
}

export async function claimRoom(data: ClaimRoomInput): Promise<ClaimRoomResult> {
  if (!auth.currentUser) {
    await signInAnonymously(auth);
  }
  const call = httpsCallable<ClaimRoomInput, ClaimRoomResult>(functions, 'claimRoom');
  try {
    const result = await call(data);
    return result.data;
  } catch (e: any) {
    if (e?.code === 'functions/already-exists') {
      throw new RoomTakenError();
    }
    throw e;
  }
}