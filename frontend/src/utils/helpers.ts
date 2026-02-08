import { format, parseISO } from 'date-fns';
import { POSITION_COLORS } from './constants';
import type { FormResult } from 'types';

/**
 * Format a numeric value as currency (EUR).
 */
export function formatCurrency(value: number | string): string {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) return '\u20AC0';

  if (num >= 1_000_000) {
    return `\u20AC${(num / 1_000_000).toFixed(1)}M`;
  }
  if (num >= 1_000) {
    return `\u20AC${(num / 1_000).toFixed(0)}K`;
  }
  return `\u20AC${num.toFixed(0)}`;
}

/**
 * Format an ISO date string into a human-readable date.
 */
export function formatDate(dateStr: string): string {
  try {
    const date = parseISO(dateStr);
    return format(date, 'dd MMM yyyy');
  } catch {
    return dateStr;
  }
}

/**
 * Get the hex color for a position abbreviation.
 */
export function getPositionColor(pos: string): string {
  return POSITION_COLORS[pos] || '#6b7280'; // gray-500 fallback
}

/**
 * Get the Tailwind badge color classes for a form result (W/D/L).
 */
export function getFormBadgeColor(result: FormResult): string {
  switch (result) {
    case 'W':
      return 'bg-green-100 text-green-800';
    case 'D':
      return 'bg-yellow-100 text-yellow-800';
    case 'L':
      return 'bg-red-100 text-red-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
}

/**
 * Get a player's initials from first and last name.
 */
export function getPlayerInitials(firstName: string, lastName: string): string {
  const first = firstName.charAt(0).toUpperCase();
  const last = lastName.charAt(0).toUpperCase();
  return `${first}${last}`;
}
