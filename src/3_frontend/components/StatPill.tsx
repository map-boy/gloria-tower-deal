import React from 'react';

interface StatPillProps {
  value: string | number;
  label: string;
  subValue?: string;
  className?: string;
}

export const StatPill: React.FC<StatPillProps> = ({
  value,
  label,
  subValue,
  className = '',
}) => {
  return (
    <div
      className={`bg-black text-white p-2.5 px-3.5 rounded-xl border-2 border-black flex flex-col justify-center shadow-none transition-transform hover:scale-[1.02] ${className}`}
    >
      <div className="flex items-baseline gap-1">
        <span className="text-xl sm:text-2xl font-black tracking-tight leading-none text-white">
          {value}
        </span>
        {subValue && (
          <span className="text-xs font-semibold text-neutral-400">
            {subValue}
          </span>
        )}
      </div>
      <span className="text-[10px] sm:text-[11px] font-mono tracking-wider uppercase text-neutral-300 mt-1 whitespace-nowrap">
        {label}
      </span>
    </div>
  );
};
