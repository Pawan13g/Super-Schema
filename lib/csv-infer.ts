import type { ColumnType } from "./types";

export interface CsvParseResult {
  headers: string[];
  rows: string[][];
  delimiter: "," | ";" | "\t" | "|";
}

export interface InferredColumn {
  name: string;
  type: ColumnType;
  nullable: boolean;
  unique: boolean;
  samples: string[];
}

export interface InferredTable {
  tableName: string;
  columns: InferredColumn[];
  rowCount: number;
}

const SUPPORTED_DELIMS = [",", ";", "\t", "|"] as const;

function detectDelimiter(headerLine: string): CsvParseResult["delimiter"] {
  let best: CsvParseResult["delimiter"] = ",";
  let bestCount = 0;
  for (const d of SUPPORTED_DELIMS) {
    const count = headerLine.split(d).length;
    if (count > bestCount) {
      bestCount = count;
      best = d;
    }
  }
  return best;
}

// RFC 4180-ish CSV parser supporting quoted fields, escaped quotes, embedded
// newlines, and CRLF/LF row endings. Custom delimiter.
export function parseCsv(text: string): CsvParseResult {
  // Strip BOM
  const input = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  // Detect delimiter from the first non-empty line
  const firstNewline = input.search(/\r?\n/);
  const headerLine = firstNewline === -1 ? input : input.slice(0, firstNewline);
  const delimiter = detectDelimiter(headerLine);

  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  let i = 0;

  while (i < input.length) {
    const ch = input[i];
    if (inQuotes) {
      if (ch === '"') {
        if (input[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i++;
        continue;
      }
      field += ch;
      i++;
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      i++;
      continue;
    }
    if (ch === delimiter) {
      row.push(field);
      field = "";
      i++;
      continue;
    }
    if (ch === "\r") {
      // CRLF or stray CR — treat as row break
      if (input[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      i++;
      continue;
    }
    if (ch === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      i++;
      continue;
    }
    field += ch;
    i++;
  }
  // Flush last field/row if non-empty
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  // Drop empty trailing rows
  while (rows.length > 0 && rows[rows.length - 1].every((c) => c === "")) {
    rows.pop();
  }

  if (rows.length === 0) {
    return { headers: [], rows: [], delimiter };
  }

  const headers = rows[0].map((h) => h.trim());
  return { headers, rows: rows.slice(1), delimiter };
}

const BOOL_VALUES = new Set([
  "true", "false", "yes", "no", "y", "n", "t", "f", "0", "1",
]);

const INT_RE = /^-?\d{1,18}$/;
const FLOAT_RE = /^-?\d+(\.\d+)?([eE][-+]?\d+)?$/;
const UUID_RE = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^\d{2}:\d{2}(:\d{2})?$/;
const TIMESTAMP_RE = /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(:\d{2})?(\.\d+)?(Z|[-+]\d{2}:?\d{2})?$/;

function isNullish(v: string): boolean {
  const t = v.trim().toLowerCase();
  return t === "" || t === "null" || t === "na" || t === "n/a" || t === "nan";
}

function inferColumnType(values: string[]): ColumnType {
  let allInt = true;
  let allFloat = true;
  let allBool = true;
  let allUuid = true;
  let allDate = true;
  let allTime = true;
  let allTimestamp = true;
  let maxLen = 0;
  let nonNullCount = 0;
  let bigInt = false;

  for (const raw of values) {
    if (isNullish(raw)) continue;
    nonNullCount++;
    const v = raw.trim();
    if (v.length > maxLen) maxLen = v.length;

    if (allInt) {
      if (INT_RE.test(v)) {
        if (v.length > 9 || (v.startsWith("-") && v.length > 10)) bigInt = true;
      } else {
        allInt = false;
      }
    }
    if (allFloat && !FLOAT_RE.test(v)) allFloat = false;
    if (allBool && !BOOL_VALUES.has(v.toLowerCase())) allBool = false;
    if (allUuid && !UUID_RE.test(v)) allUuid = false;
    if (allDate && !DATE_RE.test(v)) allDate = false;
    if (allTime && !TIME_RE.test(v)) allTime = false;
    if (allTimestamp && !TIMESTAMP_RE.test(v)) allTimestamp = false;
  }

  if (nonNullCount === 0) return "VARCHAR";
  if (allBool) return "BOOLEAN";
  if (allInt) return bigInt ? "BIGINT" : "INT";
  if (allFloat) return "DOUBLE";
  if (allUuid) return "UUID";
  if (allTimestamp) return "TIMESTAMP";
  if (allDate) return "DATE";
  if (allTime) return "TIME";
  if (maxLen > 255) return "TEXT";
  return "VARCHAR";
}

function snakeCase(s: string): string {
  const trimmed = s.trim();
  if (!trimmed) return "column";
  return (
    trimmed
      // separate camelCase
      .replace(/([a-z])([A-Z])/g, "$1_$2")
      .replace(/[^a-zA-Z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .toLowerCase() || "column"
  );
}

function inferTableName(filename: string): string {
  const base = filename.replace(/\.[^.]+$/, "");
  return snakeCase(base) || "imported_table";
}

export function inferTableFromCsv(
  parsed: CsvParseResult,
  filename: string,
  sampleSize = 200
): InferredTable {
  const { headers, rows } = parsed;
  const sample = rows.slice(0, sampleSize);

  const seenNames = new Set<string>();
  const columns: InferredColumn[] = headers.map((rawHeader, colIdx) => {
    let name = snakeCase(rawHeader || `column_${colIdx + 1}`);
    let suffix = 2;
    while (seenNames.has(name)) name = `${snakeCase(rawHeader)}_${suffix++}`;
    seenNames.add(name);

    const colValues = sample.map((r) => r[colIdx] ?? "");
    const type = inferColumnType(colValues);
    const nullable = colValues.some((v) => isNullish(v));
    // Uniqueness check on non-null values
    const nonNull = colValues.filter((v) => !isNullish(v));
    const unique = nonNull.length > 1 && new Set(nonNull).size === nonNull.length;

    const samples = nonNull.slice(0, 3);
    return { name, type, nullable, unique, samples };
  });

  return {
    tableName: inferTableName(filename),
    columns,
    rowCount: rows.length,
  };
}
