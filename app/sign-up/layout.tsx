import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Create a free account",
  description:
    "Free Super Schema account in 60 seconds. Visual ER diagrams, multi-dialect SQL generation, AI schema design with bring-your-own API keys, and Prisma / Sequelize model export.",
  alternates: { canonical: "/sign-up" },
  openGraph: {
    title: "Create your free Super Schema account",
    description:
      "Design databases visually with AI assistance — free for individuals.",
    url: "/sign-up",
  },
  twitter: {
    title: "Create your free Super Schema account",
    description:
      "Design databases visually with AI assistance — free for individuals.",
  },
};

const DEFAULT_DASHBOARD =
  (process.env.NEXT_PUBLIC_DEFAULT_DASHBOARD ?? "").startsWith("/")
    ? (process.env.NEXT_PUBLIC_DEFAULT_DASHBOARD as string)
    : "/projects";

export default async function SignUpLayout({
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
