import { NextRequest } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { userOwnsWorkspace } from "@/lib/authz";
import { requireJsonContentType } from "@/lib/csrf";

const patchSchema = z.object({
  name: z.string().min(1).max(100).optional(),
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

  const workspace = await prisma.workspace.findUnique({
    where: { id },
    include: {
      projects: {
        orderBy: { updatedAt: "desc" },
        select: {
          id: true,
          name: true,
          description: true,
          createdAt: true,
          updatedAt: true,
          _count: { select: { schemas: true } },
        },
      },
    },
  });
  if (!workspace || workspace.ownerId !== session.user.id) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  return Response.json({ workspace });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const csrfBlock = requireJsonContentType(request);
  if (csrfBlock) return csrfBlock;
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;

  if (!(await userOwnsWorkspace(id, session.user.id))) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  try {
    const body = await request.json();
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json({ error: "Invalid input" }, { status: 400 });
    }

    const workspace = await prisma.workspace.update({
      where: { id },
      data: parsed.data,
    });

    return Response.json({ workspace });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Update failed";
    return Response.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const csrfBlock = requireJsonContentType(request);
  if (csrfBlock) return csrfBlock;
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;

  if (!(await userOwnsWorkspace(id, session.user.id))) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.workspace.delete({ where: { id } });
  return Response.json({ ok: true });
}
