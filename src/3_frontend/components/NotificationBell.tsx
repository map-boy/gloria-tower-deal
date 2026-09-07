import React, { useState } from 'react';
import { AppNotification } from '../../1_core/domain/types';
import { formatCurrency, formatDateTime } from '../../1_core/utils/formatters';

interface NotificationBellProps {
  notifications: AppNotification[];
  onOpen: (notification: AppNotification) => void;
}

// Pops up when a tenant sends a payment or a cash power reading. Clicking one
// takes the admin straight to that tenant's screen.
export const NotificationBell: React.FC<NotificationBellProps> = ({ notifications, onOpen }) => {
  const [open, setOpen] = useState(false);
  const unread = notifications.filter((n) => !n.read).length;

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative px-3 py-2 bg-white hover:bg-neutral-100 border-2 border-black rounded-lg font-mono font-bold text-xs cursor-pointer"
      >
        Alerts
        {unread > 0 && (
          <span className="absolute -top-2 -right-2 min-w-5 h-5 px-1 bg-black text-white border-2 border-white rounded-full text-[10px] flex items-center justify-center">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 mt-2 w-80 max-h-96 overflow-y-auto bg-white border-2 border-black rounded-xl z-50">
            {notifications.length === 0 ? (
              <p className="p-4 font-mono text-xs text-neutral-600">Nothing new.</p>
            ) : (
              notifications.map((n) => (
                <button
                  key={n.id}
                  onClick={() => {
                    setOpen(false);
                    onOpen(n);
                  }}
                  className={`block w-full text-left p-3 border-b-2 border-black last:border-b-0 cursor-pointer hover:bg-neutral-100 ${
                    n.read ? 'bg-white' : 'bg-neutral-200'
                  }`}
                >
                  <div className="font-serif font-black text-sm">
                    Room {n.roomNumber}
                    {!n.read && <span className="ml-2 font-mono text-[10px] uppercase">new</span>}
                  </div>
                  <div className="font-mono text-[11px] text-neutral-700">
                    {n.tenantName} sent {formatCurrency(n.amountReported ?? 0)}
                    {n.cashPowerReading ? ` · reading ${n.cashPowerReading}` : ''}
                  </div>
                  <div className="font-mono text-[10px] text-neutral-500">
                    {formatDateTime(n.createdAt)}
                  </div>
                </button>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
};
