import { Rates, ServiceType } from '../domain/types';

// Days a client gets to pay once a bill is raised, and the day the second
// reminder goes out. Two reminders inside the window, as agreed.
export const PAYMENT_WINDOW_DAYS = 5;
export const SECOND_REMINDER_DAY = 3;

export function unitPriceFor(service: ServiceType, rates: Rates): number {
  switch (service) {
    case 'electricity':
      return rates.electricityPerUnit;
    case 'water':
      return rates.waterPerUnit;
    case 'rent':
      return rates.rentAmount;
  }
}

// Metered services bill the units consumed since the last reading. Rent is a
// flat monthly charge, so its "units" are always 1.
export function unitsUsed(
  service: ServiceType,
  previousReading: number,
  currentReading: number
): number {
  if (service === 'rent') return 1;
  const used = currentReading - previousReading;
  return used > 0 ? used : 0;
}

export function amountDue(
  service: ServiceType,
  previousReading: number,
  currentReading: number,
  rates: Rates
): number {
  const units = unitsUsed(service, previousReading, currentReading);
  const price = unitPriceFor(service, rates);
  // Money is whole francs; half-francs would never reconcile against what a
  // client actually sends.
  return Math.round(units * price);
}

export function dueDateFrom(issuedAtIso: string): string {
  const d = new Date(issuedAtIso);
  d.setDate(d.getDate() + PAYMENT_WINDOW_DAYS);
  return d.toISOString();
}

export function secondReminderDateFrom(issuedAtIso: string): string {
  const d = new Date(issuedAtIso);
  d.setDate(d.getDate() + SECOND_REMINDER_DAY);
  return d.toISOString();
}

export function daysUntilDue(dueDateIso: string, now: Date = new Date()): number {
  const ms = new Date(dueDateIso).getTime() - now.getTime();
  return Math.ceil(ms / (24 * 60 * 60 * 1000));
}

export function isOverdue(
  dueDateIso: string,
  status: string,
  now: Date = new Date()
): boolean {
  if (status === 'paid') return false;
  return new Date(dueDateIso).getTime() < now.getTime();
}

// A reading that goes backwards means the meter was misread or replaced, and
// billing it as a huge negative (or as zero, silently) would hide a mistake
// the technician needs to fix.
export function readingIsSane(
  service: ServiceType,
  previousReading: number,
  currentReading: number
): { ok: boolean; reason?: string } {
  if (service === 'rent') return { ok: true };
  if (!Number.isFinite(currentReading)) {
    return { ok: false, reason: 'Reading must be a number.' };
  }
  if (currentReading < 0) {
    return { ok: false, reason: 'Reading cannot be negative.' };
  }
  if (currentReading < previousReading) {
    return {
      ok: false,
      reason: `New reading (${currentReading}) is lower than the last one (${previousReading}). Check the meter.`,
    };
  }
  return { ok: true };
}
