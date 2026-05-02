import { NextRequest } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { getSchemaIfOwned } from "@/lib/authz";
import { diffSchemas } from "@/lib/schema-diff";
import { generateMigrationSql, type SqlDialect } from "@/lib/schema-migration";
import type { Schema } from "@/lib/types";

const bodySchema = z.object({
  leftId: z.string().min(1),
  rightId: z.string().min(1),
  dialect: z.enum(["postgresql", "mysql", "sqlite"]).optional(),
});

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "Invalid input" }, { status: 400 });
  }

  const { leftId, rightId } = parsed.data;
  const dialect: SqlDialect = parsed.data.dialect ?? "postgresql";

  const [left, right] = await Promise.all([
    getSchemaIfOwned(leftId, session.user.id),
    getSchemaIfOwned(rightId, session.user.id),
  ]);
  if (!left || !right) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const leftSchema = left.schemaJson as unknown as Schema;
  const rightSchema = right.schemaJson as unknown as Schema;

  const diff = diffSchemas(leftSchema, rightSchema);
  const migration = generateMigrationSql(leftSchema, rightSchema, dialect);

  return Response.json({
    left: { id: left.id, name: left.name, projectId: left.projectId },
    right: { id: right.id, name: right.name, projectId: right.projectId },
    dialect,
    diff,
    migration,
  });
}
