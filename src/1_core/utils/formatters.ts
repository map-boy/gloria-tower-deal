import { BalanceStatus } from '../domain/types';

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'RWF',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatKwh(units: number): string {
  return `${units.toFixed(1)} kWh`;
}

// Floor numbering: -1 = Basement, 0 = Ground, 1-8 = upper floors (10 floors total)
export function getFloorLabel(floorNumber: number): string {
  if (floorNumber === -1) return 'Basement';
  if (floorNumber === 0) return 'Ground';
  return `Floor ${floorNumber}`;
}

export function getFloorCode(floorNumber: number): string {
  if (floorNumber === -1) return 'B';
  if (floorNumber === 0) return 'G';
  return `F${floorNumber}`;
}

export function formatRoomNumber(floorNumber: number, roomIndex: number): string {
  const padded = roomIndex.toString().padStart(3, '0');
  return `${getFloorCode(floorNumber)}-${padded}`;
}

export function getStatusLabel(status: BalanceStatus): string {
  switch (status) {
    case 'paid':
      return 'Paid in Full';
    case 'partial':
      return 'Partial Payment';
    case 'overdue':
      return 'Overdue Balance';
    case 'no_usage':
      return 'No Usage Logged';
  }
}

export function getStatusBadgeStyle(status: BalanceStatus): {
  bg: string;
  text: string;
  border: string;
} {
  switch (status) {
    case 'paid':
      return {
        bg: 'bg-neutral-800',
        text: 'text-white',
        border: 'border-black',
      };
    case 'partial':
      return {
        bg: 'bg-neutral-400',
        text: 'text-black',
        border: 'border-black',
      };
    case 'overdue':
      return {
        bg: 'bg-black',
        text: 'text-white',
        border: 'border-black',
      };
    case 'no_usage':
      return {
        bg: 'bg-neutral-200',
        text: 'text-neutral-700',
        border: 'border-neutral-400',
      };
  }
}
