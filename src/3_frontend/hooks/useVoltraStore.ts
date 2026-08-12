import { useState, useEffect } from 'react';
import { storageService } from '../../2_backend/services/storageService';
import { getCurrentYearMonth } from '../../1_core/utils/dateUtils';
import { Role } from '../../1_core/domain/types';

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
    resetToSeedData: storageService.resetToSeedData.bind(storageService),
  };
}

export interface AuthState {
  role: Role;
  activeRoomId: string; // Defaults to F3-114 e.g. room-3-14
  activeTenantName: string;
}

export function useAuthRole() {
  const [role, setRole] = useState<Role>('tenant');
  const [activeRoomId, setActiveRoomId] = useState<string>('room-3-14');

  const setTenantRoom = (roomId: string) => {
    setActiveRoomId(roomId);
    setRole('tenant');
  };

  const setAdmin = () => {
    setRole('admin');
  };

  return {
    role,
    activeRoomId,
    setRole,
    setActiveRoomId,
    setTenantRoom,
    setAdmin,
  };
}
