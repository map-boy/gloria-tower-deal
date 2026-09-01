import React from 'react';
import { Role } from '../../1_core/domain/types';

export type ActiveTab = 'home' | 'floors' | 'rooms' | 'payments' | 'calendar' | 'settings';

interface SidebarProps {
  activeTab: ActiveTab;
  onTabChange: (tab: ActiveTab) => void;
  role: Role;
  onRoleToggle: () => void;
  activeRoomNumber?: string;
  activeTenantName?: string;
  onSelectTenantRoomModal?: () => void;
  isMobileOpen: boolean;
  onCloseMobile: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onTabChange,
  role,
  onRoleToggle,
  activeRoomNumber,
  activeTenantName,
  onSelectTenantRoomModal,
  isMobileOpen,
  onCloseMobile,
}) => {
  const navItems: { id: ActiveTab; label: string; symbol: string; adminOnly?: boolean }[] = [
    { id: 'home', label: 'Home', symbol: '\u2302' },
    { id: 'floors', label: 'Floors (8)', symbol: '\u25A6', adminOnly: true },
    { id: 'rooms', label: 'Rooms (200/fl)', symbol: '\u229E' },
    { id: 'payments', label: 'Payments', symbol: '\u00A4' },
    { id: 'calendar', label: 'Calendar', symbol: '\u25A8' },
    { id: 'settings', label: 'Settings', symbol: '\u2699' },
  ];

  return (
    <>
      {isMobileOpen && (
        <div
          onClick={onCloseMobile}
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
        />
      )}

      <aside
        className={`fixed top-0 bottom-0 left-0 w-64 bg-white dark:bg-neutral-900 border-r-3 border-black dark:border-neutral-200 z-50 flex flex-col justify-between p-4 transition-transform duration-200 lg:static lg:translate-x-0 ${
          isMobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 bg-white dark:bg-neutral-900 border-2 border-black dark:border-neutral-200 p-2 px-3 rounded-xl shadow-none">
              <div className="bg-black dark:bg-neutral-100 text-white dark:text-black px-2 py-0.5 rounded font-mono font-black text-sm">
                &#9889;
              </div>
              <div>
                <h1 className="font-mono font-black text-lg tracking-wider text-black dark:text-neutral-100 uppercase leading-none">
                  VOLTRA
                </h1>
                <span className="text-[10px] font-mono font-semibold text-neutral-600 dark:text-neutral-400 block">
                  TOWER SYSTEM
                </span>
              </div>
            </div>
            <button
              onClick={onCloseMobile}
              className="lg:hidden p-1 bg-white dark:bg-neutral-900 border-2 border-black dark:border-neutral-200 rounded font-mono font-bold text-sm text-black dark:text-neutral-100 cursor-pointer"
            >
              &#10005;
            </button>
          </div>

          <div className="bg-white dark:bg-neutral-900 border-2 border-black dark:border-neutral-200 rounded-xl p-3 text-xs font-mono">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] uppercase font-bold text-neutral-500 dark:text-neutral-400">
                ACTIVE ROLE
              </span>
              <span
                className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${
                  role === 'admin'
                    ? 'bg-neutral-300 text-black border-black'
                    : 'bg-neutral-100 text-black border-black'
                }`}
              >
                {role}
              </span>
            </div>
            <p className="font-bold text-black dark:text-neutral-100 truncate">
              {role === 'admin' ? 'Building Manager' : activeTenantName || 'Tenant'}
            </p>
            {role === 'tenant' && activeRoomNumber && (
              <div className="mt-2 flex items-center justify-between gap-1">
                <span className="text-[11px] font-semibold text-neutral-700 dark:text-neutral-300">
                  Room: {activeRoomNumber}
                </span>
                {onSelectTenantRoomModal && (
                  <button
                    onClick={onSelectTenantRoomModal}
                    className="text-[10px] underline font-bold text-black dark:text-neutral-100 hover:text-neutral-800 dark:hover:text-white cursor-pointer"
                  >
                    Switch
                  </button>
                )}
              </div>
            )}
          </div>

          <nav className="space-y-2">
            {navItems.map((item) => {
              if (item.adminOnly && role !== 'admin') return null;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    onTabChange(item.id);
                    onCloseMobile();
                  }}
                  className={`w-full text-left flex items-center gap-3 px-3.5 py-2.5 rounded-lg border-2 font-mono font-bold text-sm transition-all cursor-pointer ${
                    isActive
                      ? 'bg-black text-white dark:bg-neutral-100 dark:text-black border-black dark:border-neutral-200 shadow-none'
                      : 'bg-transparent text-black dark:text-neutral-100 border-transparent hover:bg-white/60 dark:hover:bg-white/10 hover:border-black dark:hover:border-neutral-200'
                  }`}
                >
                  <span className="text-base leading-none">{item.symbol}</span>
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        <div className="space-y-3 pt-4 border-t-2 border-black/20 dark:border-neutral-200/20">
          <button
            onClick={onRoleToggle}
            className="w-full bg-white dark:bg-neutral-900 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-black dark:text-neutral-100 font-mono font-bold text-xs p-2.5 rounded-lg border-2 border-black dark:border-neutral-200 flex items-center justify-center gap-2 cursor-pointer shadow-none active:scale-95 transition-transform"
          >
            <span>&#8635; Switch to {role === 'admin' ? 'Tenant View' : 'Admin View'}</span>
          </button>

          <button
            onClick={() => {
              alert('Logged out of session');
            }}
            className="w-full text-left flex items-center gap-2 px-3 py-2 text-xs font-mono font-bold text-neutral-800 dark:text-neutral-300 hover:text-black dark:hover:text-white cursor-pointer"
          >
            <span>&#8617;</span>
            <span>Log out</span>
          </button>
        </div>
      </aside>
    </>
  );
};
