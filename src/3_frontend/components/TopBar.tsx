import React from 'react';

interface TopBarProps {
  title: string;
  onBack?: () => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  onOpenMobileSidebar: () => void;
  resetData: () => void;
  isDark: boolean;
  onToggleDark: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({
  title,
  onBack,
  searchQuery,
  onSearchChange,
  onOpenMobileSidebar,
  resetData,
  isDark,
  onToggleDark,
}) => {
  return (
    <header className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 mb-6 pb-4 border-b-2 border-black dark:border-neutral-700">
      <div className="flex items-center gap-3">
        <button
          onClick={onOpenMobileSidebar}
          className="lg:hidden p-2 bg-white dark:bg-neutral-900 border-2 border-black dark:border-neutral-200 rounded-lg font-mono font-bold text-sm text-black dark:text-neutral-100 cursor-pointer"
        >
          &#9776;
        </button>

        {onBack && (
          <button
            onClick={onBack}
            className="p-2 bg-white dark:bg-neutral-900 hover:bg-neutral-100 dark:hover:bg-neutral-800 border-2 border-black dark:border-neutral-200 rounded-lg text-black dark:text-neutral-100 font-mono font-bold transition-transform active:scale-95 cursor-pointer flex items-center justify-center w-10 h-10"
            title="Go Back"
          >
            &#8592;
          </button>
        )}

        <div>
          <h1 className="text-2xl sm:text-3xl font-serif font-black tracking-tight text-black dark:text-neutral-100">
            {title}
          </h1>
        </div>
      </div>

      <div className="flex items-center gap-2 sm:gap-3">
        <div className="relative flex-1 sm:w-64">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search rooms, tenants..."
            className="w-full bg-white dark:bg-neutral-900 text-black dark:text-neutral-100 font-mono text-xs p-2.5 pl-3 border-2 border-black dark:border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-neutral-200 placeholder:text-neutral-500 dark:placeholder:text-neutral-500"
          />
          {searchQuery && (
            <button
              onClick={() => onSearchChange('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs font-mono font-bold text-neutral-500 hover:text-black dark:hover:text-neutral-100"
            >
              &#10005;
            </button>
          )}
        </div>

        <button
          onClick={onToggleDark}
          className="bg-white dark:bg-neutral-900 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-black dark:text-neutral-100 border-2 border-black dark:border-neutral-200 rounded-lg p-2 w-10 h-10 flex items-center justify-center font-mono font-bold cursor-pointer"
          title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {isDark ? <>&#9788;</> : <>&#9789;</>}
        </button>

        <button
          onClick={() => {
            if (confirm('Reset to initial seed dataset (8 floors, 1,600 rooms)?')) {
              resetData();
            }
          }}
          className="bg-black hover:bg-neutral-800 text-white border-2 border-black p-2 px-3 rounded-lg font-mono font-bold text-xs cursor-pointer whitespace-nowrap"
          title="Reset Seed Data"
        >
          &#8635; Reset Data
        </button>

        <button
          className="bg-white dark:bg-neutral-900 hover:bg-neutral-100 dark:hover:bg-neutral-800 border-2 border-black dark:border-neutral-200 rounded-lg p-2 w-10 h-10 flex items-center justify-center text-black dark:text-neutral-100 font-mono font-bold cursor-pointer"
          onClick={() => alert('No new tower notifications')}
          title="Notifications"
        >
          &#9673;
        </button>

        <div className="w-10 h-10 bg-neutral-300 border-2 border-black rounded-lg flex items-center justify-center font-mono font-bold text-black overflow-hidden shrink-0">
          <span className="text-xs">VT</span>
        </div>
      </div>
    </header>
  );
};
