import React from 'react';
import { getMonthName } from '../../1_core/utils/dateUtils';
import { UsageEntry } from '../../1_core/domain/types';
import { formatCurrency, formatKwh } from '../../1_core/utils/formatters';

interface MonthlyReadingPanelProps {
  year: number;
  month: number;
  onMonthChange: (year: number, month: number) => void;
  entry?: UsageEntry;
  onOpenEntry: () => void;
  appliedRate: number;
}

export const MonthlyReadingPanel: React.FC<MonthlyReadingPanelProps> = ({
  year,
  month,
  onMonthChange,
  entry,
  onOpenEntry,
  appliedRate,
}) => {
  const handlePrevMonth = () => {
    if (month === 1) onMonthChange(year - 1, 12);
    else onMonthChange(year, month - 1);
  };
  const handleNextMonth = () => {
    if (month === 12) onMonthChange(year + 1, 1);
    else onMonthChange(year, month + 1);
  };

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
              Rate: {formatCurrency(appliedRate)}/kWh &bull; {entry ? 'Reading logged' : 'No reading yet'}
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
            className="bg-neutral-400 hover:bg-neutral-500 text-black border-2 border-black rounded-lg p-2 px-3 font-mono font-bold text-xs cursor-pointer"
          >
            This Month
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

      <div
        onClick={onOpenEntry}
        className={`p-5 rounded-xl border-2 cursor-pointer transition-all flex items-center justify-between ${
          entry
            ? 'bg-neutral-400 border-black hover:bg-neutral-500'
            : 'bg-white border-neutral-300 hover:border-black hover:bg-neutral-50'
        }`}
      >
        {entry ? (
          <div className="font-mono text-sm">
            <div className="font-bold text-black">{formatKwh(entry.unitsUsed)} used</div>
            <div className="text-black">{formatCurrency(entry.amountPaid)} paid</div>
          </div>
        ) : (
          <div className="font-mono text-sm text-neutral-500">+ Log this month's reading</div>
        )}
        <span className="font-mono text-xs font-bold text-black">{entry ? 'Edit' : 'Add'} &rarr;</span>
      </div>
    </div>
  );
};