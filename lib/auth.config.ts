import type { NextAuthConfig } from "next-auth";
import type { Provider } from "next-auth/providers";
import Google from "next-auth/providers/google";
import GitHub from "next-auth/providers/github";
import MicrosoftEntraID from "next-auth/providers/microsoft-entra-id";

// OAuth providers are edge-safe; Credentials provider lives in lib/auth.ts.
// Each registers only when its env vars are present so the app keeps working
// without OAuth configured.
const oauthProviders: Provider[] = [];

if (process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET) {
  oauthProviders.push(
    Google({
      clientId: process.env.AUTH_GOOGLE_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET,
      // Account linking by email disabled — prevents an attacker who controls
      // a victim's email DNS from auto-binding an OAuth account to their record.
      // Users link providers manually post-signin (UI TBD).
      allowDangerousEmailAccountLinking: false,
    })
  );
}

if (process.env.AUTH_GITHUB_ID && process.env.AUTH_GITHUB_SECRET) {
  oauthProviders.push(
    GitHub({
      clientId: process.env.AUTH_GITHUB_ID,
      clientSecret: process.env.AUTH_GITHUB_SECRET,
      // Account linking by email disabled — prevents an attacker who controls
      // a victim's email DNS from auto-binding an OAuth account to their record.
      // Users link providers manually post-signin (UI TBD).
      allowDangerousEmailAccountLinking: false,
    })
  );
}

if (process.env.AUTH_MICROSOFT_ID && process.env.AUTH_MICROSOFT_SECRET) {
  // Default to "common" so single- and multi-tenant Azure app registrations
  // both work out of the box. Override with AUTH_MICROSOFT_TENANT.
  const msTenant = process.env.AUTH_MICROSOFT_TENANT ?? "common";
  oauthProviders.push(
    MicrosoftEntraID({
      clientId: process.env.AUTH_MICROSOFT_ID,
      clientSecret: process.env.AUTH_MICROSOFT_SECRET,
      issuer: `https://login.microsoftonline.com/${msTenant}/v2.0`,
      // Account linking by email disabled — prevents an attacker who controls
      // a victim's email DNS from auto-binding an OAuth account to their record.
      // Users link providers manually post-signin (UI TBD).
      allowDangerousEmailAccountLinking: false,
    })
  );
}

export const enabledOAuthProviders = {
  google: !!(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET),
  github: !!(process.env.AUTH_GITHUB_ID && process.env.AUTH_GITHUB_SECRET),
  microsoft: !!(
    process.env.AUTH_MICROSOFT_ID && process.env.AUTH_MICROSOFT_SECRET
  ),
};

export const authConfig: NextAuthConfig = {
  session: { strategy: "jwt" },
  pages: {
    signIn: "/sign-in",
  },
  providers: oauthProviders,
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
