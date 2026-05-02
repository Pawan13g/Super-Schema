import { NextRequest } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { userOwnsWorkspace } from "@/lib/authz";

const createSchema = z.object({
  workspaceId: z.string().min(1),
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
});

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const workspaceId = request.nextUrl.searchParams.get("workspaceId");
  if (!workspaceId) {
    return Response.json({ error: "workspaceId required" }, { status: 400 });
  }
  if (!(await userOwnsWorkspace(workspaceId, session.user.id))) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const projects = await prisma.project.findMany({
    where: { workspaceId, deletedAt: null },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      name: true,
      description: true,
      workspaceId: true,
      createdAt: true,
      updatedAt: true,
      _count: { select: { schemas: { where: { deletedAt: null } } } },
    },
  });

  return Response.json({ projects });
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
    if (!(await userOwnsWorkspace(parsed.data.workspaceId, session.user.id))) {
      return Response.json({ error: "Not found" }, { status: 404 });
    }

    const project = await prisma.$transaction(async (tx) => {
      const createdProject = await tx.project.create({
        data: {
          workspaceId: parsed.data.workspaceId,
          name: parsed.data.name,
          description: parsed.data.description ?? null,
        },
      });

      const schema = await tx.schema.create({
        data: {
          projectId: createdProject.id,
          name: "Main Schema",
          schemaJson: { tables: [], relations: [] },
        },
      });

      return {
        ...createdProject,
        schemas: [{ id: schema.id, name: schema.name }],
      };
    });

    return Response.json({ project });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Create failed";
    return Response.json({ error: message }, { status: 500 });
  }
}
