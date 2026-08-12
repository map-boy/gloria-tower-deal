import React, { useState } from 'react';
import { generateCalendarGrid, getMonthName } from '../../1_core/utils/dateUtils';
import { UsageEntry } from '../../1_core/domain/types';
import { formatCurrency, formatKwh } from '../../1_core/utils/formatters';

interface CalendarGridProps {
  year: number;
  month: number;
  onMonthChange: (year: number, month: number) => void;
  entries: UsageEntry[];
  onSelectDate: (dateStr: string, existingEntry?: UsageEntry) => void;
  appliedRate: number;
}

export const CalendarGrid: React.FC<CalendarGridProps> = ({
  year,
  month,
  onMonthChange,
  entries,
  onSelectDate,
  appliedRate,
}) => {
  const cells = generateCalendarGrid(year, month);
  const entryMap = new Map<string, UsageEntry>();
  entries.forEach((e) => entryMap.set(e.date, e));

  const handlePrevMonth = () => {
    if (month === 1) {
      onMonthChange(year - 1, 12);
    } else {
      onMonthChange(year, month - 1);
    }
  };

  const handleNextMonth = () => {
    if (month === 12) {
      onMonthChange(year + 1, 1);
    } else {
      onMonthChange(year, month + 1);
    }
  };

  const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const monthEntries = entries.filter((e) =>
    e.date.startsWith(`${year}-${month.toString().padStart(2, '0')}`)
  );
  const totalUnits = monthEntries.reduce((acc, e) => acc + (e.unitsUsed || 0), 0);
  const totalPaid = monthEntries.reduce((acc, e) => acc + (e.amountPaid || 0), 0);

  return (
    <div className="bg-white border-3 border-black rounded-2xl p-4 sm:p-6 shadow-none">
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="bg-black text-white p-2 rounded-lg font-mono font-bold text-lg">
            &#9638;
          </div>
          <div>
            <h3 className="text-xl sm:text-2xl font-serif font-black text-black">
              {getMonthName(month)} {year}
            </h3>
            <p className="font-mono text-xs text-neutral-600">
              Rate: {formatCurrency(appliedRate)}/kWh | {monthEntries.length} entries logged
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handlePrevMonth}
            className="bg-white hover:bg-neutral-100 text-black border-2 border-black rounded-lg p-2 px-3 font-mono font-black text-sm cursor-pointer transition-transform active:scale-95"
            title="Previous Month"
          >
            &lt; Prev
          </button>
          <button
            onClick={() => {
              const now = new Date();
              onMonthChange(now.getFullYear(), now.getMonth() + 1);
            }}
            className="bg-[#feca57] hover:bg-[#f3b528] text-black border-2 border-black rounded-lg p-2 px-3 font-mono font-bold text-xs cursor-pointer"
          >
            Today
          </button>
          <button
            onClick={handleNextMonth}
            className="bg-white hover:bg-neutral-100 text-black border-2 border-black rounded-lg p-2 px-3 font-mono font-black text-sm cursor-pointer transition-transform active:scale-95"
            title="Next Month"
          >
            Next &gt;
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1 sm:gap-2 mb-2 text-center font-mono font-bold text-xs text-black uppercase">
        {daysOfWeek.map((day) => (
          <div
            key={day}
            className="bg-[#a8e6cf] border-2 border-black p-2 rounded-lg"
          >
            {day}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1 sm:gap-2">
        {cells.map((cell, idx) => {
          const entry = entryMap.get(cell.dateStr);
          const hasEntry = !!entry;
          const isToday =
            cell.dateStr === new Date().toISOString().split('T')[0];

          return (
            <div
              key={`${cell.dateStr}-${idx}`}
              onClick={() => onSelectDate(cell.dateStr, entry)}
              className={`min-h-[70px] sm:min-h-[90px] p-1.5 sm:p-2 rounded-xl border-2 transition-all cursor-pointer flex flex-col justify-between relative select-none ${
                !cell.isCurrentMonth
                  ? 'bg-neutral-100/60 border-neutral-300 opacity-50'
                  : hasEntry
                  ? 'bg-[#feca57] border-black hover:bg-[#f3b528] shadow-none'
                  : isToday
                  ? 'bg-white border-black ring-2 ring-black font-bold'
                  : 'bg-white border-neutral-300 hover:border-black hover:bg-neutral-50'
              }`}
            >
              <div className="flex items-center justify-between">
                <span
                  className={`font-mono text-xs sm:text-sm font-black ${
                    !cell.isCurrentMonth
                      ? 'text-neutral-400'
                      : hasEntry
                      ? 'text-black'
                      : 'text-black'
                  }`}
                >
                  {cell.dayNumber}
                </span>

                {hasEntry && (
                  <span className="w-2.5 h-2.5 rounded-full bg-black border border-white" />
                )}
              </div>

              {hasEntry && entry ? (
                <div className="mt-1 font-mono text-[10px] sm:text-xs leading-tight bg-black text-white p-1 rounded-md border border-black">
                  <div className="font-bold text-[#7bed9f]">
                    {formatKwh(entry.unitsUsed)}
                  </div>
                  <div className="text-white">
                    {formatCurrency(entry.amountPaid)}
                  </div>
                </div>
              ) : cell.isCurrentMonth ? (
                <div className="text-[10px] font-mono text-neutral-400 opacity-0 hover:opacity-100 transition-opacity mt-auto">
                  + Add
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      <div className="mt-6 pt-4 border-t-2 border-black flex flex-wrap items-center justify-between gap-4 font-mono text-xs">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <span className="w-3.5 h-3.5 bg-[#feca57] border border-black rounded" />
            <span>Logged Day</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3.5 h-3.5 bg-white border border-neutral-400 rounded" />
            <span>No Entry</span>
          </div>
        </div>

        <div className="bg-[#a8e6cf] border-2 border-black p-2 px-3 rounded-lg font-bold text-black">
          Month Totals: {formatKwh(totalUnits)} | Paid: {formatCurrency(totalPaid)}
        </div>
      </div>
    </div>
  );
};