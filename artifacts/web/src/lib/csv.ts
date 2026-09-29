/**
 * Cells that start with one of these are run as formulas by spreadsheet
 * programs. Names and IDs come from an import, so neutralise them.
 */
const FORMULA_START = /^[=+\-@\t\r]/;

function cell(value: string): string {
  const safe = FORMULA_START.test(value) ? `'${value}` : value;
  return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

/** RFC 4180 CSV (CRLF line ends), safe to open in Excel. */
export function toCsv(rows: readonly (readonly string[])[]): string {
  return rows.map((row) => row.map(cell).join(",")).join("\r\n") + "\r\n";
}
