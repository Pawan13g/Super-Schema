import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Super Schema — Visual Tools to Build Smarter Databases",
  description:
    "Transform ideas into scalable schemas through a visual and developer-friendly builder. AI-powered schema generation, multi-dialect SQL, and real-time collaboration.",
};

export default function LandingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
