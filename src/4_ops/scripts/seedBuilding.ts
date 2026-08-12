import { Room, Tenant, UsageEntry, RateConfig } from '../../1_core/domain/types';
import { formatRoomNumber } from '../../1_core/utils/formatters';
import { formatDateString, getCurrentYearMonth, getDaysInMonth } from '../../1_core/utils/dateUtils';

const FIRST_NAMES = [
  'Alex', 'Jordan', 'Taylor', 'Morgan', 'Sam', 'Chris', 'Pat', 'Riley', 'Casey', 'Avery',
  'Devon', 'Jesse', 'Dakota', 'Skyler', 'Reese', 'Rowan', 'Hayden', 'Finley', 'Emerson', 'Peyton',
  'Liam', 'Emma', 'Noah', 'Olivia', 'Ethan', 'Ava', 'Sophia', 'Lucas', 'Mia', 'Jackson',
  'Evelyn', 'Harper', 'Benjamin', 'Amelia', 'James', 'Ella', 'Alexander', 'Sofia', 'Henry', 'Camila'
];

const LAST_NAMES = [
  'Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez',
  'Hernandez', 'Lopez', 'Gonzalez', 'Wilson', 'Anderson', 'Thomas', 'Taylor', 'Moore', 'Jackson', 'Martin',
  'Lee', 'Perez', 'Thompson', 'White', 'Harris', 'Sanchez', 'Clark', 'Ramirez', 'Lewis', 'Robinson',
  'Walker', 'Young', 'Allen', 'King', 'Wright', 'Scott', 'Torres', 'Nguyen', 'Hill', 'Flores'
];

function getRandomItem<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function getRandomPhone(): string {
  const p1 = Math.floor(100 + Math.random() * 900);
  const p2 = Math.floor(100 + Math.random() * 900);
  const p3 = Math.floor(1000 + Math.random() * 9000);
  return `+1 (${p1}) ${p2}-${p3}`;
}

export interface InitialBuildingDataset {
  rooms: Room[];
  tenants: Tenant[];
  usageEntries: UsageEntry[];
  rateConfigs: RateConfig[];
}

export function generateInitialBuildingData(): InitialBuildingDataset {
  const rooms: Room[] = [];
  const tenants: Tenant[] = [];
  const usageEntries: UsageEntry[] = [];

  const defaultRateConfig: RateConfig = {
    id: 'rate-building-default',
    scope: 'building',
    ratePerUnit: 0.25, // $0.25 / kWh
    effectiveFrom: '2026-01-01',
  };

  const rateConfigs: RateConfig[] = [defaultRateConfig];

  const { year, month } = getCurrentYearMonth();
  const prevMonth = month === 1 ? 12 : month - 1;
  const prevYear = month === 1 ? year - 1 : year;

  // Generate 8 floors x 200 rooms = 1,600 rooms total
  let tenantCount = 0;

  for (let floorNum = 1; floorNum <= 8; floorNum++) {
    for (let roomIdx = 1; roomIdx <= 200; roomIdx++) {
      const roomNumber = formatRoomNumber(floorNum, roomIdx);
      const roomId = `room-${floorNum}-${roomIdx}`;

      // Occupy ~85% of rooms
      const isOccupied = (floorNum * 200 + roomIdx) % 100 < 85;

      let tenantId: string | undefined = undefined;

      if (isOccupied) {
        tenantCount++;
        tenantId = `tenant-${tenantCount}`;
        const firstName = getRandomItem(FIRST_NAMES);
        const lastName = getRandomItem(LAST_NAMES);
        const name = `${firstName} ${lastName}`;
        const moveInMonth = Math.floor(Math.random() * 12) + 1;
        const moveInDay = Math.floor(Math.random() * 28) + 1;
        const moveInYear = 2024 + Math.floor(Math.random() * 2);

        tenants.push({
          id: tenantId,
          name,
          phone: getRandomPhone(),
          email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}@voltratower.com`,
          roomId,
          floorNumber: floorNum,
          moveInDate: formatDateString(moveInYear, moveInMonth, moveInDay),
          role: 'tenant',
        });
      }

      rooms.push({
        id: roomId,
        roomNumber,
        floorNumber: floorNum,
        tenantId,
      });

      // Generate seed entries for demo rooms (first 10 rooms of each floor)
      if (tenantId && roomIdx <= 15) {
        // Seed current month days up to today or day 12
        const daysInCurrMonth = Math.min(14, getDaysInMonth(year, month));
        const rate = 0.25;

        for (let day = 1; day <= daysInCurrMonth; day++) {
          // 80% chance day has entry logged
          if ((roomIdx + day) % 5 !== 0) {
            const unitsUsed = Number((8 + (Math.sin(day + roomIdx) * 6 + Math.random() * 4)).toFixed(1));
            // Decide payment behavior: 60% paid in full, 25% partial, 15% unpaid
            const cost = unitsUsed * rate;
            let amountPaid = 0;
            const behavior = (day + roomIdx) % 3;

            if (behavior === 0) {
              amountPaid = Number(cost.toFixed(2)); // Paid in full
            } else if (behavior === 1) {
              amountPaid = Number((cost * 0.5).toFixed(2)); // Partial
            } else {
              amountPaid = 0; // Overdue
            }

            const notes = [
              'Daily reading verified',
              'Auto meter log',
              'Partial payment at desk',
              'Regular usage',
              'AC high usage day',
            ];

            usageEntries.push({
              id: `entry-${roomId}-${year}-${month}-${day}`,
              roomId,
              date: formatDateString(year, month, day),
              unitsUsed,
              amountPaid,
              note: notes[day % notes.length],
              createdBy: 'tenant',
              createdAt: new Date(year, month - 1, day, 10, 0, 0).toISOString(),
            });
          }
        }

        // Also seed previous month entries
        const daysInPrev = 10;
        for (let day = 1; day <= daysInPrev; day++) {
          const unitsUsed = Number((10 + Math.random() * 5).toFixed(1));
          const amountPaid = Number((unitsUsed * rate).toFixed(2));
          usageEntries.push({
            id: `entry-${roomId}-${prevYear}-${prevMonth}-${day}`,
            roomId,
            date: formatDateString(prevYear, prevMonth, day),
            unitsUsed,
            amountPaid,
            note: 'Monthly clear',
            createdBy: 'tenant',
            createdAt: new Date(prevYear, prevMonth - 1, day, 9, 30, 0).toISOString(),
          });
        }
      }
    }
  }

  return {
    rooms,
    tenants,
    usageEntries,
    rateConfigs,
  };
}
