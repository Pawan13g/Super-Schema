import type { Metadata } from "next";

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

export default function SignInLayout({ children }: { children: React.ReactNode }) {
  return children;
}
