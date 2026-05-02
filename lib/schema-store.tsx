"use client";

import {
  createContext,
  useCallback,
  useContext,
  useReducer,
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
  addIndex: (tableId: string, index: Omit<TableIndex, "id">) => void;
  removeIndex: (tableId: string, indexId: string) => void;
  updateTableComment: (tableId: string, comment: string) => void;
  updateTableColor: (tableId: string, color: string) => void;
  addRelation: (relation: Omit<Relation, "id">) => void;
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

  // History stacks (refs to avoid re-render storms; canUndo/canRedo derived
  // through a tick counter that bumps when stacks change).
  const historyRef = useRef<{ past: Schema[]; future: Schema[] }>({
    past: [],
    future: [],
  });
  const [, bumpHistory] = useReducer((c: number) => c + 1, 0);

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
          bumpHistory();
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
      bumpHistory();
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
      bumpHistory();
      return nextSchema;
    });
  }, []);

  const canUndo = historyRef.current.past.length > 0;
  const canRedo = historyRef.current.future.length > 0;

  const addTable = useCallback((name: string) => {
    const id = genId("tbl");
    setSchema((prev) => {
      const color = TABLE_COLORS[prev.tables.length % TABLE_COLORS.length];
      const table: Table = normalizeTable({
        id,
        name,
        color,
        columns: [{ ...makeDefaultColumn() }],
        position: { x: 100 + Math.random() * 300, y: 100 + Math.random() * 200 },
      });
      return { ...prev, tables: [...prev.tables, table] };
    });
    setSelectedTableId(id);
  }, []);

  const removeTable = useCallback((tableId: string) => {
    setSchema((prev) => ({
      tables: prev.tables.filter((t) => t.id !== tableId),
      relations: prev.relations.filter(
        (r) => r.sourceTable !== tableId && r.targetTable !== tableId
      ),
    }));
    setSelectedTableId((prev) => (prev === tableId ? null : prev));
  }, []);

  const updateTableName = useCallback((tableId: string, name: string) => {
    setSchema((prev) => ({
      ...prev,
      tables: prev.tables.map((t) => (t.id === tableId ? { ...t, name } : t)),
    }));
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
    const col: Column = {
      id: genId("col"),
      name: "new_column",
      type: "VARCHAR",
      constraints: [],
      comment: "",
    };
    setSchema((prev) => ({
      ...prev,
      tables: prev.tables.map((t) =>
        t.id === tableId ? { ...t, columns: [...t.columns, col] } : t
      ),
    }));
  }, []);

  const removeColumn = useCallback((tableId: string, columnId: string) => {
    setSchema((prev) => ({
      ...prev,
      tables: prev.tables.map((t) =>
        t.id === tableId
          ? { ...t, columns: t.columns.filter((c) => c.id !== columnId) }
          : t
      ),
    }));
  }, []);

  const updateColumn = useCallback(
    (tableId: string, columnId: string, updates: Partial<Column>) => {
      setSchema((prev) => ({
        ...prev,
        tables: prev.tables.map((t) =>
          t.id === tableId
            ? {
                ...t,
                columns: t.columns.map((c) =>
                  c.id === columnId ? { ...c, ...updates } : c
                ),
              }
            : t
        ),
      }));
    },
    []
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
      relations: [...prev.relations, { ...relation, id }],
    }));
  }, []);

  const removeRelation = useCallback((relationId: string) => {
    setSchema((prev) => ({
      ...prev,
      relations: prev.relations.filter((r) => r.id !== relationId),
    }));
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

    // Build tables with IDs
    const tableMap = new Map<string, string>(); // name → id
    const colMap = new Map<string, Map<string, string>>(); // tableName → (colName → colId)

    const tables: Table[] = generated.tables.map((t, i) => {
      const id = genId("tbl");
      tableMap.set(t.name, id);
      const colEntries = new Map<string, string>();

      const columns: Column[] = t.columns.map((c) => {
        const colId = genId("col");
        colEntries.set(c.name, colId);
        const colType = COLUMN_TYPES.includes(c.type as ColumnType)
          ? (c.type as ColumnType)
          : "VARCHAR";
        const constraints = (c.constraints ?? []).filter((cn) =>
          ["PRIMARY KEY", "NOT NULL", "UNIQUE", "AUTO_INCREMENT", "DEFAULT", "CHECK", "REFERENCES"].includes(cn)
        ) as ColumnConstraint[];
        return { id: colId, name: c.name, type: colType, constraints, comment: "" };
      });

      colMap.set(t.name, colEntries);

      return {
        id,
        name: t.name,
        color: TABLE_COLORS[i % TABLE_COLORS.length],
        columns,
        indexes: [],
        comment: "",
        position: { x: (i % COLS) * GRID_X + 50, y: Math.floor(i / COLS) * GRID_Y + 50 },
      };
    });

    // Build relations mapping names → IDs
    const relations: Relation[] = (generated.relations ?? [])
      .map((r) => {
        const srcTableId = tableMap.get(r.sourceTable);
        const tgtTableId = tableMap.get(r.targetTable);
        const srcColId = colMap.get(r.sourceTable)?.get(r.sourceColumn);
        const tgtColId = colMap.get(r.targetTable)?.get(r.targetColumn);
        if (!srcTableId || !tgtTableId || !srcColId || !tgtColId) return null;
        const relType = (["one-to-one", "one-to-many", "many-to-many"].includes(r.type)
          ? r.type
          : "one-to-many") as Relation["type"];
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
      setSchema({
        tables: next.tables.map((table) => normalizeTable(table)),
        relations: next.relations,
      });
      setSelectedTableId(null);
    },
    [setSchema]
  );

  return (
    <SchemaContext.Provider
      value={{
        schema,
        selectedTableId,
        setSelectedTableId,
        addTable,
        removeTable,
        updateTableName,
        updateTablePosition,
        setTablePositions,
        addColumn,
        removeColumn,
        updateColumn,
        reorderColumn,
        addIndex,
        removeIndex,
        updateTableComment,
        updateTableColor,
        addRelation,
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
