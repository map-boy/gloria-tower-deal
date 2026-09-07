import React, { useMemo, useState } from 'react';
import {
  Room,
  SERVICE_LABELS,
  ServiceType,
  Submission,
  roomServices,
  submissionReading,
  submissionService,
} from '../../1_core/domain/types';
import { formatCurrency } from '../../1_core/utils/formatters';
import { StatPill } from './StatPill';
import { SubmissionCard } from './SubmissionCard';
import { SubmissionModal } from './SubmissionModal';
import { TopBar } from './TopBar';

interface TenantHomeProps {
  room: Room;
  submissions: Submission[];
  onUploadScreenshot: (file: File) => Promise<string>;
  onSubmit: (input: {
    serviceType: ServiceType;
    meterReading?: string;
    amountReported: number;
    note?: string;
    screenshotPath?: string;
  }) => Promise<void>;
  getScreenshotUrl: (path: string) => Promise<string>;
  onLogout: () => void;
}

// Everything a tenant sees is their own room and their own submissions --
// no other room, no building totals, no admin controls.
export const TenantHome: React.FC<TenantHomeProps> = ({
  room,
  submissions,
  onUploadScreenshot,
  onSubmit,
  getScreenshotUrl,
  onLogout,
}) => {
  const [modalOpen, setModalOpen] = useState(false);

  const totals = useMemo(() => {
    const confirmed = submissions.reduce((sum, s) => sum + (s.amountConfirmed ?? 0), 0);
    const pending = submissions.filter((s) => s.status === 'pending').length;
    const partial = submissions.filter((s) => s.status === 'partial').length;
    return { confirmed, pending, partial };
  }, [submissions]);

  const services = roomServices(room);

  // Latest reading per service, so a tenant can check what they last sent.
  const lastReadings = services
    .map((service) => {
      const latest = submissions.find(
        (s) => submissionService(s) === service && submissionReading(s)
      );
      return latest ? { service, reading: submissionReading(latest)! } : null;
    })
    .filter((x): x is { service: ServiceType; reading: string } => x !== null);

  return (
    <div className="min-h-screen bg-neutral-200 font-mono text-black p-4 sm:p-6">
      <div className="max-w-2xl mx-auto">
        <TopBar
          title={`Room ${room.roomNumber}`}
          subtitle={room.tenantName}
          role="tenant"
          onLogout={onLogout}
        />

        <div className="grid grid-cols-2 gap-2 mb-5">
          <StatPill value={formatCurrency(totals.confirmed)} label="Confirmed by admin" />
          <StatPill value={totals.pending} label="Waiting for review" />
        </div>

        <div className="bg-white border-2 border-black rounded-xl p-4 mb-5 space-y-3">
          <div className="font-serif font-black text-base">Your details</div>
          <dl className="grid grid-cols-2 gap-y-2 text-xs">
            <dt className="text-[10px] uppercase text-neutral-500">Room</dt>
            <dd className="font-bold">{room.roomNumber}</dd>
            <dt className="text-[10px] uppercase text-neutral-500">Name</dt>
            <dd className="font-bold break-all">{room.tenantName}</dd>
            {room.tenantPhone && (
              <>
                <dt className="text-[10px] uppercase text-neutral-500">Phone</dt>
                <dd className="font-bold">{room.tenantPhone}</dd>
              </>
            )}
          </dl>

          <div>
            <div className="text-[10px] uppercase text-neutral-500 mb-1">
              What you are included for
            </div>
            {services.length === 0 ? (
              <p className="text-[11px] text-neutral-600">
                Nothing set yet. Ask the admin what this room pays for.
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {services.map((s) => (
                  <span
                    key={s}
                    className="px-2 py-1 bg-black text-white rounded-lg border-2 border-black text-[10px] font-bold uppercase"
                  >
                    {SERVICE_LABELS[s]}
                  </span>
                ))}
              </div>
            )}
          </div>

          {lastReadings.length > 0 && (
            <div>
              <div className="text-[10px] uppercase text-neutral-500 mb-1">Your last readings</div>
              <ul className="space-y-1">
                {lastReadings.map(({ service, reading }) => (
                  <li key={service} className="text-xs">
                    <span className="text-neutral-600">{SERVICE_LABELS[service]}: </span>
                    <span className="font-bold break-all">{reading}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <p className="text-[10px] text-neutral-500">
            Something wrong here? Only the admin can change it &mdash; ask them.
          </p>
        </div>

        <button
          onClick={() => setModalOpen(true)}
          className="w-full bg-black text-white hover:bg-neutral-800 font-bold text-sm py-3.5 rounded-xl border-2 border-black transition-transform active:scale-95 cursor-pointer mb-6"
        >
          + Send a payment
        </button>

        <p className="text-[11px] text-neutral-600 mb-4 leading-relaxed">
          Pay however you normally do &mdash; phone, Irembo, cash. Then pick what you paid for,
          type the amount and the meter reading, and attach the screenshot or photo. The admin
          checks it and marks it paid, or partial if it was not the full amount.
        </p>

        <h2 className="font-serif font-black text-lg mb-3">Your history</h2>
        {submissions.length === 0 ? (
          <div className="bg-white border-2 border-dashed border-black rounded-xl p-6 text-center text-xs text-neutral-600">
            Nothing sent yet. Your submissions will show up here.
          </div>
        ) : (
          <div className="space-y-3">
            {submissions.map((s) => (
              <SubmissionCard key={s.id} submission={s} getScreenshotUrl={getScreenshotUrl} />
            ))}
          </div>
        )}
      </div>

      <SubmissionModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        room={room}
        onUploadScreenshot={onUploadScreenshot}
        onSubmit={onSubmit}
      />
    </div>
  );
};
