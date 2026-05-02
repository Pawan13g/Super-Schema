import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getSchemaIfOwned } from "@/lib/authz";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const owned = await getSchemaIfOwned(id, session.user.id, {
    includeDeleted: true,
  });
  if (!owned) return Response.json({ error: "Not found" }, { status: 404 });
  // If the parent project is in the trash, the schema can't surface — block.
  if (owned.project.deletedAt) {
    return Response.json(
      { error: "Restore the parent project first." },
      { status: 400 }
    );
  }

  await prisma.schema.update({
    where: { id },
    data: { deletedAt: null },
  });
  return Response.json({ ok: true });
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
  const owned = await getSchemaIfOwned(id, session.user.id, {
    includeDeleted: true,
  });
  if (!owned) return Response.json({ error: "Not found" }, { status: 404 });

  await prisma.schema.delete({ where: { id } });
  return Response.json({ ok: true });
}
