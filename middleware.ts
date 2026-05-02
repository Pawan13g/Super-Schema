import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { authConfig } from "@/lib/auth.config";

const { auth } = NextAuth(authConfig);

const PUBLIC_PATHS = [
  "/sign-in",
  "/sign-up",
  "/api/sign-in",
  "/api/sign-up",
  "/terms",
  "/privacy",
  "/landing",
  "/docs",
];

const PUBLIC_REDIRECT_PATHS = ["/sign-in", "/sign-up"];

export default auth((req) => {
  const { pathname } = req.nextUrl;

  if (
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/api/health") ||
    pathname.startsWith("/_next") ||
    pathname === "/favicon.ico" ||
    pathname === "/sw.js" ||
    pathname === "/manifest.webmanifest" ||
    pathname === "/robots.txt" ||
    pathname === "/sitemap.xml" ||
    pathname === "/opengraph-image" ||
    pathname === "/twitter-image" ||
    pathname === "/icon" ||
    pathname === "/apple-icon" ||
    pathname.startsWith("/.well-known/") ||
    /\.(?:wasm|svg|png|jpg|jpeg|gif|webp|ico|woff2?|ttf|otf|map)$/i.test(pathname)
  ) {
    return NextResponse.next();
  }

  const isPublic = PUBLIC_PATHS.some((p) => pathname.startsWith(p));
  const isLoggedIn = !!req.auth;

  if (!isLoggedIn && !isPublic) {
    // Root path → show landing page; other protected routes → sign-in
    if (pathname === "/") {
      return NextResponse.redirect(new URL("/landing", req.url));
    }
    const url = new URL("/sign-in", req.url);
    url.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(url);
  }

  const isAuthRoute = PUBLIC_REDIRECT_PATHS.some((p) => pathname.startsWith(p));
  if (isLoggedIn && isAuthRoute) {
    const dashboard =
      (process.env.NEXT_PUBLIC_DEFAULT_DASHBOARD ?? "").startsWith("/")
        ? (process.env.NEXT_PUBLIC_DEFAULT_DASHBOARD as string)
        : "/projects";
    return NextResponse.redirect(new URL(dashboard, req.url));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
