import { CheckResult, CheckSummary, AttendanceRow, Severity } from '../types';
import { PayslipEmployee } from '../types';

function sev(v: number, t1: number, t2: number): Severity {
  if (Math.abs(v) > t2) return 'critical';
  if (Math.abs(v) > t1) return 'high';
  return 'medium';
}

export function checkDuplicateComponents(
  payMap: Map<string, PayslipEmployee>
): CheckSummary {
  const results: CheckResult[] = [];

  for (const emp of payMap.values()) {
    // קיבוץ לפי שם רכיב (componentCode זו קטגוריה: ב/נ/פ/ק — לא מזהה ייחודי)
    const seen = new Map<string, { count: number; totalPayment: number; code: string }>();
    for (const c of emp.components) {
      const key = c.componentName;
      if (!key) continue;
      const cur = seen.get(key) ?? { count: 0, totalPayment: 0, code: c.componentCode };
      cur.count += 1;
      cur.totalPayment += Math.abs(c.payment ?? 0);
      seen.set(key, cur);
    }
    for (const [name, info] of seen.entries()) {
      if (info.count > 1) {
        results.push({
          empId: emp.empId,
          empName: emp.name,
          department: emp.department,
          severity: 'critical',
          financialImpact: info.totalPayment,
          checkId: 'Q2',
          fields: {
            'רכיב': name,
            'קוד קטגוריה': info.code,
            'מספר הופעות': info.count,
            'סכום מצטבר': Math.round(info.totalPayment * 100) / 100,
          },
        });
      }
    }
  }

  return makeSum('Q2', 'רכיבים כפולים', 'אותו רכיב מופיע יותר מפעם אחת לאותו עובד', 'quality', results);
}

export function checkEmptyComponents(
  payMap: Map<string, PayslipEmployee>
): CheckSummary {
  const results: CheckResult[] = [];

  for (const emp of payMap.values()) {
    for (const c of emp.components) {
      const hasQty = c.qty !== null && c.qty !== 0;
      const hasPrice = c.price !== null && c.price !== 0;
      const hasPayment = c.payment !== null && c.payment !== 0;

      if ((hasQty && !hasPrice && !hasPayment) || (!hasQty && hasPrice)) {
        results.push({
          empId: emp.empId,
          empName: emp.name,
          department: emp.department,
          severity: 'high',
          financialImpact: 0,
          checkId: 'Q1',
          fields: {
            'רכיב': c.componentName,
            'כמות': c.qty,
            'מחיר': c.price,
            'תשלום': c.payment,
          },
        });
      }
    }
  }

  return makeSum('Q1', 'רכיבים ריקים', 'רכיב עם כמות ללא מחיר, או מחיר ללא כמות', 'quality', results);
}

export function checkPhantomEmployees(
  attMap: Map<string, AttendanceRow>,
  payMap: Map<string, PayslipEmployee>
): CheckSummary {
  const results: CheckResult[] = [];

  for (const [id, att] of attMap.entries()) {
    if (att.workDays === 0 && att.hoursTotal === 0) {
      const pay = payMap.get(id);
      if (pay) {
        const totalPayment = pay.components.reduce((s, c) => s + (c.payment ?? 0), 0);
        if (totalPayment > 0) {
          results.push({
            empId: id,
            empName: att.name,
            department: att.department,
            branch: att.branch,
            severity: 'critical',
            financialImpact: totalPayment,
            checkId: 'Q3',
            fields: {
              'ימי עבודה בנוכחות': att.workDays,
              'שעות בנוכחות': att.hoursTotal,
              'סה"כ תשלום בתלוש': totalPayment,
            },
          });
        }
      }
    }
  }

  return makeSum('Q3', 'עובד רפאים', 'אפס ימי עבודה בנוכחות אבל קיים תשלום בתלוש', 'quality', results);
}

export function checkDailyTravel(
  attMap: Map<string, AttendanceRow>
): CheckSummary {
  const results: CheckResult[] = [];
  const MIN = 4, MAX = 16;

  for (const att of attMap.values()) {
    if (att.travel === 0 || att.workDays === 0) continue;
    const daily = att.travel / att.workDays;
    if (daily < MIN || daily > MAX) {
      const severity: Severity = daily < 2 || daily > 30 ? 'high' : 'medium';
      results.push({
        empId: att.empId,
        empName: att.name,
        department: att.department,
        branch: att.branch,
        severity,
        financialImpact: 0,
        checkId: 'Q4',
        fields: {
          'נסיעות כולל': att.travel,
          'ימי עבודה': att.workDays,
          'נסיעות ליום': Math.round(daily * 100) / 100,
          'טווח ציפייה': `${MIN}–${MAX} ₪/יום`,
        },
      });
    }
  }

  return makeSum('Q4', 'נסיעות יומי חריג', `נסיעות ÷ ימי עבודה מחוץ לטווח ${MIN}-${MAX} ₪/יום`, 'quality', results);
}

export function checkDailySalary(
  attMap: Map<string, AttendanceRow>
): CheckSummary {
  const results: CheckResult[] = [];

  // Group by department
  const deptSalaries = new Map<string, number[]>();
  for (const att of attMap.values()) {
    if (att.workDays > 0 && att.salary > 0) {
      const daily = att.salary / att.workDays;
      if (!deptSalaries.has(att.department)) deptSalaries.set(att.department, []);
      deptSalaries.get(att.department)!.push(daily);
    }
  }

  // Compute dept avg + stddev
  const deptStats = new Map<string, { avg: number; std: number }>();
  for (const [dept, vals] of deptSalaries.entries()) {
    if (vals.length < 2) continue;
    const avg = vals.reduce((a, b) => a + b) / vals.length;
    const std = Math.sqrt(vals.map(v => (v - avg) ** 2).reduce((a, b) => a + b) / vals.length);
    deptStats.set(dept, { avg, std });
  }

  for (const att of attMap.values()) {
    if (att.workDays === 0 || att.salary === 0) continue;
    const stats = deptStats.get(att.department);
    if (!stats || stats.std < 1) continue;
    const daily = att.salary / att.workDays;
    const zscore = Math.abs(daily - stats.avg) / stats.std;
    if (zscore > 2) {
      results.push({
        empId: att.empId,
        empName: att.name,
        department: att.department,
        branch: att.branch,
        severity: zscore > 3 ? 'high' : 'medium',
        financialImpact: 0,
        checkId: 'Q5',
        fields: {
          'שכר ברוטו': att.salary,
          'ימי עבודה': att.workDays,
          'שכר ליום': Math.round(daily),
          'ממוצע מחלקה': Math.round(stats.avg),
          'סטיות תקן': Math.round(zscore * 10) / 10,
        },
      });
    }
  }

  return makeSum('Q5', 'שכר יומי חריג', 'שכר ÷ ימי עבודה חריג ב-2 סטיות תקן מממוצע המחלקה', 'quality', results);
}

function makeSum(
  checkId: CheckSummary['checkId'],
  label: string,
  description: string,
  category: CheckSummary['category'],
  results: CheckResult[]
): CheckSummary {
  return {
    checkId,
    label,
    description,
    category,
    results,
    totalFinancial: results.reduce((s, r) => s + r.financialImpact, 0),
    criticalCount: results.filter(r => r.severity === 'critical').length,
    highCount: results.filter(r => r.severity === 'high').length,
    mediumCount: results.filter(r => r.severity === 'medium').length,
    lowCount: results.filter(r => r.severity === 'low').length,
  };
}
