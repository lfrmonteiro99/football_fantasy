import React from 'react';
import clsx from 'clsx';

interface SkeletonProps {
  className?: string;
  variant?: 'text' | 'circular' | 'rectangular';
  width?: string | number;
  height?: string | number;
}

function SkeletonBase({ className, variant = 'text', width, height }: SkeletonProps) {
  return (
    <div
      className={clsx(
        'bg-gray-200 animate-skeleton',
        variant === 'text' && 'h-4 rounded',
        variant === 'circular' && 'rounded-full',
        variant === 'rectangular' && 'rounded-xl',
        className,
      )}
      style={{ width, height }}
    />
  );
}

function SkeletonCard() {
  return (
    <div className="rounded-xl border border-gray-200/60 bg-white p-6 shadow-card">
      <SkeletonBase className="mb-3 h-3 w-20" />
      <SkeletonBase className="mb-2 h-6 w-16" />
      <SkeletonBase className="h-3 w-24" />
    </div>
  );
}

function SkeletonTable({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-0 divide-y divide-gray-100">
      <div className="flex gap-4 px-3 py-2.5">
        <SkeletonBase className="h-3 w-8" />
        <SkeletonBase className="h-3 w-32" />
        <SkeletonBase className="h-3 w-12 ml-auto" />
        <SkeletonBase className="h-3 w-12" />
        <SkeletonBase className="h-3 w-12" />
      </div>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 px-3 py-3">
          <SkeletonBase className="h-4 w-6" />
          <SkeletonBase className="h-4 w-36" />
          <SkeletonBase className="h-4 w-8 ml-auto" />
          <SkeletonBase className="h-4 w-8" />
          <SkeletonBase className="h-4 w-10" />
        </div>
      ))}
    </div>
  );
}

function SkeletonStatCard() {
  return (
    <div className="rounded-xl border border-gray-200/60 bg-white px-4 py-4 shadow-card">
      <SkeletonBase className="mb-2 h-5 w-5" variant="circular" />
      <SkeletonBase className="mb-2 h-7 w-16" />
      <SkeletonBase className="h-3 w-20" />
    </div>
  );
}

const Skeleton = Object.assign(SkeletonBase, {
  Card: SkeletonCard,
  Table: SkeletonTable,
  StatCard: SkeletonStatCard,
});

export default Skeleton;
