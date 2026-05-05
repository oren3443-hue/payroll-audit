import { useState, useMemo } from 'react';
import { CheckSummary, CheckResult } from '../lib/types';
import { IssueStatusChip } from './IssueStatusChip';
import { cn, formatCurrency, SEV_LABEL, SEV_TEXT, SEV_DOT, SEV_ROW } from '../lib/utils';
import { ChevronUp, ChevronDown, Search } from 'lucide-react';

interface Props {
  check: CheckSummary;
  onEmployeeClick?: (empId: string) => void;
}

type SortDir = 'asc' | 'desc' | null;

export function CheckTable({ check, onEmployeeClick }: Props) {
  const [query, setQuery] = useState('');
  const [deptFilter, setDeptFilter] = useState('');
  const [sevFilter, setSevFilter] = useState('');
  const [sortCol, setSortCol] = useState<string | null>('financialImpact');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  const departments = useMemo(() =>
    [...new Set(check.results.map(r => r.department).filter(Boolean))].sort(),
    [check.results]
  );

  const filtered = useMemo(() => {
    let rows = check.results;
    if (query) {
      const q = query.toLowerCase();
      rows = rows.filter(r =>
        r.empName.toLowerCase().includes(q) ||
        r.empId.includes(q) ||
        r.department?.toLowerCase().includes(q)
      );
    }
    if (deptFilter) rows = rows.filter(r => r.department === deptFilter);
    if (sevFilter) rows = rows.filter(r => r.severity === sevFilter);
    if (sortCol) {
      rows = [...rows].sort((a, b) => {
        let av: number, bv: number;
        if (sortCol === 'financialImpact') { av = a.financialImpact; bv = b.financialImpact; }
        else if (sortCol === 'empName') {
          return sortDir === 'asc'
            ? a.empName.localeCompare(b.empName, 'he')
            : b.empName.localeCompare(a.empName, 'he');
        }
        else { av = 0; bv = 0; }
        return sortDir === 'asc' ? av - bv : bv - av;
      });
    }
    return rows;
  }, [check.results, query, deptFilter, sevFilter, sortCol, sortDir]);

  const toggleSort = (col: string) => {
    if (sortCol === col) {
      setSortDir(d => d === 'asc' ? 'desc' : d === 'desc' ? null : 'asc');
      if (sortDir === null) setSortCol(null);
    } else {
      setSortCol(col);
      setSortDir('desc');
    }
  };

  if (check.results.length === 0) {
    return (
      <div className="text-center py-16 text-gray-400">
        <div className="text-4xl mb-3">✓</div>
        <p className="text-lg font-medium text-gray-500">לא נמצאו ממצאים</p>
        <p className="text-sm mt-1">הבדיקה עברה ללא בעיות</p>
      </div>
    );
  }

  // Collect all field keys from first few rows
  const fieldKeys = useMemo(() => {
    const keys = new Set<string>();
    for (const r of check.results.slice(0, 5)) {
      Object.keys(r.fields).forEach(k => keys.add(k));
    }
    return [...keys];
  }, [check.results]);

  const SortIcon = ({ col }: { col: string }) => {
    if (sortCol !== col) return null;
    return sortDir === 'asc' ? <ChevronUp className="w-3 h-3 inline" /> : <ChevronDown className="w-3 h-3 inline" />;
  };

  return (
    <div>
      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-4">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute right-3 top-2.5 w-4 h-4 text-gray-400" />
          <input
            type="text" placeholder="חיפוש עובד..."
            className="w-full pr-9 pl-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={query} onChange={e => setQuery(e.target.value)}
          />
        </div>
        <select
          className="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          value={deptFilter} onChange={e => setDeptFilter(e.target.value)}
        >
          <option value="">כל המחלקות</option>
          {departments.map(d => <option key={d} value={d}>{d}</option>)}
        </select>
        <select
          className="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          value={sevFilter} onChange={e => setSevFilter(e.target.value)}
        >
          <option value="">כל החומרות</option>
          <option value="critical">קריטי</option>
          <option value="high">גבוהה</option>
          <option value="medium">בינונית</option>
        </select>
        <span className="text-sm text-gray-500 self-center">{filtered.length} ממצאים</span>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-gray-200">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-right px-4 py-3 font-medium text-gray-600 whitespace-nowrap">סטטוס</th>
              <th
                className="text-right px-4 py-3 font-medium text-gray-600 whitespace-nowrap cursor-pointer hover:text-gray-900"
                onClick={() => toggleSort('empName')}
              >
                עובד <SortIcon col="empName" />
              </th>
              <th className="text-right px-4 py-3 font-medium text-gray-600 whitespace-nowrap">מחלקה</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600 whitespace-nowrap">חומרה</th>
              {fieldKeys.map(k => (
                <th key={k} className="text-right px-4 py-3 font-medium text-gray-600 whitespace-nowrap">{k}</th>
              ))}
              <th
                className="text-right px-4 py-3 font-medium text-gray-600 whitespace-nowrap cursor-pointer hover:text-gray-900"
                onClick={() => toggleSort('financialImpact')}
              >
                השפעה ₪ <SortIcon col="financialImpact" />
              </th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r, i) => (
              <ResultRow
                key={`${r.empId}-${i}`}
                result={r}
                fieldKeys={fieldKeys}
                checkId={check.checkId}
                onClick={() => onEmployeeClick?.(r.empId)}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ResultRow({ result, fieldKeys, checkId, onClick }: {
  result: CheckResult;
  fieldKeys: string[];
  checkId: string;
  onClick: () => void;
}) {
  return (
    <tr
      className={cn(SEV_ROW[result.severity], 'cursor-pointer hover:opacity-90 transition-opacity border-b border-gray-100')}
      onClick={onClick}
    >
      <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
        <IssueStatusChip checkId={checkId} empId={result.empId} />
      </td>
      <td className="px-4 py-3 font-medium whitespace-nowrap">
        <div className="text-gray-900">{result.empName || '—'}</div>
        <div className="text-xs text-gray-500">#{result.empId}</div>
      </td>
      <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{result.department || '—'}</td>
      <td className="px-4 py-3 whitespace-nowrap">
        <span className={cn('flex items-center gap-1.5 text-xs font-medium', SEV_TEXT[result.severity])}>
          <span className={cn('w-2 h-2 rounded-full', SEV_DOT[result.severity])} />
          {SEV_LABEL[result.severity]}
        </span>
      </td>
      {fieldKeys.map(k => (
        <td key={k} className="px-4 py-3 text-gray-700 whitespace-nowrap">
          {result.fields[k] !== null && result.fields[k] !== undefined ? String(result.fields[k]) : '—'}
        </td>
      ))}
      <td className="px-4 py-3 font-medium text-gray-900 whitespace-nowrap">
        {result.financialImpact > 0 ? formatCurrency(result.financialImpact) : '—'}
      </td>
    </tr>
  );
}
