import { useState, useEffect } from 'react';
import { IssueStatus } from '../lib/types';
import { getStatus, setStatus, STATUS_LABELS, STATUS_COLORS } from '../lib/statusStore';
import { cn } from '../lib/utils';

interface Props {
  checkId: string;
  empId: string;
}

const STATUS_ORDER: IssueStatus['status'][] = ['unreviewed', 'ok', 'fix', 'irrelevant'];

export function IssueStatusChip({ checkId, empId }: Props) {
  const [status, setLocalStatus] = useState<IssueStatus>(() => getStatus(checkId, empId));

  useEffect(() => {
    setLocalStatus(getStatus(checkId, empId));
  }, [checkId, empId]);

  const cycle = (e: React.MouseEvent) => {
    e.stopPropagation();
    const idx = STATUS_ORDER.indexOf(status.status);
    const next = STATUS_ORDER[(idx + 1) % STATUS_ORDER.length];
    const newStatus: IssueStatus = { status: next };
    setStatus(checkId, empId, newStatus);
    setLocalStatus(newStatus);
  };

  return (
    <button
      onClick={cycle}
      title="לחץ לשינוי סטטוס"
      className={cn(
        'px-2 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-all hover:opacity-80',
        STATUS_COLORS[status.status]
      )}
    >
      {status.status === 'unreviewed' && '⬜ '}
      {status.status === 'ok' && '✓ '}
      {status.status === 'fix' && '🔧 '}
      {status.status === 'irrelevant' && '— '}
      {STATUS_LABELS[status.status]}
    </button>
  );
}
