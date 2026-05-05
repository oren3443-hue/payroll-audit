import { AttendanceRow, AuditResult, CheckSummary, UtilizationRow } from './types';
import { PayslipEmployee } from './parsePayslips';
import {
  checkDuplicateComponents, checkEmptyComponents, checkPhantomEmployees,
  checkDailyTravel, checkDailySalary
} from './checks/dataQuality';
import {
  checkHourlyRate, checkHours100, checkHours125, checkHours150,
  checkNightHours, checkWorkDays, checkTravel, checkVacation, checkSick,
  checkMissingPayslip, checkMissingAttendance, checkGlobalEmployees,
  checkVehicleAndTravel, checkLowBalances
} from './checks/businessChecks';
import {
  checkRateChange, checkDisappearedComponents, checkNewComponents, checkHoursDramaticChange
} from './checks/prevMonthChecks';

export function runAudit(
  attEmployees: AttendanceRow[],
  payEmployees: Map<string, PayslipEmployee>,
  prevPayEmployees?: Map<string, PayslipEmployee>,
  utilization?: Map<string, UtilizationRow>,
  onProgress?: (done: number, total: number, label: string) => void
): AuditResult {
  const attMap = new Map<string, AttendanceRow>();
  for (const e of attEmployees) attMap.set(e.empId, e);

  const allChecks: Array<() => CheckSummary> = [
    () => checkEmptyComponents(payEmployees),
    () => checkDuplicateComponents(payEmployees),
    () => checkPhantomEmployees(attMap, payEmployees),
    () => checkDailyTravel(attMap),
    () => checkDailySalary(attMap),
    () => checkHourlyRate(attMap, payEmployees),
    () => checkHours100(attMap, payEmployees),
    () => checkHours125(attMap, payEmployees),
    () => checkHours150(attMap, payEmployees),
    () => checkNightHours(attMap, payEmployees),
    () => checkWorkDays(attMap, payEmployees),
    () => checkTravel(attMap, payEmployees),
    () => checkVacation(attMap, payEmployees),
    () => checkSick(attMap, payEmployees),
    () => checkMissingPayslip(attMap, payEmployees),
    () => checkMissingAttendance(attMap, payEmployees),
    () => checkGlobalEmployees(attMap, payEmployees),
    () => checkVehicleAndTravel(attMap, payEmployees),
  ];

  if (utilization && utilization.size > 0) {
    allChecks.push(() => checkLowBalances(attMap, payEmployees, utilization));
  }

  if (prevPayEmployees) {
    allChecks.push(
      () => checkRateChange(payEmployees, prevPayEmployees),
      () => checkDisappearedComponents(payEmployees, prevPayEmployees),
      () => checkNewComponents(payEmployees, prevPayEmployees),
      () => checkHoursDramaticChange(payEmployees, prevPayEmployees),
    );
  }

  const checks: CheckSummary[] = [];
  for (let i = 0; i < allChecks.length; i++) {
    const result = allChecks[i]();
    checks.push(result);
    onProgress?.(i + 1, allChecks.length, result.label);
  }

  const totalFinancial = checks.reduce((s, c) => s + c.totalFinancial, 0);
  const totalIssues = checks.reduce((s, c) => s + c.results.length, 0);

  // Financial split: positive diff = company over-paid employee, negative = under-paid
  let financialForEmployee = 0;
  let financialForCompany = 0;
  for (const c of checks) {
    for (const r of c.results) {
      // Missing payslip: company didn't pay (employee loses)
      if (c.checkId === 'C10') financialForEmployee += r.financialImpact;
      // Missing attendance: company paid without record
      else if (c.checkId === 'C11') financialForCompany += r.financialImpact;
      // Hours/rate diffs: split 50/50 as we don't know direction without more context
      else financialForEmployee += r.financialImpact / 2;
    }
  }

  // Build employee map
  const employeeMap = new Map<string, { att?: AttendanceRow; pay?: PayslipEmployee }>();
  for (const [id, att] of attMap) {
    employeeMap.set(id, { att, pay: payEmployees.get(id) });
  }
  for (const [id, pay] of payEmployees) {
    if (!employeeMap.has(id)) employeeMap.set(id, { pay });
  }

  return {
    checks,
    employeeMap,
    totalIssues,
    totalFinancial,
    financialForEmployee,
    financialForCompany,
    month: new Date().toLocaleDateString('he-IL', { month: 'long', year: 'numeric' }),
  };
}
