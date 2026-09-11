import React, { useEffect, useState } from 'react';
import { DEFAULT_RATES, Rates, Room } from './1_core/domain/types';
import { signOutUser } from './2_backend/services/authService';
import { watchRates, watchRoom } from './2_backend/services/dataService';
import {
  listenForForegroundMessages, registerForNotifications,
} from './2_backend/services/notificationService';
import { LoginScreen } from './3_frontend/components/LoginScreen';
import { AdminPortal } from './3_frontend/portals/AdminPortal';
import { ClientPortal } from './3_frontend/portals/ClientPortal';
import { RecoveryPortal } from './3_frontend/portals/RecoveryPortal';
import { TechnicianPortal } from './3_frontend/portals/TechnicianPortal';
import { useSession } from './3_frontend/hooks/useSession';

export default function App() {
  const session = useSession();
  const [rates, setRates] = useState<Rates>(DEFAULT_RATES);
  const [room, setRoom] = useState<Room | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const isStaff = !!session.staffRole;
  const isClient = !isStaff && !!session.client;

  // Prices are readable by anyone signed in -- a client has to see the rate
  // their own bill came from.
  useEffect(() => {
    if (!session.ready) return;
    return watchRates(setRates);
  }, [session.ready]);

  useEffect(() => {
    if (!isClient || !session.client) {
      setRoom(null);
      return;
    }
    // If the room is gone or this device lost it, end the session rather than
    // leave the client staring at a loading screen forever.
    return watchRoom(session.client.roomId, setRoom, () => {
      session.clearClientSession();
      setRoom(null);
    });
  }, [isClient, session.client?.roomId]);

  useEffect(() => {
    if (!session.staffRole) return;
    registerForNotifications(session.staffRole);
    return listenForForegroundMessages((title, body) => setToast(`${title} — ${body}`));
  }, [session.staffRole]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 6000);
    return () => clearTimeout(t);
  }, [toast]);

  const logout = async () => {
    session.clearClientSession();
    if (session.user && !session.user.isAnonymous) await signOutUser();
  };

  if (!session.ready) {
    return (
      <div className="min-h-screen bg-emerald-dark text-bone flex items-center justify-center text-sm">
        Loading...
      </div>
    );
  }

  const banner = toast && (
    <div className="fixed top-3 left-1/2 -translate-x-1/2 z-[60] bg-gold text-emerald-dark text-xs font-bold px-4 py-3 rounded-xl max-w-sm">
      {toast}
    </div>
  );

  if (session.staffRole === 'admin') {
    return <>{banner}<AdminPortal email={session.email} rates={rates} onLogout={logout} /></>;
  }
  if (session.staffRole === 'recovery') {
    return <>{banner}<RecoveryPortal email={session.email} rates={rates} onLogout={logout} /></>;
  }
  if (session.staffRole === 'technician') {
    return <>{banner}<TechnicianPortal email={session.email} rates={rates} onLogout={logout} /></>;
  }

  if (isClient) {
    if (!room) {
      return (
        <div className="min-h-screen bg-emerald-dark text-bone flex items-center justify-center text-sm">
          Loading your room...
        </div>
      );
    }
    return <ClientPortal room={room} rates={rates} onLogout={logout} />;
  }

  return (
    <LoginScreen
      onClientIn={session.startClientSession}
      signedInEmail={session.email}
      notStaff={!!session.user && !session.user.isAnonymous && !session.staffRole}
      onSignOut={logout}
    />
  );
}
