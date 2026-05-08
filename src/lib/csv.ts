/*
 * CSV builder — RFC 4180 style.
 *
 * Used by the export route handlers. Kept dependency-free and pure so
 * tests (someday) can import it directly.
 *
 * Escaping rules:
 *   - Wrap any value containing a comma, double-quote, or newline in
 *     double quotes.
 *   - Escape embedded double-quotes by doubling them.
 *   - null / undefined become empty strings.
 *   - Date values render as ISO 8601 (UTC) — unambiguous across
 *     spreadsheet apps.
 *   - Booleans render as "true" / "false".
 *   - Numbers use Number.toString() (no thousand separators).
 *
 * Newlines between rows are CRLF per RFC 4180. Excel and Numbers both
 * accept LF too, but CRLF is the safer default.
 */

export interface CsvColumn<Row> {
  /** Column header text (already user-facing — not transformed). */
  header: string;
  /** Pulls the cell value out of a row. Return raw — escaping is added. */
  value: (row: Row) => unknown;
}

const NEEDS_QUOTING = /[",\r\n]/;

function escapeCell(raw: unknown): string {
  if (raw == null) return "";
  let s: string;
  if (raw instanceof Date) {
    s = raw.toISOString();
  } else if (typeof raw === "boolean") {
    s = raw ? "true" : "false";
  } else if (typeof raw === "number") {
    // Don't render NaN as "NaN" — leave it blank to match the null
    // treatment above. Finite numbers (including negatives + decimals)
    // pass through unchanged.
    s = Number.isFinite(raw) ? raw.toString() : "";
  } else {
    s = String(raw);
  }
  if (NEEDS_QUOTING.test(s)) {
    return `"${s.replaceAll('"', '""')}"`;
  }
  return s;
}

export function toCsv<Row>(rows: Row[], columns: CsvColumn<Row>[]): string {
  const headerLine = columns.map((c) => escapeCell(c.header)).join(",");
  const bodyLines = rows.map((row) =>
    columns.map((c) => escapeCell(c.value(row))).join(",")
  );
  return [headerLine, ...bodyLines].join("\r\n") + "\r\n";
}
