import { useState, useMemo } from 'react';
import { AuditResult, CheckSummary } from '../lib/types';
import { PayslipEmployee } from '../lib/parsePayslips';
import { EmployeeScore, computeEmployeeScores } from '../lib/scoring';
import { CheckTable } from './CheckTable';
import { DepartmentView } from './DepartmentView';
import { EmployeeListView } from './EmployeeListView';
import { EmployeeDrawer } from './EmployeeDrawer';
import { formatCurrency, cn, SEV_TEXT, SEV_DOT } from '../lib/utils';
import { Download, RefreshCw, FileDown } from 'lucide-react';
import { exportImportFile } from '../lib/exportImport';

interface Props {
  result: AuditResult;
  payslips: Map<string, PayslipEmployee>;
  period: { month: number; year: number } | null;
  onReset: () => void;
  onExport: () => void;
}

type Tab = 'checks' | 'departments' | 'employees';

const CHECK_ORDER = ['Q1', 'Q2', 'Q3', 'Q4', 'Q5', 'C10', 'C11', 'C1', 'C2', 'C3', 'C4', 'C5', 'C6', 'C7', 'C8', 'C9', 'C12', 'C13', 'C14', 'P1', 'P2', 'P3', 'P4'];

export function Dashboard({ result, payslips, period, onReset, onExport }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>('checks');
  const [selectedCheck, setSelectedCheck] = useState<string | null>(null);
  const [selectedEmpId, setSelectedEmpId] = useState<string | null>(null);

  const scores = useMemo(() => computeEmployeeScores(result.checks), [result]);

  const sortedChecks = useMemo(() =>
    [...result.checks].sort((a, b) =>
      (CHECK_ORDER.indexOf(a.checkId) ?? 99) - (CHECK_ORDER.indexOf(b.checkId) ?? 99)
    ), [result.checks]);

  const activeCheck = selectedCheck
    ? result.checks.find(c => c.checkId === selectedCheck)
    : null;

  const totalCritical = result.checks.reduce((s, c) => s + c.criticalCount, 0);
  const totalHigh = result.checks.reduce((s, c) => s + c.highCount, 0);
  const totalMedium = result.checks.reduce((s, c) => s + c.mediumCount, 0);

  return (
    <div className="min-h-screen bg-gray-50" dir="rtl">
      {/* Top bar */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-30">
        <div className="max-w-screen-xl mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <h1 className="text-lg font-bold text-gray-900">ביקורת שכר</h1>
            <div className="flex items-center gap-4 text-sm">
              <StatBadge count={totalCritical} label="קריטי" color="text-red-600" bg="bg-red-50" />
              <StatBadge count={totalHigh} label="גבוהה" color="text-orange-600" bg="bg-orange-50" />
              <StatBadge count={totalMedium} label="בינונית" color="text-yellow-600" bg="bg-yellow-50" />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                if (!period) {
                  alert('לא ניתן לזהות חודש/שנה מנתוני התלוש. ודא שהקובץ מכיל את עמודות "שנת מס" ו"חודש".');
                  return;
                }
                exportImportFile(result, payslips, period.year, period.month);
              }}
              className="flex items-center gap-2 px-3 py-1.5 bg-emerald-600 text-white text-sm rounded-lg hover:bg-emerald-700 transition-colors"
              title="קובץ לקליטה במיכפל — מאפס רכיבים שעתיים אצל גלובלים שסומנו לתיקון"
            >
              <FileDown className="w-4 h-4" />
              קובץ קליטה (לתיקון בלבד)
            </button>
            <button
              onClick={onExport}
              className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Download className="w-4 h-4" />
              ייצוא Excel
            </button>
            <button
              onClick={onReset}
              className="flex items-center gap-2 px-3 py-1.5 border border-gray-200 text-gray-600 text-sm rounded-lg hover:bg-gray-50 transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              קובץ חדש
            </button>
          </div>
        </div>
      </div>

      {/* Financial impact banner */}
      <div className="max-w-screen-xl mx-auto px-6 pt-6">
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-white border border-gray-200 rounded-2xl p-5">
            <p className="text-xs text-gray-500 mb-1">סה"כ ממצאים</p>
            <p className="text-3xl font-bold text-gray-900">{result.totalIssues}</p>
          </div>
          <div className="bg-red-50 border border-red-200 rounded-2xl p-5">
            <p className="text-xs text-red-600 mb-1">₪ בסיכון לטובת עובד</p>
            <p className="text-3xl font-bold text-red-700">{formatCurrency(result.financialForEmployee)}</p>
          </div>
          <div className="bg-orange-50 border border-orange-200 rounded-2xl p-5">
            <p className="text-xs text-orange-600 mb-1">₪ בסיכון לטובת חברה</p>
            <p className="text-3xl font-bold text-orange-700">{formatCurrency(result.financialForCompany)}</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-gray-100 rounded-xl p-1 mb-6 w-fit">
          {[
            { id: 'checks' as Tab, label: 'לפי בדיקה' },
            { id: 'departments' as Tab, label: 'לפי מחלקה' },
            { id: 'employees' as Tab, label: 'לפי עובד' },
          ].map(t => (
            <button
              key={t.id}
              onClick={() => { setActiveTab(t.id); setSelectedCheck(null); }}
              className={cn(
                'px-4 py-2 text-sm rounded-lg font-medium transition-all',
                activeTab === t.id ? 'bg-white shadow text-gray-900' : 'text-gray-600 hover:text-gray-900'
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Content */}
        {activeTab === 'checks' && (
          activeCheck ? (
            <CheckDetail check={activeCheck} onBack={() => setSelectedCheck(null)} onEmployeeClick={setSelectedEmpId} />
          ) : (
            <CheckGrid checks={sortedChecks} onSelect={setSelectedCheck} />
          )
        )}
        {activeTab === 'departments' && (
          <DepartmentView result={result} onEmployeeClick={setSelectedEmpId} />
        )}
        {activeTab === 'employees' && (
          <EmployeeListView scores={scores} onEmployeeClick={setSelectedEmpId} />
        )}
      </div>

      {/* Employee drawer */}
      {selectedEmpId && (
        <EmployeeDrawer
          empId={selectedEmpId}
          auditResult={result}
          scores={scores}
          onClose={() => setSelectedEmpId(null)}
        />
      )}
    </div>
  );
}

function StatBadge({ count, label, color, bg }: { count: number; label: string; color: string; bg: string }) {
  if (count === 0) return null;
  return (
    <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium', bg, color)}>
      {count} {label}
    </span>
  );
}

function CheckGrid({ checks, onSelect }: { checks: CheckSummary[]; onSelect: (id: string) => void }) {
  const categories = [
    { id: 'quality', label: 'איכות נתונים', emoji: '🔍' },
    { id: 'business', label: 'בדיקות עסקיות', emoji: '📊' },
    { id: 'prev', label: 'השוואה לחודש קודם', emoji: '📅' },
  ] as const;

  return (
    <div className="space-y-8 pb-12">
      {categories.map(cat => {
        const catChecks = checks.filter(c => c.category === cat.id);
        if (catChecks.length === 0) return null;
        return (
          <div key={cat.id}>
            <h2 className="text-sm font-semibold text-gray-500 mb-3">{cat.emoji} {cat.label}</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {catChecks.map(c => (
                <CheckCard key={c.checkId} check={c} onClick={() => onSelect(c.checkId)} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function CheckCard({ check, onClick }: { check: CheckSummary; onClick: () => void }) {
  const total = check.results.length;
  const topSev = check.criticalCount > 0 ? 'critical' :
    check.highCount > 0 ? 'high' :
    check.mediumCount > 0 ? 'medium' : 'low';

  const cardBg = total === 0
    ? 'border-gray-200 bg-white'
    : topSev === 'critical' ? 'border-red-200 bg-red-50'
    : topSev === 'high' ? 'border-orange-200 bg-orange-50'
    : topSev === 'medium' ? 'border-yellow-200 bg-yellow-50'
    : 'border-green-200 bg-green-50';

  return (
    <button
      onClick={onClick}
      className={cn('border rounded-2xl p-4 text-right w-full hover:shadow-md transition-all', cardBg)}
    >
      <p className="text-sm font-semibold text-gray-800 mb-2">{check.label}</p>
      {total === 0 ? (
        <p className="text-xs text-gray-400">✓ תקין</p>
      ) : (
        <>
          <p className={cn('text-2xl font-bold mb-1', SEV_TEXT[topSev])}>{total}</p>
          <div className="flex flex-wrap gap-1">
            {check.criticalCount > 0 && <Pill n={check.criticalCount} color="bg-red-100 text-red-700" />}
            {check.highCount > 0 && <Pill n={check.highCount} color="bg-orange-100 text-orange-700" />}
            {check.mediumCount > 0 && <Pill n={check.mediumCount} color="bg-yellow-100 text-yellow-700" />}
          </div>
          {check.totalFinancial > 0 && (
            <p className="text-xs text-gray-500 mt-2">{formatCurrency(check.totalFinancial)}</p>
          )}
        </>
      )}
    </button>
  );
}

function Pill({ n, color }: { n: number; color: string }) {
  return <span className={cn('text-xs px-1.5 py-0.5 rounded-full font-medium', color)}>{n}</span>;
}

function CheckDetail({ check, onBack, onEmployeeClick }: {
  check: CheckSummary; onBack: () => void; onEmployeeClick: (id: string) => void;
}) {
  return (
    <div className="pb-12">
      <div className="flex items-center gap-3 mb-4">
        <button onClick={onBack} className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1">
          ← חזרה
        </button>
        <h2 className="text-xl font-bold text-gray-900">{check.label}</h2>
        <span className="text-sm text-gray-500">({check.results.length} ממצאים)</span>
      </div>
      <p className="text-sm text-gray-500 mb-4">{check.description}</p>
      <CheckTable check={check} onEmployeeClick={onEmployeeClick} />
    </div>
  );
}
