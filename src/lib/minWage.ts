import { EmployeeMaster } from './types';
import { PayslipEmployee, getComponent } from './parsePayslips';

export interface MinWageConfig {
  base: number;     // 18+   (100%)
  youth16: number;  // עד 16 (70%)
  youth17: number;  // 16–17 (75%)
  youth18: number;  // 17–18 (83%)
}

// ערכים רשמיים — שכר מינימום לשעה, תוקף 01.04.2026 (ניתנים לעריכה ידנית במסך)
export const DEFAULT_MIN_WAGE: MinWageConfig = {
  base: 35.40,
  youth16: 26.07,
  youth17: 27.94,
  youth18: 30.92,
};

export interface MinWageRow {
  empId: string;        // מספר מיכפל (מפתח חיבור)
  name: string;
  department: string;
  birthDate: Date;
  age: number;          // הגיל בחודש הבדיקה
  bornThisMonth: boolean;
  rate: number;         // תעריף ששולם בתלוש (שכר 100%)
  minForAge: number;
  tierLabel: string;
  shortfall: number;    // כמה חסר לשעה (0 = תקין)
  violation: boolean;
}

export function tierFor(age: number, cfg: MinWageConfig): { min: number; label: string } {
  if (age < 16) return { min: cfg.youth16, label: 'עד 16' };
  if (age < 17) return { min: cfg.youth17, label: '16–17' };
  if (age < 18) return { min: cfg.youth18, label: '17–18' };
  return { min: cfg.base, label: '18+' };
}

// הגיל בסוף חודש הבדיקה — מי שיום-הולדתו בחודש הנבדק כבר חצה את הגיל החדש
function ageAt(birth: Date, year: number, month: number): number {
  return year - birth.getFullYear() - (birth.getMonth() + 1 > month ? 1 : 0);
}

export function buildMinWageRows(
  master: Map<string, EmployeeMaster>,
  payslips: Map<string, PayslipEmployee>,
  period: { month: number; year: number },
  cfg: MinWageConfig
): MinWageRow[] {
  const rows: MinWageRow[] = [];
  for (const m of master.values()) {
    if (!m.birthDate) continue;
    const pay = payslips.get(m.empId);
    if (!pay || pay.isGlobal) continue;              // רק מי שקיים בתלוש, ורק שעתיים
    const rate = getComponent(pay, ['שכר 100%'])?.price ?? null;
    if (rate === null || rate <= 1) continue;         // תעריף שעתי תקֵף בלבד
    const age = ageAt(m.birthDate, period.year, period.month);
    const { min, label } = tierFor(age, cfg);
    const shortfall = Math.max(0, Math.round((min - rate) * 100) / 100);
    rows.push({
      empId: m.empId,
      name: pay.name || m.name,
      department: pay.department || '',
      birthDate: m.birthDate,
      age,
      bornThisMonth: m.birthDate.getMonth() + 1 === period.month,
      rate,
      minForAge: min,
      tierLabel: label,
      shortfall,
      violation: shortfall > 0.001,
    });
  }
  return rows;
}

// השכיח (mode) של התעריפים ששולמו — בדיקת שפיות מול הבסיס שהוזן
export function detectModalRate(payslips: Map<string, PayslipEmployee>): number | null {
  const counts = new Map<number, number>();
  for (const pay of payslips.values()) {
    if (pay.isGlobal) continue;
    const r = getComponent(pay, ['שכר 100%'])?.price;
    if (r != null && r > 1) counts.set(r, (counts.get(r) ?? 0) + 1);
  }
  let best: number | null = null, bestCount = 0;
  for (const [r, c] of counts) if (c > bestCount) { best = r; bestCount = c; }
  return best;
}
