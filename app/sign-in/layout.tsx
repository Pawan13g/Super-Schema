import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Sign in",
  description:
    "Sign in to Super Schema — design databases visually, generate SQL for PostgreSQL, MySQL, and SQLite, and use AI to turn descriptions into schemas.",
  alternates: { canonical: "/sign-in" },
  openGraph: {
    title: "Sign in · Super Schema",
    description:
      "Sign in to your Super Schema workspace and continue designing.",
    url: "/sign-in",
  },
  twitter: {
    title: "Sign in · Super Schema",
    description:
      "Sign in to your Super Schema workspace and continue designing.",
  },
};

const DEFAULT_DASHBOARD =
  (process.env.NEXT_PUBLIC_DEFAULT_DASHBOARD ?? "").startsWith("/")
    ? (process.env.NEXT_PUBLIC_DEFAULT_DASHBOARD as string)
    : "/projects";

// Server-side guard: if the user already has a valid session, skip the
// sign-in form and route straight to the dashboard. Backstops the edge
// middleware in case it can't read the cookie for any reason — eliminates
// the "logged in but stuck on /sign-in" symptom.
export default async function SignInLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (session?.user) {
    redirect(DEFAULT_DASHBOARD);
  }
  return children;
}
