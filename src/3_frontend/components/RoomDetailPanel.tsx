import React, { useState } from 'react';
import { Room, SERVICE_LABELS, Submission, roomServices } from '../../1_core/domain/types';
import { formatCurrency, formatDateTime } from '../../1_core/utils/formatters';
import { deleteRoom, setRoomPassword } from '../../2_backend/services/roomPasswordService';
import { SubmissionCard } from './SubmissionCard';

interface RoomDetailPanelProps {
  room: Room;
  submissions: Submission[];
  getScreenshotUrl: (path: string) => Promise<string>;
  onBack: () => void;
  onReview: (submission: Submission) => void;
  onSaveRoom: (
    roomId: string,
    updates: Partial<
      Pick<
        Room,
        | 'roomNumber'
        | 'tenantName'
        | 'tenantPhone'
        | 'hasElectricity'
        | 'hasWater'
        | 'hasRent'
        | 'active'
      >
    >
  ) => Promise<void>;
  onFreeRoom: (roomId: string) => Promise<void>;
  onRoomDeleted: () => void;
}

// One tenant's whole screen: who they are, what they uploaded, what they paid.
export const RoomDetailPanel: React.FC<RoomDetailPanelProps> = ({
  room,
  submissions,
  getScreenshotUrl,
  onBack,
  onReview,
  onSaveRoom,
  onFreeRoom,
  onRoomDeleted,
}) => {
  const [editing, setEditing] = useState(false);
  const [roomNumber, setRoomNumber] = useState(room.roomNumber);
  const [tenantName, setTenantName] = useState(room.tenantName);
  const [tenantPhone, setTenantPhone] = useState(room.tenantPhone ?? '');
  const [hasElectricity, setHasElectricity] = useState(room.hasElectricity);
  const [hasWater, setHasWater] = useState(!!room.hasWater);
  const [hasRent, setHasRent] = useState(!!room.hasRent);
  const [deleting, setDeleting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [resetting, setResetting] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [resetMessage, setResetMessage] = useState('');

  const confirmedTotal = submissions.reduce((sum, s) => sum + (s.amountConfirmed ?? 0), 0);
  const latestReading = submissions.find((s) => s.cashPowerReading)?.cashPowerReading;

  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      await onSaveRoom(room.id, {
        roomNumber: roomNumber.trim() || room.roomNumber,
        tenantName: tenantName.trim(),
        tenantPhone: tenantPhone.trim(),
        hasElectricity,
        hasWater,
        hasRent,
      });
      setEditing(false);
    } catch (e: any) {
      setError(e?.message || 'Could not save.');
    } finally {
      setSaving(false);
    }
  };

  const handleFree = async () => {
    if (!window.confirm('Free this room so someone else can claim the number?')) return;
    await onFreeRoom(room.id);
  };

  // Deleting takes the room, its password, its submissions and their photos.
  // Freeing a room is the reversible option; this one is not.
  const handleDelete = async () => {
    const typed = window.prompt(
      `Delete room ${room.roomNumber} and all ${submissions.length} of its submissions? ` +
        `This cannot be undone. Type the room number to confirm.`
    );
    if (typed === null) return;
    if (typed.trim().toLowerCase() !== room.roomNumber.trim().toLowerCase()) {
      window.alert('That did not match the room number. Nothing was deleted.');
      return;
    }
    setDeleting(true);
    try {
      await deleteRoom(room.id);
      onRoomDeleted();
    } catch (e: any) {
      window.alert(e?.message || 'Could not delete the room.');
      setDeleting(false);
    }
  };

  // A tenant who cleared their phone or forgot their password has no other way
  // back into their own room, so this is the admin's rescue button.
  const handleResetPassword = async () => {
    if (newPassword.trim().length < 4) {
      setResetMessage('Password must be at least 4 characters.');
      return;
    }
    setResetting(true);
    setResetMessage('');
    try {
      await setRoomPassword(room.id, newPassword.trim());
      setResetMessage(`Done. Tell the tenant their new password is: ${newPassword.trim()}`);
      setNewPassword('');
    } catch (e: any) {
      setResetMessage(e?.message || 'Could not reset the password.');
    } finally {
      setResetting(false);
    }
  };

  const inputClass =
    'w-full bg-white text-black text-sm p-2.5 border-2 border-black rounded-xl focus:outline-none';

  return (
    <div className="space-y-5">
      <button
        onClick={onBack}
        className="px-3 py-2 bg-white hover:bg-neutral-100 border-2 border-black rounded-lg font-mono font-bold text-xs cursor-pointer"
      >
        &larr; All rooms
      </button>

      <div className="bg-white border-2 border-black rounded-xl p-4 space-y-3">
        {editing ? (
          <div className="space-y-3 font-mono text-xs">
            <div>
              <label className="block font-bold uppercase mb-1">Room number</label>
              <input value={roomNumber} onChange={(e) => setRoomNumber(e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className="block font-bold uppercase mb-1">Tenant name</label>
              <input value={tenantName} onChange={(e) => setTenantName(e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className="block font-bold uppercase mb-1">Phone</label>
              <input value={tenantPhone} onChange={(e) => setTenantPhone(e.target.value)} className={inputClass} />
            </div>
            <div className="border-2 border-black rounded-xl p-2.5 space-y-2">
              <div className="font-bold uppercase">What this room pays for</div>
              {(
                [
                  ['Cash power', hasElectricity, setHasElectricity],
                  ['Water', hasWater, setHasWater],
                  ['Rent', hasRent, setHasRent],
                ] as [string, boolean, (fn: (v: boolean) => boolean) => void][]
              ).map(([label, value, setValue]) => (
                <div key={label} className="flex items-center justify-between gap-2">
                  <span>{label}</span>
                  <button
                    type="button"
                    onClick={() => setValue((v) => !v)}
                    className={`px-3 py-1.5 rounded-lg border-2 border-black font-bold text-[11px] cursor-pointer ${
                      value ? 'bg-black text-white' : 'bg-white text-black'
                    }`}
                  >
                    {value ? 'Yes' : 'No'}
                  </button>
                </div>
              ))}
            </div>
            {error && <p className="text-[11px] text-red-600">{error}</p>}
            <div className="flex gap-2">
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 bg-black text-white hover:bg-neutral-800 disabled:opacity-50 font-bold text-xs py-2.5 rounded-xl border-2 border-black cursor-pointer"
              >
                {saving ? 'Saving...' : 'Save'}
              </button>
              <button
                onClick={() => setEditing(false)}
                className="flex-1 bg-white hover:bg-neutral-100 font-bold text-xs py-2.5 rounded-xl border-2 border-black cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="font-serif font-black text-2xl">Room {room.roomNumber}</h2>
                <p className="font-mono text-xs text-neutral-700">{room.tenantName}</p>
                {room.tenantPhone && (
                  <p className="font-mono text-xs text-neutral-700">{room.tenantPhone}</p>
                )}
                <p className="font-mono text-[10px] uppercase text-neutral-500 mt-1">
                  {roomServices(room).map((s) => SERVICE_LABELS[s]).join(', ') || 'No services'}{' '}
                  &middot; {room.active ? 'Active' : 'Freed'} &middot; joined{' '}
                  {formatDateTime(room.createdAt)}
                </p>
              </div>
              <button
                onClick={() => setEditing(true)}
                className="shrink-0 px-3 py-2 bg-white hover:bg-neutral-100 border-2 border-black rounded-lg font-mono font-bold text-xs cursor-pointer"
              >
                Edit
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2 font-mono text-xs">
              <div className="border-2 border-black rounded-lg p-2">
                <div className="text-[10px] uppercase text-neutral-500">Confirmed paid</div>
                <div className="font-bold text-sm">{formatCurrency(confirmedTotal)}</div>
              </div>
              <div className="border-2 border-black rounded-lg p-2">
                <div className="text-[10px] uppercase text-neutral-500">Latest reading</div>
                <div className="font-bold text-sm break-all">{latestReading || '--'}</div>
              </div>
            </div>

            <div className="border-2 border-black rounded-xl p-3 space-y-2">
              <div className="text-[10px] uppercase font-bold">Reset room password</div>
              <p className="text-[10px] text-neutral-600">
                Use this when a tenant is locked out. They get back in with their phone number
                and the new password.
              </p>
              <div className="flex gap-2">
                <input
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="New password"
                  className="flex-1 bg-white text-black text-xs p-2.5 border-2 border-black rounded-xl focus:outline-none"
                />
                <button
                  onClick={handleResetPassword}
                  disabled={resetting}
                  className="px-3 bg-black text-white hover:bg-neutral-800 disabled:opacity-50 font-bold text-xs rounded-xl border-2 border-black cursor-pointer"
                >
                  {resetting ? '...' : 'Reset'}
                </button>
              </div>
              {resetMessage && (
                <p className="text-[10px] text-neutral-800 break-all">{resetMessage}</p>
              )}
            </div>

            {room.active && (
              <button
                onClick={handleFree}
                className="w-full bg-white text-red-600 hover:bg-neutral-100 font-mono font-bold text-xs py-2.5 rounded-xl border-2 border-black cursor-pointer"
              >
                Free this room number
              </button>
            )}

            <button
              onClick={handleDelete}
              disabled={deleting}
              className="w-full bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 font-mono font-bold text-xs py-2.5 rounded-xl border-2 border-black cursor-pointer"
            >
              {deleting ? 'Deleting...' : 'Delete this room for good'}
            </button>
          </>
        )}
      </div>

      <h3 className="font-serif font-black text-lg">
        Submissions ({submissions.length})
      </h3>
      {submissions.length === 0 ? (
        <div className="bg-white border-2 border-dashed border-black rounded-xl p-6 text-center font-mono text-xs text-neutral-600">
          This tenant has not sent anything yet.
        </div>
      ) : (
        <div className="space-y-3">
          {submissions.map((s) => (
            <SubmissionCard
              key={s.id}
              submission={s}
              getScreenshotUrl={getScreenshotUrl}
              onReview={onReview}
            />
          ))}
        </div>
      )}
    </div>
  );
};
