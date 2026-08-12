import { Room, Tenant, UsageEntry, RateConfig } from '../../1_core/domain/types';
import { formatRoomNumber } from '../../1_core/utils/formatters';

export interface InitialBuildingDataset {
  rooms: Room[];
  tenants: Tenant[];
  usageEntries: UsageEntry[];
  rateConfigs: RateConfig[];
}

// Generates the empty building shell only: 8 floors x 200 rooms = 1,600
// rooms, no tenants and no usage history. Admins assign real tenants to
// rooms from the dashboard, and tenants log their own daily usage from
// their calendar. Nothing here is placeholder/demo data.
export function generateInitialBuildingData(): InitialBuildingDataset {
  const rooms: Room[] = [];
  const tenants: Tenant[] = [];
  const usageEntries: UsageEntry[] = [];

  const defaultRateConfig: RateConfig = {
    id: 'rate-building-default',
    scope: 'building',
    ratePerUnit: 350, // RWF per kWh - adjust from Admin > Rate settings
    effectiveFrom: '2026-01-01',
  };

  const rateConfigs: RateConfig[] = [defaultRateConfig];

  for (let floorNum = 1; floorNum <= 8; floorNum++) {
    for (let roomIdx = 1; roomIdx <= 200; roomIdx++) {
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