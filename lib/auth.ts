import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "./db";
import { authConfig } from "./auth.config";

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

async function seedUserDefaults(userId: string) {
  // Race-safe seed: NextAuth's createUser + linkAccount events can fire
  // back-to-back during the same OAuth flow. A naive count+create lets two
  // concurrent transactions both seed and produce duplicate workspaces.
  // Hash the user id into a Postgres advisory lock to serialize seeds per
  // user; readers without the lock just wait their turn inside the txn.
  await prisma.$transaction(async (tx) => {
    await tx.$queryRawUnsafe(
      `SELECT pg_advisory_xact_lock(hashtextextended($1, 0))`,
      `seed:${userId}`
    );
    const count = await tx.workspace.count({ where: { ownerId: userId } });
    if (count > 0) return;
    const ws = await tx.workspace.create({
      data: { ownerId: userId, name: "My Workspace" },
    });
    const proj = await tx.project.create({
      data: { workspaceId: ws.id, name: "Default Project" },
    });
    await tx.schema.create({
      data: {
        projectId: proj.id,
        name: "Main Schema",
        schemaJson: { tables: [], relations: [] },
      },
    });
  });
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  adapter: PrismaAdapter(prisma),
  providers: [
    ...(authConfig.providers ?? []),
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(creds) {
        const parsed = credentialsSchema.safeParse(creds);
        if (!parsed.success) return null;
        const { email, password } = parsed.data;

        const user = await prisma.user.findUnique({ where: { email } });
        if (!user?.passwordHash) return null;

        const valid = await bcrypt.compare(password, user.passwordHash);
        if (!valid) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
        };
      },
    }),
  ],
  events: {
    async createUser({ user }) {
      if (user.id) {
        try {
          await seedUserDefaults(user.id);
        } catch {
          // best-effort seed; user can create defaults manually
        }
      }
    },
    async linkAccount({ user }) {
      if (user.id) {
        try {
          await seedUserDefaults(user.id);
        } catch {}
      }
    },
  },
});
