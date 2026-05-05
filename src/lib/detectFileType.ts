import { FileDetectionResult } from './types';

function findHeaderRow(rows: unknown[][]): number {
  for (let i = 0; i < Math.min(10, rows.length); i++) {
    const row = rows[i];
    if (row && row.length > 5) return i;
  }
  return 0;
}

function rowToString(row: unknown[]): string {
  return row.map(c => String(c ?? '')).join('|').toLowerCase();
}

export function detectFileType(rows: unknown[][], filename: string): FileDetectionResult['type'] {
  const headerIdx = findHeaderRow(rows);
  const sample = rows.slice(headerIdx, headerIdx + 3)
    .map(r => rowToString(r as unknown[]))
    .join(' ');

  const attendanceSignals = ['שעות לילה', 'עלות נסיעות', 'ימי עבודה בפועל', 'שעות 100', 'שעות 125', 'ימי מחלה'];
  const payslipSignals = ['שם הרכיב', 'קוד', 'כמות', 'מחיר', 'תשלום', 'רכיב תשלום'];
  // קובץ נוכחות וניצולים מזוהה לפי שילוב ייחודי של עמודות
  const utilSignals = ['בסיס שכר', 'י"ע משולמים', 'ש"ע משולמות', 'תקן י"ע', 'י"ע בפועל', 'חופשה - יתרה', 'מחלה - יתרה'];

  const attScore = attendanceSignals.filter(s => sample.includes(s.toLowerCase())).length;
  const payScore = payslipSignals.filter(s => sample.includes(s.toLowerCase())).length;
  const utilScore = utilSignals.filter(s => sample.includes(s.toLowerCase())).length;

  if (utilScore >= 2) return 'utilization';
  if (attScore >= 2) return 'attendance';
  if (payScore >= 2) {
    // רמז משם הקובץ — אם כתוב "קודם" / "prev" / "previous"
    const fnameLower = filename.toLowerCase();
    if (fnameLower.includes('קודם') || fnameLower.includes('prev') || fnameLower.includes('previous')) {
      return 'prevPayslips';
    }
    return 'payslips';
  }
  return 'unknown';
}

// מחלץ מספר חודש מנתוני התלוש (col[2] בשורת נתונים ראשונה)
export function extractMonthFromPayslip(rows: unknown[][]): number | null {
  for (let i = 0; i < Math.min(20, rows.length); i++) {
    const row = rows[i] as unknown[];
    if (!row) continue;
    const m = row[2];
    if (m !== null && m !== undefined && m !== '') {
      const n = Number(m);
      if (!isNaN(n) && n >= 1 && n <= 12) return n;
    }
  }
  return null;
}

export function parseExcelFile(file: File): Promise<FileDetectionResult> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        // Dynamic import to avoid SSR issues
        import('xlsx').then(XLSX => {
          const data = new Uint8Array(e.target!.result as ArrayBuffer);
          const wb = XLSX.read(data, { type: 'array' });
          const ws = wb.Sheets[wb.SheetNames[0]];
          const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: null });
          const type = detectFileType(rows as unknown[][], file.name);
          resolve({ type, rows: rows as unknown[][], filename: file.name });
        });
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}
