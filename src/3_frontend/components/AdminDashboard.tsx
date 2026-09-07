import React, { useMemo, useState } from 'react';
import { AppNotification, Room, Submission, SubmissionStatus } from '../../1_core/domain/types';
import {
  formatCurrency,
  formatDateTime,
  getStatusBadgeStyle,
  getStatusLabel,
} from '../../1_core/utils/formatters';
import { NotificationBell } from './NotificationBell';
import { ReviewSubmissionModal } from './ReviewSubmissionModal';
import { RoomDetailPanel } from './RoomDetailPanel';
import { StatPill } from './StatPill';
import { SubmissionCard } from './SubmissionCard';
import { TopBar } from './TopBar';

interface AdminDashboardProps {
  rooms: Room[];
  submissions: Submission[];
  notifications: AppNotification[];
  adminLabel: string;
  getScreenshotUrl: (path: string) => Promise<string>;
  onOpenNotification: (notification: AppNotification) => void;
  onSaveReview: (
    submissionId: string,
    updates: {
      status: SubmissionStatus;
      amountConfirmed: number;
      amountReported: number;
      cashPowerReading?: string;
      adminNote?: string;
    }
  ) => Promise<void>;
  onDeleteSubmission: (submissionId: string) => Promise<void>;
  onSaveRoom: (
    roomId: string,
    updates: Partial<Pick<Room, 'roomNumber' | 'tenantName' | 'tenantPhone' | 'hasElectricity' | 'active'>>
  ) => Promise<void>;
  onFreeRoom: (roomId: string) => Promise<void>;
  selectedRoomId: string | null;
  onSelectRoom: (roomId: string | null) => void;
  focusSubmission: Submission | null;
  onClearFocusSubmission: () => void;
  onLogout: () => void;
}

type Tab = 'inbox' | 'rooms';

// Admin sees three things and nothing else: every room registered, what each
// tenant sent, and who still needs marking.
export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  rooms,
  submissions,
  notifications,
  adminLabel,
  getScreenshotUrl,
  onOpenNotification,
  onSaveReview,
  onDeleteSubmission,
  onSaveRoom,
  onFreeRoom,
  selectedRoomId,
  onSelectRoom,
  focusSubmission,
  onClearFocusSubmission,
  onLogout,
}) => {
  const [tab, setTab] = useState<Tab>('inbox');
  const [search, setSearch] = useState('');
  const [reviewing, setReviewing] = useState<Submission | null>(null);

  const pending = useMemo(
    () => submissions.filter((s) => s.status === 'pending'),
    [submissions]
  );
  const collected = useMemo(
    () => submissions.reduce((sum, s) => sum + (s.amountConfirmed ?? 0), 0),
    [submissions]
  );

  const filteredRooms = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return rooms;
    return rooms.filter(
      (r) =>
        r.roomNumber.toLowerCase().includes(term) ||
        r.tenantName.toLowerCase().includes(term) ||
        (r.tenantPhone ?? '').toLowerCase().includes(term)
    );
  }, [rooms, search]);

  const selectedRoom = selectedRoomId ? rooms.find((r) => r.id === selectedRoomId) : undefined;
  const activeReview = focusSubmission ?? reviewing;

  const closeReview = () => {
    setReviewing(null);
    onClearFocusSubmission();
  };

  return (
    <div className="min-h-screen bg-neutral-200 font-mono text-black p-4 sm:p-6">
      <div className="max-w-3xl mx-auto">
        <TopBar
          title="Admin"
          subtitle={adminLabel}
          role="admin"
          onLogout={onLogout}
          right={
            <NotificationBell notifications={notifications} onOpen={onOpenNotification} />
          }
        />

        <div className="grid grid-cols-3 gap-2 mb-5">
          <StatPill value={rooms.length} label="Rooms registered" />
          <StatPill value={pending.length} label="Waiting to be marked" />
          <StatPill value={formatCurrency(collected)} label="Confirmed collected" />
        </div>

        {selectedRoom ? (
          <RoomDetailPanel
            room={selectedRoom}
            submissions={submissions.filter((s) => s.roomId === selectedRoom.id)}
            getScreenshotUrl={getScreenshotUrl}
            onBack={() => onSelectRoom(null)}
            onReview={setReviewing}
            onSaveRoom={onSaveRoom}
            onFreeRoom={onFreeRoom}
          />
        ) : (
          <>
            <div className="flex gap-2 mb-4">
              {(['inbox', 'rooms'] as Tab[]).map((t) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={`flex-1 py-2.5 rounded-xl border-2 border-black font-bold text-xs uppercase cursor-pointer ${
                    tab === t ? 'bg-black text-white' : 'bg-white text-black'
                  }`}
                >
                  {t === 'inbox' ? `Payments (${pending.length} new)` : `Rooms (${rooms.length})`}
                </button>
              ))}
            </div>

            {tab === 'inbox' && (
              <div className="space-y-3">
                {submissions.length === 0 ? (
                  <div className="bg-white border-2 border-dashed border-black rounded-xl p-6 text-center text-xs text-neutral-600">
                    No payments sent yet.
                  </div>
                ) : (
                  submissions.map((s) => (
                    <SubmissionCard
                      key={s.id}
                      submission={s}
                      getScreenshotUrl={getScreenshotUrl}
                      showRoom
                      onReview={setReviewing}
                    />
                  ))
                )}
              </div>
            )}

            {tab === 'rooms' && (
              <div className="space-y-3">
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search room number, name or phone"
                  className="w-full bg-white text-black text-sm p-3 border-2 border-black rounded-xl focus:outline-none"
                />
                {filteredRooms.length === 0 ? (
                  <div className="bg-white border-2 border-dashed border-black rounded-xl p-6 text-center text-xs text-neutral-600">
                    No rooms yet. A room appears here the moment a tenant enters its number.
                  </div>
                ) : (
                  filteredRooms.map((room) => {
                    const roomSubs = submissions.filter((s) => s.roomId === room.id);
                    const last = roomSubs[0];
                    const badge = last ? getStatusBadgeStyle(last.status) : null;
                    return (
                      <button
                        key={room.id}
                        onClick={() => onSelectRoom(room.id)}
                        className="w-full text-left bg-white border-2 border-black rounded-xl p-3 hover:bg-neutral-100 cursor-pointer"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <div className="font-serif font-black text-base">
                              Room {room.roomNumber}
                              {!room.active && (
                                <span className="ml-2 font-mono text-[10px] uppercase text-neutral-500">
                                  freed
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-neutral-700 truncate">{room.tenantName}</div>
                            <div className="text-[10px] uppercase text-neutral-500">
                              {room.hasElectricity ? 'cash power' : 'no cash power'}
                              {last ? ` · last sent ${formatDateTime(last.createdAt)}` : ' · nothing sent'}
                            </div>
                          </div>
                          {badge && last && (
                            <span
                              className={`shrink-0 px-2 py-1 rounded-lg border-2 font-bold text-[10px] uppercase ${badge.bg} ${badge.text} ${badge.border}`}
                            >
                              {getStatusLabel(last.status)}
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            )}
          </>
        )}
      </div>

      <ReviewSubmissionModal
        submission={activeReview}
        onClose={closeReview}
        getScreenshotUrl={getScreenshotUrl}
        onSave={onSaveReview}
        onDelete={onDeleteSubmission}
      />
    </div>
  );
};
