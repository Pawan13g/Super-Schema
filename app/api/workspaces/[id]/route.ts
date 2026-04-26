import { NextRequest } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

const patchSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  schemaJson: z
    .object({
      tables: z.array(z.unknown()),
      relations: z.array(z.unknown()),
    })
    .optional(),
});

async function ensureOwner(workspaceId: string, userId: string) {
  const ws = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { ownerId: true },
  });
  return ws?.ownerId === userId;
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

  const workspace = await prisma.workspace.findUnique({
    where: { id },
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
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;

  if (!(await ensureOwner(id, session.user.id))) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  try {
    const body = await request.json();
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json({ error: "Invalid input" }, { status: 400 });
    }

    const data: Prisma.WorkspaceUpdateInput = {};
    if (parsed.data.name !== undefined) data.name = parsed.data.name;
    if (parsed.data.schemaJson !== undefined) {
      data.schemaJson = parsed.data.schemaJson as Prisma.InputJsonValue;
    }

    const workspace = await prisma.workspace.update({
      where: { id },
      data,
    });

    return Response.json({ workspace });
  } catch (err) {
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

  if (!(await ensureOwner(id, session.user.id))) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.workspace.delete({ where: { id } });
  return Response.json({ ok: true });
}
