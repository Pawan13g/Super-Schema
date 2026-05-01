// Centralized SEO constants. Pulled from env when set so the same build
// produces correct absolute URLs in every environment.

export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ??
  process.env.NEXTAUTH_URL?.replace(/\/$/, "") ??
  "http://localhost:3000";

export const SITE_NAME = "Super Schema";

export const SITE_TAGLINE =
  "AI-powered visual database designer";

export const SITE_DESCRIPTION =
  "Design database schemas visually on a drag-and-drop canvas. Generate PostgreSQL, MySQL, and SQLite. Bring your own AI key (Google, OpenAI, Claude, Mistral, Grok, OpenRouter, AWS Bedrock) to turn plain English into normalized schemas, run mock queries, and export Prisma or Sequelize models.";

export const SITE_KEYWORDS = [
  "database designer",
  "schema designer",
  "ER diagram",
  "entity relationship diagram",
  "SQL generator",
  "PostgreSQL schema",
  "MySQL schema",
  "SQLite schema",
  "visual database tool",
  "Prisma schema generator",
  "AI database design",
  "database modeling",
  "DDL generator",
  "schema migration",
  "data modeling tool",
  "BYOK AI",
  "OpenAI database",
  "Claude database",
  "Gemini database",
  "Mistral",
  "OpenRouter",
  "AWS Bedrock",
  "dbml alternative",
  "dbdiagram alternative",
];

export const SITE_AUTHOR = {
  name: "Super Schema",
  url: SITE_URL,
};

export const SITE_TWITTER = "@superschema";

export const SITE_LOCALE = "en_US";

export const ORGANIZATION_JSON_LD = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: SITE_NAME,
  url: SITE_URL,
  logo: `${SITE_URL}/logo.svg`,
  sameAs: [],
};

export const APPLICATION_JSON_LD = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: SITE_NAME,
  url: SITE_URL,
  description: SITE_DESCRIPTION,
  applicationCategory: "DeveloperApplication",
  operatingSystem: "Any",
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "USD",
  },
  aggregateRating: undefined as undefined,
  featureList: [
    "Visual ER diagram canvas",
    "Drag-and-drop tables and relations",
    "PostgreSQL / MySQL / SQLite SQL generation",
    "Prisma and Sequelize model generation",
    "AI-powered schema design (BYOK)",
    "In-browser mock query execution",
    "Schema linter",
    "SQL import",
  ],
};

export function pageMetadataBase() {
  return new URL(SITE_URL);
}

/**
 * Build a fully-qualified absolute URL for a path. Trims duplicate slashes.
 */
export function absoluteUrl(path = "/") {
  if (path.startsWith("http")) return path;
  return `${SITE_URL}/${path.replace(/^\//, "")}`;
}
