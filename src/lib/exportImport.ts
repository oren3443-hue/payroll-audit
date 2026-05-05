import { AuditResult } from './types';
import { getAllStatuses, makeKey } from './statusStore';

/**
 * יוצר קובץ לקליטה למיכפל לאיפוס רכיבים שעתיים אצל עובדים גלובלים
 * שסומנו בסטטוס "לתיקון". פורמט הקובץ:
 *   שורה 1: (10, YEAR, MONTH, ...)
 *   שורה 2: כותרות
 *   שורות 3+: נתונים — '0-' לכל רכיב שיש לאפס
 *
 * רק עובדים שסומנו "לתיקון" (status === 'fix') בבדיקה C12 ייכללו.
 */
export async function exportImportFile(
  result: AuditResult,
  year: number,
  month: number
): Promise<void> {
  const XLSX = await import('xlsx');

  const statuses = getAllStatuses();

  // בדיקת C12 — עובדים גלובלים
  const c12 = result.checks.find(c => c.checkId === 'C12');
  if (!c12) {
    alert('לא נמצאה בדיקת עובדים גלובלים');
    return;
  }

  // איסוף עובדים שסומנו "לתיקון" בבדיקה C12
  const toFix = c12.results.filter(r => {
    const s = statuses[makeKey('C12', r.empId)];
    return s?.status === 'fix';
  });

  if (toFix.length === 0) {
    alert('לא סומנו עובדים גלובלים לתיקון. סמן עובדים בסטטוס "לתיקון" בבדיקת עובדים גלובלים, ונסה שוב.');
    return;
  }

  // איסוף עובדים מבדיקת C13 (שווי רכב + נסיעות) שסומנו לתיקון — לאיפוס נסיעות
  const c13 = result.checks.find(c => c.checkId === 'C13');
  const toZeroTravel = new Set<string>();
  if (c13) {
    for (const r of c13.results) {
      const s = statuses[makeKey('C13', r.empId)];
      if (s?.status === 'fix') toZeroTravel.add(r.empId);
    }
  }

  // המרת רשימת רכיבים אסורים → אילו עמודות לאפס
  const importRows: unknown[][] = [];
  for (const r of toFix) {
    const forbiddenStr = String(r.fields['רכיבים שעתיים אסורים'] ?? '');
    const has100   = forbiddenStr.includes('שכר 100%');
    const has125   = /125%/.test(forbiddenStr);
    const has150   = /150%/.test(forbiddenStr);
    const hasNight = forbiddenStr.includes('משמרות');
    const zeroTravel = toZeroTravel.has(r.empId);

    if (!has100 && !has125 && !has150 && !hasNight && !zeroTravel) continue;

    importRows.push([
      r.empId,
      r.empName,
      has100 ? '0-' : null,
      has125 ? '0-' : null,
      has150 ? '0-' : null,
      hasNight ? '0-' : null,
      zeroTravel ? '0-' : null,
    ]);
  }

  if (importRows.length === 0) {
    alert('לא נמצאו רכיבים שיש לאפס לעובדים שסומנו לתיקון.');
    return;
  }

  const aoa: unknown[][] = [
    [10, year, month, null, null, null, null],
    ['מספר עובד', 'שם העובד', 'רכיב 100', 'רכיב 125', 'רכיב 150', 'רכיב לילה', 'נסיעות'],
    ...importRows,
  ];

  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws['!cols'] = [{ wch: 12 }, { wch: 28 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 }];
  ws['!sheetView'] = [{ rightToLeft: true } as never];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'גיליון1');

  const monthStr = String(month).padStart(2, '0');
  XLSX.writeFile(wb, `קובץ לקליטה - איפוס גלובלים - ${monthStr}-${year}.xlsx`);
}
