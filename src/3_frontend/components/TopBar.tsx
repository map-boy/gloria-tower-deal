import React from 'react';

interface TopBarProps {
  title: string;
  subtitle?: string;
  role: 'admin' | 'tenant';
  onLogout: () => void;
  right?: React.ReactNode;
}

export const TopBar: React.FC<TopBarProps> = ({ title, subtitle, role, onLogout, right }) => {
  return (
    <header className="flex items-center justify-between gap-3 mb-6 pb-4 border-b-2 border-black">
      <div className="min-w-0">
        <h1 className="text-xl sm:text-3xl font-serif font-black tracking-tight text-black truncate">
          {title}
        </h1>
        {subtitle && (
          <p className="font-mono text-[11px] uppercase tracking-wider text-neutral-600 truncate">
            {subtitle}
          </p>
        )}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {right}
        <span className="hidden sm:flex w-10 h-10 bg-neutral-300 border-2 border-black rounded-lg items-center justify-center font-mono font-bold text-black text-xs">
          {role === 'admin' ? 'AD' : 'TN'}
        </span>
        <button
          onClick={onLogout}
          className="px-3 py-2 bg-white hover:bg-neutral-100 border-2 border-black rounded-lg font-mono font-bold text-xs text-black cursor-pointer"
        >
          Exit
        </button>
      </div>
    </header>
  );
};
