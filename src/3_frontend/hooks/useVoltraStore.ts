import { useState, useEffect } from 'react';
import { storageService } from '../../2_backend/services/storageService';
import { getCurrentYearMonth } from '../../1_core/utils/dateUtils';
import { Role } from '../../1_core/domain/types';
import { auth } from '../../2_backend/services/firebaseConfig';
import { onAuthStateChanged, User } from 'firebase/auth';
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
    getInvoices: () => storageService.getInvoices(),
    getPayments: () => storageService.getPayments(),
    getUnseenPaymentsCount: () => storageService.getUnseenPaymentsCount(),
    markPaymentsSeen: () => storageService.markPaymentsSeen(),
    getTenants: () => storageService.getTenants(),
    getUsageEntries: () => storageService.getUsageEntries(),
    getRateConfigs: () => storageService.getRateConfigs(),
    getRoomById: (id: string) => storageService.getRoomById(id),
    getTenantForRoom: (roomId: string) => storageService.getTenantForRoom(roomId),
    getRoomUsageEntries: (roomId: string) => storageService.getRoomUsageEntries(roomId),
    getRoomMonthlyStats: (roomId: string, year: number, month: number) =>
      storageService.getRoomMonthlyStats(roomId, year, month),
    getBuildingSummary: (year?: number, month?: number) =>
      storageService.getBuildingSummary(year, month),
    saveUsageEntry: storageService.saveUsageEntry.bind(storageService),
    deleteUsageEntry: storageService.deleteUsageEntry.bind(storageService),
    setRateConfig: storageService.setRateConfig.bind(storageService),
    assignTenantToRoom: storageService.assignTenantToRoom.bind(storageService),
    updateTenantProfile: storageService.updateTenantProfile.bind(storageService),
    moveTenant: storageService.moveTenant.bind(storageService),
    vacateRoom: storageService.vacateRoom.bind(storageService),
    setRoomRateOverrides: storageService.setRoomRateOverrides.bind(storageService),
    resetToSeedData: storageService.resetToSeedData.bind(storageService),
  };
}

export interface AuthState {
  role: Role;
  activeRoomId: string;
  activeTenantName: string;
}

export function useAuthRole() {
  const [role, setRole] = useState<Role>('tenant');
  const [activeRoomId, setActiveRoomId] = useState<string>('room-1-1');
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [checkingAdmin, setCheckingAdmin] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user);
      if (!user) {
        setRole('tenant');
        return;
      }
      setCheckingAdmin(true);
      const admin = await isCurrentUserAdmin();
      setRole(admin ? 'admin' : 'tenant');
      setCheckingAdmin(false);
    });
    return unsub;
  }, []);

  useEffect(() => {
    if (checkingAdmin) return;
    storageService.setAuthContext(firebaseUser ? role : null, firebaseUser?.email || null);
  }, [role, firebaseUser, checkingAdmin]);
  const setTenantRoom = (roomId: string) => {
    setActiveRoomId(roomId);
  };

  return {
    role,
    activeRoomId,
    firebaseUser,
    checkingAdmin,
    setActiveRoomId,
    setTenantRoom,
  };
}

