import React, { useEffect, useState } from 'react';
import {
  AdminEntry,
  addAdmin,
  removeAdmin,
  subscribeToAdmins,
} from '../../2_backend/services/adminService';
import { formatDateTime } from '../../1_core/utils/formatters';

interface AdminsPanelProps {
  currentAdminEmail: string;
}

// Any admin can add another. Access is granted to an email address, so the
// person becomes an admin the moment they sign in with Google -- there is no
// invite to accept and nothing to set up for them.
export const AdminsPanel: React.FC<AdminsPanelProps> = ({ currentAdminEmail }) => {
  const [admins, setAdmins] = useState<AdminEntry[]>([]);
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => subscribeToAdmins(setAdmins), []);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const value = email.trim().toLowerCase();
    if (!value) return;
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await addAdmin(value);
      setMessage(`${value} is now an admin. They get access when they sign in with Google.`);
      setEmail('');
    } catch (e: any) {
      setError(e?.message || 'Could not add that admin.');
    } finally {
      setBusy(false);
    }
  };

  const handleRemove = async (target: string) => {
    if (!window.confirm(`Remove admin access for ${target}?`)) return;
    setError('');
    setMessage('');
    try {
      await removeAdmin(target);
      setMessage(`${target} is no longer an admin.`);
    } catch (e: any) {
      setError(e?.message || 'Could not remove that admin.');
    }
  };

  return (
    <div className="space-y-4">
      <div className="bg-white border-2 border-black rounded-xl p-4 space-y-3">
        <div>
          <h3 className="font-serif font-black text-lg">Add an admin</h3>
          <p className="text-[11px] text-neutral-600">
            Type their Google email. They sign in with Google and get full admin access
            straight away &mdash; nothing to accept, nothing to set up.
          </p>
        </div>

        <form onSubmit={handleAdd} className="flex gap-2">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="name@gmail.com"
            className="flex-1 bg-white text-black text-sm p-2.5 border-2 border-black rounded-xl focus:outline-none"
          />
          <button
            type="submit"
            disabled={busy}
            className="px-4 bg-black text-white hover:bg-neutral-800 disabled:opacity-50 font-bold text-xs rounded-xl border-2 border-black cursor-pointer"
          >
            {busy ? '...' : 'Add'}
          </button>
        </form>

        {message && <p className="text-[11px] text-neutral-800 break-all">{message}</p>}
        {error && <p className="text-[11px] text-red-600 break-all">{error}</p>}
      </div>

      <h3 className="font-serif font-black text-lg">Admins ({admins.length})</h3>
      <div className="space-y-2">
        {admins.map((admin) => {
          const isSelf = admin.email === currentAdminEmail.toLowerCase();
          return (
            <div
              key={admin.email}
              className="bg-white border-2 border-black rounded-xl p-3 flex items-center justify-between gap-3"
            >
              <div className="min-w-0">
                <div className="text-xs font-bold break-all">
                  {admin.email}
                  {isSelf && <span className="ml-2 text-[10px] uppercase text-neutral-500">you</span>}
                </div>
                <div className="text-[10px] uppercase text-neutral-500">
                  {admin.builtIn
                    ? 'Built-in owner'
                    : `Added by ${admin.addedBy ?? 'an admin'}${
                        admin.addedAt ? ` · ${formatDateTime(admin.addedAt)}` : ''
                      }`}
                </div>
              </div>
              {!admin.builtIn && !isSelf && (
                <button
                  onClick={() => handleRemove(admin.email)}
                  className="shrink-0 px-3 py-2 bg-white text-red-600 hover:bg-neutral-100 border-2 border-black rounded-lg font-bold text-[10px] uppercase cursor-pointer"
                >
                  Remove
                </button>
              )}
            </div>
          );
        })}
      </div>

      <p className="text-[10px] text-neutral-500">
        Built-in owners are set in the code and cannot be removed here, so the building can
        never be locked out of its own system. You also cannot remove yourself.
      </p>
    </div>
  );
};
