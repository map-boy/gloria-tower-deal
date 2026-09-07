import { SubmissionStatus } from '../domain/types';

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'RWF',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function getStatusLabel(status: SubmissionStatus): string {
  switch (status) {
    case 'paid':
      return 'Paid';
    case 'partial':
      return 'Partial Payment';
    case 'pending':
      return 'Awaiting Review';
  }
}

export function getStatusBadgeStyle(status: SubmissionStatus): {
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
    case 'pending':
      return {
        bg: 'bg-neutral-200',
        text: 'text-neutral-700',
        border: 'border-neutral-400',
      };
  }
}
export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function daysUntil(iso?: string): number | null {
  if (!iso) return null;
  const ms = new Date(iso).getTime() - Date.now();
  if (isNaN(ms)) return null;
  return Math.max(0, Math.ceil(ms / (24 * 60 * 60 * 1000)));
}
