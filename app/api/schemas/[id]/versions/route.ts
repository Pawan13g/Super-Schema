import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getSchemaIfOwned } from "@/lib/authz";

// GET /api/schemas/:id/versions — list all version snapshots
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

  const versions = await prisma.schemaVersion.findMany({
    where: { schemaId: id },
    orderBy: { version: "desc" },
    select: {
      id: true,
      version: true,
      createdAt: true,
      schemaJson: true,
    },
  });

  // Include table/relation counts for the listing UI
  const items = versions.map((v) => {
    const json = v.schemaJson as { tables?: unknown[]; relations?: unknown[] } | null;
    return {
      id: v.id,
      version: v.version,
      createdAt: v.createdAt,
      tableCount: json?.tables?.length ?? 0,
      relationCount: json?.relations?.length ?? 0,
    };
  });

  return Response.json({
    versions: items,
    currentVersion: owned.version,
  });
}
