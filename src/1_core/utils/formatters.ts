import { BillStatus } from '../domain/types';

export function formatCurrency(amount: number): string {
  return `${new Intl.NumberFormat('en-US').format(Math.round(amount || 0))} RWF`;
}

export function formatDateTime(iso?: string): string {
  if (!iso) return '--';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

export function formatDate(iso?: string): string {
  if (!iso) return '--';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
}

export function daysUntil(iso?: string): number | null {
  if (!iso) return null;
  const ms = new Date(iso).getTime() - Date.now();
  if (isNaN(ms)) return null;
  return Math.ceil(ms / (24 * 60 * 60 * 1000));
}

// Green means settled, amber means it needs someone, red means it is late or
// broken. Nothing else gets a colour.
export function statusTone(status: BillStatus, overdue: boolean): 'good' | 'warn' | 'bad' {
  if (status === 'paid') return 'good';
  if (overdue) return 'bad';
  if (status === 'awaiting_review' || status === 'partial') return 'warn';
  return 'warn';
}

export const TONE_CLASSES: Record<'good' | 'warn' | 'bad', string> = {
  good: 'bg-emerald-mid text-bone border-bone/30',
  warn: 'bg-gold text-emerald-dark border-emerald-dark/30',
  bad: 'bg-alert text-bone border-bone/30',
};

export function getStatusLabel(status: BillStatus, overdue: boolean): string {
  if (status === 'paid') return 'Paid';
  if (overdue) return 'OVERDUE';
  switch (status) {
    case 'awaiting_review': return 'Waiting for recovery';
    case 'partial': return 'Part paid';
    default: return 'Not paid';
  }
}
