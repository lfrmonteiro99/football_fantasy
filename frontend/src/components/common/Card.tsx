import React from 'react';
import clsx from 'clsx';

interface CardProps {
  title?: string;
  subtitle?: string;
  className?: string;
  children: React.ReactNode;
  actions?: React.ReactNode;
}

export default function Card({
  title,
  subtitle,
  className,
  children,
  actions,
}: CardProps) {
  return (
    <div className={clsx('rounded-lg bg-white p-6 shadow-sm', className)}>
      {(title || actions) && (
        <div className="mb-4 flex items-start justify-between">
          <div>
            {title && (
              <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
            )}
            {subtitle && (
              <p className="mt-1 text-sm text-gray-500">{subtitle}</p>
            )}
          </div>
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </div>
      )}
      {children}
    </div>
  );
}
