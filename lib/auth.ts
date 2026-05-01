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
  // "1" = persistent (30 days), "0" = transient session (1 hour).
  remember: z.enum(["0", "1"]).optional(),
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
        remember: { label: "Remember me", type: "text" },
      },
      async authorize(creds) {
        const parsed = credentialsSchema.safeParse(creds);
        if (!parsed.success) return null;
        const { password, remember } = parsed.data;
        // Email lookup is case-insensitive — sign-up stores lowercased.
        const email = parsed.data.email.trim().toLowerCase();

        const user = await prisma.user.findUnique({ where: { email } });
        if (!user?.passwordHash) return null;

        const valid = await bcrypt.compare(password, user.passwordHash);
        if (!valid) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
          // Smuggled through to the jwt callback — sets per-session expiry.
          remember: remember !== "0",
        } as never;
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
    // Refresh the user row's name/image from the OAuth profile on each
    // sign-in. We only fill blanks — never clobber a value the user has
    // manually edited in Settings.
    async signIn({ user, account, profile }) {
      if (!user?.id || !account || account.provider === "credentials") return;
      const providerName =
        (profile as { name?: string } | undefined)?.name ?? user.name;
      const providerImage =
        (profile as { picture?: string; avatar_url?: string } | undefined)
          ?.picture ??
        (profile as { avatar_url?: string } | undefined)?.avatar_url ??
        user.image;
      if (!providerName && !providerImage) return;

      try {
        const existing = await prisma.user.findUnique({
          where: { id: user.id },
          select: { name: true, image: true },
        });
        const data: { name?: string; image?: string } = {};
        if (providerName && !existing?.name) data.name = providerName;
        if (providerImage && !existing?.image) data.image = providerImage;
        if (Object.keys(data).length > 0) {
          await prisma.user.update({ where: { id: user.id }, data });
        }
      } catch {
        // non-fatal — login continues without profile sync
      }
    },
  },
});
