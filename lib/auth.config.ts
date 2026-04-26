import type { NextAuthConfig } from "next-auth";

// Edge-safe config — no Prisma adapter, no bcrypt.
// Used by middleware. Full config (with Credentials authorize + adapter)
// lives in lib/auth.ts and runs only in Node API routes.
export const authConfig: NextAuthConfig = {
  session: { strategy: "jwt" },
  pages: {
    signIn: "/sign-in",
  },
  providers: [],
  callbacks: {
    async jwt({ token, user }) {
      if (user?.id) token.id = user.id;
      return token;
    },
    async session({ session, token }) {
      if (token?.id && session.user) {
        session.user.id = token.id as string;
      }
      return session;
    },
  },
};
