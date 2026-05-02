import { NextRequest } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getSchemaIfOwned } from "@/lib/authz";

const patchSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  schemaJson: z
    .object({
      tables: z.array(z.unknown()),
      relations: z.array(z.unknown()),
    })
    .optional(),
});

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;

  const schema = await getSchemaIfOwned(id, session.user.id);
  if (!schema) return Response.json({ error: "Not found" }, { status: 404 });

  return Response.json({
    schema: {
      id: schema.id,
      name: schema.name,
      projectId: schema.projectId,
      schemaJson: schema.schemaJson,
      version: schema.version,
      createdAt: schema.createdAt,
      updatedAt: schema.updatedAt,
    },
    project: { id: schema.project.id, name: schema.project.name },
    workspace: { id: schema.project.workspace.id },
  });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;

  const owned = await getSchemaIfOwned(id, session.user.id);
  if (!owned) return Response.json({ error: "Not found" }, { status: 404 });

  try {
    const body = await request.json();
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json({ error: "Invalid input" }, { status: 400 });
    }

    const data: Prisma.SchemaUpdateInput = {};
    if (parsed.data.name !== undefined) data.name = parsed.data.name;
    if (parsed.data.schemaJson !== undefined) {
      data.schemaJson = parsed.data.schemaJson as Prisma.InputJsonValue;
      // Bump version on every content change so the version-history panel can
      // index snapshots monotonically.
      data.version = { increment: 1 };
    }

    const schema = await prisma.schema.update({ where: { id }, data });

    // Snapshot every content change into SchemaVersion (capped at 50 per schema).
    if (parsed.data.schemaJson) {
      await prisma.schemaVersion.upsert({
        where: { schemaId_version: { schemaId: id, version: schema.version } },
        create: {
          schemaId: id,
          version: schema.version,
          schemaJson: parsed.data.schemaJson as Prisma.InputJsonValue,
        },
        update: {
          schemaJson: parsed.data.schemaJson as Prisma.InputJsonValue,
        },
      });
      const oldest = await prisma.schemaVersion.findMany({
        where: { schemaId: id },
        orderBy: { version: "desc" },
        skip: 50,
        select: { id: true },
      });
      if (oldest.length > 0) {
        await prisma.schemaVersion.deleteMany({
          where: { id: { in: oldest.map((v) => v.id) } },
        });
      }
    }

    return Response.json({ schema });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Update failed";
    return Response.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;

  const owned = await getSchemaIfOwned(id, session.user.id);
  if (!owned) return Response.json({ error: "Not found" }, { status: 404 });

  // Soft-delete: row stays for 30 days, recoverable from trash.
  await prisma.schema.update({
    where: { id },
    data: { deletedAt: new Date() },
  });
  return Response.json({ ok: true });
}
