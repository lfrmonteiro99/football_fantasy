import React from 'react';

// ── Stat Card ──
export function StatCard({ label, value, color = 'brand', icon }: {
  label: string; value: string | number; color?: 'brand' | 'accent' | 'navy' | 'red'; icon?: React.ReactNode;
}) {
  const colors = {
    brand: 'from-brand-600/20 to-brand-600/5 border-brand-500/20',
    accent: 'from-accent-600/20 to-accent-600/5 border-accent-500/20',
    navy: 'from-navy-600/20 to-navy-600/5 border-navy-500/20',
    red: 'from-red-600/20 to-red-600/5 border-red-500/20',
  };
  return (
    <div className={`bg-gradient-to-br ${colors[color]} border rounded-xl p-3 flex flex-col gap-1`}>
      <div className="flex items-center gap-1.5">
        {icon}
        <span className="text-[10px] uppercase tracking-wider text-navy-400 font-medium">{label}</span>
      </div>
      <span className="text-xl font-bold text-white">{value}</span>
    </div>
  );
}

// ── Badge ──
export function Badge({ children, variant = 'info', size = 'sm' }: {
  children: React.ReactNode; variant?: 'success' | 'warning' | 'danger' | 'info'; size?: 'sm' | 'md';
}) {
  const variants = {
    success: 'bg-brand-500/20 text-brand-400',
    warning: 'bg-accent-500/20 text-accent-400',
    danger: 'bg-red-500/20 text-red-400',
    info: 'bg-blue-500/20 text-blue-400',
  };
  const sizes = { sm: 'px-1.5 py-0.5 text-[10px]', md: 'px-2 py-1 text-xs' };
  return (
    <span className={`${variants[variant]} ${sizes[size]} rounded-full font-semibold inline-flex items-center`}>
      {children}
    </span>
  );
}

// ── Form Badge ──
export function FormBadge({ result }: { result: string }) {
  if (result === 'W') return <span className="form-badge-w">W</span>;
  if (result === 'D') return <span className="form-badge-d">D</span>;
  return <span className="form-badge-l">L</span>;
}

// ── Segment Control ──
export function SegmentControl({ options, value, onChange }: {
  options: { label: string; value: string }[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="segment-control">
      {options.map((opt) => (
        <button
          key={opt.value}
          className={value === opt.value ? 'segment-item-active' : 'segment-item-inactive'}
          onClick={() => onChange(opt.value)}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

// ── Bottom Sheet ──
export function Sheet({ open, onClose, title, children }: {
  open: boolean; onClose: () => void; title?: string; children: React.ReactNode;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[100]">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="absolute bottom-0 left-0 right-0 bg-navy-900 rounded-t-3xl animate-slide-up max-h-[85vh] flex flex-col">
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-white/20" />
        </div>
        {title && (
          <div className="px-5 py-2 flex items-center justify-between border-b border-white/10">
            <h3 className="text-base font-bold text-white">{title}</h3>
            <button onClick={onClose} className="text-navy-400 text-xl leading-none">&times;</button>
          </div>
        )}
        <div className="flex-1 overflow-hidden">
          {children}
        </div>
      </div>
    </div>
  );
}

// ── Spinner ──
export function Spinner({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const s = { sm: 'w-4 h-4', md: 'w-6 h-6', lg: 'w-8 h-8' };
  return (
    <div className="flex items-center justify-center">
      <div className={`${s[size]} border-2 border-brand-500/30 border-t-brand-500 rounded-full animate-spin`} />
    </div>
  );
}

// ── Empty State ──
export function EmptyState({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-2 text-center px-8">
      <span className="text-3xl">&#9917;</span>
      <p className="text-sm font-semibold text-navy-300">{title}</p>
      {subtitle && <p className="text-xs text-navy-500">{subtitle}</p>}
    </div>
  );
}

// ── Slider Control ──
export function SliderControl({ label, value, options, onChange }: {
  label: string;
  value: string;
  options: string[];
  onChange: (v: string) => void;
}) {
  const idx = options.indexOf(value);
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-medium text-navy-300">{label}</span>
        <span className="text-[11px] font-semibold text-brand-400 capitalize">{value.replace(/_/g, ' ')}</span>
      </div>
      <div className="flex gap-0.5">
        {options.map((opt, i) => (
          <button
            key={opt}
            onClick={() => onChange(opt)}
            className={`flex-1 h-1.5 rounded-full transition-colors ${
              i <= idx ? 'bg-brand-500' : 'bg-white/10'
            }`}
          />
        ))}
      </div>
    </div>
  );
}
