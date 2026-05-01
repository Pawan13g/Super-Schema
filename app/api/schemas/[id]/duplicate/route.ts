import { NextRequest } from "next/server";
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

  const copy = await prisma.schema.create({
    data: {
      projectId: original.projectId,
      name: `${original.name} (copy)`,
      schemaJson: original.schemaJson ?? { tables: [], relations: [] },
    },
  });

  return Response.json({ schema: copy });
}
