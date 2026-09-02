import {
  UsageEntry,
  RateConfig,
  MonthlyRoomStats,
  BalanceStatus,
  Room,
  Tenant,
  BuildingSummary,
  FloorSummary,
  FLOOR_NUMBERS,
} from '../domain/types';

export const DEFAULT_BUILDING_RATE = 350; // RWF per kWh

export function getEffectiveRate(
  room: Room,
  rateConfigs: RateConfig[]
): number {
  if (room.rateOverride !== undefined) {
    return room.rateOverride;
  }
  const floorConfig = rateConfigs.find(
    (rc) => rc.scope === 'floor' && rc.floorNumber === room.floorNumber
  );
  if (floorConfig) {
    return floorConfig.ratePerUnit;
  }
  const buildingConfig = rateConfigs.find((rc) => rc.scope === 'building');
  if (buildingConfig) {
    return buildingConfig.ratePerUnit;
  }
  return DEFAULT_BUILDING_RATE;
}

export function calculateRoomMonthlyStats(
  room: Room,
  tenant: Tenant | undefined,
  usageEntries: UsageEntry[],
  rateConfigs: RateConfig[],
  year: number,
  month: number
): MonthlyRoomStats {
  const yearMonthPrefix = `${year}-${month.toString().padStart(2, '0')}`;

  const roomMonthEntries = usageEntries.filter((entry) => {
    return entry.roomId === room.id && entry.date.startsWith(yearMonthPrefix);
  });

  const totalUnits = roomMonthEntries.reduce(
    (sum, entry) => sum + (entry.unitsUsed || 0),
    0
  );
  const totalPaid = roomMonthEntries.reduce(
    (sum, entry) => sum + (entry.amountPaid || 0),
    0
  );

  const appliedRate = getEffectiveRate(room, rateConfigs);
  const expectedCost = totalUnits * appliedRate;
  const balance = expectedCost - totalPaid;

  let status: BalanceStatus = 'no_usage';
  if (totalUnits > 0 || totalPaid > 0) {
    if (balance <= 0.01) {
      status = 'paid';
    } else if (totalPaid > 0) {
      status = 'partial';
    } else {
      status = 'overdue';
    }
  }

  return {
    roomId: room.id,
    roomNumber: room.roomNumber,
    tenantName: tenant ? tenant.name : 'Vacant Room',
    year,
    month,
    totalUnits,
    totalPaid,
    expectedCost,
    balance: Math.max(0, balance),
    status,
    daysLogged: roomMonthEntries.length,
    appliedRate,
  };
}

export function calculateBuildingSummary(
  rooms: Room[],
  tenants: Tenant[],
  usageEntries: UsageEntry[],
  rateConfigs: RateConfig[],
  year: number,
  month: number
): BuildingSummary {
  const tenantMap = new Map<string, Tenant>();
  tenants.forEach((t) => tenantMap.set(t.id, t));

  const perFloorSummaries: FloorSummary[] = [];

  let totalCollectedThisMonth = 0;
  let totalOutstandingThisMonth = 0;
  let totalUnitsThisMonth = 0;
  let paidRoomsCount = 0;
  let partialRoomsCount = 0;
  let overdueRoomsCount = 0;
  let occupiedCountAll = 0;

  for (const floorNum of FLOOR_NUMBERS) {
    const floorRooms = rooms.filter((r) => r.floorNumber === floorNum);
    let floorUnits = 0;
    let floorCollected = 0;
    let floorOutstanding = 0;
    let floorPaidCount = 0;
    let floorPartialCount = 0;
    let floorOverdueCount = 0;
    let floorOccupied = 0;

    const floorRate = getEffectiveRate(
      { id: '', roomNumber: '', floorNumber: floorNum },
      rateConfigs
    );

    floorRooms.forEach((room) => {
      const tenant = room.tenantId ? tenantMap.get(room.tenantId) : undefined;
      if (tenant) floorOccupied++;

      const stats = calculateRoomMonthlyStats(
        room,
        tenant,
        usageEntries,
        rateConfigs,
        year,
        month
      );

      floorUnits += stats.totalUnits;
      floorCollected += stats.totalPaid;
      floorOutstanding += stats.balance;

      if (stats.status === 'paid') floorPaidCount++;
      else if (stats.status === 'partial') floorPartialCount++;
      else if (stats.status === 'overdue') floorOverdueCount++;
    });

    totalCollectedThisMonth += floorCollected;
    totalOutstandingThisMonth += floorOutstanding;
    totalUnitsThisMonth += floorUnits;
    paidRoomsCount += floorPaidCount;
    partialRoomsCount += floorPartialCount;
    overdueRoomsCount += floorOverdueCount;
    occupiedCountAll += floorOccupied;

    perFloorSummaries.push({
      floorNumber: floorNum,
      totalRooms: floorRooms.length,
      occupiedRooms: floorOccupied,
      totalUnits: floorUnits,
      totalCollected: floorCollected,
      totalOutstanding: floorOutstanding,
      paidCount: floorPaidCount,
      partialCount: floorPartialCount,
      overdueCount: floorOverdueCount,
      ratePerUnit: floorRate,
    });
  }

  const buildingConfig = rateConfigs.find((rc) => rc.scope === 'building');
  const defaultRate = buildingConfig
    ? buildingConfig.ratePerUnit
    : DEFAULT_BUILDING_RATE;

  return {
    buildingName: 'Voltra Tower',
    totalFloors: FLOOR_NUMBERS.length,
    totalRooms: rooms.length,
    occupiedRooms: occupiedCountAll,
    totalCollectedThisMonth,
    totalOutstandingThisMonth,
    totalUnitsThisMonth,
    paidRoomsCount,
    partialRoomsCount,
    overdueRoomsCount,
    defaultRatePerUnit: defaultRate,
    perFloorSummaries,
  };
}
