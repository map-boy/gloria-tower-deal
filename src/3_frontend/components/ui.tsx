import React from 'react';

// Shared shell for all four portals. Green is the ground, gold flags things
// that need a person, red flags late or broken.

export const Card: React.FC<{ children: React.ReactNode; className?: string }> = ({
  children, className = '',
}) => (
  <div className={`bg-emerald-deep border border-bone/15 rounded-2xl p-4 ${className}`}>
    {children}
  </div>
);

export const Banner: React.FC<{
  tone: 'good' | 'warn' | 'bad';
  title: string;
  children?: React.ReactNode;
}> = ({ tone, title, children }) => {
  const tones = {
    good: 'bg-emerald-mid text-bone',
    warn: 'bg-gold text-emerald-dark',
    bad: 'bg-alert text-bone',
  };
  return (
    <div className={`rounded-2xl px-4 py-3 ${tones[tone]}`}>
      <div className="font-bold text-sm">{title}</div>
      {children && <div className="text-xs opacity-90 mt-0.5">{children}</div>}
    </div>
  );
};

export const Stat: React.FC<{
  value: React.ReactNode;
  label: string;
  tone?: 'good' | 'warn' | 'bad' | 'plain';
}> = ({ value, label, tone = 'plain' }) => {
  const tones = {
    plain: 'bg-emerald-deep border-bone/15 text-bone',
    good: 'bg-emerald-mid border-bone/20 text-bone',
    warn: 'bg-gold border-emerald-dark/20 text-emerald-dark',
    bad: 'bg-alert border-bone/20 text-bone',
  };
  return (
    <div className={`border rounded-2xl p-3 ${tones[tone]}`}>
      <div className="text-lg sm:text-xl font-black leading-tight break-words">{value}</div>
      <div className="text-[10px] uppercase tracking-wider opacity-75 mt-1">{label}</div>
    </div>
  );
};

export const Button: React.FC<
  React.ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: 'primary' | 'ghost' | 'danger' | 'gold';
    full?: boolean;
  }
> = ({ variant = 'primary', full, className = '', children, ...rest }) => {
  const variants = {
    primary: 'bg-gold text-emerald-dark hover:brightness-110',
    gold: 'bg-gold-soft text-emerald-dark hover:brightness-110',
    ghost: 'bg-transparent text-bone border border-bone/30 hover:bg-bone/10',
    danger: 'bg-alert text-bone hover:brightness-110',
  };
  return (
    <button
      {...rest}
      className={`${variants[variant]} ${full ? 'w-full' : ''} font-bold text-xs px-4 py-2.5
        rounded-xl transition disabled:opacity-40 disabled:cursor-not-allowed
        cursor-pointer ${className}`}
    >
      {children}
    </button>
  );
};

export const Field: React.FC<{
  label: string;
  hint?: string;
  children: React.ReactNode;
}> = ({ label, hint, children }) => (
  <div>
    <label className="block text-[10px] font-bold uppercase tracking-wider text-bone/70 mb-1">
      {label}
    </label>
    {children}
    {hint && <p className="text-[10px] text-bone/50 mt-1">{hint}</p>}
  </div>
);

export const inputClass =
  'w-full bg-emerald-dark text-bone text-sm px-3 py-2.5 rounded-xl border border-bone/20 ' +
  'placeholder:text-bone/30 focus:outline-none focus:border-gold';

export const Tabs: React.FC<{
  tabs: Array<{ id: string; label: string; badge?: number }>;
  active: string;
  onChange: (id: string) => void;
}> = ({ tabs, active, onChange }) => (
  <div className="flex gap-1.5 overflow-x-auto pb-1 mb-4">
    {tabs.map((t) => (
      <button
        key={t.id}
        onClick={() => onChange(t.id)}
        className={`shrink-0 px-3 py-2 rounded-xl font-bold text-[11px] uppercase tracking-wide
          cursor-pointer transition ${
            active === t.id
              ? 'bg-gold text-emerald-dark'
              : 'bg-emerald-deep text-bone/70 border border-bone/15 hover:text-bone'
          }`}
      >
        {t.label}
        {t.badge ? (
          <span
            className={`ml-1.5 px-1.5 py-0.5 rounded-full text-[9px] ${
              active === t.id ? 'bg-emerald-dark text-gold' : 'bg-alert text-bone'
            }`}
          >
            {t.badge}
          </span>
        ) : null}
      </button>
    ))}
  </div>
);

export const Modal: React.FC<{
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}> = ({ open, title, onClose, children }) => {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-emerald-dark/80 p-0 sm:p-4">
      <div className="bg-emerald-deep border border-bone/20 rounded-t-2xl sm:rounded-2xl w-full max-w-md max-h-[92vh] overflow-y-auto">
        <div className="sticky top-0 bg-emerald-deep flex items-center justify-between px-4 py-3 border-b border-bone/15">
          <h3 className="font-black text-base">{title}</h3>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg border border-bone/25 text-bone cursor-pointer hover:bg-bone/10"
          >
            ✕
          </button>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>
  );
};

export const Empty: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="border border-dashed border-bone/25 rounded-2xl p-6 text-center text-xs text-bone/60">
    {children}
  </div>
);

export const PortalShell: React.FC<{
  title: string;
  subtitle?: string;
  onLogout: () => void;
  right?: React.ReactNode;
  children: React.ReactNode;
}> = ({ title, subtitle, onLogout, right, children }) => (
  <div className="min-h-screen bg-emerald-dark text-bone">
    <div className="max-w-3xl mx-auto p-4 sm:p-6">
      <header className="flex items-start justify-between gap-3 mb-5 pb-4 border-b border-bone/15">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-black tracking-tight truncate">{title}</h1>
          {subtitle && <p className="text-[11px] text-bone/60 truncate">{subtitle}</p>}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {right}
          <Button variant="ghost" onClick={onLogout}>Exit</Button>
        </div>
      </header>
      {children}
    </div>
  </div>
);
