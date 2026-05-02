import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getSchemaIfOwned } from "@/lib/authz";

// GET /api/schemas/:id/versions/:versionId — get a specific version's full schema JSON
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; versionId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id, versionId } = await params;

  const owned = await getSchemaIfOwned(id, session.user.id);
  if (!owned) return Response.json({ error: "Not found" }, { status: 404 });

  const version = await prisma.schemaVersion.findUnique({
    where: { id: versionId },
  });
  if (!version || version.schemaId !== id) {
    return Response.json({ error: "Version not found" }, { status: 404 });
  }

  return Response.json({
    version: {
      id: version.id,
      version: version.version,
      schemaJson: version.schemaJson,
      createdAt: version.createdAt,
    },
  });
}

// POST /api/schemas/:id/versions/:versionId — restore this version
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; versionId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id, versionId } = await params;

  const owned = await getSchemaIfOwned(id, session.user.id);
  if (!owned) return Response.json({ error: "Not found" }, { status: 404 });

  const version = await prisma.schemaVersion.findUnique({
    where: { id: versionId },
  });
  if (!version || version.schemaId !== id) {
    return Response.json({ error: "Version not found" }, { status: 404 });
  }

  // Restore: update the schema with the old version's JSON, bump version
  const schema = await prisma.schema.update({
    where: { id },
    data: {
      schemaJson: version.schemaJson!,
      version: { increment: 1 },
    },
  });

  // Create a new snapshot for the restored version
  await prisma.schemaVersion.create({
    data: {
      schemaId: id,
      version: schema.version,
      schemaJson: version.schemaJson!,
    },
  });

  return Response.json({ schema });
}

// DELETE /api/schemas/:id/versions/:versionId — drop a single history entry.
// The schema's current state is untouched.
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; versionId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id, versionId } = await params;

  const owned = await getSchemaIfOwned(id, session.user.id);
  if (!owned) return Response.json({ error: "Not found" }, { status: 404 });

  const version = await prisma.schemaVersion.findUnique({
    where: { id: versionId },
  });
  if (!version || version.schemaId !== id) {
    return Response.json({ error: "Version not found" }, { status: 404 });
  }

  await prisma.schemaVersion.delete({ where: { id: versionId } });
  return Response.json({ ok: true });
}
