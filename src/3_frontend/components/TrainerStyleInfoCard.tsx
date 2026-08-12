import React from 'react';
import { Room, Tenant, MonthlyRoomStats } from '../../1_core/domain/types';
import { StatPill } from './StatPill';
import { formatCurrency, formatKwh, getStatusBadgeStyle, getStatusLabel } from '../../1_core/utils/formatters';

interface TrainerStyleInfoCardProps {
  room: Room;
  tenant?: Tenant;
  stats: MonthlyRoomStats;
  onOpenCalendar: () => void;
  onOpenTenantProfile?: () => void;
  onLogUsage?: () => void;
  role: 'tenant' | 'admin';
}

export const TrainerStyleInfoCard: React.FC<TrainerStyleInfoCardProps> = ({
  room,
  tenant,
  stats,
  onOpenCalendar,
  onOpenTenantProfile,
  onLogUsage,
  role,
}) => {
  const badge = getStatusBadgeStyle(stats.status);

  return (
    <div className="bg-[#feca57] border-3 border-black rounded-2xl p-4 sm:p-6 text-black shadow-none flex flex-col md:flex-row gap-5 items-stretch relative">
      {/* Left Avatar / Room Icon Block */}
      <div className="flex flex-col items-center justify-center bg-white border-2 border-black rounded-xl p-4 min-w-[150px] sm:min-w-[180px] shrink-0 text-center">
        <div className="w-20 h-20 sm:w-24 sm:h-24 bg-[#a8e6cf] border-2 border-black rounded-full flex items-center justify-center font-mono font-black text-2xl sm:text-3xl text-black mb-2 shadow-none overflow-hidden">
          {tenant ? (
            <img
              src={`https://api.dicebear.com/7.x/bottts/svg?seed=${tenant.name}`}
              alt={tenant.name}
              className="w-full h-full object-cover"
            />
          ) : (
            <span className="font-mono">⚡</span>
          )}
        </div>
        <div className="font-mono text-xs font-bold uppercase tracking-wider text-black bg-neutral-100 border border-black px-2 py-0.5 rounded mt-1">
          {room.roomNumber}
        </div>
        <span className="text-[11px] font-mono font-semibold text-neutral-700 mt-1">
          Floor {room.floorNumber}
        </span>
      </div>

      {/* Right Content Area */}
      <div className="flex-1 flex flex-col justify-between space-y-4">
        {/* Header info */}
        <div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-2xl sm:text-3xl font-serif font-black tracking-tight text-black">
                {tenant ? tenant.name : 'Vacant Room'}
              </h2>
              <p className="font-mono text-xs font-medium text-neutral-800">
                {tenant ? `${tenant.phone} • Move-in: ${tenant.moveInDate}` : 'No tenant currently assigned'}
              </p>
            </div>
            <div
              className={`px-3 py-1 rounded-full text-xs font-mono font-bold border-2 ${badge.bg} ${badge.text} ${badge.border}`}
            >
              {getStatusLabel(stats.status)}
            </div>
          </div>
        </div>

        {/* 4 Stat Pills row matching screenshot */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          <StatPill
            value={formatKwh(stats.totalUnits)}
            label="Total Usage"
            subValue="kWh"
          />
          <StatPill
            value={formatCurrency(stats.totalPaid)}
            label="Paid Total"
          />
          <StatPill
            value={formatCurrency(stats.balance)}
            label="Outstanding"
          />
          <StatPill
            value={`${stats.daysLogged}`}
            label="Days Logged"
            subValue="days"
          />
        </div>

        {/* Note / Rate information */}
        <div className="bg-white/80 border-2 border-black rounded-lg p-2.5 px-3 text-xs font-sans text-black">
          <span className="font-bold font-mono uppercase">Applied Rate: </span>
          ${stats.appliedRate.toFixed(2)} / kWh • Expected Cost: {formatCurrency(stats.expectedCost)}
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-3 pt-1">
          <button
            onClick={onLogUsage || onOpenCalendar}
            className="flex-1 sm:flex-none bg-black text-white hover:bg-neutral-800 font-mono font-bold text-xs sm:text-sm px-5 py-2.5 rounded-lg border-2 border-black transition-transform active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
          >
            <span>⚡ Log Electricity & Payment</span>
          </button>
          <button
            onClick={onOpenCalendar}
            className="flex-1 sm:flex-none bg-white text-black hover:bg-neutral-100 font-mono font-bold text-xs sm:text-sm px-5 py-2.5 rounded-lg border-2 border-black transition-transform active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
          >
            <span>📅 View Monthly Calendar</span>
          </button>
          {role === 'admin' && onOpenTenantProfile && (
            <button
              onClick={onOpenTenantProfile}
              className="bg-[#a8e6cf] text-black hover:bg-[#8ee2be] font-mono font-bold text-xs sm:text-sm px-4 py-2.5 rounded-lg border-2 border-black transition-transform active:scale-95 cursor-pointer"
            >
              ⚙ Tenant Config
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
