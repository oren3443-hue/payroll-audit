import { useState, useMemo, ReactNode } from 'react';
import { EmployeeMaster } from '../lib/types';
import { PayslipEmployee } from '../lib/parsePayslips';
import { MinWageConfig, DEFAULT_MIN_WAGE, buildMinWageRows, detectModalRate } from '../lib/minWage';
import { cn } from '../lib/utils';
import { Cake, AlertTriangle, FileSpreadsheet } from 'lucide-react';

const MONTHS = ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'];

interface Props {
  master: Map<string, EmployeeMaster> | null;
  payslips: Map<string, PayslipEmployee>;
  period: { month: number; year: number } | null;
}

type View = 'birthday' | 'violations';

export function MinWageView({ master, payslips, period }: Props) {
  const [cfg, setCfg] = useState<MinWageConfig>(DEFAULT_MIN_WAGE);
  const [view, setView] = useState<View>('birthday');

  const allRows = useMemo(
    () => (master && period) ? buildMinWageRows(master, payslips, period, cfg) : [],
    [master, payslips, period, cfg]
  );
  const modal = useMemo(() => detectModalRate(payslips), [payslips]);

  if (!master) {
    return (
      <div className="pb-12 flex flex-col items-center justify-center text-center py-20 gap-3">
        <FileSpreadsheet className="w-12 h-12 text-gray-300" />
        <p className="text-gray-600 font-medium">קובץ "נתוני עובד מיכפל" לא נטען</p>
        <p className="text-sm text-gray-400 max-w-md">
          בדיקה זו דורשת את קובץ המאסטר של מיכפל (תאריך לידה). חזור למסך הטעינה והעלה אותו.
        </p>
      </div>
    );
  }
  if (!period) {
    return <div className="pb-12 text-sm text-gray-500 py-10">לא זוהה חודש בדיקה — לא ניתן לחשב גיל.</div>;
  }

  const birthdayRows = allRows.filter(r => r.bornThisMonth);
  const violationRows = allRows.filter(r => r.violation);
  const shown = view === 'birthday' ? birthdayRows : violationRows;
  const sorted = [...shown].sort(
    (a, b) => (Number(b.violation) - Number(a.violation)) || a.age - b.age
  );

  const periodLabel = `${MONTHS[period.month - 1]} ${period.year}`;
  const baseMismatch = modal !== null && Math.abs(modal - cfg.base) > 0.001;

  return (
    <div className="pb-12">
      {/* קונפיג שכר מינימום */}
      <div className="bg-white border border-gray-200 rounded-2xl p-5 mb-5">
        <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
          <h3 className="text-sm font-semibold text-gray-800">שכר מינימום לשעה — ניתן לעריכה</h3>
          {modal !== null && (
            <span className={cn('text-xs px-2.5 py-1 rounded-full', baseMismatch ? 'bg-amber-50 text-amber-700' : 'bg-gray-50 text-gray-500')}>
              השכיח שאותר בקובץ: <strong>{modal} ₪</strong>
              {baseMismatch && ' ≠ הבסיס שהוזן'}
            </span>
          )}
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <RateInput label="18+" sub="100%" value={cfg.base} onChange={v => setCfg(c => ({ ...c, base: v }))} />
          <RateInput label="17–18" sub="83%" value={cfg.youth18} onChange={v => setCfg(c => ({ ...c, youth18: v }))} />
          <RateInput label="16–17" sub="75%" value={cfg.youth17} onChange={v => setCfg(c => ({ ...c, youth17: v }))} />
          <RateInput label="עד 16" sub="70%" value={cfg.youth16} onChange={v => setCfg(c => ({ ...c, youth16: v }))} />
        </div>
      </div>

      {/* לחצני סינון */}
      <div className="flex items-center gap-3 flex-wrap mb-4">
        <ToggleBtn active={view === 'birthday'} onClick={() => setView('birthday')}
          icon={<Cake className="w-4 h-4" />} label={`חגגו ב${periodLabel}`} count={birthdayRows.length} tone="indigo" />
        <ToggleBtn active={view === 'violations'} onClick={() => setView('violations')}
          icon={<AlertTriangle className="w-4 h-4" />} label="חריגים לבדיקה" count={violationRows.length} tone="red" />
        <span className="text-xs text-gray-400">
          {view === 'birthday'
            ? 'עובדים שעתיים שנולדו בחודש הבדיקה (כאן מרוכזות רוב הטעויות — חציית גיל).'
            : 'כל מי ששולם לו מתחת לשכר המינימום לגילו, בכל חודש לידה.'}
        </span>
      </div>

      {/* טבלה */}
      {sorted.length === 0 ? (
        <div className="bg-green-50 border border-green-200 rounded-2xl p-6 text-center text-sm text-green-700">
          {view === 'birthday' ? 'אין עובדים שעתיים שנולדו בחודש זה.' : '✓ לא נמצאו חריגות מול שכר המינימום לגיל.'}
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-gray-500 text-xs">
                <Th>מספר מיכפל</Th><Th>שם</Th><Th>מחלקה</Th><Th>ת.לידה</Th>
                <Th center>גיל</Th><Th center>מדרגה</Th><Th center>תעריף</Th><Th center>מינ׳ לגיל</Th><Th center>סטטוס</Th>
              </tr>
            </thead>
            <tbody>
              {sorted.map(r => (
                <tr key={r.empId} className={cn('border-t border-gray-100', r.violation && 'bg-red-50/60')}>
                  <Td className="font-mono text-gray-500">{r.empId}</Td>
                  <Td className="font-medium text-gray-800">{r.name}</Td>
                  <Td className="text-gray-500">{r.department}</Td>
                  <Td className="text-gray-500">{r.birthDate.toLocaleDateString('he-IL')}</Td>
                  <Td center>{r.age}</Td>
                  <Td center className="text-gray-500">{r.tierLabel}</Td>
                  <Td center>{r.rate.toFixed(2)}</Td>
                  <Td center className="text-gray-500">{r.minForAge.toFixed(2)}</Td>
                  <Td center>
                    {r.violation
                      ? <span className="text-red-600 font-semibold whitespace-nowrap">❌ חוסר {r.shortfall.toFixed(2)} ₪</span>
                      : <span className="text-green-600">✓ תקין</span>}
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function RateInput({ label, sub, value, onChange }: {
  label: string; sub: string; value: number; onChange: (v: number) => void;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs text-gray-500">{label} <span className="text-gray-300">· {sub}</span></span>
      <div className="relative">
        <input
          type="number" step="0.01" min="0" value={value}
          onChange={e => onChange(e.target.value === '' ? 0 : parseFloat(e.target.value))}
          className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-800 focus:border-indigo-500 focus:outline-none"
        />
        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-gray-400 pointer-events-none">₪</span>
      </div>
    </label>
  );
}

function ToggleBtn({ active, onClick, icon, label, count, tone }: {
  active: boolean; onClick: () => void; icon: ReactNode; label: string; count: number; tone: 'indigo' | 'red';
}) {
  const activeCls = tone === 'indigo' ? 'bg-indigo-600 text-white shadow' : 'bg-red-600 text-white shadow';
  return (
    <button
      onClick={onClick}
      className={cn('flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all',
        active ? activeCls : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50')}
    >
      {icon}
      {label}
      <span className={cn('px-1.5 py-0.5 rounded-full text-xs', active ? 'bg-white/20' : 'bg-gray-100 text-gray-500')}>{count}</span>
    </button>
  );
}

function Th({ children, center }: { children: ReactNode; center?: boolean }) {
  return <th className={cn('px-4 py-2.5 font-medium', center ? 'text-center' : 'text-right')}>{children}</th>;
}

function Td({ children, center, className }: { children: ReactNode; center?: boolean; className?: string }) {
  return <td className={cn('px-4 py-2.5', center ? 'text-center' : 'text-right', className)}>{children}</td>;
}
