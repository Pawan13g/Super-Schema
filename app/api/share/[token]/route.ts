import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";

// Public, unauthenticated read. Returns the schema JSON for a valid, non-revoked
// share token. Adds long-cache headers since the snapshot rarely changes.
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  if (!token || token.length < 16) {
    return Response.json({ error: "Invalid token" }, { status: 400 });
  }

  const share = await prisma.schemaShare.findUnique({
    where: { token },
    include: {
      schema: {
        select: {
          id: true,
          name: true,
          schemaJson: true,
          updatedAt: true,
          project: { select: { name: true } },
        },
      },
    },
  });

  if (!share || share.revokedAt) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  return Response.json(
    {
      schema: {
        name: share.schema.name,
        projectName: share.schema.project.name,
        schemaJson: share.schema.schemaJson,
        updatedAt: share.schema.updatedAt,
      },
    },
    {
      headers: {
        // Brief edge cache so a viral link doesn't hammer the DB.
        "Cache-Control": "public, max-age=60, s-maxage=60, stale-while-revalidate=300",
      },
    }
  );
}
