import { UtilizationRow } from './types';

function toNum(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return isNaN(n) ? null : n;
}

function toStr(v: unknown): string {
  if (v === null || v === undefined) return '';
  return String(v).trim();
}

function findDataStart(rows: unknown[][]): number {
  // הכותרות בשורה הראשונה; הנתונים בשורה 2 והלאה
  for (let i = 0; i < Math.min(5, rows.length); i++) {
    const row = rows[i] as unknown[];
    if (row && row[2] !== null && row[2] !== undefined && row[2] !== '') {
      const id = String(row[2]).trim();
      if (/^\d+$/.test(id)) return i;
    }
  }
  return 1;
}

export function parseUtilization(rows: unknown[][]): {
  rows: Map<string, UtilizationRow>;
  missingColumns: string[];
} {
  const missingColumns: string[] = [];
  const dataStart = findDataStart(rows);
  const map = new Map<string, UtilizationRow>();

  const headerStr = rows.slice(0, dataStart)
    .map(r => (r as unknown[]).map(c => String(c ?? '')).join('|'))
    .join('|')
    .toLowerCase();

  if (!headerStr.includes('בסיס שכר')) missingColumns.push('בסיס שכר');
  if (!headerStr.includes('י"ע בפועל') && !headerStr.includes('בפועל')) missingColumns.push('י"ע בפועל');

  for (let i = dataStart; i < rows.length; i++) {
    const row = rows[i] as unknown[];
    if (!row || row.length < 10) continue;
    const empId = toStr(row[2]);
    if (!empId || !/^\d+$/.test(empId)) continue;

    map.set(empId, {
      empId,
      name: toStr(row[3]),
      department: toStr(row[4]),
      salaryBase: toStr(row[6]),
      paidDays: toNum(row[9]),
      paidHours: toNum(row[10]),
      absenceHours: toNum(row[11]),
      stdDays: toNum(row[12]),
      actualDays: toNum(row[13]),
      stdHours: toNum(row[14]),
      actualHours: toNum(row[15]),
      vacUsed: toNum(row[17]),
      vacBalance: toNum(row[18]),
      sickUsed: toNum(row[20]),
      sickBalance: toNum(row[21]),
      reserveDays: toNum(row[22]),
    });
  }

  return { rows: map, missingColumns };
}
