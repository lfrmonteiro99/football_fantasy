import React from 'react';
import clsx from 'clsx';

interface StatCardProps {
  value: string | number;
  label: string;
  icon?: React.ReactNode;
  accent?: 'brand' | 'accent' | 'navy';
  className?: string;
}

const accentStyles: Record<string, { border: string; iconBg: string; iconColor: string }> = {
  brand: {
    border: 'border-l-brand-500',
    iconBg: 'bg-brand-50',
    iconColor: 'text-brand-600',
  },
  accent: {
    border: 'border-l-accent-400',
    iconBg: 'bg-accent-50',
    iconColor: 'text-accent-600',
  },
  navy: {
    border: 'border-l-navy-600',
    iconBg: 'bg-navy-50',
    iconColor: 'text-navy-600',
  },
};

export default function StatCard({
  value,
  label,
  icon,
  accent = 'brand',
  className,
}: StatCardProps) {
  const a = accentStyles[accent];

  return (
    <div
      className={clsx(
        'rounded-xl border border-surface-border bg-white px-4 py-4 shadow-card hover:shadow-card-hover transition-all duration-250',
        'border-l-[3px]',
        a.border,
        className,
      )}
    >
      <div className="flex items-start justify-between">
        <div>
          <div className="text-overline text-gray-500 uppercase tracking-wider mb-2">{label}</div>
          <div className="font-display text-stat text-navy-900 uppercase">{value}</div>
        </div>
        {icon && (
          <div className={clsx('flex items-center justify-center w-9 h-9 rounded-lg', a.iconBg, a.iconColor)}>
            {icon}
          </div>
        )}
      </div>
    </div>
  );
}
