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
  remember: z.enum(["0", "1"]).optional(),
});

// Race-safe seed: createUser + linkAccount events can fire back-to-back
// during the same OAuth flow. The advisory lock serializes seeds per user.
async function seedUserDefaults(userId: string) {
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
      id: "credentials",
      name: "Email and password",
      credentials: {
        email: {
          label: "Email",
          type: "email",
          placeholder: "you@example.com",
        },
        password: { label: "Password", type: "password" },
        remember: { label: "Remember me", type: "text" },
      },
      async authorize(creds) {
        const parsed = credentialsSchema.safeParse(creds);
        if (!parsed.success) throw new Error("MissingCredentials");

        const email = parsed.data.email.trim().toLowerCase();

        let user;
        try {
          user = await prisma.user.findUnique({
            where: { email },
            select: {
              id: true,
              email: true,
              name: true,
              image: true,
              passwordHash: true,
            },
          });
        } catch (err) {
          console.error("[auth] DB error during sign-in:", err);
          throw new Error("DatabaseUnavailable");
        }

        if (!user) throw new Error("UserNotFound");
        if (!user.passwordHash) throw new Error("OAuthOnlyAccount");

        const valid = await bcrypt.compare(parsed.data.password, user.passwordHash);
        if (!valid) throw new Error("InvalidPassword");

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
        } catch {}
      }
    },
    async linkAccount({ user }) {
      if (user.id) {
        try {
          await seedUserDefaults(user.id);
        } catch {}
      }
    },
    // Fill blanks on User row from the OAuth profile. Never overwrites
    // values the user has manually edited in Settings.
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
      } catch {}
    },
  },
});
