import { NextRequest } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getProjectIfOwned } from "@/lib/authz";

const patchSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).nullable().optional(),
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

  const project = await getProjectIfOwned(id, session.user.id);
  if (!project) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const schemas = await prisma.schema.findMany({
    where: { projectId: id, deletedAt: null },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      name: true,
      version: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return Response.json({
    project: {
      id: project.id,
      name: project.name,
      description: project.description,
      workspaceId: project.workspaceId,
      createdAt: project.createdAt,
      updatedAt: project.updatedAt,
    },
    workspace: { id: project.workspace.id },
    schemas,
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

  const owned = await getProjectIfOwned(id, session.user.id);
  if (!owned) return Response.json({ error: "Not found" }, { status: 404 });

  try {
    const body = await request.json();
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json({ error: "Invalid input" }, { status: 400 });
    }

    const project = await prisma.project.update({
      where: { id },
      data: parsed.data,
    });

    return Response.json({ project });
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      return Response.json(
        {
          error: "A project with that name already exists in this workspace.",
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

  const owned = await getProjectIfOwned(id, session.user.id);
  if (!owned) return Response.json({ error: "Not found" }, { status: 404 });

  // Soft-delete: cascade by also marking child schemas. Permanent deletion
  // happens via the trash route.
  await prisma.$transaction([
    prisma.project.update({
      where: { id },
      data: { deletedAt: new Date() },
    }),
    prisma.schema.updateMany({
      where: { projectId: id, deletedAt: null },
      data: { deletedAt: new Date() },
    }),
  ]);
  return Response.json({ ok: true });
}
