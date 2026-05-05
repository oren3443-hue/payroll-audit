import { CheckSummary, Severity } from './types';

const SEVERITY_WEIGHT: Record<Severity, number> = {
  critical: 4,
  high: 3,
  medium: 1,
  low: 0.5,
};

export interface EmployeeScore {
  empId: string;
  empName: string;
  department: string;
  branch?: string;
  score: number;
  issueCount: number;
  financialImpact: number;
  sevCounts: Record<Severity, number>;
  checkIds: string[];
}

export function computeEmployeeScores(checks: CheckSummary[]): Map<string, EmployeeScore> {
  const map = new Map<string, EmployeeScore>();

  for (const check of checks) {
    for (const result of check.results) {
      if (!map.has(result.empId)) {
        map.set(result.empId, {
          empId: result.empId,
          empName: result.empName,
          department: result.department,
          branch: result.branch,
          score: 0,
          issueCount: 0,
          financialImpact: 0,
          sevCounts: { critical: 0, high: 0, medium: 0, low: 0 },
          checkIds: [],
        });
      }
      const e = map.get(result.empId)!;
      e.score += SEVERITY_WEIGHT[result.severity] * (1 + result.financialImpact / 1000);
      e.issueCount += 1;
      e.financialImpact += result.financialImpact;
      e.sevCounts[result.severity] += 1;
      if (!e.checkIds.includes(check.checkId)) e.checkIds.push(check.checkId);
    }
  }

  // Normalize to 1-10
  const maxScore = Math.max(...[...map.values()].map(e => e.score), 1);
  for (const e of map.values()) {
    e.score = Math.max(1, Math.round((e.score / maxScore) * 10));
  }

  return map;
}
