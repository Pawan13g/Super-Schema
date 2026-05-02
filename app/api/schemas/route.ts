import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const schemas = await prisma.schema.findMany({
    where: { project: { workspace: { ownerId: session.user.id } } },
    orderBy: [{ updatedAt: "desc" }],
    select: {
      id: true,
      name: true,
      version: true,
      updatedAt: true,
      project: {
        select: {
          id: true,
          name: true,
          workspace: { select: { id: true, name: true } },
        },
      },
    },
  });

  return Response.json({
    schemas: schemas.map((s) => ({
      id: s.id,
      name: s.name,
      version: s.version,
      updatedAt: s.updatedAt,
      projectId: s.project.id,
      projectName: s.project.name,
      workspaceId: s.project.workspace.id,
      workspaceName: s.project.workspace.name,
    })),
  });
}
