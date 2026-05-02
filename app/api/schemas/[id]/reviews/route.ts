import { NextRequest } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getSchemaIfOwned } from "@/lib/authz";

const createSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  proposedJson: z.object({
    tables: z.array(z.unknown()),
    relations: z.array(z.unknown()),
  }),
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
  const owned = await getSchemaIfOwned(id, session.user.id);
  if (!owned) return Response.json({ error: "Not found" }, { status: 404 });

  const reviews = await prisma.schemaReview.findMany({
    where: { schemaId: id },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      title: true,
      description: true,
      authorName: true,
      baseVersion: true,
      status: true,
      decidedAt: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return Response.json({
    reviews,
    currentVersion: owned.version,
  });
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
  const owned = await getSchemaIfOwned(id, session.user.id);
  if (!owned) return Response.json({ error: "Not found" }, { status: 404 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "Invalid input" }, { status: 400 });
  }

  const review = await prisma.schemaReview.create({
    data: {
      schemaId: id,
      authorId: session.user.id,
      authorName: session.user.name ?? session.user.email ?? null,
      title: parsed.data.title,
      description: parsed.data.description ?? null,
      baseVersion: owned.version,
      proposedJson: parsed.data.proposedJson as Prisma.InputJsonValue,
    },
  });

  return Response.json({ review });
}
