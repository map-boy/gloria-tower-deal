import { useState, useEffect } from 'react';
import { storageService } from '../../2_backend/services/storageService';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth } from '../../2_backend/services/firebaseConfig';
import { isCurrentUserAdmin } from '../../2_backend/services/authService';

export function useVoltraStore() {
  const [dataVersion, setDataVersion] = useState(0);
  useEffect(() => {
    const unsubscribe = storageService.subscribe(() => {
      setDataVersion((v) => v + 1);
    });
    return unsubscribe;
  }, []);
  return {
    dataVersion,
    getRooms: () => storageService.getRooms(),
    getRoomById: (id: string) => storageService.getRoomById(id),
    getSubmissions: () => storageService.getSubmissions(),
    getSubmissionsForRoom: (roomId: string) => storageService.getSubmissionsForRoom(roomId),
    getSubmissionById: (id: string) => storageService.getSubmissionById(id),
    createSubmission: storageService.createSubmission.bind(storageService),
    reviewSubmission: storageService.reviewSubmission.bind(storageService),
    deleteSubmission: storageService.deleteSubmission.bind(storageService),
    updateRoom: storageService.updateRoom.bind(storageService),
    freeRoom: storageService.freeRoom.bind(storageService),
    uploadPaymentScreenshot: storageService.uploadPaymentScreenshot.bind(storageService),
    getScreenshotUrl: storageService.getScreenshotUrl.bind(storageService),
  };
}

export function useAuthRole() {
  const [role, setRole] = useState<'admin' | 'tenant' | null>(null);
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [checkingAdmin, setCheckingAdmin] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user);
      if (!user || user.isAnonymous) {
        setRole(null);
        setCheckingAdmin(false);
        return;
      }
      setCheckingAdmin(true);
      const admin = await isCurrentUserAdmin();
      setRole(admin ? 'admin' : null);
      setCheckingAdmin(false);
    });
    return unsub;
  }, []);

  return { role, firebaseUser, checkingAdmin };
}
