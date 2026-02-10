import React from 'react';
import clsx from 'clsx';

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

export default function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div className={clsx('py-12 px-4 text-center', className)}>
      {icon && (
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center text-gray-300">
          {icon}
        </div>
      )}
      <h3 className="text-heading-3 text-gray-900">{title}</h3>
      {description && (
        <p className="mt-1 text-body-sm text-gray-500 max-w-sm mx-auto">{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
