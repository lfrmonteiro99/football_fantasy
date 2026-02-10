import React from 'react';
import clsx from 'clsx';

interface TabItem {
  key: string;
  label: string;
  badge?: React.ReactNode;
}

interface TabsProps {
  items: TabItem[];
  activeKey: string;
  onChange: (key: string) => void;
  variant?: 'pills' | 'underline';
  size?: 'sm' | 'md';
  className?: string;
}

export default function Tabs({
  items,
  activeKey,
  onChange,
  variant = 'pills',
  size = 'md',
  className,
}: TabsProps) {
  if (variant === 'underline') {
    return (
      <div className={clsx('flex border-b border-gray-200', className)}>
        {items.map((item) => (
          <button
            key={item.key}
            onClick={() => onChange(item.key)}
            className={clsx(
              'relative px-4 pb-2.5 pt-1 text-body font-medium transition-colors',
              activeKey === item.key
                ? 'text-brand-700 after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-brand-600 after:rounded-full'
                : 'text-gray-500 hover:text-gray-700',
              size === 'sm' && 'px-3 text-body-sm',
            )}
          >
            <span className="inline-flex items-center gap-1.5">
              {item.label}
              {item.badge}
            </span>
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className={clsx('inline-flex rounded-lg bg-gray-100 p-1', className)}>
      {items.map((item) => (
        <button
          key={item.key}
          onClick={() => onChange(item.key)}
          className={clsx(
            'rounded-md px-3 py-1.5 font-medium transition-all duration-150',
            size === 'sm' ? 'text-body-sm' : 'text-body',
            activeKey === item.key
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-500 hover:text-gray-700',
          )}
        >
          <span className="inline-flex items-center gap-1.5">
            {item.label}
            {item.badge}
          </span>
        </button>
      ))}
    </div>
  );
}
