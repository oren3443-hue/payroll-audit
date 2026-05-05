import { CheckResult, CheckSummary, Severity } from '../types';
import { PayslipEmployee } from '../parsePayslips';

function makeSum(checkId: CheckSummary['checkId'], label: string, description: string, results: CheckResult[]): CheckSummary {
  return {
    checkId, label, description, category: 'prev', results,
    totalFinancial: results.reduce((s, r) => s + r.financialImpact, 0),
    criticalCount: results.filter(r => r.severity === 'critical').length,
    highCount: results.filter(r => r.severity === 'high').length,
    mediumCount: results.filter(r => r.severity === 'medium').length,
    lowCount: results.filter(r => r.severity === 'low').length,
  };
}

function getRate(emp: PayslipEmployee): number | null {
  const comp = emp.components.find(c =>
    c.componentName === 'שכר 100%' || c.componentName.startsWith('שכר 100') || c.componentName === 'משכורת'
  );
  if (!comp || !comp.qty || !comp.payment || comp.qty === 0) return null;
  return comp.payment / comp.qty;
}

export function checkRateChange(
  currMap: Map<string, PayslipEmployee>,
  prevMap: Map<string, PayslipEmployee>
): CheckSummary {
  const results: CheckResult[] = [];

  for (const [id, curr] of currMap.entries()) {
    const prev = prevMap.get(id);
    if (!prev) continue;

    const currRate = getRate(curr);
    const prevRate = getRate(prev);
    if (!currRate || !prevRate || prevRate === 0) continue;

    const changePct = Math.abs((currRate - prevRate) / prevRate) * 100;
    if (changePct < 10) continue;

    const sev: Severity = changePct > 25 ? 'critical' : 'high';

    results.push({
      empId: id, empName: curr.name, department: curr.department,
      severity: sev, financialImpact: 0, checkId: 'P1',
      fields: {
        'תעריף חודש זה': Math.round(currRate * 100) / 100,
        'תעריף חודש קודם': Math.round(prevRate * 100) / 100,
        'שינוי %': `${Math.round(changePct * 10) / 10}%`,
        'כיוון': currRate > prevRate ? 'עלייה ▲' : 'ירידה ▼',
      },
    });
  }

  return makeSum('P1', 'שינוי תעריף', 'שינוי > 10% בתעריף השעתי ביחס לחודש קודם', results);
}

export function checkDisappearedComponents(
  currMap: Map<string, PayslipEmployee>,
  prevMap: Map<string, PayslipEmployee>
): CheckSummary {
  const results: CheckResult[] = [];

  for (const [id, prev] of prevMap.entries()) {
    const curr = currMap.get(id);
    if (!curr) continue; // new/leaving handled elsewhere

    const prevNames = new Set(prev.components.map(c => c.componentName));
    const currNames = new Set(curr.components.map(c => c.componentName));

    const disappeared = [...prevNames].filter(n =>
      !currNames.has(n) && !['שכר 100%', 'הפרשי שכר 125%', 'הפרשי שכר 150%'].includes(n)
    );

    if (disappeared.length === 0) continue;

    results.push({
      empId: id, empName: curr.name, department: curr.department,
      severity: 'medium', financialImpact: 0, checkId: 'P2',
      fields: { 'רכיבים שנעלמו': disappeared.join(', ') },
    });
  }

  return makeSum('P2', 'רכיב שנעלם', 'רכיב שהיה בחודש קודם ואינו בחודש הנוכחי', results);
}

export function checkNewComponents(
  currMap: Map<string, PayslipEmployee>,
  prevMap: Map<string, PayslipEmployee>
): CheckSummary {
  const results: CheckResult[] = [];

  for (const [id, curr] of currMap.entries()) {
    const prev = prevMap.get(id);
    if (!prev) continue; // new employee

    const prevNames = new Set(prev.components.map(c => c.componentName));
    const currNames = curr.components.map(c => c.componentName);

    const newComps = currNames.filter(n => !prevNames.has(n));
    if (newComps.length === 0) continue;

    const totalNew = curr.components
      .filter(c => newComps.includes(c.componentName))
      .reduce((s, c) => s + (c.payment ?? 0), 0);

    results.push({
      empId: id, empName: curr.name, department: curr.department,
      severity: 'medium', financialImpact: totalNew, checkId: 'P3',
      fields: {
        'רכיבים חדשים': newComps.join(', '),
        'סכום': Math.round(totalNew),
      },
    });
  }

  return makeSum('P3', 'רכיב חדש', 'רכיב שמופיע לראשונה בחודש הנוכחי', results);
}

export function checkHoursDramaticChange(
  currMap: Map<string, PayslipEmployee>,
  prevMap: Map<string, PayslipEmployee>
): CheckSummary {
  const results: CheckResult[] = [];

  for (const [id, curr] of currMap.entries()) {
    const prev = prevMap.get(id);
    if (!prev) continue;

    const currH = curr.hoursTotal;
    const prevH = prev.hoursTotal;
    if (currH === null || prevH === null || prevH === 0) continue;

    const diff = Math.abs(currH - prevH);
    if (diff < 40) continue;

    const sev: Severity = diff > 80 ? 'critical' : 'high';

    results.push({
      empId: id, empName: curr.name, department: curr.department,
      severity: sev, financialImpact: 0, checkId: 'P4',
      fields: {
        'שעות חודש זה': currH,
        'שעות חודש קודם': prevH,
        'הפרש': Math.round(diff * 10) / 10,
      },
    });
  }

  return makeSum('P4', 'שינוי דרמטי בשעות', 'הפרש > 40 שעות ביחס לחודש קודם', results);
}
