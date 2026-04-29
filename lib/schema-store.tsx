"use client";

import {
  createContext,
  useCallback,
  useContext,
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
  addColumn: (tableId: string) => void;
  removeColumn: (tableId: string, columnId: string) => void;
  updateColumn: (tableId: string, columnId: string, updates: Partial<Column>) => void;
  addIndex: (tableId: string, index: Omit<TableIndex, "id">) => void;
  removeIndex: (tableId: string, indexId: string) => void;
  updateTableComment: (tableId: string, comment: string) => void;
  addRelation: (relation: Omit<Relation, "id">) => void;
  removeRelation: (relationId: string) => void;
  createJunctionTable: (
    sourceTableId: string,
    sourceColumnId: string,
    targetTableId: string,
    targetColumnId: string
  ) => string | null;
  importAiSchema: (generated: GeneratedSchema) => void;
  replaceSchema: (next: Schema) => void;
}

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

function genId(prefix: string) {
  // Use browser-native UUIDs when available to avoid ID collisions
  // across page refreshes (which reset module-scoped counters).
  if (typeof crypto !== "undefined" && typeof (crypto as any).randomUUID === "function") {
    // remove dashes to keep IDs compact
    return `${prefix}_${(crypto as any).randomUUID().replace(/-/g, "")}`;
  }
  // Fallback to a timestamp-based id when crypto.randomUUID isn't available
  return `${prefix}_${Date.now().toString(36)}_${Math.floor(Math.random() * 10000)}`;
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
  const [schema, setSchema] = useState<Schema>({ tables: [], relations: [] });
  const [selectedTableId, setSelectedTableId] = useState<string | null>(null);

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
    []
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
          position: {
            x:
              ((sourceTable.position.x ?? 100) +
                (targetTable.position.x ?? 400)) /
              2,
            y:
              Math.max(sourceTable.position.y ?? 100, targetTable.position.y ?? 100) +
              260,
          },
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

  const importAiSchema = useCallback((generated: GeneratedSchema) => {
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

    setSchema({ tables, relations });
    setSelectedTableId(null);
  }, []);

  const replaceSchema = useCallback((next: Schema) => {
    setSchema({
      tables: next.tables.map((table) => normalizeTable(table)),
      relations: next.relations,
    });
    setSelectedTableId(null);
  }, []);

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
        addColumn,
        removeColumn,
        updateColumn,
        addIndex,
        removeIndex,
        updateTableComment,
        addRelation,
        removeRelation,
        createJunctionTable,
        importAiSchema,
        replaceSchema,
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
