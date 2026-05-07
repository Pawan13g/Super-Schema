import { z } from "zod";
import {
  COLUMN_CONSTRAINTS,
  COLUMN_TYPES,
  INDEX_TYPES,
  TABLE_COLORS,
  type Schema,
} from "./types";

// Runtime validation for `Schema` shapes coming from the database
// (`schemaJson` is a `Prisma.JsonValue`) or from any other untrusted source.
// Routes that diff / merge / generate SQL from a schema should pipe its
// `schemaJson` through `parseSchemaJson` and return 422 on failure rather
// than `as unknown as Schema` and risking a downstream crash on a
// malformed / stale row.

const colorSchema = z.string().min(1);

const constraintSchema = z.enum(
  COLUMN_CONSTRAINTS as unknown as readonly [string, ...string[]]
);
const typeSchema = z.enum(
  COLUMN_TYPES as unknown as readonly [string, ...string[]]
);
const indexTypeSchema = z.enum(
  INDEX_TYPES as unknown as readonly [string, ...string[]]
);

const columnZod = z.object({
  id: z.string().min(1),
  name: z.string(),
  type: typeSchema,
  constraints: z.array(constraintSchema),
  comment: z.string().optional(),
  defaultValue: z.string().optional(),
  references: z
    .object({
      table: z.string(),
      column: z.string(),
    })
    .optional(),
});

const indexZod = z.object({
  id: z.string().min(1),
  name: z.string(),
  columns: z.array(z.string()),
  unique: z.boolean(),
  type: indexTypeSchema.optional(),
});

const tableZod = z.object({
  id: z.string().min(1),
  name: z.string(),
  // Allow any non-empty color string; older saved schemas may have hex
  // values that aren't in `TABLE_COLORS`, and that's fine.
  color: colorSchema,
  columns: z.array(columnZod),
  indexes: z.array(indexZod),
  comment: z.string(),
  position: z.object({ x: z.number(), y: z.number() }),
});

const relationZod = z.object({
  id: z.string().min(1),
  sourceTable: z.string().min(1),
  sourceColumn: z.string().min(1),
  targetTable: z.string().min(1),
  targetColumn: z.string().min(1),
  type: z.enum(["one-to-one", "one-to-many", "many-to-many"]),
});

export const schemaZod = z.object({
  tables: z.array(tableZod),
  relations: z.array(relationZod),
});

export type ParseSchemaResult =
  | { ok: true; schema: Schema }
  | { ok: false; error: string };

// Validates a `Prisma.JsonValue` (or any unknown) as a `Schema`. Returns
// `ok:false` instead of throwing so route handlers can map directly to a
// 422 response. The error message names the first failing path so the
// caller can log a useful diagnostic without dumping the full Zod issue
// tree to the client.
export function parseSchemaJson(input: unknown): ParseSchemaResult {
  const r = schemaZod.safeParse(input);
  if (r.success) {
    // Cast back to the `Schema` type. Zod validates the shape but uses
    // generic `string` for fields like `color` / `name`, while `Schema`
    // narrows some of them via TS-only literal types — the runtime data
    // is byte-identical so the cast is safe here.
    return { ok: true, schema: r.data as unknown as Schema };
  }
  const first = r.error.issues[0];
  const path = first?.path.join(".") || "<root>";
  const message = first?.message ?? "invalid";
  return { ok: false, error: `Invalid schema at "${path}": ${message}` };
}

// Suppress unused-import lint when TABLE_COLORS isn't referenced inline.
void TABLE_COLORS;
