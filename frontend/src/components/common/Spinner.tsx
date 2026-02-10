import React from 'react';
import clsx from 'clsx';

interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  color?: 'brand' | 'gray' | 'white';
  className?: string;
}

const sizeClasses: Record<string, string> = {
  sm: 'h-4 w-4 border-2',
  md: 'h-6 w-6 border-2',
  lg: 'h-10 w-10 border-3',
};

const colorClasses: Record<string, string> = {
  brand: 'border-brand-600 border-t-transparent',
  gray: 'border-gray-400 border-t-transparent',
  white: 'border-white border-t-transparent',
};

export default function Spinner({ size = 'md', color = 'brand', className }: SpinnerProps) {
  return (
    <div
      className={clsx(
        'animate-spin rounded-full border-solid',
        sizeClasses[size],
        colorClasses[color],
        className,
      )}
      role="status"
      aria-label="Loading"
    >
      <span className="sr-only">Loading...</span>
    </div>
  );
}
