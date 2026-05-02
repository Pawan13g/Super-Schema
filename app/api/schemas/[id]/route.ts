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
  // Optimistic-lock guard: client sends the version it last loaded; server
  // updates only when versions match. Lets two concurrent tabs detect that
  // their state is stale instead of silently overwriting each other.
  expectedVersion: z.number().int().nonnegative().optional(),
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
      // Bump version on any content change so optimistic-lock readers
      // see that their snapshot is stale.
      data.version = { increment: 1 };
    }

    if (parsed.data.expectedVersion !== undefined) {
      // Conditional update — succeeds only if the row's current version
      // matches what the client thought it was editing.
      const result = await prisma.schema.updateMany({
        where: { id, version: parsed.data.expectedVersion },
        data,
      });
      if (result.count === 0) {
        const current = await prisma.schema.findUnique({
          where: { id },
          select: { version: true, updatedAt: true },
        });
        return Response.json(
          {
            error: "Schema was modified elsewhere. Reload to get the latest.",
            code: "VERSION_CONFLICT",
            currentVersion: current?.version ?? null,
          },
          { status: 409 }
        );
      }
      const schema = await prisma.schema.findUnique({ where: { id } });

      // Create a version snapshot on content changes
      if (schema && parsed.data.schemaJson) {
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
        // Keep only the last 50 versions per schema
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
    }

    const schema = await prisma.schema.update({ where: { id }, data });

    // Create a version snapshot on content changes
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

  await prisma.schema.delete({ where: { id } });
  return Response.json({ ok: true });
}
