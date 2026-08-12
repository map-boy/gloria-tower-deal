import React from 'react';
import { BuildingSummary } from '../../1_core/domain/types';
import { formatCurrency, formatKwh } from '../../1_core/utils/formatters';
import { StatPill } from './StatPill';

interface AdminSummaryPanelProps {
  summary: BuildingSummary;
  onOpenRateConfig: () => void;
}

export const AdminSummaryPanel: React.FC<AdminSummaryPanelProps> = ({
  summary,
  onOpenRateConfig,
}) => {
  return (
    <div className="bg-[#a8e6cf] border-3 border-black rounded-2xl p-5 sm:p-6 text-black mb-8 shadow-none">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b-2 border-black mb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="bg-black text-white px-2 py-0.5 rounded font-mono font-bold text-xs uppercase">
              Admin Control
            </span>
            <span className="font-mono text-xs font-semibold text-neutral-800">
              8 Floors • 1,600 Total Rooms
            </span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-serif font-black tracking-tight text-black mt-1">
            Voltra Tower Building Overview
          </h2>
        </div>

        <button
          onClick={onOpenRateConfig}
          className="bg-white hover:bg-neutral-100 text-black border-2 border-black rounded-xl p-3 px-4 font-mono font-bold text-xs flex items-center justify-center gap-2 cursor-pointer transition-transform active:scale-95 shadow-none"
        >
          <span>⚡ Config Rate: ${summary.defaultRatePerUnit.toFixed(2)}/kWh</span>
        </button>
      </div>

      {/* Grid of Key Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-4">
        <StatPill
          value={formatCurrency(summary.totalCollectedThisMonth)}
          label="Total Collected"
        />
        <StatPill
          value={formatCurrency(summary.totalOutstandingThisMonth)}
          label="Total Outstanding"
        />
        <StatPill
          value={formatKwh(summary.totalUnitsThisMonth)}
          label="Total Power Used"
        />
        <StatPill
          value={`${summary.paidRoomsCount}`}
          label="Paid Rooms"
          subValue={`/ ${summary.occupiedRooms}`}
        />
        <StatPill
          value={`${summary.overdueRoomsCount}`}
          label="Overdue Rooms"
          className="col-span-2 lg:col-span-1"
        />
      </div>

      {/* Progress Breakdown bar */}
      <div className="bg-white border-2 border-black rounded-xl p-3 text-xs font-mono">
        <div className="flex justify-between items-center mb-2 font-bold">
          <span>Building Collection Status ({summary.occupiedRooms} Occupied Rooms):</span>
          <span>
            {Math.round((summary.paidRoomsCount / (summary.occupiedRooms || 1)) * 100)}% Paid in Full
          </span>
        </div>
        <div className="h-4 bg-neutral-200 border-2 border-black rounded-full overflow-hidden flex">
          <div
            style={{
              width: `${(summary.paidRoomsCount / (summary.occupiedRooms || 1)) * 100}%`,
            }}
            className="bg-[#2ed573] h-full border-r border-black"
            title={`Paid: ${summary.paidRoomsCount}`}
          />
          <div
            style={{
              width: `${(summary.partialRoomsCount / (summary.occupiedRooms || 1)) * 100}%`,
            }}
            className="bg-[#feca57] h-full border-r border-black"
            title={`Partial: ${summary.partialRoomsCount}`}
          />
          <div
            style={{
              width: `${(summary.overdueRoomsCount / (summary.occupiedRooms || 1)) * 100}%`,
            }}
            className="bg-[#ff6b6b] h-full"
            title={`Overdue: ${summary.overdueRoomsCount}`}
          />
        </div>
        <div className="flex flex-wrap gap-4 mt-2 text-[11px] font-semibold">
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 bg-[#2ed573] border border-black rounded-sm" />
            Paid: {summary.paidRoomsCount}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 bg-[#feca57] border border-black rounded-sm" />
            Partial: {summary.partialRoomsCount}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 bg-[#ff6b6b] border border-black rounded-sm" />
            Overdue: {summary.overdueRoomsCount}
          </span>
        </div>
      </div>
    </div>
  );
};
