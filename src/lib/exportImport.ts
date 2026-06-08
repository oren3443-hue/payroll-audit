import { AuditResult } from './types';
import { PayslipEmployee } from './parsePayslips';
import { getAllStatuses, makeKey } from './statusStore';
import { isHolidayComponent } from './componentCodes';

/**
 * יוצר קובץ לקליטה למיכפל לאיפוס רכיבים אסורים אצל עובדים גלובלים
 * שסומנו "לתיקון" בבדיקת C12.
 *
 * עיקרון: לכל עובד מסומן — מאפס את כל הרכיבים האסורים שיש לו בפועל.
 * המבנה של הקובץ: עמודה לכל רכיב אסור שמופיע אצל לפחות אחד מהמסומנים.
 * ערך התא: 0 (כשיש רכיב לאפס) או ריק (אחרת).
 *
 * רכיבים אסורים לגלובלי (לפי קודי מיכפל):
 *   1=שכר 100%, 7=ש.נוס 125%, 9=אבל, 10=חופש, 14=ש.נוס 150%, 15=מחלה,
 *   29=משמרות, 30=נוספות.משמרות, 137-143=חגים (תחילית "חג:")
 *
 * אם עובד סומן גם ב-C13 → גם נסיעות תאופס.
 *
 * פורמט פלט:
 *   שורה 1: (10, YEAR, MONTH, ...) — מספר חברה, שנה, חודש
 *   שורה 2: כותרות
 *   שורות 3+: 0 לרכיב לאיפוס, ריק אחרת
 */

const FORBIDDEN_NAMES = new Set([
  'שכר 100%',          // 1
  'ש.נוס 125%',        // 7
  'אבל',               // 9
  'חופש',              // 10
  'ש.נוס 150%',        // 14
  'מחלה',              // 15
  'משמרות',            // 29
  'נוספות.משמרות',     // 30
  'הפרשי שכר 100%',    // 119
  'הפרשי שכר 125%',    // 120
  'הפרשי שכר 150%',    // 121
  'משמרות.ג',          // 117
  'מחלה ג',            // 132
  'פדיון חופש',        // 31
]);

function isForbiddenComponent(name: string): boolean {
  if (FORBIDDEN_NAMES.has(name)) return true;
  if (isHolidayComponent(name)) return true;
  return false;
}

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
    alert('לא סומנו עובדים גלובלים לתיקון. עבור לבדיקת "עובדים גלובלים", סמן עובדים בסטטוס "לתיקון" (אפשר גם בכפתור "סמן הכל לתיקון"), ונסה שוב.');
    return;
  }

  // עובדים שסומנו "לתיקון" ב-C13 — לאיפוס נסיעות
  const c13 = result.checks.find(c => c.checkId === 'C13');
  const zeroTravelIds = new Set<string>();
  if (c13) {
    for (const r of c13.results) {
      if (statuses[makeKey('C13', r.empId)]?.status === 'fix') {
        zeroTravelIds.add(r.empId);
      }
    }
  }

  // שלב 1: לכל עובד מסומן, אסוף את הרכיבים האסורים שלו
  type Row = { empId: string; empName: string; toZero: Set<string> };
  const rows: Row[] = [];
  const skipped: string[] = [];
  const allForbiddenNames = new Set<string>();

  for (const empId of fixIds) {
    const pay = payslips.get(empId);
    if (!pay) {
      skipped.push(`${empId} — לא נמצא בתלושים`);
      continue;
    }

    const toZero = new Set<string>();
    for (const c of pay.components) {
      if (isForbiddenComponent(c.componentName)) {
        toZero.add(c.componentName);
      }
    }
    // הוסף נסיעות אם סומן ב-C13
    if (zeroTravelIds.has(empId)) {
      const hasTravel = pay.components.some(c => c.componentName === 'נסיעות');
      if (hasTravel) toZero.add('נסיעות');
    }

    if (toZero.size === 0) {
      skipped.push(`${empId} ${pay.name} — אין רכיבים אסורים לאיפוס`);
      continue;
    }

    for (const n of toZero) allForbiddenNames.add(n);
    rows.push({ empId, empName: pay.name, toZero });
  }

  if (rows.length === 0) {
    const detail = skipped.length > 0 ? `\n\nפרטים:\n${skipped.slice(0, 15).join('\n')}` : '';
    alert(`לא נמצאו רכיבים לאיפוס.${detail}`);
    return;
  }

  // שלב 2: סדר עמודות לפי סדר חשיבות מועיל
  const COL_ORDER = [
    'שכר 100%', 'הפרשי שכר 100%',
    'ש.נוס 125%', 'הפרשי שכר 125%',
    'ש.נוס 150%', 'הפרשי שכר 150%',
    'משמרות', 'נוספות.משמרות', 'משמרות.ג',
    'חופש', 'פדיון חופש',
    'מחלה', 'מחלה ג',
    'אבל',
    'נסיעות',
  ];
  const presentCols = COL_ORDER.filter(c => allForbiddenNames.has(c));
  // הוסף בסוף את כל החגים שמופיעים (מסודרים לפי שם)
  const holidayCols = [...allForbiddenNames]
    .filter(isHolidayComponent)
    .sort((a, b) => a.localeCompare(b, 'he'));
  // ועוד שאר רכיבים שלא נכללו (תיאורטית לא יקרה)
  const knownSet = new Set([...presentCols, ...holidayCols]);
  const otherCols = [...allForbiddenNames].filter(n => !knownSet.has(n));

  const columns = [...presentCols, ...holidayCols, ...otherCols];

  // שלב 3: בנה את הקובץ
  const headers = ['מספר עובד', 'שם העובד', ...columns];
  const metaRow: unknown[] = [10, year, month, ...new Array(headers.length - 3).fill(null)];

  const aoa: unknown[][] = [metaRow, headers];
  for (const r of rows) {
    aoa.push([
      r.empId,
      r.empName,
      ...columns.map(c => r.toZero.has(c) ? 0 : null),
    ]);
  }

  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws['!cols'] = [
    { wch: 12 }, { wch: 28 },
    ...columns.map(c => ({ wch: Math.max(c.length + 2, 12) })),
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
