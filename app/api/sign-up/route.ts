import { NextRequest } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";

const bodySchema = z.object({
  name: z.string().min(1).max(100),
  email: z.email(),
  password: z.string().min(8).max(128),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      return Response.json(
        { error: "Invalid input. Email and 8+ char password required." },
        { status: 400 }
      );
    }
    const { name, email, password } = parsed.data;

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return Response.json(
        { error: "An account with that email already exists." },
        { status: 409 }
      );
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: { name, email, passwordHash },
      select: { id: true, email: true, name: true },
    });

    // Seed the initial workspace/project/schema explicitly to avoid nested
    // write edge cases during sign-up.
    await prisma.$transaction(async (tx) => {
      const workspace = await tx.workspace.create({
        data: {
          ownerId: user.id,
          name: "My Workspace",
        },
      });

      const project = await tx.project.create({
        data: {
          workspaceId: workspace.id,
          name: "Default Project",
          description: null,
        },
      });

      await tx.schema.create({
        data: {
          projectId: project.id,
          name: "Main Schema",
          schemaJson: { tables: [], relations: [] },
        },
      });
    });

    return Response.json({ user });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Sign-up failed";
    return Response.json({ error: message }, { status: 500 });
  }
}
