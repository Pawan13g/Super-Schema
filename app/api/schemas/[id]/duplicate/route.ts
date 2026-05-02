import { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getSchemaIfOwned } from "@/lib/authz";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;

  const original = await getSchemaIfOwned(id, session.user.id);
  if (!original) return Response.json({ error: "Not found" }, { status: 404 });

  // Find the next available "(copy N)" suffix so duplicates don't collide
  // with our new unique-per-project constraint.
  const existing = await prisma.schema.findMany({
    where: { projectId: original.projectId, deletedAt: null },
    select: { name: true },
  });
  const taken = new Set(existing.map((s) => s.name));
  let candidate = `${original.name} (copy)`;
  let n = 2;
  while (taken.has(candidate)) candidate = `${original.name} (copy ${n++})`;

  try {
    const copy = await prisma.schema.create({
      data: {
        projectId: original.projectId,
        name: candidate,
        schemaJson:
          (original.schemaJson as Prisma.InputJsonValue) ?? {
            tables: [],
            relations: [],
          },
      },
    });
    return Response.json({ schema: copy });
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      return Response.json(
        { error: "Couldn't pick a unique name — try again." },
        { status: 409 }
      );
    }
    throw err;
  }
}
