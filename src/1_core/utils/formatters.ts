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