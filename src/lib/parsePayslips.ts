import type { PayslipEmployee, PayslipComponent } from './types';
export type { PayslipEmployee };

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
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i] as unknown[];
    if (row && row[3] !== null && row[3] !== undefined && row[3] !== '') {
      const id = String(row[3]).trim();
      if (/^\d+$/.test(id)) return i;
    }
  }
  return 1;
}

export function parsePayslips(rows: unknown[][]): {
  employees: Map<string, PayslipEmployee>;
  missingColumns: string[];
} {
  const missingColumns: string[] = [];
  const dataStart = findDataStart(rows);
  const empMap = new Map<string, PayslipEmployee>();

  const headerStr = rows.slice(0, dataStart)
    .map(r => (r as unknown[]).map(c => String(c ?? '')).join('|'))
    .join('|')
    .toLowerCase();

  if (!headerStr.includes('שם הרכיב') && !headerStr.includes('רכיב')) {
    missingColumns.push('שם הרכיב');
  }
  if (!headerStr.includes('מספר עובד') && !headerStr.includes('עובד')) {
    missingColumns.push('מספר עובד');
  }

  const seenFirstRow = new Set<string>();

  for (let i = dataStart; i < rows.length; i++) {
    const row = rows[i] as unknown[];
    if (!row || row.length < 10) continue;
    const empId = toStr(row[3]);
    if (!empId || !/^\d+$/.test(empId)) continue;

    const isFirst = !seenFirstRow.has(empId);
    if (isFirst) seenFirstRow.add(empId);

    if (!empMap.has(empId)) {
      empMap.set(empId, {
        empId,
        name: toStr(row[4]),
        department: toStr(row[37]),
        departmentId: toStr(row[36]),
        workDays: null,
        hoursTotal: null,
        vacationDays: null,
        sickDays: null,
        netPay: null,
        components: [],
        isGlobal: false,
      });
    }

    const emp = empMap.get(empId)!;

    // Summary fields only on first row
    if (isFirst) {
      emp.workDays = toNum(row[21]);
      emp.hoursTotal = toNum(row[22]);
      emp.vacationDays = toNum(row[24]);
      emp.sickDays = toNum(row[25]);
      emp.netPay = toNum(row[19]);
    }

    const componentName = toStr(row[6]);
    if (componentName) {
      const comp: PayslipComponent = {
        componentName,
        componentCode: toStr(row[7]),
        qty: toNum(row[8]),
        price: toNum(row[9]),
        payment: toNum(row[11]),
      };
      emp.components.push(comp);

      if (componentName === 'משכורת') {
        emp.isGlobal = true;
      }
    }
  }

  return { employees: empMap, missingColumns };
}

export function getComponent(emp: PayslipEmployee, names: string[]): PayslipComponent | undefined {
  return emp.components.find(c => names.some(n => c.componentName === n || c.componentName.includes(n)));
}

export function getComponentQty(emp: PayslipEmployee, names: string[]): number | null {
  const comp = getComponent(emp, names);
  return comp?.qty ?? null;
}

export function getComponentPayment(emp: PayslipEmployee, names: string[]): number | null {
  const comp = getComponent(emp, names);
  return comp?.payment ?? null;
}
