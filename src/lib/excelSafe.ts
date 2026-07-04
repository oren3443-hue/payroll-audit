// Neutralize spreadsheet formula ("CSV") injection. A cell value whose first
// character can start a formula (= + - @) or a leading tab/CR is prefixed with
// an apostrophe so a spreadsheet application treats it as literal text instead
// of evaluating it when the exported file is opened. Applied to values derived
// from uploaded payroll files (employee names, component names).
export function sanitizeCellValue<T>(value: T): T | string {
  if (typeof value === 'string' && /^[=+\-@\t\r]/.test(value)) {
    return "'" + value;
  }
  return value;
}
