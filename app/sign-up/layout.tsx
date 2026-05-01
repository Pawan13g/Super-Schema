import type { Metadata } from "next";

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

export default function SignUpLayout({ children }: { children: React.ReactNode }) {
  return children;
}
