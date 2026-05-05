import { CheckResult, CheckSummary, AttendanceRow, Severity, CheckId } from '../types';
import { PayslipEmployee, getComponentQty, getComponentPayment } from '../parsePayslips';

function abs(v: number) { return Math.abs(v); }

function moneySev(money: number): Severity | null {
  if (abs(money) < 0.1) return null;
  if (abs(money) <= 100) return 'medium';
  if (abs(money) <= 500) return 'high';
  return 'critical';
}

function makeSum(
  checkId: CheckId, label: string, description: string, results: CheckResult[]
): CheckSummary {
  return {
    checkId, label, description, category: 'business', results,
    totalFinancial: results.reduce((s, r) => s + r.financialImpact, 0),
    criticalCount: results.filter(r => r.severity === 'critical').length,
    highCount: results.filter(r => r.severity === 'high').length,
    mediumCount: results.filter(r => r.severity === 'medium').length,
    lowCount: results.filter(r => r.severity === 'low').length,
  };
}

// C1: Hourly rate mismatch
export function checkHourlyRate(
  attMap: Map<string, AttendanceRow>,
  payMap: Map<string, PayslipEmployee>
): CheckSummary {
  const results: CheckResult[] = [];

  for (const [id, att] of attMap.entries()) {
    const pay = payMap.get(id);
    if (!pay || pay.isGlobal) continue;

    const attRate = att.hourlyRate;
    if (!attRate) continue;

    // Find rate from payslip: שכר 100% component
    const comp = pay.components.find(c =>
      c.componentName === 'שכר 100%' || c.componentName.startsWith('שכר 100')
    );
    if (!comp || !comp.qty || !comp.payment) continue;
    const payRate = comp.payment / comp.qty;

    const diff = attRate - payRate;
    let sev: Severity | null = null;
    if (abs(diff) >= 5) sev = 'critical';
    else if (abs(diff) >= 1) sev = 'high';
    else if (abs(diff) >= 0.5) sev = 'medium';

    if (!sev) continue;

    results.push({
      empId: id, empName: att.name, department: att.department,
      branch: att.branch, costType: att.costType,
      severity: sev, financialImpact: abs(diff * att.hours100),
      checkId: 'C1',
      fields: {
        'תעריף נוכחות': Math.round(attRate * 100) / 100,
        'תעריף תלוש': Math.round(payRate * 100) / 100,
        'הפרש ₪': Math.round(diff * 100) / 100,
        'הפרש %': `${Math.round(diff / attRate * 1000) / 10}%`,
      },
    });
  }

  return makeSum('C1', 'תעריף שעתי שונה', 'הפרש בין תעריף הנוכחות לתעריף בתלוש', results);
}

// C2-C4: Hours checks
function checkHoursGeneric(
  checkId: CheckId, label: string, description: string,
  attMap: Map<string, AttendanceRow>,
  payMap: Map<string, PayslipEmployee>,
  getAttHours: (a: AttendanceRow) => number,
  componentNames: string[],
  multiplier: number
): CheckSummary {
  const results: CheckResult[] = [];

  for (const [id, att] of attMap.entries()) {
    const pay = payMap.get(id);
    if (!pay || pay.isGlobal) continue;

    const attH = getAttHours(att);
    const payH = getComponentQty(pay, componentNames) ?? 0;
    const diff = attH - payH;

    if (abs(diff) < 0.1) continue;

    const rate = att.hourlyRate * multiplier;
    const moneyDiff = diff * rate;
    const sev = moneySev(moneyDiff);
    if (!sev) continue;

    results.push({
      empId: id, empName: att.name, department: att.department,
      branch: att.branch,
      severity: sev, financialImpact: abs(moneyDiff),
      checkId,
      fields: {
        'שעות נוכחות': attH,
        'שעות תלוש': payH,
        'הפרש שעות': Math.round(diff * 100) / 100,
        'תעריף': Math.round(rate * 100) / 100,
        'הפרש ₪': Math.round(moneyDiff),
      },
    });
  }

  return makeSum(checkId, label, description, results);
}

export function checkHours100(a: Map<string, AttendanceRow>, p: Map<string, PayslipEmployee>) {
  return checkHoursGeneric('C2', 'הפרש שעות 100%', 'הפרש בין שעות 100% בנוכחות לתלוש', a, p,
    att => att.hours100, ['שכר 100%'], 1);
}

export function checkHours125(a: Map<string, AttendanceRow>, p: Map<string, PayslipEmployee>) {
  return checkHoursGeneric('C3', 'הפרש שעות 125%', 'הפרש בין שעות 125% בנוכחות לתלוש', a, p,
    att => att.hours125, ['ש.נוס 125%', 'הפרשי שכר 125%', 'שעות נוספות 125'], 1.25);
}

export function checkHours150(a: Map<string, AttendanceRow>, p: Map<string, PayslipEmployee>) {
  return checkHoursGeneric('C4', 'הפרש שעות 150%', 'הפרש בין שעות 150% בנוכחות לתלוש', a, p,
    att => att.hours150, ['ש.נוס 150%', 'ש. נוספות ג', 'שעות נוספות', 'הפרשי שכר 150%'], 1.5);
}

export function checkNightHours(a: Map<string, AttendanceRow>, p: Map<string, PayslipEmployee>) {
  const results: CheckResult[] = [];

  for (const [id, att] of a.entries()) {
    const pay = p.get(id);
    if (!pay || pay.isGlobal || att.hoursNight === 0) continue;

    const payH = getComponentQty(pay, ['משמרות']) ?? 0;
    const diff = att.hoursNight - payH;
    if (Math.abs(diff) < 0.1) continue;

    const moneyDiff = diff * att.hourlyRate;
    const sev = moneySev(moneyDiff);
    if (!sev) continue;

    results.push({
      empId: id, empName: att.name, department: att.department, branch: att.branch,
      severity: sev, financialImpact: Math.abs(moneyDiff), checkId: 'C5',
      fields: {
        'שעות לילה נוכחות': att.hoursNight,
        'שעות משמרות תלוש': payH,
        'הפרש': Math.round(diff * 100) / 100,
        'הפרש ₪': Math.round(moneyDiff),
      },
    });
  }

  return makeSum('C5', 'הפרש שעות לילה', 'הפרש בין שעות לילה בנוכחות לרכיב משמרות בתלוש', results);
}

export function checkWorkDays(a: Map<string, AttendanceRow>, p: Map<string, PayslipEmployee>) {
  const results: CheckResult[] = [];

  for (const [id, att] of a.entries()) {
    const pay = p.get(id);
    if (!pay) continue;

    const attDays = att.workDays;
    const payTotalDays = pay.workDays ?? 0;
    const payVac = pay.vacationDays ?? 0;
    const paySick = pay.sickDays ?? 0;
    const attReserve = att.reserveDays;

    const payActual = payTotalDays - payVac - paySick - attReserve;
    const diff = attDays - payActual;

    if (Math.abs(diff) < 0.01) continue;

    let sev: Severity;
    if (Math.abs(diff) > 3) sev = 'critical';
    else if (Math.abs(diff) > 1) sev = 'high';
    else sev = 'medium';

    const dailyRate = att.hourlyRate * 8;
    results.push({
      empId: id, empName: att.name, department: att.department, branch: att.branch,
      severity: sev, financialImpact: Math.abs(diff * dailyRate), checkId: 'C6',
      fields: {
        'ימי עבודה נוכחות': attDays,
        'סה"כ ימים תלוש': payTotalDays,
        'ימי חופשה תלוש': payVac,
        'ימי מחלה תלוש': paySick,
        'מילואים': attReserve,
        'ימי עבודה בפועל תלוש': Math.round(payActual * 100) / 100,
        'הפרש ימים': Math.round(diff * 100) / 100,
      },
    });
  }

  return makeSum('C6', 'הפרש ימי עבודה', 'השוואת ימי עבודה בין מערכת הנוכחות לתלוש', results);
}

export function checkTravel(a: Map<string, AttendanceRow>, p: Map<string, PayslipEmployee>) {
  const results: CheckResult[] = [];

  for (const [id, att] of a.entries()) {
    const pay = p.get(id);
    if (!pay) continue;

    const attTravel = att.travel;
    // נסיעות — לא כולל החזר הוצ רכב
    const payTravel = pay.components
      .filter(c => c.componentName === 'נסיעות')
      .reduce((s, c) => s + (c.payment ?? 0), 0);

    const diff = attTravel - payTravel;
    if (Math.abs(diff) < 1) continue;

    let sev: Severity;
    if (Math.abs(diff) > 200) sev = 'critical';
    else if (Math.abs(diff) > 50) sev = 'high';
    else sev = 'medium';

    results.push({
      empId: id, empName: att.name, department: att.department, branch: att.branch,
      severity: sev, financialImpact: Math.abs(diff), checkId: 'C7',
      fields: {
        'נסיעות נוכחות': attTravel,
        'נסיעות תלוש': payTravel,
        'הפרש ₪': Math.round(diff),
      },
    });
  }

  return makeSum('C7', 'הפרש נסיעות', 'הפרש בין עלות נסיעות בנוכחות לרכיב נסיעות בתלוש', results);
}

export function checkVacation(a: Map<string, AttendanceRow>, p: Map<string, PayslipEmployee>) {
  const results: CheckResult[] = [];

  for (const [id, att] of a.entries()) {
    const pay = p.get(id);
    if (!pay) continue;

    const attVac = att.vacationDays;
    const payVac = pay.vacationDays ?? 0;

    if (attVac === 0 && payVac === 0) continue;

    let status = 'תקין';
    let sev: Severity | null = null;
    let impact = 0;

    if (attVac > 0 && payVac === 0) {
      status = 'תקלה - קיים בנוכחות בלבד'; sev = 'critical';
      impact = attVac * att.hourlyRate * 8;
    } else if (attVac === 0 && payVac > 0) {
      status = 'תקלה - קיים בתלוש בלבד'; sev = 'critical';
      impact = payVac * att.hourlyRate * 8;
    } else if (Math.abs(attVac - payVac) > 0.5) {
      status = 'הפרש ימים'; sev = 'high';
      impact = Math.abs(attVac - payVac) * att.hourlyRate * 8;
    }

    // Check avg hours/vacation day
    const denom = payVac > 0 ? payVac : attVac;
    const vacHoursComp = pay.components.find(c => c.componentName.includes('חופשה'));
    const payVacHours = vacHoursComp?.qty ?? 0;
    const avg = denom > 0 ? payVacHours / denom : 0;

    if (!sev && avg > 0 && (avg < 6 || avg > 10)) {
      status = 'ממוצע שעות חריג'; sev = 'medium';
    }

    if (!sev) continue;

    results.push({
      empId: id, empName: att.name, department: att.department, branch: att.branch,
      severity: sev, financialImpact: impact, checkId: 'C8',
      fields: {
        'ימי חופשה נוכחות': attVac,
        'ימי חופשה תלוש': payVac,
        'שעות חופשה': payVacHours || null,
        'ממוצע שעות ליום': avg > 0 ? Math.round(avg * 10) / 10 : null,
        'סטטוס': status,
      },
    });
  }

  return makeSum('C8', 'ניצול חופשה', 'בדיקת התאמה בין ימי חופשה בנוכחות לתלוש', results);
}

export function checkSick(a: Map<string, AttendanceRow>, p: Map<string, PayslipEmployee>) {
  const results: CheckResult[] = [];

  for (const [id, att] of a.entries()) {
    const pay = p.get(id);
    if (!pay) continue;

    const attSick = att.sickDays;
    const paySick = pay.sickDays ?? 0;

    if (attSick === 0 && paySick === 0) continue;

    let status = 'תקין';
    let sev: Severity | null = null;
    let impact = 0;

    if (attSick > 0 && paySick === 0) {
      status = 'תקלה - קיים בנוכחות בלבד'; sev = 'critical';
      impact = attSick * att.hourlyRate * 8;
    } else if (attSick === 0 && paySick > 0) {
      status = 'תקלה - קיים בתלוש בלבד'; sev = 'critical';
      impact = paySick * att.hourlyRate * 8;
    } else if (Math.abs(attSick - paySick) > 0.5) {
      status = 'הפרש ימים'; sev = 'high';
      impact = Math.abs(attSick - paySick) * att.hourlyRate * 8;
    }

    const sickComp = pay.components.find(c => c.componentName.includes('מחלה'));
    const paySickHours = sickComp?.qty ?? 0;
    const denom = paySick > 0 ? paySick : attSick;
    const avg = denom > 0 ? paySickHours / denom : 0;

    if (!sev && avg > 0 && (avg < 6 || avg > 10)) {
      status = 'ממוצע שעות חריג'; sev = 'medium';
    }

    if (!sev) continue;

    results.push({
      empId: id, empName: att.name, department: att.department, branch: att.branch,
      severity: sev, financialImpact: impact, checkId: 'C9',
      fields: {
        'ימי מחלה נוכחות': attSick,
        'ימי מחלה תלוש': paySick,
        'שעות מחלה': paySickHours || null,
        'ממוצע שעות ליום': avg > 0 ? Math.round(avg * 10) / 10 : null,
        'סטטוס': status,
      },
    });
  }

  return makeSum('C9', 'ניצול מחלה', 'בדיקת התאמה בין ימי מחלה בנוכחות לתלוש', results);
}

export function checkMissingPayslip(a: Map<string, AttendanceRow>, p: Map<string, PayslipEmployee>) {
  const results: CheckResult[] = [];

  for (const [id, att] of a.entries()) {
    if (!p.has(id)) {
      results.push({
        empId: id, empName: att.name, department: att.department,
        branch: att.branch, costType: att.costType,
        severity: 'critical', financialImpact: att.salary || 0, checkId: 'C10',
        fields: {
          'מחלקה': att.department,
          'ת.ז.': att.idNumber,
          'מס עובד פנימי': att.internalId,
          'ימי עבודה': att.workDays,
          'שכר משוקלל': att.salary,
          'הערה': 'קיים בנוכחות, חסר בתלוש',
        },
      });
    }
  }

  return makeSum('C10', 'חסרים בתלוש', 'עובדים הקיימים בנוכחות אך אין להם תלוש שכר', results);
}

export function checkMissingAttendance(a: Map<string, AttendanceRow>, p: Map<string, PayslipEmployee>) {
  const results: CheckResult[] = [];

  for (const [id, emp] of p.entries()) {
    if (!a.has(id)) {
      const totalPay = emp.components.reduce((s, c) => s + (c.payment ?? 0), 0);
      results.push({
        empId: id, empName: emp.name, department: emp.department,
        severity: 'high', financialImpact: totalPay, checkId: 'C11',
        fields: {
          'מחלקה': emp.department,
          'ימי עבודה תלוש': emp.workDays,
          'שעות תלוש': emp.hoursTotal,
          'שכר נטו': emp.netPay,
          'הערה': 'קיים בתלוש, חסר בנוכחות',
        },
      });
    }
  }

  return makeSum('C11', 'חסרים בנוכחות', 'עובדים עם תלוש שכר שאין להם רשומת נוכחות', results);
}

export function checkGlobalEmployees(a: Map<string, AttendanceRow>, p: Map<string, PayslipEmployee>) {
  const results: CheckResult[] = [];

  for (const [id, pay] of p.entries()) {
    if (!pay.isGlobal) continue;
    const att = a.get(id);
    if (!att) continue;

    const issues: string[] = [];
    let financialImpact = 0;
    let sev: Severity = 'high';

    // Hours comparison (only when payslip has hours)
    if (pay.hoursTotal !== null) {
      const hDiff = att.hoursTotal - pay.hoursTotal;
      if (Math.abs(hDiff) >= 0.1) {
        issues.push(`שעות: ${att.hoursTotal} vs ${pay.hoursTotal}`);
        if (Math.abs(hDiff) >= 5) { sev = 'critical'; financialImpact += Math.abs(hDiff) * 50; }
      }
    }

    // Days comparison
    const payActual = (pay.workDays ?? 0) - (pay.vacationDays ?? 0) - (pay.sickDays ?? 0) - att.reserveDays;
    const dayDiff = att.workDays - payActual;
    if (Math.abs(dayDiff) >= 0.01) {
      issues.push(`ימים: ${att.workDays} vs ${Math.round(payActual * 100) / 100}`);
      if (Math.abs(dayDiff) >= 5) sev = 'critical';
    }

    if (issues.length === 0) continue;

    results.push({
      empId: id, empName: att.name, department: att.department, branch: att.branch,
      severity: sev, financialImpact, checkId: 'C12',
      fields: {
        'שעות נוכחות': att.hoursTotal,
        'שעות תלוש': pay.hoursTotal,
        'ימי עבודה נוכחות': att.workDays,
        'ימי עבודה תלוש': Math.round(payActual * 100) / 100,
        'בעיות': issues.join(' | '),
      },
    });
  }

  return makeSum('C12', 'עובדים גלובלים', 'עובדים גלובלים — בדיקת שעות וימי עבודה', results);
}
