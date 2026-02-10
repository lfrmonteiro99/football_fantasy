import React from 'react';
import clsx from 'clsx';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  leftIcon?: React.ReactNode;
}

export default function Input({
  label,
  error,
  hint,
  leftIcon,
  className,
  id,
  ...rest
}: InputProps) {
  const inputId = id || label?.toLowerCase().replace(/\s+/g, '-');

  return (
    <div className={className}>
      {label && (
        <label htmlFor={inputId} className="block text-body-sm font-medium text-gray-700 mb-1.5">
          {label}
        </label>
      )}
      <div className="relative">
        {leftIcon && (
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400">
            {leftIcon}
          </div>
        )}
        <input
          id={inputId}
          className={clsx(
            'input-base',
            leftIcon && 'pl-10',
            error && 'border-red-300 focus:border-red-500 focus:ring-red-500/20',
          )}
          {...rest}
        />
      </div>
      {error && <p className="mt-1 text-caption text-red-600">{error}</p>}
      {hint && !error && <p className="mt-1 text-caption text-gray-400">{hint}</p>}
    </div>
  );
}
