import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getSchemaIfOwned } from "@/lib/authz";

// 24-byte url-safe random token. base64url is ~32 chars, plenty of entropy.
function makeToken(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
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
  const owned = await getSchemaIfOwned(id, session.user.id);
  if (!owned) return Response.json({ error: "Not found" }, { status: 404 });

  const share = await prisma.schemaShare.findFirst({
    where: { schemaId: id, revokedAt: null },
    orderBy: { createdAt: "desc" },
  });

  return Response.json({ share });
}

export async function POST(
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

  // Reuse an active share if present so callers don't pile up tokens.
  const existing = await prisma.schemaShare.findFirst({
    where: { schemaId: id, revokedAt: null },
  });
  if (existing) return Response.json({ share: existing });

  const share = await prisma.schemaShare.create({
    data: { schemaId: id, token: makeToken() },
  });
  return Response.json({ share });
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
  const owned = await getSchemaIfOwned(id, session.user.id);
  if (!owned) return Response.json({ error: "Not found" }, { status: 404 });

  await prisma.schemaShare.updateMany({
    where: { schemaId: id, revokedAt: null },
    data: { revokedAt: new Date() },
  });

  return Response.json({ ok: true });
}
