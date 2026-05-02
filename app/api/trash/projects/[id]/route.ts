import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getProjectIfOwned } from "@/lib/authz";

// POST = restore. Clears deletedAt on the project AND on every child schema
// that was soft-deleted as part of the same cascade. We treat any child
// whose deletedAt >= the project's deletedAt as "trashed by the cascade"
// and bring it back. Schemas explicitly trashed before the project was sent
// to the bin keep their state.
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const owned = await getProjectIfOwned(id, session.user.id, {
    includeDeleted: true,
  });
  if (!owned) return Response.json({ error: "Not found" }, { status: 404 });

  // Allow ~1s slack between the project's and its schemas' delete timestamps
  // so the transaction's two updates count as the same cascade event.
  const cascadeFrom = owned.deletedAt
    ? new Date(owned.deletedAt.getTime() - 1000)
    : null;

  await prisma.$transaction([
    prisma.project.update({
      where: { id },
      data: { deletedAt: null },
    }),
    prisma.schema.updateMany({
      where: {
        projectId: id,
        deletedAt: cascadeFrom ? { gte: cascadeFrom } : { not: null },
      },
      data: { deletedAt: null },
    }),
  ]);
  return Response.json({ ok: true });
}

// DELETE = permanent. Cascades through Prisma onDelete: Cascade.
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const owned = await getProjectIfOwned(id, session.user.id, {
    includeDeleted: true,
  });
  if (!owned) return Response.json({ error: "Not found" }, { status: 404 });

  await prisma.project.delete({ where: { id } });
  return Response.json({ ok: true });
}
