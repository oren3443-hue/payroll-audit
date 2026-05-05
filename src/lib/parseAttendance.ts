import { AttendanceRow } from './types';

function toNum(v: unknown): number {
  if (v === null || v === undefined || v === '') return 0;
  const n = Number(v);
  return isNaN(n) ? 0 : n;
}

function toStr(v: unknown): string {
  if (v === null || v === undefined) return '';
  return String(v).trim();
}

function findDataStart(rows: unknown[][]): number {
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i] as unknown[];
    // Data rows have a numeric value at col 11 (employee ID)
    if (row && row[11] !== null && row[11] !== undefined && row[11] !== '') {
      const id = String(row[11]).trim();
      if (/^\d+$/.test(id)) return i;
    }
  }
  return 1;
}

export function parseAttendance(rows: unknown[][]): {
  employees: AttendanceRow[];
  missingColumns: string[];
} {
  const missingColumns: string[] = [];
  const dataStart = findDataStart(rows);
  const employees: AttendanceRow[] = [];

  // Validate required columns exist by scanning header rows
  const headerRows = rows.slice(0, dataStart).map(r => (r as unknown[]).map(c => String(c ?? '').trim()).join('|'));
  const headerStr = headerRows.join('|').toLowerCase();

  const required = [
    { name: 'שעות לילה', check: 'שעות לילה' },
    { name: 'עלות נסיעות', check: 'עלות נסיעות' },
    { name: 'מס\' עובד', check: 'עובד' },
  ];
  for (const r of required) {
    if (!headerStr.includes(r.check.toLowerCase())) {
      missingColumns.push(r.name);
    }
  }

  for (let i = dataStart; i < rows.length; i++) {
    const row = rows[i] as unknown[];
    if (!row || row.length < 12) continue;
    const empId = toStr(row[11]);
    if (!empId || !/^\d+$/.test(empId)) continue;

    employees.push({
      empId,
      firstName: toStr(row[4]),
      lastName: toStr(row[5]),
      name: `${toStr(row[4])} ${toStr(row[5])}`.trim() || toStr(row[4]),
      branch: toStr(row[1]),
      role: toStr(row[2]),
      department: toStr(row[6]),
      idNumber: toStr(row[7]),
      internalId: toStr(row[8]),
      costType: toStr(row[12]),
      hourlyRate: toNum(row[13]),
      workDays: toNum(row[14]),
      hours100: toNum(row[15]),
      hours125: toNum(row[16]),
      hours150: toNum(row[17]),
      hoursNight: toNum(row[18]),
      hoursBreak: toNum(row[19]),
      hoursTotal: toNum(row[20]),
      travel: toNum(row[21]),
      salary: toNum(row[22]),
      vacationDays: toNum(row[23]),
      sickDays: toNum(row[24]),
      reserveDays: toNum(row[25]),
    });
  }

  return { employees, missingColumns };
}
