import { AuditResult, CheckSummary, Severity } from './types';

const SEV_COLOR: Record<Severity, string> = {
  critical: 'FFFFC7CE',  // red background
  high: 'FFFFEB9C',      // orange/yellow background
  medium: 'FFFFFF00',    // yellow
  low: 'FFC6EFCE',       // green
};

const SEV_FONT: Record<Severity, string> = {
  critical: 'FF9C0006',
  high: 'FF9C5700',
  medium: 'FF7D6608',
  low: 'FF276221',
};

function makeCell(value: unknown, severity?: Severity, bold = false) {
  const cell: Record<string, unknown> = { v: value ?? '', t: typeof value === 'number' ? 'n' : 's' };
  if (severity || bold) {
    cell.s = {
      font: {
        bold,
        color: severity ? { rgb: SEV_FONT[severity] } : undefined,
      },
      fill: severity ? { fgColor: { rgb: SEV_COLOR[severity] } } : undefined,
    };
  }
  return cell;
}

export async function exportToExcel(result: AuditResult): Promise<void> {
  const XLSX = await import('xlsx');

  const wb = XLSX.utils.book_new();

  const checkOrder = ['Q1', 'Q2', 'Q3', 'Q4', 'Q5', 'C1', 'C2', 'C3', 'C4', 'C5', 'C6', 'C7', 'C8', 'C9', 'C10', 'C11', 'C12', 'C13', 'P1', 'P2', 'P3', 'P4'];
  const sortedChecks = [...result.checks].sort((a, b) =>
    (checkOrder.indexOf(a.checkId) ?? 99) - (checkOrder.indexOf(b.checkId) ?? 99)
  );

  for (const check of sortedChecks) {
    if (check.results.length === 0) continue;

    // Build header row
    const fieldKeys = [...new Set(check.results.slice(0, 10).flatMap(r => Object.keys(r.fields)))];
    const headers = ['מספר עובד', 'שם עובד', 'מחלקה', 'חומרה', ...fieldKeys, 'השפעה כספית'];

    const aoa: unknown[][] = [headers];

    for (const r of check.results) {
      const row: unknown[] = [
        r.empId,
        r.empName,
        r.department || '',
        { critical: 'קריטי', high: 'גבוהה', medium: 'בינונית', low: 'נמוכה' }[r.severity],
        ...fieldKeys.map(k => r.fields[k] ?? ''),
        r.financialImpact > 0 ? Math.round(r.financialImpact) : '',
      ];
      aoa.push(row);
    }

    const ws = XLSX.utils.aoa_to_sheet(aoa);

    // Apply colors (basic - xlsx community edition has limited styling)
    const range = XLSX.utils.decode_range(ws['!ref'] ?? 'A1');
    for (let row = 1; row <= range.e.r; row++) {
      const sev = check.results[row - 1]?.severity;
      if (!sev) continue;
      for (let col = range.s.c; col <= range.e.c; col++) {
        const addr = XLSX.utils.encode_cell({ r: row, c: col });
        if (ws[addr]) {
          ws[addr].s = {
            fill: { fgColor: { rgb: SEV_COLOR[sev] }, patternType: 'solid' },
            font: { color: { rgb: SEV_FONT[sev] } },
          };
        }
      }
    }

    // Column widths
    ws['!cols'] = headers.map((h, i) => ({
      wch: i < 2 ? 20 : i < 4 ? 14 : Math.max(String(h).length + 2, 12),
    }));

    // Freeze first row
    ws['!freeze'] = { xSplit: 0, ySplit: 1 };

    const sheetName = check.label.slice(0, 31);
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
  }

  // Summary sheet
  const summaryRows: unknown[][] = [
    ['בדיקה', 'מספר ממצאים', 'קריטי', 'גבוהה', 'בינונית', 'נמוכה', 'השפעה כספית'],
  ];
  for (const c of sortedChecks) {
    summaryRows.push([
      c.label,
      c.results.length,
      c.criticalCount,
      c.highCount,
      c.mediumCount,
      c.lowCount,
      c.totalFinancial > 0 ? Math.round(c.totalFinancial) : '',
    ]);
  }
  summaryRows.push([]);
  summaryRows.push(['סה"כ ממצאים', result.totalIssues]);
  summaryRows.push(['סה"כ השפעה כספית', Math.round(result.totalFinancial)]);

  const wsSummary = XLSX.utils.aoa_to_sheet(summaryRows);
  wsSummary['!cols'] = [{ wch: 30 }, { wch: 16 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 16 }];
  XLSX.utils.book_append_sheet(wb, wsSummary, 'סיכום');

  const today = new Date().toLocaleDateString('he-IL').replace(/\//g, '-');
  XLSX.writeFile(wb, `דוח בקרת שכר - ${today}.xlsx`);
}
