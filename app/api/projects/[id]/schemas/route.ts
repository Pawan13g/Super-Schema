import { NextRequest } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getProjectIfOwned } from "@/lib/authz";

const createSchema = z.object({
  name: z.string().min(1).max(100),
  schemaJson: z
    .object({
      tables: z.array(z.unknown()),
      relations: z.array(z.unknown()),
    })
    .optional(),
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

  const owned = await getProjectIfOwned(id, session.user.id);
  if (!owned) return Response.json({ error: "Not found" }, { status: 404 });

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

  return Response.json({ schemas });
}

export async function POST(
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
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json({ error: "Invalid input" }, { status: 400 });
    }

    const schema = await prisma.schema.create({
      data: {
        projectId: id,
        name: parsed.data.name,
        schemaJson: (parsed.data.schemaJson ?? {
          tables: [],
          relations: [],
        }) as Prisma.InputJsonValue,
      },
    });

    return Response.json({ schema });
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      return Response.json(
        {
          error:
            "A schema with that name already exists in this project. Pick a different name.",
          code: "DUPLICATE_NAME",
        },
        { status: 409 }
      );
    }
    const message = err instanceof Error ? err.message : "Create failed";
    return Response.json({ error: message }, { status: 500 });
  }
}
