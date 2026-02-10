import React from 'react';
import clsx from 'clsx';
import Spinner from './Spinner';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  children: React.ReactNode;
}

const variantClasses: Record<string, string> = {
  primary:
    'bg-brand-600 text-white shadow-xs hover:bg-brand-700 hover:shadow-sm focus-visible:ring-2 focus-visible:ring-brand-500/40 disabled:bg-brand-300 disabled:shadow-none',
  secondary:
    'bg-gray-100 text-gray-700 hover:bg-gray-200 focus-visible:ring-2 focus-visible:ring-gray-400/40 disabled:bg-gray-50 disabled:text-gray-400',
  outline:
    'border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 hover:border-gray-300 focus-visible:ring-2 focus-visible:ring-gray-400/40 disabled:bg-gray-50 disabled:text-gray-400',
  danger:
    'bg-red-600 text-white shadow-xs hover:bg-red-700 hover:shadow-sm focus-visible:ring-2 focus-visible:ring-red-500/40 disabled:bg-red-300',
  ghost:
    'bg-transparent text-gray-600 hover:bg-gray-100 hover:text-gray-900 focus-visible:ring-2 focus-visible:ring-gray-400/40 disabled:text-gray-300',
};

const sizeClasses: Record<string, string> = {
  sm: 'px-3 py-1.5 text-body-sm',
  md: 'px-4 py-2 text-body',
  lg: 'px-6 py-3 text-base',
};

export default function Button({
  variant = 'primary',
  size = 'md',
  isLoading = false,
  disabled,
  children,
  className,
  ...rest
}: ButtonProps) {
  return (
    <button
      className={clsx(
        'inline-flex items-center justify-center gap-2 rounded-md font-medium transition-all duration-150 ease-spring focus:outline-none active:scale-[0.98]',
        variantClasses[variant],
        sizeClasses[size],
        className,
      )}
      disabled={disabled || isLoading}
      {...rest}
    >
      {isLoading ? (
        <>
          <Spinner size="sm" />
          <span>Loading...</span>
        </>
      ) : (
        children
      )}
    </button>
  );
}
