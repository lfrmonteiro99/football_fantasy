import React from 'react';
import clsx from 'clsx';

interface BadgeProps {
  variant?: 'success' | 'warning' | 'danger' | 'info' | 'default' | 'brand';
  size?: 'sm' | 'md';
  dot?: boolean;
  children: React.ReactNode;
  className?: string;
}

const variantClasses: Record<string, string> = {
  success: 'bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-600/10',
  warning: 'bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-600/10',
  danger: 'bg-red-50 text-red-700 ring-1 ring-inset ring-red-600/10',
  info: 'bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-600/10',
  default: 'bg-gray-100 text-gray-600 ring-1 ring-inset ring-gray-500/10',
  brand: 'bg-brand-50 text-brand-700 ring-1 ring-inset ring-brand-600/10',
};

const dotColors: Record<string, string> = {
  success: 'bg-emerald-500',
  warning: 'bg-amber-500',
  danger: 'bg-red-500',
  info: 'bg-blue-500',
  default: 'bg-gray-400',
  brand: 'bg-brand-500',
};

const sizeClasses: Record<string, string> = {
  sm: 'px-1.5 py-0.5 text-xs',
  md: 'px-2.5 py-1 text-sm',
};

export default function Badge({
  variant = 'default',
  size = 'sm',
  dot = false,
  children,
  className,
}: BadgeProps) {
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1 rounded-full font-medium',
        variantClasses[variant],
        sizeClasses[size],
        className,
      )}
    >
      {dot && (
        <span className={clsx('h-1.5 w-1.5 rounded-full', dotColors[variant])} />
      )}
      {children}
    </span>
  );
}
