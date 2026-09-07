import React, { useMemo, useState } from 'react';
import { Room, Submission } from '../../1_core/domain/types';
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
    cashPowerReading?: string;
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

  const lastReading = submissions.find((s) => s.cashPowerReading)?.cashPowerReading;

  return (
    <div className="min-h-screen bg-neutral-200 font-mono text-black p-4 sm:p-6">
      <div className="max-w-2xl mx-auto">
        <TopBar
          title={`Room ${room.roomNumber}`}
          subtitle={room.tenantName}
          role="tenant"
          onLogout={onLogout}
        />

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-5">
          <StatPill value={formatCurrency(totals.confirmed)} label="Confirmed by admin" />
          <StatPill value={totals.pending} label="Waiting for review" />
          <StatPill
            value={room.hasElectricity ? 'Yes' : 'No'}
            label="Cash power in this room"
            className="col-span-2 sm:col-span-1"
          />
        </div>

        {room.hasElectricity && lastReading && (
          <div className="bg-white border-2 border-black rounded-xl p-3 mb-5">
            <div className="text-[10px] uppercase text-neutral-500">Your last cash power reading</div>
            <div className="font-bold text-sm break-all">{lastReading}</div>
          </div>
        )}

        <button
          onClick={() => setModalOpen(true)}
          className="w-full bg-black text-white hover:bg-neutral-800 font-bold text-sm py-3.5 rounded-xl border-2 border-black transition-transform active:scale-95 cursor-pointer mb-6"
        >
          + Send this month's payment
        </button>

        <p className="text-[11px] text-neutral-600 mb-4 leading-relaxed">
          Pay however you normally do &mdash; phone, Irembo, cash. Then type what you paid
          {room.hasElectricity ? ', your cash power reading' : ''} and attach the screenshot or
          photo. The admin checks it and marks it paid, or partial if it was not the full amount.
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
