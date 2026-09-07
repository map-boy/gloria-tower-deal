import React from 'react';

interface TopBarProps {
  title: string;
  onOpenMobileSidebar: () => void;
  role: 'admin' | 'tenant';
}

export const TopBar: React.FC<TopBarProps> = ({ title, onOpenMobileSidebar, role }) => {
  return (
    <header className="flex items-center justify-between gap-3 mb-6 pb-4 border-b-2 border-black">
      <div className="flex items-center gap-3">
        <button
          onClick={onOpenMobileSidebar}
          className="lg:hidden p-2 bg-white border-2 border-black rounded-lg font-mono font-bold text-sm text-black cursor-pointer"
        >
          &#9776;
        </button>
        <h1 className="text-2xl sm:text-3xl font-serif font-black tracking-tight text-black">
          {title}
        </h1>
      </div>
      <div className="w-10 h-10 bg-neutral-300 border-2 border-black rounded-lg flex items-center justify-center font-mono font-bold text-black shrink-0 text-xs">
        {role === 'admin' ? 'AD' : 'TN'}
      </div>
    </header>
  );
};
