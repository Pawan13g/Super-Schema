import type { Metadata } from "next";
import { SITE_URL } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Documentation",
  description:
    "Super Schema documentation — visual canvas guide, BYOK AI setup (Google Gemini, OpenAI, Claude, Mistral, Grok, OpenRouter, AWS Bedrock), SQL dialect support, ORM model generation, schema linting, OAuth setup, and self-hosting.",
  alternates: { canonical: "/docs" },
  keywords: [
    "Super Schema docs",
    "database designer documentation",
    "ER diagram tutorial",
    "BYOK AI setup",
    "Prisma schema export",
    "self-host database designer",
  ],
  openGraph: {
    title: "Super Schema · Documentation",
    description:
      "Everything you need to design schemas visually, configure AI, and export production SQL.",
    url: "/docs",
    type: "article",
  },
  twitter: {
    title: "Super Schema · Documentation",
    description:
      "Visual canvas, multi-dialect SQL, BYOK AI, ORM model export.",
  },
};

const breadcrumbJsonLd = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    {
      "@type": "ListItem",
      position: 1,
      name: "Home",
      item: SITE_URL,
    },
    {
      "@type": "ListItem",
      position: 2,
      name: "Documentation",
      item: `${SITE_URL}/docs`,
    },
  ],
};

const articleJsonLd = {
  "@context": "https://schema.org",
  "@type": "TechArticle",
  headline: "Super Schema Documentation",
  description: metadata.description,
  author: { "@type": "Organization", name: "Super Schema" },
  publisher: { "@type": "Organization", name: "Super Schema" },
  mainEntityOfPage: `${SITE_URL}/docs`,
};

export default function DocsLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd) }}
      />
      {children}
    </>
  );
}
