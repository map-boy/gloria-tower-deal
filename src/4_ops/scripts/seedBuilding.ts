import { Room, Tenant, UsageEntry, RateConfig, FLOOR_NUMBERS, ROOMS_PER_FLOOR } from '../../1_core/domain/types';
import { formatRoomNumber } from '../../1_core/utils/formatters';

export interface InitialBuildingDataset {
  rooms: Room[];
  tenants: Tenant[];
  usageEntries: UsageEntry[];
  rateConfigs: RateConfig[];
}

// Generates the empty building shell only: 10 floors (Basement, Ground, 1-8)
// x 200 rooms = 2,000 rooms, no tenants and no usage history. Admins assign
// real tenants to rooms from the dashboard, and tenants log their own daily
// usage from their calendar. Nothing here is placeholder/demo data.
export function generateInitialBuildingData(): InitialBuildingDataset {
  const rooms: Room[] = [];
  const tenants: Tenant[] = [];
  const usageEntries: UsageEntry[] = [];

  const defaultRateConfig: RateConfig = {
    id: 'rate-building-default',
    scope: 'building',
    utilityType: 'electricity',
    ratePerUnit: 350, // RWF per kWh - adjust from Admin > Rate settings
    effectiveFrom: '2026-01-01',
  };
  const rateConfigs: RateConfig[] = [defaultRateConfig];

  for (const floorNum of FLOOR_NUMBERS) {
    for (let roomIdx = 1; roomIdx <= ROOMS_PER_FLOOR; roomIdx++) {
      const roomNumber = formatRoomNumber(floorNum, roomIdx);
      const roomId = `room-${floorNum}-${roomIdx}`;
      rooms.push({
        id: roomId,
        roomNumber,
        floorNumber: floorNum,
        tenantId: undefined,
      });
    }
  }

  return {
    rooms,
    tenants,
    usageEntries,
    rateConfigs,
  };
}
