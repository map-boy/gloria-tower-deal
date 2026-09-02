import React from 'react';
import { FloorSummary } from '../../1_core/domain/types';
import { formatCurrency, formatKwh, getFloorCode, getFloorLabel } from '../../1_core/utils/formatters';

interface FloorCardProps {
  summary: FloorSummary;
  onSelectFloor: (floorNumber: number) => void;
}

export const FloorCard: React.FC<FloorCardProps> = ({ summary, onSelectFloor }) => {
  return (
    <div
      onClick={() => onSelectFloor(summary.floorNumber)}
      className="bg-white border-3 border-black rounded-2xl p-5 shadow-none hover:-translate-y-1 transition-all cursor-pointer flex flex-col justify-between space-y-4"
    >
      {/* Floor Number Header */}
      <div className="flex items-center justify-between pb-3 border-b-2 border-black">
        <div className="flex items-center gap-2">
          <span className="bg-black text-white px-2 py-1 rounded-lg font-mono font-black text-sm">
            {getFloorCode(summary.floorNumber)}
          </span>
          <h3 className="font-serif font-black text-xl text-black">
            {getFloorLabel(summary.floorNumber)}
          </h3>
        </div>
        <span className="font-mono text-xs font-bold text-neutral-800 bg-neutral-100 border border-black px-2 py-0.5 rounded">
          {summary.occupiedRooms} / {summary.totalRooms} Occupied
        </span>
      </div>

      {/* Stats Breakdown */}
      <div className="space-y-2 font-mono text-xs text-black">
        <div className="flex justify-between items-center bg-neutral-100 p-2 rounded-lg border border-black">
          <span className="text-neutral-700">Total Collected:</span>
          <span className="font-bold text-sm text-black">
            {formatCurrency(summary.totalCollected)}
          </span>
        </div>
        <div className="flex justify-between items-center bg-neutral-100 p-2 rounded-lg border border-black">
          <span className="text-neutral-700">Outstanding:</span>
          <span className="font-bold text-sm text-black">
            {formatCurrency(summary.totalOutstanding)}
          </span>
        </div>
        <div className="flex justify-between items-center bg-neutral-100 p-2 rounded-lg border border-black">
          <span className="text-neutral-700">Power Usage:</span>
          <span className="font-bold text-sm text-black">
            {formatKwh(summary.totalUnits)}
          </span>
        </div>
      </div>

      {/* Status Badges Row */}
      <div className="grid grid-cols-3 gap-1 text-center font-mono text-[10px] font-bold">
        <div className="bg-neutral-800 text-white border border-black p-1 rounded">
          {summary.paidCount} Paid
        </div>
        <div className="bg-neutral-400 text-black border border-black p-1 rounded">
          {summary.partialCount} Partial
        </div>
        <div className="bg-black text-white border border-black p-1 rounded">
          {summary.overdueCount} Overdue
        </div>
      </div>

      {/* Button */}
      <button className="w-full bg-black text-white hover:bg-neutral-800 font-mono font-bold text-xs py-2.5 rounded-xl border-2 border-black transition-transform active:scale-95 flex items-center justify-center gap-1.5 cursor-pointer">
        <span>Open 200 Rooms</span>
        <span>&rarr;</span>
      </button>
    </div>
  );
};



