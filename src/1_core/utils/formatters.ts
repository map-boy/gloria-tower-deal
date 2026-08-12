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

export function formatRoomNumber(floorNumber: number, roomIndex: number): string {
  // roomIndex 1 to 200 on floor
  const padded = roomIndex.toString().padStart(3, '0');
  return `F${floorNumber}-${padded}`;
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
        bg: 'bg-[#2ed573]',
        text: 'text-black',
        border: 'border-black',
      };
    case 'partial':
      return {
        bg: 'bg-[#feca57]',
        text: 'text-black',
        border: 'border-black',
      };
    case 'overdue':
      return {
        bg: 'bg-[#ff6b6b]',
        text: 'text-black',
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