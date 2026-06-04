import { EmployeeMaster } from './types';

function toStr(v: unknown): string {
  if (v === null || v === undefined) return '';
  return String(v).trim();
}

// מפענח תאריך מתא Excel: אובייקט Date, מספר סריאלי של Excel, או מחרוזת.
export function parseExcelDate(v: unknown): Date | null {
  if (v === null || v === undefined || v === '') return null;
  if (v instanceof Date) return isNaN(v.getTime()) ? null : v;
  if (typeof v === 'number') {
    // מספר סריאלי של Excel (ימים מאז 1899-12-30). בונים ב-UTC בצהריים כדי לנטרל הסחת אזור-זמן.
    const ms = Math.round((v - 25569) * 86400 * 1000) + 12 * 3600 * 1000;
    const d = new Date(ms);
    return isNaN(d.getTime()) ? null : d;
  }
  const s = String(v).trim();
  let m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/);
  if (m) return new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

function findDataStart(rows: unknown[][]): number {
  // הכותרות בשורה 0; הנתונים מתחילים בשורה הראשונה עם מספר עובד נומרי ב-col 0
  for (let i = 0; i < Math.min(5, rows.length); i++) {
    const row = rows[i] as unknown[];
    if (row && row[0] !== null && row[0] !== undefined && row[0] !== '') {
      const id = String(row[0]).trim();
      if (/^\d+$/.test(id)) return i;
    }
  }
  return 1;
}

export function parseEmployeeMaster(rows: unknown[][]): {
  employees: Map<string, EmployeeMaster>;
  missingColumns: string[];
} {
  const missingColumns: string[] = [];
  const dataStart = findDataStart(rows);
  const map = new Map<string, EmployeeMaster>();

  const headerStr = rows.slice(0, dataStart)
    .map(r => (r as unknown[]).map(c => String(c ?? '')).join('|'))
    .join('|');

  if (!headerStr.includes('תאריך לידה')) missingColumns.push('תאריך לידה');

  for (let i = dataStart; i < rows.length; i++) {
    const row = rows[i] as unknown[];
    if (!row || row.length < 16) continue;
    const empId = toStr(row[0]);
    if (!empId || !/^\d+$/.test(empId)) continue;

    const firstName = toStr(row[2]);
    const lastName = toStr(row[3]);
    map.set(empId, {
      empId,
      name: `${firstName} ${lastName}`.trim() || firstName,
      birthDate: parseExcelDate(row[15]),
      gender: toStr(row[6]),
    });
  }

  return { employees: map, missingColumns };
}
