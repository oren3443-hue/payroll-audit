import { Severity } from './types';

export function cn(...classes: (string | undefined | false | null)[]): string {
  return classes.filter(Boolean).join(' ');
}

export function formatCurrency(n: number): string {
  return `₪${Math.round(n).toLocaleString('he-IL')}`;
}

export function formatNum(n: number | null | undefined, decimals = 1): string {
  if (n === null || n === undefined) return '—';
  return n.toFixed(decimals).replace(/\.0+$/, '');
}

export const SEV_LABEL: Record<Severity, string> = {
  critical: 'קריטי',
  high: 'גבוהה',
  medium: 'בינונית',
  low: 'נמוכה',
};

export const SEV_BG: Record<Severity, string> = {
  critical: 'bg-red-50 border-red-200',
  high: 'bg-orange-50 border-orange-200',
  medium: 'bg-yellow-50 border-yellow-200',
  low: 'bg-green-50 border-green-200',
};

export const SEV_TEXT: Record<Severity, string> = {
  critical: 'text-red-700',
  high: 'text-orange-700',
  medium: 'text-yellow-700',
  low: 'text-green-700',
};

export const SEV_DOT: Record<Severity, string> = {
  critical: 'bg-red-500',
  high: 'bg-orange-500',
  medium: 'bg-yellow-500',
  low: 'bg-green-500',
};

export const SEV_ROW: Record<Severity, string> = {
  critical: 'row-critical',
  high: 'row-high',
  medium: 'row-medium',
  low: 'row-low',
};
