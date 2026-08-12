import React from 'react';

interface TopBarProps {
  title: string;
  onBack?: () => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  onOpenMobileSidebar: () => void;
  resetData: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({
  title,
  onBack,
  searchQuery,
  onSearchChange,
  onOpenMobileSidebar,
  resetData,
}) => {
  return (
    <header className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 mb-6 pb-4 border-b-2 border-black">
      {/* Title & Back Button */}
      <div className="flex items-center gap-3">
        <button
          onClick={onOpenMobileSidebar}
          className="lg:hidden p-2 bg-white border-2 border-black rounded-lg font-mono font-bold text-sm text-black cursor-pointer"
        >
          ☰
        </button>

        {onBack && (
          <button
            onClick={onBack}
            className="p-2 bg-white hover:bg-neutral-100 border-2 border-black rounded-lg text-black font-mono font-bold transition-transform active:scale-95 cursor-pointer flex items-center justify-center w-10 h-10"
            title="Go Back"
          >
            ←
          </button>
        )}

        <div>
          <h1 className="text-2xl sm:text-3xl font-serif font-black tracking-tight text-black">
            {title}
          </h1>
        </div>
      </div>

      {/* Right Search & Controls */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Search input */}
        <div className="relative flex-1 sm:w-64">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Q Search rooms, tenants..."
            className="w-full bg-white text-black font-mono text-xs p-2.5 pl-3 border-2 border-black rounded-lg focus:outline-none focus:ring-2 focus:ring-black placeholder:text-neutral-500"
          />
          {searchQuery && (
            <button
              onClick={() => onSearchChange('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs font-mono font-bold text-neutral-500 hover:text-black"
            >
              ✕
            </button>
          )}
        </div>

        {/* Demo reset data button */}
        <button
          onClick={() => {
            if (confirm('Reset to initial seed dataset (8 floors, 1,600 rooms)?')) {
              resetData();
            }
          }}
          className="bg-[#ff80bf] hover:bg-[#ff66b2] text-black border-2 border-black p-2 px-3 rounded-lg font-mono font-bold text-xs cursor-pointer whitespace-nowrap"
          title="Reset Seed Data"
        >
          🔄 Seed Data
        </button>

        {/* Bell notification */}
        <button
          className="bg-white hover:bg-neutral-100 border-2 border-black rounded-lg p-2 w-10 h-10 flex items-center justify-center text-black font-mono font-bold cursor-pointer"
          onClick={() => alert('No new tower notifications')}
          title="Notifications"
        >
          🔔
        </button>

        {/* User avatar */}
        <div className="w-10 h-10 bg-[#feca57] border-2 border-black rounded-lg flex items-center justify-center font-mono font-bold text-black overflow-hidden shrink-0">
          <span className="text-sm">🏢</span>
        </div>
      </div>
    </header>
  );
};
