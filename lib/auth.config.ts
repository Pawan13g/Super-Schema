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

// Default session lifetime (30 days). Per-login overrides happen inside the
// jwt callback by setting token.exp directly.
const REMEMBER_MAX_AGE = 30 * 24 * 60 * 60;
const SESSION_MAX_AGE = 60 * 60; // 1 hour when "remember me" is unchecked

export const authConfig: NextAuthConfig = {
  session: { strategy: "jwt", maxAge: REMEMBER_MAX_AGE },
  pages: {
    signIn: "/sign-in",
  },
  providers: oauthProviders,
  callbacks: {
    async jwt({ token, user }) {
      if (user?.id) {
        token.id = user.id;
        // Credentials provider attaches `remember` to the user object —
        // honor it on first issue. OAuth users always get the long lifetime.
        const remember = (user as { remember?: boolean }).remember;
        const lifetime =
          remember === false ? SESSION_MAX_AGE : REMEMBER_MAX_AGE;
        token.exp = Math.floor(Date.now() / 1000) + lifetime;
      }
      return token;
    },
    async session({ session, token }) {
      if (token?.id && session.user) {
        session.user.id = token.id as string;
      }
      return session;
    },
    async redirect({ url, baseUrl }) {
      // Block bouncing back to the auth pages — fixes the
      // /sign-in?callbackUrl=/sign-in… loop.
      try {
        const target = new URL(url, baseUrl);
        if (target.origin !== baseUrl) return baseUrl;
        if (
          target.pathname.startsWith("/sign-in") ||
          target.pathname.startsWith("/sign-up")
        ) {
          return baseUrl;
        }
        return target.toString();
      } catch {
        return baseUrl;
      }
    },
  },
};
