import React, { useState } from 'react';
import { Room, Tenant } from '../../1_core/domain/types';

interface TenantProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  room: Room;
  tenant?: Tenant;
  onAssignTenant: (tenantData: { name: string; phone: string; email: string; moveInDate: string }) => void;
  onMoveTenant?: () => void;
  onVacateRoom?: () => void;
}

export const TenantProfileModal: React.FC<TenantProfileModalProps> = ({
  isOpen,
  onClose,
  room,
  tenant,
  onAssignTenant,
  onMoveTenant,
  onVacateRoom,
}) => {
  const [name, setName] = useState(tenant?.name || '');
  const [phone, setPhone] = useState(tenant?.phone || '');
  const [email, setEmail] = useState(tenant?.email || '');
  const [moveInDate, setMoveInDate] = useState(
    tenant?.moveInDate || new Date().toISOString().split('T')[0]
  );

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim()) return;
    onAssignTenant({ name, phone, email, moveInDate });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
      <div className="bg-white border-3 border-black rounded-2xl w-full max-w-md p-6 shadow-none text-black relative">
        <div className="flex items-center justify-between pb-4 border-b-2 border-black mb-4">
          <div className="flex items-center gap-2">
            <span className="bg-black text-white p-1.5 rounded font-mono font-bold text-sm">
              ðŸ‘¤
            </span>
            <div>
              <h3 className="font-serif font-black text-xl text-black">
                Tenant & Room Profile
              </h3>
              <p className="font-mono text-xs text-neutral-800">Room {room.roomNumber}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 bg-white hover:bg-neutral-100 border-2 border-black rounded-lg font-mono font-bold text-sm cursor-pointer"
          >
            âœ•
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 font-mono text-xs">
          <div>
            <label className="block font-bold uppercase mb-1">Occupant Full Name *</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Sarah Connor"
              className="w-full bg-white text-black text-sm p-3 border-2 border-black rounded-xl focus:outline-none"
            />
          </div>

          <div>
            <label className="block font-bold uppercase mb-1">Google Sign-In Email *</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tenant@gmail.com"
              className="w-full bg-white text-black text-sm p-3 border-2 border-black rounded-xl focus:outline-none"
            />
            <p className="text-[10px] font-mono text-neutral-600 mt-1">
              Must match the Google account the tenant will sign in with &mdash; this is what grants them access to this room.
            </p>
          </div>

          <div>
            <label className="block font-bold uppercase mb-1">Phone Number</label>
            <input
              type="text"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+1 (555) 019-2831"
              className="w-full bg-white text-black text-sm p-3 border-2 border-black rounded-xl focus:outline-none"
            />
          </div>

          <div>
            <label className="block font-bold uppercase mb-1">Move-In Date</label>
            <input
              type="date"
              value={moveInDate}
              onChange={(e) => setMoveInDate(e.target.value)}
              className="w-full bg-white text-black text-sm p-3 border-2 border-black rounded-xl focus:outline-none"
            />
          </div>

          <div className="pt-2">
            <button
              type="submit"
              className="w-full bg-black text-white hover:bg-neutral-800 font-bold text-sm py-3 rounded-xl border-2 border-black transition-transform active:scale-95 cursor-pointer"
            >
              Save Tenant Details
            </button>
          </div>
        </form>

        {tenant && (onMoveTenant || onVacateRoom) && (
          <div className="flex gap-2 pt-2 border-t-2 border-black mt-4">
            {onMoveTenant && (
              <button
                type="button"
                onClick={onMoveTenant}
                className="flex-1 bg-white text-black hover:bg-neutral-100 font-bold text-xs py-2 rounded-xl border-2 border-black transition-transform active:scale-95 cursor-pointer"
              >
                Move Tenant
              </button>
            )}
            {onVacateRoom && (
              <button
                type="button"
                onClick={() => { if (window.confirm('Vacate this room? This will remove the tenant.')) onVacateRoom(); }}
                className="flex-1 bg-white text-black hover:bg-red-50 font-bold text-xs py-2 rounded-xl border-2 border-black transition-transform active:scale-95 cursor-pointer"
              >
                Vacate Room
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

