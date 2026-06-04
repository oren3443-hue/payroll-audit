export type Severity = 'critical' | 'high' | 'medium' | 'low';

export interface AttendanceRow {
  empId: string;          // col 11 - מס' עובד במע' שכר
  firstName: string;      // col 4
  lastName: string;       // col 5
  name: string;           // firstName + lastName
  branch: string;         // col 1 - ענף/מפעל
  role: string;           // col 2 - תפקיד
  department: string;     // col 6 - מחלקה
  idNumber: string;       // col 7 - ת.ז.
  internalId: string;     // col 8 - מס' עובד פנימי
  costType: string;       // col 12 - סוג עלות
  hourlyRate: number;     // col 13 - תעריף שעתי
  workDays: number;       // col 14 - ימי עבודה
  hours100: number;       // col 15 - שעות 100%
  hours125: number;       // col 16 - שעות 125%
  hours150: number;       // col 17 - שעות 150%
  hoursNight: number;     // col 18 - שעות לילה
  hoursBreak: number;     // col 19 - הפסקות
  hoursTotal: number;     // col 20 - סה"כ שעות
  travel: number;         // col 21 - עלות נסיעות
  salary: number;         // col 22 - שכר
  vacationDays: number;   // col 23 - ימי חופשה
  sickDays: number;       // col 24 - ימי מחלה
  reserveDays: number;    // col 25 - ימי מילואים
}

export interface UtilizationRow {
  empId: string;          // col 2 - מספר עובד
  name: string;           // col 3 - שם העובד
  department: string;     // col 4 - שם מחלקה
  salaryBase: string;     // col 6 - 'חדשי' / 'לפי שעות'
  paidDays: number | null;     // col 9  - י"ע משולמים
  paidHours: number | null;    // col 10 - ש"ע משולמות
  absenceHours: number | null; // col 11 - שעות העדרות
  stdDays: number | null;      // col 12 - תקן י"ע
  actualDays: number | null;   // col 13 - י"ע בפועל
  stdHours: number | null;     // col 14 - תקן ש"ע
  actualHours: number | null;  // col 15 - ש"ע בפועל
  vacUsed: number | null;      // col 17 - חופשה ניצול
  vacBalance: number | null;   // col 18 - חופשה יתרה
  sickUsed: number | null;     // col 20 - מחלה ניצול
  sickBalance: number | null;  // col 21 - מחלה יתרה
  reserveDays: number | null;  // col 22 - מילואים
}

export interface PayslipComponent {
  componentName: string;  // col 6
  componentCode: string;  // col 7
  qty: number | null;     // col 8
  price: number | null;   // col 9
  payment: number | null; // col 11
}

export interface PayslipEmployee {
  empId: string;          // col 3
  name: string;           // col 4
  department: string;     // col 37
  departmentId: string;   // col 36
  workDays: number | null;    // col 21 (first row only)
  hoursTotal: number | null;  // col 22 (first row only, may be null)
  vacationDays: number | null; // col 24
  sickDays: number | null;     // col 25
  netPay: number | null;       // col 19
  components: PayslipComponent[];
  isGlobal: boolean;      // has משכורת component
}

export interface EmployeeMaster {
  empId: string;          // col 0 - מספר עובד (מספר מיכפל, מפתח חיבור)
  name: string;           // col 2 + col 3 - שם פרטי + שם משפחה
  birthDate: Date | null; // col 15 - תאריך לידה
  gender: string;         // col 6 - קוד מין
}

export interface IssueStatus {
  status: 'unreviewed' | 'ok' | 'fix' | 'irrelevant';
  note?: string;
}

export type CheckId =
  | 'Q1' | 'Q2' | 'Q3' | 'Q4' | 'Q5'
  | 'C1' | 'C2' | 'C3' | 'C4' | 'C5' | 'C6' | 'C7' | 'C8' | 'C9' | 'C10' | 'C11' | 'C12' | 'C13' | 'C14'
  | 'P1' | 'P2' | 'P3' | 'P4';

export interface CheckResult {
  empId: string;
  empName: string;
  department: string;
  branch?: string;
  costType?: string;
  severity: Severity;
  fields: Record<string, string | number | null>;
  financialImpact: number;
  checkId: CheckId;
}

export interface CheckSummary {
  checkId: CheckId;
  label: string;
  description: string;
  category: 'quality' | 'business' | 'prev';
  results: CheckResult[];
  totalFinancial: number;
  criticalCount: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;
}

export interface AuditResult {
  checks: CheckSummary[];
  employeeMap: Map<string, { att?: AttendanceRow; pay?: PayslipEmployee }>;
  totalIssues: number;
  totalFinancial: number;
  financialForEmployee: number;
  financialForCompany: number;
  month: string;
}

export interface FileDetectionResult {
  type: 'attendance' | 'payslips' | 'prevPayslips' | 'utilization' | 'employeeMaster' | 'unknown';
  rows: unknown[][];
  filename: string;
}
