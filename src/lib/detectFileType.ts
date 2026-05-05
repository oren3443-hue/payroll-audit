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

  const attScore = attendanceSignals.filter(s => sample.includes(s.toLowerCase())).length;
  const payScore = payslipSignals.filter(s => sample.includes(s.toLowerCase())).length;

  if (attScore >= 2) return 'attendance';
  if (payScore >= 2) return 'payslips';
  return 'unknown';
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
