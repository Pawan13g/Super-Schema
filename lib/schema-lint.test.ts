import { describe, it, expect } from "vitest";
import { lintSchema } from "./schema-lint";
import type { Schema } from "./types";

const t = (id: string, name: string, cols: { id: string; name: string; type?: string; constraints?: string[]; references?: { table: string; column: string } }[] = []): import("./types").Table => ({
  id,
  name,
  color: "#000",
  columns: cols.map((c) => ({
    id: c.id,
    name: c.name,
    type: (c.type ?? "INT") as never,
    constraints: (c.constraints ?? []) as never,
    references: c.references,
  })),
  indexes: [],
  comment: "",
  position: { x: 0, y: 0 },
});

describe("lintSchema", () => {
  it("flags table without primary key", () => {
    const schema: Schema = { tables: [t("1", "users", [{ id: "c", name: "id" }])], relations: [] };
    const issues = lintSchema(schema);
    expect(issues.some((i) => i.rule === "no-primary-key")).toBe(true);
  });

  it("flags non-snake_case names", () => {
    const schema: Schema = {
      tables: [t("1", "Users", [{ id: "c", name: "userId", constraints: ["PRIMARY KEY"] }])],
      relations: [],
    };
    const issues = lintSchema(schema);
    expect(issues.some((i) => i.rule === "snake-case-table")).toBe(true);
    expect(issues.some((i) => i.rule === "snake-case-column")).toBe(true);
  });

  it("flags FK to missing table", () => {
    const schema: Schema = {
      tables: [t("1", "users", [{ id: "c", name: "id", constraints: ["PRIMARY KEY"], references: { table: "ghost", column: "id" } }])],
      relations: [],
    };
    const issues = lintSchema(schema);
    expect(issues.some((i) => i.rule === "fk-missing-table")).toBe(true);
  });

  it("flags duplicate table + column names", () => {
    const schema: Schema = {
      tables: [
        t("1", "users", [{ id: "a", name: "id", constraints: ["PRIMARY KEY"] }, { id: "b", name: "id" }]),
        t("2", "users", [{ id: "c", name: "id", constraints: ["PRIMARY KEY"] }]),
      ],
      relations: [],
    };
    const issues = lintSchema(schema);
    expect(issues.some((i) => i.rule === "unique-table-name")).toBe(true);
    expect(issues.some((i) => i.rule === "unique-column-name")).toBe(true);
  });

  it("returns empty for clean schema", () => {
    const schema: Schema = {
      tables: [t("1", "users", [{ id: "c", name: "id", constraints: ["PRIMARY KEY"] }])],
      relations: [],
    };
    expect(lintSchema(schema)).toEqual([]);
  });
});
