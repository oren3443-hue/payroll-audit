import { useState, useCallback } from 'react';
import { UploadZone } from './components/UploadZone';
import { Dashboard } from './components/Dashboard';
import { AuditResult, AttendanceRow } from './lib/types';
import { PayslipEmployee } from './lib/parsePayslips';
import { runAudit } from './lib/runAudit';
import { exportToExcel } from './lib/exportExcel';
import { Loader2 } from 'lucide-react';

type AppState = 'upload' | 'running' | 'done';

interface Progress {
  done: number;
  total: number;
  label: string;
}

export default function App() {
  const [appState, setAppState] = useState<AppState>('upload');
  const [progress, setProgress] = useState<Progress>({ done: 0, total: 1, label: '' });
  const [result, setResult] = useState<AuditResult | null>(null);

  const handleReady = useCallback(async (
    att: AttendanceRow[],
    pay: Map<string, PayslipEmployee>,
    prev?: Map<string, PayslipEmployee>
  ) => {
    setAppState('running');
    setProgress({ done: 0, total: 17 + (prev ? 4 : 0), label: 'מתחיל...' });

    await new Promise(r => setTimeout(r, 50));

    const auditResult = runAudit(att, pay, prev, (done, total, label) => {
      setProgress({ done, total, label });
    });

    setResult(auditResult);
    setAppState('done');
  }, []);

  const handleReset = () => {
    setAppState('upload');
    setResult(null);
  };

  const handleExport = async () => {
    if (result) {
      await exportToExcel(result);
    }
  };

  if (appState === 'upload') {
    return <UploadZone onReady={handleReady} />;
  }

  if (appState === 'running') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-8 bg-gray-50" dir="rtl">
        <Loader2 className="w-12 h-12 text-blue-500 animate-spin" />
        <div className="text-center">
          <p className="text-lg font-semibold text-gray-800 mb-2">מבצע בדיקות...</p>
          <p className="text-sm text-gray-500">{progress.label}</p>
        </div>
        <div className="w-80">
          <div className="flex justify-between text-xs text-gray-500 mb-1">
            <span>{progress.done} / {progress.total}</span>
            <span>{Math.round((progress.done / progress.total) * 100)}%</span>
          </div>
          <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-500 rounded-full transition-all duration-300"
              style={{ width: `${(progress.done / progress.total) * 100}%` }}
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <Dashboard
      result={result!}
      onReset={handleReset}
      onExport={handleExport}
    />
  );
}
