import { NextRequest } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

const createSchema = z.object({
  name: z.string().min(1).max(100),
});

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const workspaces = await prisma.workspace.findMany({
    where: { ownerId: session.user.id },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      name: true,
      createdAt: true,
      updatedAt: true,
      _count: { select: { projects: { where: { deletedAt: null } } } },
    },
  });

  return Response.json({ workspaces });
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json({ error: "Invalid input" }, { status: 400 });
    }
    // Create the workspace AND seed a default project + schema in one
    // transaction so the user lands on a usable canvas immediately.
    const workspace = await prisma.$transaction(async (tx) => {
      const ws = await tx.workspace.create({
        data: { ownerId: session.user.id, name: parsed.data.name },
      });
      const project = await tx.project.create({
        data: { workspaceId: ws.id, name: "Default Project" },
      });
      await tx.schema.create({
        data: {
          projectId: project.id,
          name: "Main Schema",
          schemaJson: { tables: [], relations: [] },
        },
      });
      return ws;
    });

    return Response.json({ workspace });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Create failed";
    return Response.json({ error: message }, { status: 500 });
  }
}
