import { useState } from 'react';
import { EmployeeScore } from '../lib/scoring';
import { cn, formatCurrency } from '../lib/utils';
import { Search } from 'lucide-react';

interface Props {
  scores: Map<string, EmployeeScore>;
  onEmployeeClick: (empId: string) => void;
}

export function EmployeeListView({ scores, onEmployeeClick }: Props) {
  const [query, setQuery] = useState('');
  const [deptFilter, setDeptFilter] = useState('');

  const sorted = [...scores.values()].sort((a, b) => b.score - a.score || b.financialImpact - a.financialImpact);

  const departments = [...new Set(sorted.map(e => e.department).filter(Boolean))].sort();

  const filtered = sorted.filter(e => {
    const matchQ = !query || e.empName.toLowerCase().includes(query.toLowerCase()) || e.empId.includes(query);
    const matchD = !deptFilter || e.department === deptFilter;
    return matchQ && matchD;
  });

  return (
    <div className="pb-12">
      <div className="flex gap-3 mb-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute right-3 top-2.5 w-4 h-4 text-gray-400" />
          <input
            type="text" placeholder="חיפוש עובד..."
            className="w-full pr-9 pl-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={query} onChange={e => setQuery(e.target.value)}
          />
        </div>
        <select
          className="text-sm border border-gray-200 rounded-lg px-3 py-2"
          value={deptFilter} onChange={e => setDeptFilter(e.target.value)}
        >
          <option value="">כל המחלקות</option>
          {departments.map(d => <option key={d} value={d}>{d}</option>)}
        </select>
      </div>

      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-right px-4 py-3 font-medium text-gray-600">ניקוד סיכון</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">עובד</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">מחלקה</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">ממצאים</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">השפעה כספית</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">חומרות</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(emp => (
              <tr
                key={emp.empId}
                className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer transition-colors"
                onClick={() => onEmployeeClick(emp.empId)}
              >
                <td className="px-4 py-3">
                  <Scorebadge score={emp.score} />
                </td>
                <td className="px-4 py-3">
                  <p className="font-medium text-gray-900">{emp.empName}</p>
                  <p className="text-xs text-gray-500">#{emp.empId}</p>
                </td>
                <td className="px-4 py-3 text-gray-600">{emp.department || '—'}</td>
                <td className="px-4 py-3 text-gray-700 font-medium">{emp.issueCount}</td>
                <td className="px-4 py-3 text-gray-700">
                  {emp.financialImpact > 0 ? formatCurrency(emp.financialImpact) : '—'}
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-1">
                    {emp.sevCounts.critical > 0 && <Pip n={emp.sevCounts.critical} color="bg-red-500" />}
                    {emp.sevCounts.high > 0 && <Pip n={emp.sevCounts.high} color="bg-orange-500" />}
                    {emp.sevCounts.medium > 0 && <Pip n={emp.sevCounts.medium} color="bg-yellow-500" />}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <p className="text-center text-gray-400 py-8">לא נמצאו עובדים</p>
        )}
      </div>
    </div>
  );
}

function Scorebadge({ score }: { score: number }) {
  const color = score >= 8 ? 'bg-red-100 text-red-700 border-red-200' :
    score >= 5 ? 'bg-orange-100 text-orange-700 border-orange-200' :
    'bg-yellow-100 text-yellow-700 border-yellow-200';
  return (
    <span className={cn('inline-flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold border', color)}>
      {score}
    </span>
  );
}

function Pip({ n, color }: { n: number; color: string }) {
  return (
    <span className={cn('inline-flex items-center justify-center w-5 h-5 rounded-full text-white text-xs font-bold', color)}>
      {n}
    </span>
  );
}
