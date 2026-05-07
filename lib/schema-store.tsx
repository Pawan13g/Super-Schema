"use client";

import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type {
  Column,
  ColumnConstraint,
  ColumnType,
  Relation,
  Schema,
  Table,
  TableIndex,
} from "./types";
import { TABLE_COLORS, COLUMN_TYPES } from "./types";
import type { GeneratedSchema } from "./langchain/ai";

interface SchemaStore {
  schema: Schema;
  selectedTableId: string | null;
  setSelectedTableId: (id: string | null) => void;
  addTable: (name: string) => void;
  removeTable: (tableId: string) => void;
  // Bulk-remove tables. Drops the tables + every relation that touched them
  // in a single history-tracked update.
  removeTables: (tableIds: string[]) => void;
  updateTableName: (tableId: string, name: string) => void;
  updateTablePosition: (tableId: string, position: { x: number; y: number }) => void;
  setTablePositions: (
    positions: Record<string, { x: number; y: number }>
  ) => void;
  addColumn: (tableId: string) => void;
  removeColumn: (tableId: string, columnId: string) => void;
  updateColumn: (tableId: string, columnId: string, updates: Partial<Column>) => void;
  // Reorder a column inside the same table. `position` is "before" or "after"
  // the target column. No-op if same id or unknown ids.
  reorderColumn: (
    tableId: string,
    sourceColumnId: string,
    targetColumnId: string,
    position: "before" | "after"
  ) => void;
  // Reorder a table within the schema's table list. Used by sidebar tree
  // drag-and-drop. No-op for same/unknown ids.
  reorderTable: (
    sourceTableId: string,
    targetTableId: string,
    position: "before" | "after"
  ) => void;
  addIndex: (tableId: string, index: Omit<TableIndex, "id">) => void;
  removeIndex: (tableId: string, indexId: string) => void;
  updateTableComment: (tableId: string, comment: string) => void;
  updateTableColor: (tableId: string, color: string) => void;
  addRelation: (relation: Omit<Relation, "id">) => void;
  // Update an existing relation in place. Used for type cycling and endpoint
  // edits so the underlying React Flow edge id stays stable (no flicker, no
  // duplicate edge during the swap).
  updateRelation: (
    relationId: string,
    updates: Partial<Omit<Relation, "id">>
  ) => void;
  removeRelation: (relationId: string) => void;
  createJunctionTable: (
    sourceTableId: string,
    sourceColumnId: string,
    targetTableId: string,
    targetColumnId: string
  ) => string | null;
  duplicateTable: (tableId: string, options?: { select?: boolean }) => string | null;
  insertTable: (table: Table) => string;
  importAiSchema: (generated: GeneratedSchema) => void;
  replaceSchema: (next: Schema) => void;
  // History
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
}

const HISTORY_LIMIT = 50;

const SchemaContext = createContext<SchemaStore | null>(null);

function normalizeColumn(column: Column): Column {
  return {
    ...column,
    comment: column.comment ?? "",
  };
}

function normalizeTable(table: Partial<Table> & Pick<Table, "id" | "name" | "color" | "columns" | "position">): Table {
  return {
    ...table,
    columns: table.columns.map((column) => normalizeColumn(column)),
    indexes: table.indexes ?? [],
    comment: table.comment ?? "",
  };
}

function genId(prefix: string): string {
  // Use browser-native UUIDs when available to avoid ID collisions across
  // page refreshes (which would reset any module-scoped counter).
  const c =
    typeof crypto !== "undefined"
      ? (crypto as Crypto & { randomUUID?: () => string })
      : null;
  if (c?.randomUUID) {
    return `${prefix}_${c.randomUUID().replace(/-/g, "")}`;
  }
  // Fallback when crypto.randomUUID isn't available (older browsers).
  return `${prefix}_${Date.now().toString(36)}_${Math.floor(
    Math.random() * 10000
  )}`;
}

// Pick a position for a junction table that avoids overlapping existing
// nodes. Starts midway-below the parent tables, then nudges down on collision.
function pickJunctionPosition(
  existing: Table[],
  source: Table,
  target: Table
): { x: number; y: number } {
  const baseX =
    ((source.position.x ?? 100) + (target.position.x ?? 400)) / 2;
  const baseY =
    Math.max(source.position.y ?? 100, target.position.y ?? 100) + 260;
  const nodeWidth = 240;
  const nodeHeight = 220;
  let pos = { x: baseX, y: baseY };
  let attempts = 0;
  while (
    existing.some(
      (t) =>
        Math.abs((t.position.x ?? 0) - pos.x) < nodeWidth &&
        Math.abs((t.position.y ?? 0) - pos.y) < nodeHeight
    ) &&
    attempts < 12
  ) {
    pos = { x: pos.x, y: pos.y + 240 };
    attempts++;
  }
  return pos;
}

function makeDefaultColumn(): Column {
  return {
    id: genId("col"),
    name: "id",
    type: "SERIAL" as ColumnType,
    constraints: ["PRIMARY KEY"],
    comment: "",
  };
}

export function SchemaProvider({ children }: { children: ReactNode }) {
  const [schema, setSchemaRaw] = useState<Schema>({ tables: [], relations: [] });
  const [selectedTableId, setSelectedTableId] = useState<string | null>(null);

  // History stacks (refs to avoid re-render storms). The boolean flags are
  // tracked in state and updated alongside ref pushes so consumers can read
  // `canUndo` / `canRedo` during render without violating the
  // react-hooks/refs rule. Updates are no-ops when the value is unchanged
  // so we don't trigger an extra render on every history-skipping mutation.
  const historyRef = useRef<{ past: Schema[]; future: Schema[] }>({
    past: [],
    future: [],
  });
  const [canUndo, setCanUndoState] = useState(false);
  const [canRedo, setCanRedoState] = useState(false);
  const syncHistoryFlags = useCallback(() => {
    const u = historyRef.current.past.length > 0;
    const r = historyRef.current.future.length > 0;
    setCanUndoState((prev) => (prev === u ? prev : u));
    setCanRedoState((prev) => (prev === r ? prev : r));
  }, []);

  const setSchema = useCallback(
    (
      next: Schema | ((prev: Schema) => Schema),
      opts: { skipHistory?: boolean } = {}
    ) => {
      setSchemaRaw((prev) => {
        const computed =
          typeof next === "function"
            ? (next as (p: Schema) => Schema)(prev)
            : next;
        if (computed === prev) return prev;
        if (!opts.skipHistory) {
          const past = historyRef.current.past;
          past.push(prev);
          if (past.length > HISTORY_LIMIT) past.shift();
          historyRef.current.future = [];
          syncHistoryFlags();
        }
        return computed;
      });
    },
    []
  );

  const undo = useCallback(() => {
    setSchemaRaw((prev) => {
      const { past, future } = historyRef.current;
      if (past.length === 0) return prev;
      const previous = past.pop()!;
      future.push(prev);
      if (future.length > HISTORY_LIMIT) future.shift();
      syncHistoryFlags();
      return previous;
    });
  }, []);

  const redo = useCallback(() => {
    setSchemaRaw((prev) => {
      const { past, future } = historyRef.current;
      if (future.length === 0) return prev;
      const nextSchema = future.pop()!;
      past.push(prev);
      if (past.length > HISTORY_LIMIT) past.shift();
      syncHistoryFlags();
      return nextSchema;
    });
  }, []);

  // canUndo / canRedo are now driven by `setCanUndoState` /
  // `setCanRedoState` calls inside `syncHistoryFlags`. Reading them is safe
  // during render — they're regular state — and consumers re-render only
  // when the flags actually flip.

  // Find a non-colliding name by appending "_N" if the requested name is
  // already taken in `taken`. Returns the requested name if unique.
  const dedupeName = (requested: string, taken: Set<string>): string => {
    if (!taken.has(requested)) return requested;
    let n = 2;
    while (taken.has(`${requested}_${n}`)) n++;
    return `${requested}_${n}`;
  };

  const addTable = useCallback((name: string) => {
    const id = genId("tbl");
    setSchema((prev) => {
      const taken = new Set(prev.tables.map((t) => t.name));
      const finalName = dedupeName(name, taken);
      const color = TABLE_COLORS[prev.tables.length % TABLE_COLORS.length];
      const table: Table = normalizeTable({
        id,
        name: finalName,
        color,
        columns: [{ ...makeDefaultColumn() }],
        position: { x: 100 + Math.random() * 300, y: 100 + Math.random() * 200 },
      });
      return { ...prev, tables: [...prev.tables, table] };
    });
    setSelectedTableId(id);
  }, []);

  const removeTable = useCallback((tableId: string) => {
    setSchema((prev) => {
      const dropped = prev.tables.find((t) => t.id === tableId);
      const droppedName = dropped?.name;
      return {
        ...prev,
        relations: prev.relations.filter(
          (r) => r.sourceTable !== tableId && r.targetTable !== tableId
        ),
        // Drop the table itself; on surviving tables strip any FK references
        // that pointed at the deleted table (matched by name in the column's
        // `references` field) so the column doesn't keep claiming to be a FK.
        tables: prev.tables
          .filter((t) => t.id !== tableId)
          .map((t) => {
            if (!droppedName) return t;
            let touched = false;
            const cols = t.columns.map((c) => {
              if (c.references?.table === droppedName) {
                touched = true;
                return {
                  ...c,
                  references: undefined,
                  constraints: c.constraints.filter((k) => k !== "REFERENCES"),
                };
              }
              return c;
            });
            return touched ? { ...t, columns: cols } : t;
          }),
      };
    });
    setSelectedTableId((prev) => (prev === tableId ? null : prev));
  }, []);

  const removeTables = useCallback((tableIds: string[]) => {
    if (tableIds.length === 0) return;
    const ids = new Set(tableIds);
    setSchema((prev) => {
      const droppedNames = new Set(
        prev.tables.filter((t) => ids.has(t.id)).map((t) => t.name)
      );
      return {
        ...prev,
        relations: prev.relations.filter(
          (r) => !ids.has(r.sourceTable) && !ids.has(r.targetTable)
        ),
        tables: prev.tables
          .filter((t) => !ids.has(t.id))
          .map((t) => {
            let touched = false;
            const cols = t.columns.map((c) => {
              if (c.references && droppedNames.has(c.references.table)) {
                touched = true;
                return {
                  ...c,
                  references: undefined,
                  constraints: c.constraints.filter((k) => k !== "REFERENCES"),
                };
              }
              return c;
            });
            return touched ? { ...t, columns: cols } : t;
          }),
      };
    });
    setSelectedTableId((prev) => (prev && ids.has(prev) ? null : prev));
  }, []);

  const updateTableName = useCallback((tableId: string, name: string) => {
    setSchema((prev) => {
      const trimmed = name.trim();
      if (!trimmed) return prev;
      const before = prev.tables.find((t) => t.id === tableId);
      if (!before || before.name === trimmed) return prev;
      // Reject duplicate table names within the same schema.
      const collision = prev.tables.some(
        (t) => t.id !== tableId && t.name === trimmed
      );
      if (collision) return prev;
      const oldName = before.name;
      // Rewrite peer columns whose `references.table` pointed at the old
      // name. Otherwise SQL gen would emit `REFERENCES <old-name>(...)` for
      // a table that no longer exists under that name and the canvas FK
      // arrow lookup (which compares on `references.table`) goes stale.
      return {
        ...prev,
        tables: prev.tables.map((t) => {
          if (t.id === tableId) return { ...t, name: trimmed };
          let touched = false;
          const cols = t.columns.map((c) => {
            if (c.references?.table === oldName) {
              touched = true;
              return {
                ...c,
                references: { ...c.references, table: trimmed },
              };
            }
            return c;
          });
          return touched ? { ...t, columns: cols } : t;
        }),
      };
    });
  }, []);

  const updateTablePosition = useCallback(
    (tableId: string, position: { x: number; y: number }) => {
      setSchema((prev) => ({
        ...prev,
        tables: prev.tables.map((t) =>
          t.id === tableId ? { ...t, position } : t
        ),
      }));
    },
    [setSchema]
  );

  // Batched layout update — single history entry covering all moved tables.
  const setTablePositions = useCallback(
    (positions: Record<string, { x: number; y: number }>) => {
      setSchema((prev) => ({
        ...prev,
        tables: prev.tables.map((t) =>
          positions[t.id] ? { ...t, position: positions[t.id] } : t
        ),
      }));
    },
    [setSchema]
  );

  const addColumn = useCallback((tableId: string) => {
    setSchema((prev) => ({
      ...prev,
      tables: prev.tables.map((t) => {
        if (t.id !== tableId) return t;
        const taken = new Set(t.columns.map((c) => c.name));
        const col: Column = {
          id: genId("col"),
          name: dedupeName("new_column", taken),
          type: "VARCHAR",
          constraints: [],
          comment: "",
        };
        return { ...t, columns: [...t.columns, col] };
      }),
    }));
  }, []);

  const removeColumn = useCallback((tableId: string, columnId: string) => {
    setSchema((prev) => {
      const targetTable = prev.tables.find((t) => t.id === tableId);
      const targetCol = targetTable?.columns.find((c) => c.id === columnId);
      const targetColName = targetCol?.name;
      return {
        ...prev,
        // Drop relations that touched this column (either as source or target).
        relations: prev.relations.filter(
          (r) =>
            !(
              (r.sourceTable === tableId && r.sourceColumn === columnId) ||
              (r.targetTable === tableId && r.targetColumn === columnId)
            )
        ),
        tables: prev.tables.map((t) => {
          if (t.id === tableId) {
            // Drop the column itself; also drop any indexes that referenced
            // it; collapse empty indexes.
            const nextCols = t.columns.filter((c) => c.id !== columnId);
            const nextIndexes = (t.indexes ?? [])
              .map((idx) => ({
                ...idx,
                columns: idx.columns.filter((cid) => cid !== columnId),
              }))
              .filter((idx) => idx.columns.length > 0);
            return { ...t, columns: nextCols, indexes: nextIndexes };
          }
          // Other tables: clear any FK references that pointed here by name.
          if (!targetTable || !targetColName) return t;
          let touched = false;
          const cols = t.columns.map((c) => {
            if (
              c.references?.table === targetTable.name &&
              c.references.column === targetColName
            ) {
              touched = true;
              return {
                ...c,
                references: undefined,
                constraints: c.constraints.filter((k) => k !== "REFERENCES"),
              };
            }
            return c;
          });
          return touched ? { ...t, columns: cols } : t;
        }),
      };
    });
  }, []);

  const updateColumn = useCallback(
    (tableId: string, columnId: string, updates: Partial<Column>) => {
      setSchema((prev) => {
        const owningTable = prev.tables.find((t) => t.id === tableId);
        const oldCol = owningTable?.columns.find((c) => c.id === columnId);
        const trimmedName =
          typeof updates.name === "string" ? updates.name.trim() : undefined;
        // True iff this update is renaming the column to a different,
        // non-empty name. Used below to decide whether to propagate the new
        // name into peer columns' `references.column` strings.
        const renaming =
          trimmedName !== undefined &&
          trimmedName.length > 0 &&
          oldCol !== undefined &&
          oldCol.name !== trimmedName &&
          !owningTable!.columns.some(
            (c) => c.id !== columnId && c.name === trimmedName
          );
        return {
          ...prev,
          tables: prev.tables.map((t) => {
            if (t.id === tableId) {
              // Block renames that collide with another column in the same
              // table. Other field updates pass through unchanged.
              if (
                trimmedName !== undefined &&
                t.columns.some(
                  (c) => c.id !== columnId && c.name === trimmedName
                )
              ) {
                const safe = { ...updates };
                delete safe.name;
                return {
                  ...t,
                  columns: t.columns.map((c) =>
                    c.id === columnId ? { ...c, ...safe } : c
                  ),
                };
              }
              return {
                ...t,
                columns: t.columns.map((c) =>
                  c.id === columnId ? { ...c, ...updates } : c
                ),
              };
            }
            // Other tables: if we just renamed a column, rewrite any
            // inbound `references.column` that pointed at the old name. The
            // table-name guard prevents collisions with same-named columns
            // in unrelated tables.
            if (!renaming || !owningTable || !oldCol) return t;
            let touched = false;
            const cols = t.columns.map((c) => {
              if (
                c.references?.table === owningTable.name &&
                c.references.column === oldCol.name
              ) {
                touched = true;
                return {
                  ...c,
                  references: { ...c.references, column: trimmedName! },
                };
              }
              return c;
            });
            return touched ? { ...t, columns: cols } : t;
          }),
        };
      });
    },
    []
  );

  const reorderTable = useCallback(
    (
      sourceTableId: string,
      targetTableId: string,
      position: "before" | "after"
    ) => {
      if (sourceTableId === targetTableId) return;
      setSchema((prev) => {
        const fromIdx = prev.tables.findIndex((t) => t.id === sourceTableId);
        const toIdx = prev.tables.findIndex((t) => t.id === targetTableId);
        if (fromIdx === -1 || toIdx === -1) return prev;
        const next = [...prev.tables];
        const [moved] = next.splice(fromIdx, 1);
        let insertAt = next.findIndex((t) => t.id === targetTableId);
        if (insertAt === -1) return prev;
        if (position === "after") insertAt += 1;
        next.splice(insertAt, 0, moved);
        return { ...prev, tables: next };
      });
    },
    [setSchema]
  );

  const reorderColumn = useCallback(
    (
      tableId: string,
      sourceColumnId: string,
      targetColumnId: string,
      position: "before" | "after"
    ) => {
      if (sourceColumnId === targetColumnId) return;
      setSchema((prev) => ({
        ...prev,
        tables: prev.tables.map((t) => {
          if (t.id !== tableId) return t;
          const fromIdx = t.columns.findIndex((c) => c.id === sourceColumnId);
          const toIdx = t.columns.findIndex((c) => c.id === targetColumnId);
          if (fromIdx === -1 || toIdx === -1) return t;
          const next = [...t.columns];
          const [moved] = next.splice(fromIdx, 1);
          // After splice the target index may have shifted by one if it was
          // after the source.
          let insertAt = next.findIndex((c) => c.id === targetColumnId);
          if (insertAt === -1) return t;
          if (position === "after") insertAt += 1;
          next.splice(insertAt, 0, moved);
          return { ...t, columns: next };
        }),
      }));
    },
    []
  );

  const addIndex = useCallback((tableId: string, index: Omit<TableIndex, "id">) => {
    setSchema((prev) => ({
      ...prev,
      tables: prev.tables.map((table) =>
        table.id === tableId
          ? { ...table, indexes: [...(table.indexes ?? []), { ...index, id: genId("idx") }] }
          : table
      ),
    }));
  }, []);

  const removeIndex = useCallback((tableId: string, indexId: string) => {
    setSchema((prev) => ({
      ...prev,
      tables: prev.tables.map((table) =>
        table.id === tableId
          ? { ...table, indexes: (table.indexes ?? []).filter((index) => index.id !== indexId) }
          : table
      ),
    }));
  }, []);

  const updateTableComment = useCallback((tableId: string, comment: string) => {
    setSchema((prev) => ({
      ...prev,
      tables: prev.tables.map((table) =>
        table.id === tableId ? { ...table, comment } : table
      ),
    }));
  }, []);

  const updateTableColor = useCallback((tableId: string, color: string) => {
    setSchema((prev) => ({
      ...prev,
      tables: prev.tables.map((table) =>
        table.id === tableId ? { ...table, color } : table
      ),
    }));
  }, []);

  const addRelation = useCallback((relation: Omit<Relation, "id">) => {
    const id = genId("rel");
    setSchema((prev) => ({
      ...prev,
      // A column can hold at most one outgoing FK. Drop any existing
      // relation on the same (sourceTable, sourceColumn) before appending so
      // editing a FK target doesn't leave a stale edge dangling.
      relations: [
        ...prev.relations.filter(
          (r) =>
            !(
              r.sourceTable === relation.sourceTable &&
              r.sourceColumn === relation.sourceColumn
            )
        ),
        { ...relation, id },
      ],
    }));
  }, []);

  const updateRelation = useCallback(
    (relationId: string, updates: Partial<Omit<Relation, "id">>) => {
      const VALID_TYPES: Relation["type"][] = [
        "one-to-one",
        "one-to-many",
        "many-to-many",
      ];
      // Validate type up front so a bad enum value can't sneak into state.
      if (
        updates.type !== undefined &&
        !VALID_TYPES.includes(updates.type as Relation["type"])
      ) {
        return;
      }
      setSchema((prev) => {
        const target = prev.relations.find((r) => r.id === relationId);
        if (!target) return prev;
        // Resolve the candidate endpoint values (either incoming or current)
        // against the live tables/columns. If any reference doesn't resolve,
        // bail rather than persist an orphan relation.
        const nextSourceTable = updates.sourceTable ?? target.sourceTable;
        const nextSourceColumn = updates.sourceColumn ?? target.sourceColumn;
        const nextTargetTable = updates.targetTable ?? target.targetTable;
        const nextTargetColumn = updates.targetColumn ?? target.targetColumn;
        const sTable = prev.tables.find((t) => t.id === nextSourceTable);
        const tTable = prev.tables.find((t) => t.id === nextTargetTable);
        const sCol = sTable?.columns.find((c) => c.id === nextSourceColumn);
        const tCol = tTable?.columns.find((c) => c.id === nextTargetColumn);
        if (!sTable || !tTable || !sCol || !tCol) return prev;
        return {
          ...prev,
          relations: prev.relations.map((r) =>
            r.id === relationId ? { ...r, ...updates } : r
          ),
        };
      });
    },
    [setSchema]
  );

  const removeRelation = useCallback((relationId: string) => {
    setSchema((prev) => {
      const rel = prev.relations.find((r) => r.id === relationId);
      if (!rel) return prev;
      return {
        ...prev,
        relations: prev.relations.filter((r) => r.id !== relationId),
        // Strip the REFERENCES constraint + `references` field from the
        // source column so the FK badge / arrow stops claiming a link.
        tables: prev.tables.map((t) => {
          if (t.id !== rel.sourceTable) return t;
          return {
            ...t,
            columns: t.columns.map((c) => {
              if (c.id !== rel.sourceColumn) return c;
              return {
                ...c,
                references: undefined,
                constraints: c.constraints.filter((k) => k !== "REFERENCES"),
              };
            }),
          };
        }),
      };
    });
  }, []);

  const createJunctionTable = useCallback(
    (
      sourceTableId: string,
      sourceColumnId: string,
      targetTableId: string,
      targetColumnId: string
    ): string | null => {
      let junctionId: string | null = null;
      setSchema((prev) => {
        const sourceTable = prev.tables.find((t) => t.id === sourceTableId);
        const targetTable = prev.tables.find((t) => t.id === targetTableId);
        const sourceCol = sourceTable?.columns.find(
          (c) => c.id === sourceColumnId
        );
        const targetCol = targetTable?.columns.find(
          (c) => c.id === targetColumnId
        );
        if (!sourceTable || !targetTable || !sourceCol || !targetCol) {
          return prev;
        }

        const junctionTableId = genId("tbl");
        const sourceFkId = genId("col");
        const targetFkId = genId("col");
        junctionId = junctionTableId;

        // Match referenced column types — coerce SERIAL → INT (FK side)
        const fkType = (refType: ColumnType): ColumnType =>
          refType === "SERIAL" ? "INT" : refType;

        const junctionTable: Table = {
          id: junctionTableId,
          name: `${sourceTable.name}_${targetTable.name}`,
          color: TABLE_COLORS[prev.tables.length % TABLE_COLORS.length],
          columns: [
            {
              id: sourceFkId,
              name: `${sourceTable.name}_${sourceCol.name}`,
              type: fkType(sourceCol.type),
              constraints: ["PRIMARY KEY", "NOT NULL", "REFERENCES"],
              comment: "",
              references: { table: sourceTable.name, column: sourceCol.name },
            },
            {
              id: targetFkId,
              name: `${targetTable.name}_${targetCol.name}`,
              type: fkType(targetCol.type),
              constraints: ["PRIMARY KEY", "NOT NULL", "REFERENCES"],
              comment: "",
              references: { table: targetTable.name, column: targetCol.name },
            },
          ],
          indexes: [],
          comment: "",
          position: pickJunctionPosition(prev.tables, sourceTable, targetTable),
        };

        const relationToSource: Relation = {
          id: genId("rel"),
          sourceTable: junctionTableId,
          sourceColumn: sourceFkId,
          targetTable: sourceTableId,
          targetColumn: sourceColumnId,
          type: "one-to-many",
        };
        const relationToTarget: Relation = {
          id: genId("rel"),
          sourceTable: junctionTableId,
          sourceColumn: targetFkId,
          targetTable: targetTableId,
          targetColumn: targetColumnId,
          type: "one-to-many",
        };

        return {
          tables: [...prev.tables, junctionTable],
          relations: [...prev.relations, relationToSource, relationToTarget],
        };
      });
      return junctionId;
    },
    []
  );

  const duplicateTable = useCallback(
    (tableId: string, options: { select?: boolean } = {}): string | null => {
      let newId: string | null = null;
      setSchema((prev) => {
        const src = prev.tables.find((t) => t.id === tableId);
        if (!src) return prev;
        newId = genId("tbl");
        // Avoid name collisions: append "_copy", "_copy_2", etc.
        let candidate = `${src.name}_copy`;
        let counter = 2;
        while (prev.tables.some((t) => t.name === candidate)) {
          candidate = `${src.name}_copy_${counter++}`;
        }
        const cloned: Table = {
          id: newId,
          name: candidate,
          color: src.color,
          columns: src.columns.map((c) => ({
            ...c,
            id: genId("col"),
          })),
          indexes: (src.indexes ?? []).map((idx) => ({
            ...idx,
            id: genId("idx"),
          })),
          comment: src.comment,
          position: {
            x: (src.position.x ?? 0) + 40,
            y: (src.position.y ?? 0) + 40,
          },
        };
        return { ...prev, tables: [...prev.tables, cloned] };
      });
      if (newId && options.select) setSelectedTableId(newId);
      return newId;
    },
    [setSchema]
  );

  const insertTable = useCallback(
    (table: Table): string => {
      const newId = genId("tbl");
      setSchema((prev) => {
        // Ensure name uniqueness on paste.
        let candidate = table.name;
        let counter = 2;
        while (prev.tables.some((t) => t.name === candidate)) {
          candidate = `${table.name}_${counter++}`;
        }
        const cloned: Table = {
          ...table,
          id: newId,
          name: candidate,
          columns: table.columns.map((c) => ({ ...c, id: genId("col") })),
          indexes: (table.indexes ?? []).map((idx) => ({
            ...idx,
            id: genId("idx"),
          })),
          position: {
            x: (table.position.x ?? 0) + 40,
            y: (table.position.y ?? 0) + 40,
          },
        };
        return { ...prev, tables: [...prev.tables, cloned] };
      });
      setSelectedTableId(newId);
      return newId;
    },
    [setSchema]
  );

  const importAiSchemaImpl = (generated: GeneratedSchema): Schema => {
    const GRID_X = 300;
    const GRID_Y = 250;
    const COLS = 3;

    // Build tables with IDs. Dedupe table names — if the AI emits two tables
    // with the same name we silently keep the first so we don't end up with
    // colliding identifiers and broken FK lookups.
    const tableMap = new Map<string, string>(); // name → id
    const colMap = new Map<string, Map<string, string>>(); // tableName → (colName → colId)
    const tableObjMap = new Map<string, Table>(); // tableId → Table

    const tables: Table[] = [];
    let tableIdx = 0;
    for (const t of generated.tables) {
      if (!t?.name || tableMap.has(t.name)) continue;
      const id = genId("tbl");
      tableMap.set(t.name, id);
      const colEntries = new Map<string, string>();

      const columns: Column[] = [];
      for (const c of t.columns ?? []) {
        if (!c?.name || colEntries.has(c.name)) continue; // dedupe column names
        const colId = genId("col");
        colEntries.set(c.name, colId);
        const colType = COLUMN_TYPES.includes(c.type as ColumnType)
          ? (c.type as ColumnType)
          : "VARCHAR";
        const constraints = (c.constraints ?? []).filter((cn) =>
          ["PRIMARY KEY", "NOT NULL", "UNIQUE", "AUTO_INCREMENT", "DEFAULT", "CHECK", "REFERENCES"].includes(cn)
        ) as ColumnConstraint[];
        columns.push({ id: colId, name: c.name, type: colType, constraints, comment: "" });
      }

      colMap.set(t.name, colEntries);

      const tableObj: Table = {
        id,
        name: t.name,
        color: TABLE_COLORS[tableIdx % TABLE_COLORS.length],
        columns,
        indexes: [],
        comment: "",
        position: {
          x: (tableIdx % COLS) * GRID_X + 50,
          y: Math.floor(tableIdx / COLS) * GRID_Y + 50,
        },
      };
      tableObjMap.set(id, tableObj);
      tables.push(tableObj);
      tableIdx += 1;
    }

    // Build relations mapping names → IDs. Drops any relation whose source
    // or target endpoint can't be resolved against the imported tables /
    // columns; AI output is unreliable about that and the canvas edge
    // renderer + SQL generator can't recover from a phantom id.
    const fkSourceColIds = new Set<string>();
    const relations: Relation[] = (generated.relations ?? [])
      .map((r) => {
        if (!r?.sourceTable || !r?.targetTable || !r?.sourceColumn || !r?.targetColumn) {
          return null;
        }
        const srcTableId = tableMap.get(r.sourceTable);
        const tgtTableId = tableMap.get(r.targetTable);
        const srcColId = colMap.get(r.sourceTable)?.get(r.sourceColumn);
        const tgtColId = colMap.get(r.targetTable)?.get(r.targetColumn);
        if (!srcTableId || !tgtTableId || !srcColId || !tgtColId) return null;
        const relType = (["one-to-one", "one-to-many", "many-to-many"].includes(r.type)
          ? r.type
          : "one-to-many") as Relation["type"];
        fkSourceColIds.add(srcColId);
        // Wire the source column's `references` metadata so SQL gen can emit
        // the FK clause and the column is consistently marked as a foreign key.
        const srcTable = tableObjMap.get(srcTableId);
        const tgtTable = tableObjMap.get(tgtTableId);
        const srcCol = srcTable?.columns.find((c) => c.id === srcColId);
        const tgtCol = tgtTable?.columns.find((c) => c.id === tgtColId);
        if (srcCol && tgtTable && tgtCol) {
          srcCol.references = { table: tgtTable.name, column: tgtCol.name };
          if (!srcCol.constraints.includes("REFERENCES")) {
            srcCol.constraints = [...srcCol.constraints, "REFERENCES"];
          }
        }
        return {
          id: genId("rel"),
          sourceTable: srcTableId,
          sourceColumn: srcColId,
          targetTable: tgtTableId,
          targetColumn: tgtColId,
          type: relType,
        };
      })
      .filter((r): r is Relation => r !== null);

    // Strip REFERENCES constraints on columns that don't have a matching
    // surviving relation. Otherwise the column claims to be a foreign key
    // but the canvas can't draw an edge for it and SQL gen produces an
    // orphan-looking definition.
    for (const tbl of tables) {
      tbl.columns = tbl.columns.map((c) => {
        if (!c.constraints.includes("REFERENCES")) return c;
        if (fkSourceColIds.has(c.id)) return c;
        return {
          ...c,
          constraints: c.constraints.filter((k) => k !== "REFERENCES"),
          references: undefined,
        };
      });
    }

    return { tables, relations };
  };

  const importAiSchema = useCallback(
    (generated: GeneratedSchema) => {
      setSchema(importAiSchemaImpl(generated));
      setSelectedTableId(null);
    },
    [setSchema]
  );

  const replaceSchema = useCallback(
    (next: Schema) => {
      // A wholesale schema swap (tab switch, import, AI generation) is a
      // hard boundary in undo history. The previous canvas state belongs
      // to a different schema id; keeping it in the past stack means
      // pressing Ctrl+Z silently morphs the current schema into another
      // schema's tables — confusing and easy to miss. We clear both
      // past and future stacks here so each loaded schema starts with a
      // fresh history. We use the lower-level setSchemaRaw + manual
      // history reset so the swap itself isn't pushed as an undo step.
      historyRef.current.past = [];
      historyRef.current.future = [];
      syncHistoryFlags();
      setSchemaRaw({
        tables: next.tables.map((table) => normalizeTable(table)),
        relations: next.relations,
      });
      setSelectedTableId(null);
    },
    [syncHistoryFlags]
  );

  return (
    <SchemaContext.Provider
      value={{
        schema,
        selectedTableId,
        setSelectedTableId,
        addTable,
        removeTable,
        removeTables,
        updateTableName,
        updateTablePosition,
        setTablePositions,
        addColumn,
        removeColumn,
        updateColumn,
        reorderColumn,
        reorderTable,
        addIndex,
        removeIndex,
        updateTableComment,
        updateTableColor,
        addRelation,
        updateRelation,
        removeRelation,
        createJunctionTable,
        duplicateTable,
        insertTable,
        importAiSchema,
        replaceSchema,
        undo,
        redo,
        canUndo,
        canRedo,
      }}
    >
      {children}
    </SchemaContext.Provider>
  );
}

export function useSchema() {
  const ctx = useContext(SchemaContext);
  if (!ctx) throw new Error("useSchema must be used within SchemaProvider");
  return ctx;
}
