import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

// Lists every soft-deleted project + schema the user owns. Server-side
// pruning of items past 30 days happens lazily on every list call so we
// don't need a separate cron.
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  await prisma.$transaction([
    prisma.schema.deleteMany({
      where: { deletedAt: { lt: cutoff } },
    }),
    prisma.project.deleteMany({
      where: { deletedAt: { lt: cutoff } },
    }),
  ]);

  const userId = session.user.id;

  const [projects, schemas] = await Promise.all([
    prisma.project.findMany({
      where: {
        deletedAt: { not: null },
        workspace: { ownerId: userId },
      },
      orderBy: { deletedAt: "desc" },
      select: {
        id: true,
        name: true,
        description: true,
        deletedAt: true,
        workspaceId: true,
        workspace: { select: { id: true, name: true } },
      },
    }),
    prisma.schema.findMany({
      where: {
        deletedAt: { not: null },
        // Only show schemas whose parent project is still alive (or itself
        // soft-deleted but inside a live workspace).
        project: { workspace: { ownerId: userId } },
      },
      orderBy: { deletedAt: "desc" },
      select: {
        id: true,
        name: true,
        deletedAt: true,
        version: true,
        projectId: true,
        project: {
          select: {
            id: true,
            name: true,
            deletedAt: true,
            workspaceId: true,
          },
        },
      },
    }),
  ]);

  return Response.json({
    projects,
    schemas,
    cutoff: cutoff.toISOString(),
  });
}
