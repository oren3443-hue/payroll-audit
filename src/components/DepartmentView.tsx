import { useState, useMemo } from 'react';
import { AuditResult, CheckResult } from '../lib/types';
import { cn, formatCurrency, SEV_LABEL, SEV_TEXT, SEV_DOT, SEV_BG } from '../lib/utils';
import { IssueStatusChip } from './IssueStatusChip';
import { ChevronDown, ChevronUp } from 'lucide-react';

interface Props {
  result: AuditResult;
  onEmployeeClick: (empId: string) => void;
}

interface DeptData {
  name: string;
  issues: Array<CheckResult & { checkLabel: string; checkId: string }>;
  employees: Set<string>;
  financial: number;
  criticalCount: number;
}

export function DepartmentView({ result, onEmployeeClick }: Props) {
  const [expanded, setExpanded] = useState<string | null>(null);

  const departments = useMemo(() => {
    const map = new Map<string, DeptData>();

    for (const check of result.checks) {
      for (const r of check.results) {
        const dept = r.department || 'לא מוגדר';
        if (!map.has(dept)) {
          map.set(dept, { name: dept, issues: [], employees: new Set(), financial: 0, criticalCount: 0 });
        }
        const d = map.get(dept)!;
        d.issues.push({ ...r, checkLabel: check.label, checkId: check.checkId });
        d.employees.add(r.empId);
        d.financial += r.financialImpact;
        if (r.severity === 'critical') d.criticalCount += 1;
      }
    }

    return [...map.values()].sort((a, b) => b.criticalCount - a.criticalCount || b.financial - a.financial);
  }, [result]);

  return (
    <div className="space-y-3 pb-12">
      {departments.map(dept => (
        <DeptCard
          key={dept.name}
          dept={dept}
          isExpanded={expanded === dept.name}
          onToggle={() => setExpanded(expanded === dept.name ? null : dept.name)}
          onEmployeeClick={onEmployeeClick}
        />
      ))}
      {departments.length === 0 && (
        <p className="text-center text-gray-400 py-12">לא נמצאו ממצאים</p>
      )}
    </div>
  );
}

function DeptCard({ dept, isExpanded, onToggle, onEmployeeClick }: {
  dept: DeptData;
  isExpanded: boolean;
  onToggle: () => void;
  onEmployeeClick: (id: string) => void;
}) {
  const topSev = dept.criticalCount > 0 ? 'critical' :
    dept.issues.some(i => i.severity === 'high') ? 'high' : 'medium';

  return (
    <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
      <button
        className="w-full flex items-center justify-between px-6 py-4 hover:bg-gray-50 transition-colors"
        onClick={onToggle}
      >
        <div className="flex items-center gap-4">
          <div className={cn('w-2 h-8 rounded-full', SEV_DOT[topSev])} />
          <div className="text-right">
            <p className="text-base font-semibold text-gray-900">{dept.name}</p>
            <p className="text-xs text-gray-500">
              {dept.employees.size} עובדים • {dept.issues.length} ממצאים
              {dept.financial > 0 && ` • ${formatCurrency(dept.financial)}`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {dept.criticalCount > 0 && (
            <span className="bg-red-100 text-red-700 text-xs px-2 py-0.5 rounded-full font-medium">
              {dept.criticalCount} קריטי
            </span>
          )}
          {isExpanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
        </div>
      </button>

      {isExpanded && (
        <div className="border-t border-gray-100 px-6 py-4">
          <div className="space-y-2">
            {dept.issues.map((issue, i) => (
              <div
                key={i}
                className={cn('border rounded-xl p-3 cursor-pointer hover:opacity-80 transition-opacity', SEV_BG[issue.severity])}
                onClick={() => onEmployeeClick(issue.empId)}
              >
                <div className="flex items-center justify-between mb-1">
                  <div>
                    <span className="text-sm font-medium text-gray-800">{issue.empName}</span>
                    <span className="text-xs text-gray-500 mr-2">#{issue.empId}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={cn('text-xs font-medium flex items-center gap-1', SEV_TEXT[issue.severity])}>
                      <span className={cn('w-1.5 h-1.5 rounded-full', SEV_DOT[issue.severity])} />
                      {SEV_LABEL[issue.severity]}
                    </span>
                    <IssueStatusChip checkId={issue.checkId} empId={issue.empId} />
                  </div>
                </div>
                <p className="text-xs text-gray-500">{issue.checkLabel}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
