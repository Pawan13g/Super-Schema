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

// Stable JSON serialization with sorted object keys, so two semantically
// identical schemas (e.g. produced by different client paths) compare equal
// even if their key order differs.
function canonicalStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) {
    return `[${value.map((v) => canonicalStringify(v)).join(",")}]`;
  }
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return `{${keys
    .map((k) => `${JSON.stringify(k)}:${canonicalStringify(obj[k])}`)
    .join(",")}}`;
}

// Returns a copy of the schema with cosmetic-only fields stripped (table
// `position`). Used to detect *structural* changes so a position-only drag
// doesn't carve a new history version.
function withoutCosmetics(value: unknown): unknown {
  if (value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map((v) => withoutCosmetics(v));
  const obj = value as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const k of Object.keys(obj)) {
    if (k === "position") continue;
    out[k] = withoutCosmetics(obj[k]);
  }
  return out;
}

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

    // Detect whether the incoming JSON differs from what's already stored.
    // No-diff PATCHes (e.g. no-op renames, debounced retries) shouldn't bump
    // the version or create a snapshot — otherwise the history tab fills up
    // with identical entries.
    const incomingJson =
      parsed.data.schemaJson !== undefined
        ? canonicalStringify(parsed.data.schemaJson)
        : null;
    const currentJson =
      parsed.data.schemaJson !== undefined
        ? canonicalStringify(owned.schemaJson)
        : null;
    const contentChanged =
      incomingJson !== null && incomingJson !== currentJson;

    // Detect *structural* changes (anything other than table positions). A
    // pure drag-to-reposition still saves the new schemaJson but should not
    // create a SchemaVersion snapshot — history is for meaningful edits.
    const structuralChanged =
      parsed.data.schemaJson !== undefined &&
      canonicalStringify(withoutCosmetics(parsed.data.schemaJson)) !==
        canonicalStringify(withoutCosmetics(owned.schemaJson));

    const data: Prisma.SchemaUpdateInput = {};
    if (parsed.data.name !== undefined) data.name = parsed.data.name;
    if (parsed.data.schemaJson !== undefined) {
      data.schemaJson = parsed.data.schemaJson as Prisma.InputJsonValue;
      // Bump version only on real structural change so position-only drags
      // don't inflate the version counter or history list.
      if (structuralChanged) {
        data.version = { increment: 1 };
      }
    }

    const schema = await prisma.schema.update({ where: { id }, data });

    // Snapshot only on structural change (skip pure position drags +
    // no-op PATCHes), capped at 50 versions per schema.
    if (parsed.data.schemaJson && structuralChanged && contentChanged) {
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
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      return Response.json(
        {
          error:
            "A schema with that name already exists in this project.",
          code: "DUPLICATE_NAME",
        },
        { status: 409 }
      );
    }
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
