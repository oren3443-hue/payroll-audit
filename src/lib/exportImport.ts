import { AuditResult } from './types';
import { PayslipEmployee } from './parsePayslips';
import { getAllStatuses, makeKey } from './statusStore';

/**
 * יוצר קובץ לקליטה למיכפל לאיפוס רכיבים אסורים אצל עובדים גלובלים
 * שסומנו בסטטוס "לתיקון" בבדיקה C12.
 *
 * רכיבים אסורים לגלובלי (לפי קודי מיכפל):
 *   1=שכר 100%, 7=ש.נוס 125%, 9=אבל, 10=חופש, 14=ש.נוס 150%, 15=מחלה,
 *   29=משמרות, 30=נוספות.משמרות, 137-143=חגים (תחילית "חג:")
 * וגם: 119/120/121=הפרשי שכר X% (אם קיימים)
 *
 * אם עובד סומן גם ב-C13 (שווי רכב + נסיעות) → יאפס גם נסיעות.
 *
 * פורמט הקובץ:
 *   שורה 1: (10, YEAR, MONTH, ...) — מספר חברה, שנה, חודש
 *   שורה 2: כותרות
 *   שורות 3+: '0-' לכל רכיב שיש לאפס
 */

interface ColSpec {
  header: string;
  matches: (compName: string) => boolean;
}

const COLUMNS: ColSpec[] = [
  { header: 'רכיב 100',        matches: n => n === 'שכר 100%' || n === 'הפרשי שכר 100%' },
  { header: 'רכיב 125',        matches: n => n === 'ש.נוס 125%' || n === 'הפרשי שכר 125%' },
  { header: 'רכיב 150',        matches: n => n === 'ש.נוס 150%' || n === 'הפרשי שכר 150%' },
  { header: 'רכיב משמרות',     matches: n => n === 'משמרות' || n === 'נוספות.משמרות' || n === 'משמרות.ג' },
  { header: 'רכיב חופש',       matches: n => n === 'חופש' || n === 'פדיון חופש' },
  { header: 'רכיב מחלה',       matches: n => n === 'מחלה' || n === 'מחלה ג' },
  { header: 'רכיב אבל',        matches: n => n === 'אבל' },
  { header: 'רכיב חג',         matches: n => n.startsWith('חג:') || n.startsWith('חג ') || n === 'עבודה חג' },
  { header: 'נסיעות',          matches: n => n === 'נסיעות' },
];

export async function exportImportFile(
  result: AuditResult,
  payslips: Map<string, PayslipEmployee>,
  year: number,
  month: number
): Promise<void> {
  const XLSX = await import('xlsx');
  const statuses = getAllStatuses();

  // עובדים שסומנו "לתיקון" ב-C12
  const c12 = result.checks.find(c => c.checkId === 'C12');
  if (!c12) {
    alert('לא נמצאה בדיקת עובדים גלובלים (C12)');
    return;
  }
  const fixIds = new Set(
    c12.results.filter(r => statuses[makeKey('C12', r.empId)]?.status === 'fix').map(r => r.empId)
  );
  if (fixIds.size === 0) {
    alert('לא סומנו עובדים גלובלים לתיקון. סמן עובדים בסטטוס "לתיקון" בבדיקת עובדים גלובלים, ונסה שוב.');
    return;
  }

  // עובדים שסומנו "לתיקון" ב-C13 (שווי רכב + נסיעות) — לאיפוס נסיעות
  const c13 = result.checks.find(c => c.checkId === 'C13');
  const zeroTravelIds = new Set<string>();
  if (c13) {
    for (const r of c13.results) {
      if (statuses[makeKey('C13', r.empId)]?.status === 'fix') {
        zeroTravelIds.add(r.empId);
      }
    }
  }

  // לכל עובד מסומן — בנה שורה לקובץ
  const importRows: unknown[][] = [];
  const skipped: string[] = [];

  for (const empId of fixIds) {
    const pay = payslips.get(empId);
    if (!pay) {
      skipped.push(`${empId} — לא נמצא בתלושים`);
      continue;
    }

    const compNames = pay.components.map(c => c.componentName);
    const cellsByCol = COLUMNS.map(col => compNames.some(col.matches) ? '0-' : null);

    // דריסה לעמודת נסיעות אם סומן ב-C13
    const travelColIdx = COLUMNS.findIndex(c => c.header === 'נסיעות');
    if (zeroTravelIds.has(empId) && travelColIdx !== -1) {
      cellsByCol[travelColIdx] = '0-';
    }

    if (cellsByCol.every(v => v === null)) {
      skipped.push(`${empId} ${pay.name} — אין רכיבים אסורים לאיפוס`);
      continue;
    }

    importRows.push([empId, pay.name, ...cellsByCol]);
  }

  if (importRows.length === 0) {
    const msg = skipped.length > 0
      ? `לא נמצאו רכיבים לאיפוס. פרטים:\n${skipped.slice(0, 10).join('\n')}`
      : 'לא נמצאו רכיבים לאיפוס.';
    alert(msg);
    return;
  }

  const headers = ['מספר עובד', 'שם העובד', ...COLUMNS.map(c => c.header)];
  const metaRow: unknown[] = [10, year, month, ...new Array(headers.length - 3).fill(null)];

  const aoa: unknown[][] = [metaRow, headers, ...importRows];

  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws['!cols'] = [
    { wch: 12 }, { wch: 28 },
    ...COLUMNS.map(() => ({ wch: 14 })),
  ];
  ws['!sheetView'] = [{ rightToLeft: true } as never];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'גיליון1');

  const monthStr = String(month).padStart(2, '0');
  XLSX.writeFile(wb, `קובץ לקליטה - איפוס גלובלים - ${monthStr}-${year}.xlsx`);

  if (skipped.length > 0) {
    console.warn('דולגו עובדים:', skipped);
  }
}
