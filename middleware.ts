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
];

const PUBLIC_REDIRECT_PATHS = ["/sign-in", "/sign-up"];

export default auth((req) => {
  const { pathname } = req.nextUrl;

  if (
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/_next") ||
    pathname === "/favicon.ico" ||
    /\.(?:wasm|svg|png|jpg|jpeg|gif|webp|ico|woff2?|ttf|otf|map)$/i.test(pathname)
  ) {
    return NextResponse.next();
  }

  const isPublic = PUBLIC_PATHS.some((p) => pathname.startsWith(p));
  const isLoggedIn = !!req.auth;
  if (!isLoggedIn && !isPublic) {
    const url = new URL("/sign-in", req.url);
    url.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(url);
  }

  const isAuthRoute = PUBLIC_REDIRECT_PATHS.some((p) => pathname.startsWith(p));
  if (isLoggedIn && isAuthRoute) {
    return NextResponse.redirect(new URL("/", req.url));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
