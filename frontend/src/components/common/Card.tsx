import React from 'react';
import clsx from 'clsx';

interface CardProps {
  title?: string;
  subtitle?: string;
  className?: string;
  children: React.ReactNode;
  actions?: React.ReactNode;
  footer?: React.ReactNode;
  variant?: 'default' | 'outlined' | 'elevated';
  noPadding?: boolean;
}

const variantStyles: Record<string, string> = {
  default: 'border border-surface-border bg-white shadow-card',
  outlined: 'border border-surface-border bg-white',
  elevated: 'bg-white shadow-md',
};

export default function Card({
  title,
  subtitle,
  className,
  children,
  actions,
  footer,
  variant = 'default',
  noPadding = false,
}: CardProps) {
  return (
    <div
      className={clsx(
        'rounded-xl transition-shadow duration-250',
        variantStyles[variant],
        !noPadding && 'p-5',
        className,
      )}
    >
      {(title || actions) && (
        <div className={clsx('mb-4 flex items-start justify-between', noPadding && 'px-5 pt-5')}>
          <div>
            {title && (
              <h3 className="font-display text-base font-bold uppercase tracking-wide text-navy-800">{title}</h3>
            )}
            {subtitle && (
              <p className="mt-1 text-body-sm text-gray-500">{subtitle}</p>
            )}
          </div>
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </div>
      )}
      {children}
      {footer && (
        <div className={clsx('mt-4 border-t border-surface-border-subtle pt-4', noPadding && 'mx-5 pb-5')}>
          {footer}
        </div>
      )}
    </div>
  );
}
