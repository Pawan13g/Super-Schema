import { NextRequest } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getSchemaIfOwned } from "@/lib/authz";

const decisionSchema = z.object({
  decision: z.enum(["approve", "reject"]),
});

async function loadReview(id: string, userId: string) {
  const review = await prisma.schemaReview.findUnique({
    where: { id },
  });
  if (!review) return null;
  const schema = await getSchemaIfOwned(review.schemaId, userId);
  if (!schema) return null;
  return { review, schema };
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
  const found = await loadReview(id, session.user.id);
  if (!found) return Response.json({ error: "Not found" }, { status: 404 });

  return Response.json({
    review: found.review,
    schema: {
      id: found.schema.id,
      name: found.schema.name,
      version: found.schema.version,
      schemaJson: found.schema.schemaJson,
    },
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
  const found = await loadReview(id, session.user.id);
  if (!found) return Response.json({ error: "Not found" }, { status: 404 });
  if (found.review.status !== "open") {
    return Response.json(
      { error: "Review is already decided" },
      { status: 400 }
    );
  }

  const parsed = decisionSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return Response.json({ error: "Invalid input" }, { status: 400 });
  }

  if (parsed.data.decision === "reject") {
    const updated = await prisma.schemaReview.update({
      where: { id },
      data: {
        status: "rejected",
        decidedAt: new Date(),
        decidedById: session.user.id,
      },
    });
    return Response.json({ review: updated });
  }

  // Approve = merge proposed schema into the live one.
  const result = await prisma.$transaction(async (tx) => {
    const review = await tx.schemaReview.update({
      where: { id },
      data: {
        status: "approved",
        decidedAt: new Date(),
        decidedById: session.user.id,
      },
    });
    const schema = await tx.schema.update({
      where: { id: review.schemaId },
      data: {
        schemaJson: review.proposedJson as Prisma.InputJsonValue,
        version: { increment: 1 },
      },
    });
    // Snapshot the new version into SchemaVersion.
    await tx.schemaVersion.upsert({
      where: {
        schemaId_version: {
          schemaId: schema.id,
          version: schema.version,
        },
      },
      create: {
        schemaId: schema.id,
        version: schema.version,
        schemaJson: review.proposedJson as Prisma.InputJsonValue,
      },
      update: {
        schemaJson: review.proposedJson as Prisma.InputJsonValue,
      },
    });
    return { review, schema };
  });

  return Response.json({ review: result.review, version: result.schema.version });
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
  const found = await loadReview(id, session.user.id);
  if (!found) return Response.json({ error: "Not found" }, { status: 404 });

  await prisma.schemaReview.delete({ where: { id } });
  return Response.json({ ok: true });
}
