import { NextRequest } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

const createSchema = z.object({
  name: z.string().min(1).max(100),
  schemaJson: z
    .object({
      tables: z.array(z.unknown()),
      relations: z.array(z.unknown()),
    })
    .optional(),
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

    const workspace = await prisma.workspace.create({
      data: {
        ownerId: session.user.id,
        name: parsed.data.name,
        schemaJson: (parsed.data.schemaJson ?? {
          tables: [],
          relations: [],
        }) as Prisma.InputJsonValue,
      },
    });

    return Response.json({ workspace });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Create failed";
    return Response.json({ error: message }, { status: 500 });
  }
}
