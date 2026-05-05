import { useState, useCallback } from 'react';
import { Upload, FileSpreadsheet, X, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { parseExcelFile } from '../lib/detectFileType';
import { parseAttendance } from '../lib/parseAttendance';
import { parsePayslips } from '../lib/parsePayslips';
import { AttendanceRow } from '../lib/types';
import { PayslipEmployee } from '../lib/parsePayslips';
import { cn } from '../lib/utils';

interface LoadedFile {
  type: 'attendance' | 'payslips' | 'prevPayslips' | 'unknown';
  filename: string;
  rowCount: number;
}

interface Props {
  onReady: (
    att: AttendanceRow[],
    pay: Map<string, PayslipEmployee>,
    prev?: Map<string, PayslipEmployee>
  ) => void;
}

export function UploadZone({ onReady }: Props) {
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [files, setFiles] = useState<LoadedFile[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [missingCols, setMissingCols] = useState<string[]>([]);

  const [attData, setAttData] = useState<AttendanceRow[] | null>(null);
  const [payData, setPayData] = useState<Map<string, PayslipEmployee> | null>(null);
  const [prevPayData, setPrevPayData] = useState<Map<string, PayslipEmployee> | null>(null);

  const processFiles = useCallback(async (fileList: File[]) => {
    setLoading(true);
    setError(null);
    setMissingCols([]);

    let newAtt = attData;
    let newPay = payData;
    let newPrev = prevPayData;
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

        // If already have a file of this type, treat next payslip as prev
        if (detected.type === 'payslips' && newPay) {
          detected.type = 'prevPayslips';
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
          const { employees, missingColumns } = parsePayslips(detected.rows);
          if (missingColumns.length > 0) {
            setMissingCols(prev => [...prev, ...missingColumns]);
          }
          newPay = employees;
          newFiles.push({ type: 'payslips', filename: file.name, rowCount: employees.size });
          setPayData(employees);
        } else if (detected.type === 'prevPayslips') {
          const { employees } = parsePayslips(detected.rows);
          newPrev = employees;
          newFiles.push({ type: 'prevPayslips', filename: file.name, rowCount: employees.size });
          setPrevPayData(employees);
        }
      }
    } catch (e) {
      setError(`שגיאה בקריאת הקובץ: ${e instanceof Error ? e.message : String(e)}`);
    }

    setFiles(newFiles.slice(-4)); // show last 4
    setLoading(false);
  }, [attData, payData, prevPayData, files]);

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
    if (removed?.type === 'payslips') setPayData(null);
    if (removed?.type === 'prevPayslips') setPrevPayData(null);
  };

  const canRun = attData && payData;

  const FILE_TYPE_LABELS: Record<string, string> = {
    attendance: 'נוכחות',
    payslips: 'תלושי שכר',
    prevPayslips: 'תלושים חודש קודם',
    unknown: 'לא זוהה',
  };

  const FILE_TYPE_COLORS: Record<string, string> = {
    attendance: 'bg-blue-100 text-blue-700',
    payslips: 'bg-purple-100 text-purple-700',
    prevPayslips: 'bg-slate-100 text-slate-600',
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
                <p className="text-sm text-gray-500 mt-1">או לחץ לבחירה — עד 3 קבצי Excel</p>
              </div>
              <p className="text-xs text-gray-400">נוכחות + תלושים (+ חודש קודם אופציונלי)</p>
            </div>
          )}
        </div>
        <input
          id="file-input" type="file" multiple accept=".xlsx,.xls"
          className="hidden" onChange={handleFileInput}
        />

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

        {/* What's loaded */}
        <div className="mt-6 grid grid-cols-2 gap-3">
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
        </div>

        {/* Run button */}
        <button
          disabled={!canRun}
          onClick={() => canRun && onReady(attData!, payData!, prevPayData ?? undefined)}
          className={cn(
            'mt-6 w-full py-4 rounded-2xl text-lg font-semibold transition-all',
            canRun
              ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-lg shadow-blue-200'
              : 'bg-gray-100 text-gray-400 cursor-not-allowed'
          )}
        >
          {canRun ? '▶ הרץ ביקורת שכר' : 'העלה קובץ נוכחות + תלושים כדי להתחיל'}
        </button>
      </div>
    </div>
  );
}

function StatusCard({ label, loaded, count, unit }: {
  label: string; loaded: boolean; count?: number; unit: string;
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
        <p className="text-sm font-medium text-gray-700">{label}</p>
        {loaded && count !== undefined && (
          <p className="text-xs text-green-600">{count} {unit}</p>
        )}
      </div>
    </div>
  );
}
