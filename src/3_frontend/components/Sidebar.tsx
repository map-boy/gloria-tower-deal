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
    { id: 'home', label: 'Home', symbol: '⌂' },
    { id: 'floors', label: 'Floors (8)', symbol: '🏢', adminOnly: true },
    { id: 'rooms', label: 'Rooms (200/fl)', symbol: '🚪' },
    { id: 'payments', label: 'Payments', symbol: '💳' },
    { id: 'calendar', label: 'Calendar', symbol: '📅' },
    { id: 'settings', label: 'Settings', symbol: '⚙' },
  ];

  return (
    <>
      {/* Mobile backdrop */}
      {isMobileOpen && (
        <div
          onClick={onCloseMobile}
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
        />
      )}

      <aside
        className={`fixed top-0 bottom-0 left-0 w-64 bg-[#a8e6cf] border-r-3 border-black z-50 flex flex-col justify-between p-4 transition-transform duration-200 lg:static lg:translate-x-0 ${
          isMobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Top Header & Brand */}
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 bg-white border-2 border-black p-2 px-3 rounded-xl shadow-none">
              <div className="bg-black text-white px-2 py-0.5 rounded font-mono font-black text-sm">
                ⚡
              </div>
              <div>
                <h1 className="font-mono font-black text-lg tracking-wider text-black uppercase leading-none">
                  VOLTRA
                </h1>
                <span className="text-[10px] font-mono font-semibold text-neutral-600 block">
                  TOWER SYSTEM
                </span>
              </div>
            </div>
            <button
              onClick={onCloseMobile}
              className="lg:hidden p-1 bg-white border-2 border-black rounded font-mono font-bold text-sm text-black cursor-pointer"
            >
              ✕
            </button>
          </div>

          {/* User / Role Badge */}
          <div className="bg-white border-2 border-black rounded-xl p-3 text-xs font-mono">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] uppercase font-bold text-neutral-500">
                ACTIVE ROLE
              </span>
              <span
                className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${
                  role === 'admin'
                    ? 'bg-[#feca57] text-black border-black'
                    : 'bg-[#a8e6cf] text-black border-black'
                }`}
              >
                {role}
              </span>
            </div>
            <p className="font-bold text-black truncate">
              {role === 'admin' ? 'Building Manager' : activeTenantName || 'Tenant'}
            </p>
            {role === 'tenant' && activeRoomNumber && (
              <div className="mt-2 flex items-center justify-between gap-1">
                <span className="text-[11px] font-semibold text-neutral-700">
                  Room: {activeRoomNumber}
                </span>
                {onSelectTenantRoomModal && (
                  <button
                    onClick={onSelectTenantRoomModal}
                    className="text-[10px] underline font-bold text-black hover:text-neutral-800 cursor-pointer"
                  >
                    Switch
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Navigation Links */}
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
                      ? 'bg-black text-white border-black shadow-none'
                      : 'bg-transparent text-black border-transparent hover:bg-white/60 hover:border-black'
                  }`}
                >
                  <span className="text-base leading-none">{item.symbol}</span>
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Footer actions & role switcher */}
        <div className="space-y-3 pt-4 border-t-2 border-black/20">
          <button
            onClick={onRoleToggle}
            className="w-full bg-white hover:bg-neutral-100 text-black font-mono font-bold text-xs p-2.5 rounded-lg border-2 border-black flex items-center justify-center gap-2 cursor-pointer shadow-none active:scale-95 transition-transform"
          >
            <span>🔄 Switch to {role === 'admin' ? 'Tenant View' : 'Admin View'}</span>
          </button>

          <button
            onClick={() => {
              alert('Logged out of session');
            }}
            className="w-full text-left flex items-center gap-2 px-3 py-2 text-xs font-mono font-bold text-neutral-800 hover:text-black cursor-pointer"
          >
            <span>↩</span>
            <span>Log out</span>
          </button>
        </div>
      </aside>
    </>
  );
};
