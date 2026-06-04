import { useState, useCallback } from 'react';
import { Upload, FileSpreadsheet, X, CheckCircle, AlertCircle, Loader2, CalendarClock, BookOpen, ChevronDown, ChevronLeft } from 'lucide-react';
import {
  parseExcelFile,
  extractMonthFromPayslip,
  extractYearFromPayslip,
  extractMonthFromUtilization,
  extractYearFromUtilization,
} from '../lib/detectFileType';
import { parseAttendance } from '../lib/parseAttendance';
import { parsePayslips } from '../lib/parsePayslips';
import { parseUtilization } from '../lib/parseUtilization';
import { parseEmployeeMaster } from '../lib/parseEmployeeMaster';
import { AttendanceRow, UtilizationRow, EmployeeMaster } from '../lib/types';
import { PayslipEmployee } from '../lib/parsePayslips';
import { cn } from '../lib/utils';

const HEBREW_MONTHS = [
  'ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני',
  'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר',
];

// ברירת מחדל לחודש הבדיקה לפי התאריך של היום:
// עד ה-15 בחודש → מציגים את החודש הקודם; מה-16 ואילך → החודש הנוכחי.
function defaultAuditPeriod(): { month: number; year: number } {
  const now = new Date();
  let month = now.getMonth() + 1; // 1–12 (חודש נוכחי)
  let year = now.getFullYear();
  if (now.getDate() <= 15) {
    month -= 1;
    if (month === 0) { month = 12; year -= 1; }
  }
  return { month, year };
}

// שנים לבחירה בבורר — טווח דינמי סביב השנה הנוכחית, כדי שברירת המחדל תמיד תהיה בטווח
const YEAR_OPTIONS = (() => {
  const y = new Date().getFullYear();
  return [y - 2, y - 1, y, y + 1];
})();

// מדריך ייצוא הקבצים מהמערכות (רסטיגו / מיכפל) — מוצג למשתמש במסך הטעינה
const EXPORT_GUIDE: {
  name: string; role: string; system: 'רסטיגו' | 'מיכפל'; path: string[]; optional?: boolean;
}[] = [
  {
    name: 'דוח שכר רשתי רסטיגו',
    role: 'דוח נוכחות',
    system: 'רסטיגו',
    path: ['דוח שכר רשתי', 'סינון: סניפי בעלות והעסקה ישירה'],
  },
  {
    name: 'ריכוז תלושים מיכפל',
    role: 'תלושי שכר — חודש נוכחי',
    system: 'מיכפל',
    path: ['קובץ', 'ייצוא', 'נתונים ל-Excel', 'טבלאות ציר - שכר', 'ריכוז תלושים', 'בחירת חודש נוכחי'],
  },
  {
    name: 'נוכחות וניצולים',
    role: 'נוכחות וניצולים',
    system: 'מיכפל',
    path: ['קובץ', 'ייצוא', 'נתונים ל-Excel', 'נוכחות וניצולים', 'בחירת חודש נוכחי'],
  },
  {
    name: 'ריכוז תלושים מיכפל',
    role: 'תלושים חודש קודם',
    system: 'מיכפל',
    path: ['קובץ', 'ייצוא', 'נתונים ל-Excel', 'טבלאות ציר - שכר', 'ריכוז תלושים', 'בחירת חודש קודם'],
    optional: true,
  },
];

interface LoadedFile {
  type: 'attendance' | 'payslips' | 'prevPayslips' | 'utilization' | 'employeeMaster' | 'unknown';
  filename: string;
  rowCount: number;
}

interface Props {
  onReady: (
    att: AttendanceRow[],
    pay: Map<string, PayslipEmployee>,
    prev?: Map<string, PayslipEmployee>,
    util?: Map<string, UtilizationRow>,
    period?: { month: number; year: number },
    master?: Map<string, EmployeeMaster>
  ) => void;
}

export function UploadZone({ onReady }: Props) {
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
  const [files, setFiles] = useState<LoadedFile[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [missingCols, setMissingCols] = useState<string[]>([]);

  const [attData, setAttData] = useState<AttendanceRow[] | null>(null);
  const [payData, setPayData] = useState<Map<string, PayslipEmployee> | null>(null);
  const [prevPayData, setPrevPayData] = useState<Map<string, PayslipEmployee> | null>(null);
  const [utilData, setUtilData] = useState<Map<string, UtilizationRow> | null>(null);
  const [masterData, setMasterData] = useState<Map<string, EmployeeMaster> | null>(null);
  const [pendingPayRows, setPendingPayRows] = useState<unknown[][] | null>(null);
  // חודשים שזוהו לקבצי תלוש (לזיהוי חכם מי קודם ומי נוכחי)
  const [payMonth, setPayMonth] = useState<number | null>(null);
  const [payYear, setPayYear] = useState<number | null>(null);
  const [prevMonth, setPrevMonth] = useState<number | null>(null);
  const [pendingPrevRows, setPendingPrevRows] = useState<unknown[][] | null>(null);
  // חודש הבדיקה שנבחר במסך — מקור האמת שמולו מאמתים את הקבצים.
  // ברירת המחדל נגזרת מהתאריך (עד ה-15 → חודש קודם, מ-16 → חודש נוכחי),
  // אך עדיין נדרסת אוטומטית מהתלוש כל עוד המשתמש לא בחר ידנית.
  const [selMonth, setSelMonth] = useState<number | null>(() => defaultAuditPeriod().month);
  const [selYear, setSelYear] = useState<number | null>(() => defaultAuditPeriod().year);
  // האם המשתמש בחר חודש ידנית — אם כן, לא נדרוס אותו מהתלוש
  const [pickerTouched, setPickerTouched] = useState(false);
  // חודש/שנה שזוהו בקובץ "נוכחות וניצולים" — לאימות מול הבחירה
  const [utilMonth, setUtilMonth] = useState<number | null>(null);
  const [utilYear, setUtilYear] = useState<number | null>(null);

  const processFiles = useCallback(async (fileList: File[]) => {
    setLoading(true);
    setError(null);
    setMissingCols([]);

    let newAtt = attData;
    let newPay = payData;
    let newPrev = prevPayData;
    let newUtil = utilData;
    let pendingPay = pendingPayRows;
    let pendingPrev = pendingPrevRows;
    let curPayMonth = payMonth;
    let curPrevMonth = prevMonth;
    const newFiles = [...files];

    try {
      for (const file of fileList) {
        const detected = await parseExcelFile(file);

        if (detected.type === 'unknown') {
          // Try to determine by elimination
          if (!newAtt) detected.type = 'attendance';
          else if (!newPay) detected.type = 'payslips';
          else detected.type = 'prevPayslips';
        }

        // אם כבר יש תלוש "נוכחי" וכעת מגיע עוד אחד — נקבע לפי מספר חודש
        if (detected.type === 'payslips' && newPay) {
          const incomingMonth = extractMonthFromPayslip(detected.rows);
          if (incomingMonth !== null && curPayMonth !== null) {
            if (incomingMonth > curPayMonth) {
              // החדש מאוחר יותר → הוא הופך לנוכחי, הקיים יורד לקודם
              const oldRows = pendingPay;
              const oldMonth = curPayMonth;
              const oldFile = newFiles.find(f => f.type === 'payslips');
              // נסמן את הישן כקודם
              if (oldFile) oldFile.type = 'prevPayslips';
              if (newPay) {
                newPrev = newPay;
                setPrevPayData(newPay);
                curPrevMonth = oldMonth;
                setPrevMonth(oldMonth);
                pendingPrev = oldRows;
                setPendingPrevRows(oldRows);
              }
              // נמשיך לעבד את החדש כתלוש נוכחי (לא prev)
            } else {
              detected.type = 'prevPayslips';
            }
          } else {
            // אין מידע על חודש — fallback לפי סדר העלאה
            detected.type = 'prevPayslips';
          }
        }

        if (detected.type === 'attendance') {
          const { employees, missingColumns } = parseAttendance(detected.rows);
          if (missingColumns.length > 0) {
            setMissingCols(missingColumns);
          }
          newAtt = employees;
          newFiles.push({ type: 'attendance', filename: file.name, rowCount: employees.length });
          setAttData(employees);
        } else if (detected.type === 'payslips') {
          // אם כבר יש util — נפעיל אותו ב-parsePayslips לזיהוי גלובלי
          const { employees, missingColumns } = parsePayslips(detected.rows, newUtil ?? undefined);
          if (missingColumns.length > 0) {
            setMissingCols(prev => [...prev, ...missingColumns]);
          }
          newPay = employees;
          pendingPay = newUtil ? null : detected.rows;
          curPayMonth = extractMonthFromPayslip(detected.rows);
          const curPayYear = extractYearFromPayslip(detected.rows);
          newFiles.push({ type: 'payslips', filename: file.name, rowCount: employees.size });
          setPayData(employees);
          setPendingPayRows(pendingPay);
          setPayMonth(curPayMonth);
          if (curPayYear !== null) setPayYear(curPayYear);
          // ברירת מחדל לבורר חודש הבדיקה — נגזרת מהתלוש, אלא אם המשתמש בחר ידנית
          if (!pickerTouched) {
            if (curPayMonth !== null) setSelMonth(curPayMonth);
            if (curPayYear !== null) setSelYear(curPayYear);
          }
        } else if (detected.type === 'prevPayslips') {
          const { employees } = parsePayslips(detected.rows);
          newPrev = employees;
          curPrevMonth = extractMonthFromPayslip(detected.rows);
          pendingPrev = detected.rows;
          newFiles.push({ type: 'prevPayslips', filename: file.name, rowCount: employees.size });
          setPrevPayData(employees);
          setPrevMonth(curPrevMonth);
          setPendingPrevRows(detected.rows);
        } else if (detected.type === 'utilization') {
          const { rows: utilRows, missingColumns } = parseUtilization(detected.rows);
          if (missingColumns.length > 0) {
            setMissingCols(prev => [...prev, ...missingColumns]);
          }
          newUtil = utilRows;
          newFiles.push({ type: 'utilization', filename: file.name, rowCount: utilRows.size });
          setUtilData(utilRows);
          setUtilMonth(extractMonthFromUtilization(detected.rows));
          setUtilYear(extractYearFromUtilization(detected.rows));
          // אם כבר יש תלושים שנטענו לפני — נחשב מחדש את is_global
          if (pendingPay) {
            const { employees } = parsePayslips(pendingPay, utilRows);
            newPay = employees;
            setPayData(employees);
            pendingPay = null;
            setPendingPayRows(null);
          } else if (newPay) {
            // ניתן לעדכן is_global ישירות על המפה
            for (const emp of newPay.values()) {
              const u = utilRows.get(emp.empId);
              if (u && u.salaryBase) emp.isGlobal = u.salaryBase === 'חדשי';
            }
            setPayData(new Map(newPay));
          }
        } else if (detected.type === 'employeeMaster') {
          const { employees, missingColumns } = parseEmployeeMaster(detected.rows);
          if (missingColumns.length > 0) {
            setMissingCols(prev => [...prev, ...missingColumns]);
          }
          newFiles.push({ type: 'employeeMaster', filename: file.name, rowCount: employees.size });
          setMasterData(employees);
        }
      }
    } catch (e) {
      setError(`שגיאה בקריאת הקובץ: ${e instanceof Error ? e.message : String(e)}`);
    }

    setFiles(newFiles.slice(-5));
    setLoading(false);
  }, [attData, payData, prevPayData, utilData, pendingPayRows, pendingPrevRows, payMonth, prevMonth, files, pickerTouched]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const fileList = Array.from(e.dataTransfer.files).filter(f =>
      f.name.endsWith('.xlsx') || f.name.endsWith('.xls')
    );
    if (fileList.length > 0) processFiles(fileList);
  }, [processFiles]);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = Array.from(e.target.files ?? []);
    if (fileList.length > 0) processFiles(fileList);
    e.target.value = '';
  };

  const removeFile = (filename: string) => {
    setFiles(f => f.filter(x => x.filename !== filename));
    const removed = files.find(f => f.filename === filename);
    if (removed?.type === 'attendance') setAttData(null);
    if (removed?.type === 'payslips') { setPayData(null); setPayMonth(null); setPendingPayRows(null); }
    if (removed?.type === 'prevPayslips') { setPrevPayData(null); setPrevMonth(null); setPendingPrevRows(null); }
    if (removed?.type === 'utilization') { setUtilData(null); setUtilMonth(null); setUtilYear(null); }
    if (removed?.type === 'employeeMaster') setMasterData(null);
  };

  const canRun = attData && payData && utilData;

  // עדכון ידני של בורר חודש הבדיקה — מסמן שהמשתמש בחר, כדי שלא יידרס מהתלוש
  const pickMonth = (m: number) => { setSelMonth(m); setPickerTouched(true); };
  const pickYear = (y: number) => { setSelYear(y); setPickerTouched(true); };

  // אימות: כל קובץ שיש בו חודש בתוכן מושווה לחודש הבדיקה שנבחר.
  // קובץ הנוכחות לא מכיל חודש — לכן אינו מאומת (התלוש הוא העוגן).
  const periodMismatches: { label: string; month: number | null; year: number | null }[] = [];
  if (selMonth !== null) {
    const differs = (m: number | null, y: number | null) =>
      (m !== null && m !== selMonth) ||
      (y !== null && selYear !== null && y !== selYear);
    if (payData && differs(payMonth, payYear)) {
      periodMismatches.push({ label: 'תלושי שכר', month: payMonth, year: payYear });
    }
    if (utilData && differs(utilMonth, utilYear)) {
      periodMismatches.push({ label: 'נוכחות וניצולים', month: utilMonth, year: utilYear });
    }
  }
  const fmtPeriod = (m: number | null, y: number | null) =>
    `${m ? HEBREW_MONTHS[m - 1] : '—'} ${y ?? ''}`.trim();

  const FILE_TYPE_LABELS: Record<string, string> = {
    attendance: 'נוכחות',
    payslips: 'תלושי שכר',
    prevPayslips: 'תלושים חודש קודם',
    utilization: 'נוכחות וניצולים',
    employeeMaster: 'נתוני עובד מיכפל',
    unknown: 'לא זוהה',
  };

  const FILE_TYPE_COLORS: Record<string, string> = {
    attendance: 'bg-blue-100 text-blue-700',
    payslips: 'bg-purple-100 text-purple-700',
    prevPayslips: 'bg-slate-100 text-slate-600',
    utilization: 'bg-emerald-100 text-emerald-700',
    employeeMaster: 'bg-amber-100 text-amber-700',
    unknown: 'bg-red-100 text-red-600',
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6" dir="rtl">
      <div className="w-full max-w-2xl">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 rounded-2xl mb-4">
            <FileSpreadsheet className="w-8 h-8 text-blue-600" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">ביקורת שכר</h1>
          <p className="text-gray-500">העלה קבצי אקסל — האתר יזהה את הסוג אוטומטית ויבצע את כל הבדיקות</p>
        </div>

        {/* בורר חודש בדיקה */}
        <div className="mb-5 bg-white border border-gray-200 rounded-2xl px-5 py-4 flex items-center gap-4">
          <div className="inline-flex items-center justify-center w-10 h-10 bg-indigo-100 rounded-xl shrink-0">
            <CalendarClock className="w-5 h-5 text-indigo-600" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-gray-800">חודש שכר לבדיקה</p>
            <p className="text-xs text-gray-500">נקבע אוטומטית מהתלוש — ניתן לשנות ידנית</p>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={selMonth ?? ''}
              onChange={e => pickMonth(Number(e.target.value))}
              className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 focus:border-indigo-500 focus:outline-none"
            >
              <option value="" disabled>חודש</option>
              {HEBREW_MONTHS.map((name, i) => (
                <option key={i} value={i + 1}>{name}</option>
              ))}
            </select>
            <select
              value={selYear ?? ''}
              onChange={e => pickYear(Number(e.target.value))}
              className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 focus:border-indigo-500 focus:outline-none"
            >
              <option value="" disabled>שנה</option>
              {YEAR_OPTIONS.map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Drop zone */}
        <div
          className={cn(
            'border-2 border-dashed rounded-2xl p-10 text-center transition-all cursor-pointer',
            dragging ? 'border-blue-500 bg-blue-50' : 'border-gray-300 bg-white hover:border-blue-400 hover:bg-blue-50/30'
          )}
          onDragOver={e => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          onClick={() => document.getElementById('file-input')?.click()}
        >
          {loading ? (
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="w-10 h-10 text-blue-500 animate-spin" />
              <p className="text-gray-600">מעבד קבצים...</p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3">
              <Upload className="w-10 h-10 text-gray-400" />
              <div>
                <p className="text-lg font-medium text-gray-700">גרור קבצים לכאן</p>
                <p className="text-sm text-gray-500 mt-1">או לחץ לבחירה — עד 5 קבצי Excel</p>
              </div>
              <p className="text-xs text-gray-400">נוכחות + תלושים + נוכחות וניצולים (+ חודש קודם / נתוני עובד מיכפל — אופציונלי)</p>
            </div>
          )}
        </div>
        <input
          id="file-input" type="file" multiple accept=".xlsx,.xls"
          className="hidden" onChange={handleFileInput}
        />

        {/* מדריך ייצוא הקבצים מהמערכות */}
        <div className="mt-4 bg-white border border-gray-200 rounded-2xl overflow-hidden">
          <button
            type="button"
            onClick={() => setGuideOpen(o => !o)}
            className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-gray-50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <BookOpen className="w-5 h-5 text-indigo-500 shrink-0" />
              <span className="text-sm font-semibold text-gray-800">איך מוציאים את הקבצים מהמערכות?</span>
            </div>
            <ChevronDown className={cn('w-5 h-5 text-gray-400 transition-transform shrink-0', guideOpen && 'rotate-180')} />
          </button>
          {guideOpen && (
            <div className="px-5 pb-5 pt-2 space-y-3 border-t border-gray-100">
              {EXPORT_GUIDE.map((g, i) => (
                <div key={i} className="rounded-xl bg-gray-50 border border-gray-100 p-3">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-gray-800">{g.name}</span>
                      {g.optional && <span className="text-[11px] text-gray-400">(אופציונלי)</span>}
                    </div>
                    <span className={cn(
                      'text-[11px] px-2 py-0.5 rounded-full font-medium shrink-0',
                      g.system === 'רסטיגו' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'
                    )}>
                      {g.system}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mb-2">{g.role}</p>
                  <div className="flex flex-wrap items-center gap-1 text-xs text-gray-600">
                    {g.path.map((step, j) => (
                      <span key={j} className="flex items-center gap-1">
                        <span className="px-1.5 py-0.5 bg-white border border-gray-200 rounded">{step}</span>
                        {j < g.path.length - 1 && <ChevronLeft className="w-3 h-3 text-gray-300 shrink-0" />}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
              <p className="text-[11px] text-gray-400 pt-1">
                שמות הקבצים אינם חובה — הזיהוי מתבצע לפי תוכן הקובץ.
              </p>
            </div>
          )}
        </div>

        {/* Loaded files */}
        {files.length > 0 && (
          <div className="mt-4 space-y-2">
            {files.map(f => (
              <div key={f.filename} className="flex items-center justify-between bg-white border border-gray-200 rounded-xl px-4 py-3">
                <div className="flex items-center gap-3">
                  <FileSpreadsheet className="w-5 h-5 text-gray-400 shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-gray-800">{f.filename}</p>
                    <p className="text-xs text-gray-500">{f.rowCount} עובדים</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={cn('text-xs px-2 py-1 rounded-full font-medium', FILE_TYPE_COLORS[f.type])}>
                    {FILE_TYPE_LABELS[f.type]}
                  </span>
                  <button onClick={() => removeFile(f.filename)} className="text-gray-400 hover:text-red-500 transition-colors">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Missing columns warning */}
        {missingCols.length > 0 && (
          <div className="mt-4 bg-amber-50 border border-amber-200 rounded-xl p-4 flex gap-3">
            <AlertCircle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-amber-800">עמודות חסרות</p>
              <p className="text-sm text-amber-700 mt-1">
                העמודות הבאות לא זוהו: <strong>{missingCols.join(', ')}</strong>.
                חלק מהבדיקות עלולות להיות חלקיות.
              </p>
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="mt-4 bg-red-50 border border-red-200 rounded-xl p-4 flex gap-3">
            <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {/* אזהרת אי-התאמה בין חודש הקובץ לחודש שנבחר */}
        {periodMismatches.length > 0 && (
          <div className="mt-4 bg-red-50 border border-red-200 rounded-xl p-4 flex gap-3">
            <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
            <div className="text-sm text-red-700">
              <p className="font-semibold text-red-800">אי-התאמה בחודש</p>
              <p className="mt-1">
                בחרת לבדוק את חודש <strong>{fmtPeriod(selMonth, selYear)}</strong>, אך:
              </p>
              <ul className="mt-1 list-disc mr-5 space-y-0.5">
                {periodMismatches.map(m => (
                  <li key={m.label}>
                    הקובץ <strong>{m.label}</strong> מסומן <strong>{fmtPeriod(m.month, m.year)}</strong>
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-red-600">ודא שהעלית את הקבצים של החודש הנכון. אפשר להריץ בכל זאת.</p>
            </div>
          </div>
        )}

        {/* What's loaded */}
        <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatusCard
            label="דוח נוכחות"
            loaded={!!attData}
            count={attData?.length}
            unit="עובדים"
          />
          <StatusCard
            label="תלושי שכר"
            loaded={!!payData}
            count={payData?.size}
            unit="עובדים"
          />
          <StatusCard
            label="נוכחות וניצולים"
            loaded={!!utilData}
            count={utilData?.size}
            unit="עובדים"
          />
          <StatusCard
            label="נתוני עובד מיכפל"
            loaded={!!masterData}
            count={masterData?.size}
            unit="עובדים"
            optional
          />
        </div>

        {/* Run button */}
        <button
          disabled={!canRun}
          onClick={() => canRun && onReady(
            attData!,
            payData!,
            prevPayData ?? undefined,
            utilData ?? undefined,
            (selMonth !== null && selYear !== null) ? { month: selMonth, year: selYear } : undefined,
            masterData ?? undefined
          )}
          className={cn(
            'mt-6 w-full py-4 rounded-2xl text-lg font-semibold transition-all',
            canRun
              ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-lg shadow-blue-200'
              : 'bg-gray-100 text-gray-400 cursor-not-allowed'
          )}
        >
          {canRun ? '▶ הרץ ביקורת שכר' : 'העלה נוכחות + תלושים + נוכחות וניצולים כדי להתחיל'}
        </button>
      </div>
    </div>
  );
}

function StatusCard({ label, loaded, count, unit, optional }: {
  label: string; loaded: boolean; count?: number; unit: string; optional?: boolean;
}) {
  return (
    <div className={cn(
      'border rounded-xl p-4 flex items-center gap-3',
      loaded ? 'border-green-200 bg-green-50' : 'border-gray-200 bg-gray-50'
    )}>
      {loaded
        ? <CheckCircle className="w-5 h-5 text-green-500 shrink-0" />
        : <div className="w-5 h-5 border-2 border-gray-300 rounded-full shrink-0" />
      }
      <div>
        <p className="text-sm font-medium text-gray-700">
          {label}
          {optional && <span className="text-xs text-gray-400 mr-1">(אופציונלי)</span>}
        </p>
        {loaded && count !== undefined && (
          <p className="text-xs text-green-600">{count} {unit}</p>
        )}
      </div>
    </div>
  );
}
