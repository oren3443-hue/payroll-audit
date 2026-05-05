import { useMemo } from 'react';
import { X, TrendingUp, AlertTriangle } from 'lucide-react';
import { AuditResult } from '../lib/types';
import { EmployeeScore } from '../lib/scoring';
import { cn, formatCurrency, SEV_LABEL, SEV_TEXT, SEV_BG } from '../lib/utils';
import { IssueStatusChip } from './IssueStatusChip';

interface Props {
  empId: string | null;
  auditResult: AuditResult;
  scores: Map<string, EmployeeScore>;
  onClose: () => void;
}

export function EmployeeDrawer({ empId, auditResult, scores, onClose }: Props) {
  const emp = empId ? auditResult.employeeMap.get(empId) : null;
  const score = empId ? scores.get(empId) : null;

  const issues = useMemo(() => {
    if (!empId) return [];
    return auditResult.checks.flatMap(c =>
      c.results.filter(r => r.empId === empId).map(r => ({ ...r, checkLabel: c.label, checkId: c.checkId }))
    );
  }, [empId, auditResult]);

  if (!emp || !empId) return null;

  const att = emp.att;
  const pay = emp.pay;

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/40 z-40" onClick={onClose} />

      {/* Drawer */}
      <div className="fixed left-0 top-0 h-full w-full max-w-xl bg-white z-50 shadow-2xl overflow-y-auto flex flex-col" dir="rtl">
        {/* Header */}
        <div className="flex items-start justify-between p-6 border-b border-gray-100 sticky top-0 bg-white z-10">
          <div>
            <h2 className="text-xl font-bold text-gray-900">{att?.name || pay?.name || '—'}</h2>
            <p className="text-sm text-gray-500 mt-1">מס׳ עובד: {empId} • {att?.department || pay?.department || '—'}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 mt-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Risk score */}
        {score && (
          <div className="mx-6 mt-4 bg-gray-50 rounded-xl p-4 flex items-center gap-4">
            <div className={cn(
              'w-12 h-12 rounded-xl flex items-center justify-center text-xl font-bold',
              score.score >= 8 ? 'bg-red-100 text-red-700' :
              score.score >= 5 ? 'bg-orange-100 text-orange-700' :
              'bg-yellow-100 text-yellow-700'
            )}>
              {score.score}
            </div>
            <div>
              <p className="text-sm font-medium text-gray-700">ניקוד סיכון (מ-10)</p>
              <p className="text-xs text-gray-500">
                {score.issueCount} ממצאים • {formatCurrency(score.financialImpact)} בסיכון
              </p>
            </div>
            <div className="mr-auto flex gap-1.5">
              {score.sevCounts.critical > 0 && (
                <span className="bg-red-100 text-red-700 text-xs px-2 py-0.5 rounded-full font-medium">
                  {score.sevCounts.critical} קריטי
                </span>
              )}
              {score.sevCounts.high > 0 && (
                <span className="bg-orange-100 text-orange-700 text-xs px-2 py-0.5 rounded-full font-medium">
                  {score.sevCounts.high} גבוהה
                </span>
              )}
            </div>
          </div>
        )}

        {/* Issues */}
        <div className="p-6">
          <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-500" />
            ממצאים ({issues.length})
          </h3>
          {issues.length === 0 ? (
            <p className="text-sm text-gray-400">לא נמצאו ממצאים לעובד זה</p>
          ) : (
            <div className="space-y-2">
              {issues.map((issue, i) => (
                <div key={i} className={cn('border rounded-xl p-3', SEV_BG[issue.severity])}>
                  <div className="flex items-center justify-between mb-2">
                    <span className={cn('text-xs font-semibold', SEV_TEXT[issue.severity])}>
                      {SEV_LABEL[issue.severity]} — {issue.checkLabel}
                    </span>
                    <IssueStatusChip checkId={issue.checkId} empId={empId} />
                  </div>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                    {Object.entries(issue.fields).map(([k, v]) => (
                      <div key={k} className="text-xs">
                        <span className="text-gray-500">{k}: </span>
                        <span className="font-medium text-gray-800">{v !== null && v !== undefined ? String(v) : '—'}</span>
                      </div>
                    ))}
                  </div>
                  {issue.financialImpact > 0 && (
                    <p className="text-xs font-medium text-gray-700 mt-2">
                      השפעה כספית: {formatCurrency(issue.financialImpact)}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Raw data comparison */}
        {(att || pay) && (
          <div className="p-6 border-t border-gray-100">
            <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-blue-500" />
              נתונים גולמיים
            </h3>
            <div className="grid grid-cols-2 gap-4">
              {/* Attendance */}
              <div>
                <p className="text-xs font-semibold text-blue-600 mb-2">נוכחות</p>
                <DataGrid rows={att ? [
                  ['תעריף שעתי', att.hourlyRate > 0 ? `₪${att.hourlyRate}` : '—'],
                  ['ימי עבודה', att.workDays],
                  ['שעות 100%', att.hours100],
                  ['שעות 125%', att.hours125 || '—'],
                  ['שעות 150%', att.hours150 || '—'],
                  ['שעות לילה', att.hoursNight || '—'],
                  ['נסיעות', att.travel ? `₪${att.travel}` : '—'],
                  ['חופשה (ימים)', att.vacationDays || '—'],
                  ['מחלה (ימים)', att.sickDays || '—'],
                ] : []} />
              </div>
              {/* Payslip */}
              <div>
                <p className="text-xs font-semibold text-purple-600 mb-2">תלוש</p>
                <DataGrid rows={pay ? [
                  ['ימי עבודה', pay.workDays ?? '—'],
                  ['שעות עבודה', pay.hoursTotal ?? '—'],
                  ['חופשה (ימים)', pay.vacationDays ?? '—'],
                  ['מחלה (ימים)', pay.sickDays ?? '—'],
                  ['שכר נטו', pay.netPay ? `₪${Math.round(pay.netPay)}` : '—'],
                  ['גלובלי', pay.isGlobal ? 'כן' : 'לא'],
                ] : []} />
              </div>
            </div>

            {/* Payslip components */}
            {pay && pay.components.length > 0 && (
              <div className="mt-4">
                <p className="text-xs font-semibold text-gray-600 mb-2">רכיבי תלוש ({pay.components.length})</p>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-gray-500">
                        <th className="text-right pb-1">רכיב</th>
                        <th className="text-left pb-1">כמות</th>
                        <th className="text-left pb-1">מחיר</th>
                        <th className="text-left pb-1">תשלום</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pay.components.map((c, i) => (
                        <tr key={i} className="border-t border-gray-100">
                          <td className="py-1 text-gray-800">{c.componentName}</td>
                          <td className="py-1 text-left text-gray-600">{c.qty ?? '—'}</td>
                          <td className="py-1 text-left text-gray-600">{c.price ?? '—'}</td>
                          <td className="py-1 text-left font-medium">{c.payment ? `₪${Math.round(c.payment)}` : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}

function DataGrid({ rows }: { rows: [string, string | number][] }) {
  return (
    <div className="space-y-1">
      {rows.map(([label, value]) => (
        <div key={label} className="flex justify-between text-xs">
          <span className="text-gray-500">{label}</span>
          <span className="font-medium text-gray-800">{String(value)}</span>
        </div>
      ))}
    </div>
  );
}
