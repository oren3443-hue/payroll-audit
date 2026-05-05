import { IssueStatus } from './types';

const STORAGE_KEY = 'payroll-audit-statuses';

function load(): Record<string, IssueStatus> {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}');
  } catch {
    return {};
  }
}

function save(data: Record<string, IssueStatus>) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export function makeKey(checkId: string, empId: string): string {
  return `${checkId}::${empId}`;
}

export function getStatus(checkId: string, empId: string): IssueStatus {
  const data = load();
  return data[makeKey(checkId, empId)] ?? { status: 'unreviewed' };
}

export function setStatus(checkId: string, empId: string, status: IssueStatus) {
  const data = load();
  data[makeKey(checkId, empId)] = status;
  save(data);
}

export function getAllStatuses(): Record<string, IssueStatus> {
  return load();
}

export function clearAllStatuses() {
  localStorage.removeItem(STORAGE_KEY);
}

export const STATUS_LABELS: Record<IssueStatus['status'], string> = {
  unreviewed: 'לא נבדק',
  ok: 'נבדק תקין',
  fix: 'לתיקון',
  irrelevant: 'לא רלוונטי',
};

export const STATUS_COLORS: Record<IssueStatus['status'], string> = {
  unreviewed: 'bg-gray-100 text-gray-600',
  ok: 'bg-green-100 text-green-700',
  fix: 'bg-red-100 text-red-700',
  irrelevant: 'bg-slate-100 text-slate-500',
};
