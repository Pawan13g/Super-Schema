import type { NextAuthConfig } from "next-auth";
import type { Provider } from "next-auth/providers";
import Google from "next-auth/providers/google";
import GitHub from "next-auth/providers/github";
import MicrosoftEntraID from "next-auth/providers/microsoft-entra-id";

const oauthProviders: Provider[] = [];

if (process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET) {
  oauthProviders.push(
    Google({
      clientId: process.env.AUTH_GOOGLE_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET,
      allowDangerousEmailAccountLinking: false,
    })
  );
}

if (process.env.AUTH_GITHUB_ID && process.env.AUTH_GITHUB_SECRET) {
  oauthProviders.push(
    GitHub({
      clientId: process.env.AUTH_GITHUB_ID,
      clientSecret: process.env.AUTH_GITHUB_SECRET,
      allowDangerousEmailAccountLinking: false,
    })
  );
}

if (process.env.AUTH_MICROSOFT_ID && process.env.AUTH_MICROSOFT_SECRET) {
  const msTenant = process.env.AUTH_MICROSOFT_TENANT ?? "common";
  oauthProviders.push(
    MicrosoftEntraID({
      clientId: process.env.AUTH_MICROSOFT_ID,
      clientSecret: process.env.AUTH_MICROSOFT_SECRET,
      issuer: `https://login.microsoftonline.com/${msTenant}/v2.0`,
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

const REMEMBER_MAX_AGE = 30 * 24 * 60 * 60;

const useSecureCookies =
  process.env.NEXTAUTH_URL?.startsWith("https://") ||
  process.env.AUTH_URL?.startsWith("https://") ||
  process.env.VERCEL === "1" ||
  process.env.VERCEL_ENV === "production" ||
  process.env.VERCEL_ENV === "preview" ||
  process.env.NODE_ENV === "production";

const cookiePrefix = useSecureCookies ? "__Secure-" : "";
const hostCookiePrefix = useSecureCookies ? "__Host-" : "";

export const authConfig: NextAuthConfig = {
  session: { strategy: "jwt", maxAge: REMEMBER_MAX_AGE },
  trustHost: true,
  // Pin cookie names so the route handler and edge middleware never disagree.
  cookies: {
    sessionToken: {
      name: `${cookiePrefix}authjs.session-token`,
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: useSecureCookies,
      },
    },
    callbackUrl: {
      name: `${cookiePrefix}authjs.callback-url`,
      options: {
        sameSite: "lax",
        path: "/",
        secure: useSecureCookies,
      },
    },
    csrfToken: {
      name: `${hostCookiePrefix}authjs.csrf-token`,
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: useSecureCookies,
      },
    },
  },
  pages: {
    signIn: "/sign-in",
  },
  providers: oauthProviders,
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      if (user?.id) {
        token.id = user.id;
        if (user.name) token.name = user.name;
        if (user.email) token.email = user.email;
        if (user.image) token.picture = user.image;
        token.exp = Math.floor(Date.now() / 1000) + REMEMBER_MAX_AGE;
      }
      // Client-driven profile updates via `useSession().update({...})`.
      if (trigger === "update" && session) {
        const u = (session as { user?: { name?: string; image?: string } })
          .user;
        if (u?.name) token.name = u.name;
        if (u?.image) token.picture = u.image;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        if (token?.id) session.user.id = token.id as string;
        if (typeof token?.picture === "string")
          session.user.image = token.picture;
        if (typeof token?.name === "string") session.user.name = token.name;
        if (typeof token?.email === "string") session.user.email = token.email;
      }
      return session;
    },
    async redirect({ url, baseUrl }) {
      try {
        const target = new URL(url, baseUrl);
        // Block off-origin redirects.
        if (target.origin !== baseUrl) return baseUrl;
        // Honor explicit /sign-in callbackUrl (used by signOut). Earlier this
        // path was rewritten to baseUrl, which middleware then bounced to
        // /landing — sending logged-out users to the marketing page instead
        // of the login form.
        return target.toString();
      } catch {
        return baseUrl;
      }
    },
  },
};
