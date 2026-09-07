import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AppNotification, Submission, SubmissionStatus, Room } from './1_core/domain/types';
import { storageService } from './2_backend/services/storageService';
import { useVoltraStore, useAuthRole } from './3_frontend/hooks/useVoltraStore';
import { useAccessGate } from './3_frontend/hooks/useAccessGate';
import { signInWithGoogle, signOutUser } from './2_backend/services/authService';
import {
  registerForNotifications,
  listenForForegroundMessages,
  subscribeToNotifications,
  markNotificationRead,
} from './2_backend/services/notificationService';
import { RoomEntryForm } from './3_frontend/components/RoomEntryForm';
import { TenantHome } from './3_frontend/components/TenantHome';
import { AdminDashboard } from './3_frontend/components/AdminDashboard';

export default function App() {
  const gate = useAccessGate();
  const { role: authRole, firebaseUser, checkingAdmin } = useAuthRole();
  const store = useVoltraStore();

  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const [focusSubmission, setFocusSubmission] = useState<Submission | null>(null);
  const [signingIn, setSigningIn] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const isAdmin = authRole === 'admin';
  const isTenant = !isAdmin && gate.role === 'tenant' && !!gate.roomId;
  const effectiveRole: 'admin' | 'tenant' | null = isAdmin ? 'admin' : isTenant ? 'tenant' : null;

  // Point the data layer at exactly what this person is allowed to see.
  useEffect(() => {
    if (!gate.authReady) return;
    storageService.setAuthContext(effectiveRole, isAdmin ? null : gate.roomId, gate.uid);
  }, [gate.authReady, gate.uid, gate.roomId, effectiveRole, isAdmin]);

  // Admin-only: the bell feed, plus a push when the app is in the background.
  useEffect(() => {
    if (!isAdmin) {
      setNotifications([]);
      return;
    }
    const unsubNotifications = subscribeToNotifications(setNotifications);
    registerForNotifications('admin');
    const unsubMessages = listenForForegroundMessages((title, body) =>
      setToast(`${title} — ${body}`)
    );
    return () => {
      unsubNotifications();
      unsubMessages();
    };
  }, [isAdmin]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 6000);
    return () => clearTimeout(t);
  }, [toast]);

  const rooms = useMemo(() => store.getRooms(), [store.dataVersion]);
  const submissions = useMemo(() => store.getSubmissions(), [store.dataVersion]);

  const getScreenshotUrl = useCallback(
    (path: string) => storageService.getScreenshotUrl(path),
    []
  );

  // --- Tenant actions ---

  const tenantRoom = isTenant ? rooms.find((r) => r.id === gate.roomId) : undefined;

  const handleTenantSubmit = useCallback(
    async (input: {
      cashPowerReading?: string;
      amountReported: number;
      note?: string;
      screenshotPath?: string;
    }) => {
      if (!tenantRoom || !gate.uid) return;
      await store.createSubmission({
        roomId: tenantRoom.id,
        roomNumber: tenantRoom.roomNumber,
        tenantName: tenantRoom.tenantName,
        tenantUid: gate.uid,
        ...input,
      });
    },
    [tenantRoom, gate.uid, store]
  );

  const handleUploadScreenshot = useCallback(
    (file: File) => {
      if (!tenantRoom) throw new Error('No room');
      return store.uploadPaymentScreenshot(tenantRoom.id, file);
    },
    [tenantRoom, store]
  );

  // --- Admin actions ---

  const handleOpenNotification = useCallback(
    (n: AppNotification) => {
      if (!n.read) markNotificationRead(n.id).catch(() => undefined);
      setSelectedRoomId(n.roomId);
      const submission = storageService.getSubmissionById(n.submissionId);
      if (submission) setFocusSubmission(submission);
    },
    []
  );

  const handleSaveReview = useCallback(
    async (
      submissionId: string,
      updates: {
        status: SubmissionStatus;
        amountConfirmed: number;
        amountReported: number;
        cashPowerReading?: string;
        adminNote?: string;
      }
    ) => {
      await store.reviewSubmission(submissionId, firebaseUser?.email || 'admin', {
        status: updates.status,
        amountConfirmed: updates.amountConfirmed,
        amountReported: updates.amountReported,
        cashPowerReading: updates.cashPowerReading ?? '',
        adminNote: updates.adminNote ?? '',
      });
    },
    [store, firebaseUser]
  );

  const handleSaveRoom = useCallback(
    (
      roomId: string,
      updates: Partial<Pick<Room, 'roomNumber' | 'tenantName' | 'tenantPhone' | 'hasElectricity' | 'active'>>
    ) => store.updateRoom(roomId, updates),
    [store]
  );

  const handleAdminSignIn = async () => {
    setSigningIn(true);
    try {
      await signInWithGoogle();
    } finally {
      setSigningIn(false);
    }
  };

  const handleLogout = useCallback(async () => {
    setSelectedRoomId(null);
    setFocusSubmission(null);
    gate.logout();
    if (firebaseUser && !firebaseUser.isAnonymous) {
      await signOutUser();
    }
  }, [gate, firebaseUser]);

  // --- Screens ---

  if (!gate.authReady || checkingAdmin) {
    return (
      <div className="min-h-screen bg-neutral-200 flex items-center justify-center font-mono text-black text-sm">
        Loading...
      </div>
    );
  }

  if (isAdmin) {
    return (
      <>
        {toast && (
          <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[60] bg-black text-white font-mono text-xs px-4 py-3 rounded-xl border-2 border-black max-w-sm">
            {toast}
          </div>
        )}
        <AdminDashboard
          rooms={rooms}
          submissions={submissions}
          notifications={notifications}
          adminLabel={firebaseUser?.email || 'admin'}
          getScreenshotUrl={getScreenshotUrl}
          onOpenNotification={handleOpenNotification}
          onSaveReview={handleSaveReview}
          onDeleteSubmission={store.deleteSubmission}
          onSaveRoom={handleSaveRoom}
          onFreeRoom={store.freeRoom}
          selectedRoomId={selectedRoomId}
          onSelectRoom={setSelectedRoomId}
          focusSubmission={
            focusSubmission
              ? storageService.getSubmissionById(focusSubmission.id) ?? focusSubmission
              : null
          }
          onClearFocusSubmission={() => setFocusSubmission(null)}
          onLogout={handleLogout}
        />
      </>
    );
  }

  if (isTenant) {
    if (!tenantRoom) {
      return (
        <div className="min-h-screen bg-neutral-200 flex items-center justify-center font-mono text-black text-sm">
          Loading your room...
        </div>
      );
    }
    return (
      <TenantHome
        room={tenantRoom}
        submissions={submissions}
        onUploadScreenshot={handleUploadScreenshot}
        onSubmit={handleTenantSubmit}
        getScreenshotUrl={getScreenshotUrl}
        onLogout={handleLogout}
      />
    );
  }

  const signedInNotAdmin = !!firebaseUser && !firebaseUser.isAnonymous;

  return (
    <div className="relative">
      <RoomEntryForm onSubmit={gate.enterRoom} />
      <div className="fixed bottom-4 left-0 right-0 flex flex-col items-center gap-2 px-4">
        {signedInNotAdmin && (
          <p className="font-mono text-[11px] text-red-600 bg-white border-2 border-black rounded-xl px-3 py-2 text-center">
            {firebaseUser?.email} is not an admin on this building.
          </p>
        )}
        <button
          onClick={signedInNotAdmin ? handleLogout : handleAdminSignIn}
          disabled={signingIn}
          className="px-4 py-2 bg-white hover:bg-neutral-100 disabled:opacity-50 border-2 border-black rounded-xl font-mono font-bold text-xs text-black cursor-pointer"
        >
          {signingIn ? 'Opening...' : signedInNotAdmin ? 'Sign out' : 'I am the admin'}
        </button>
      </div>
    </div>
  );
}
