// Twitter Card image. Same content as the OG image — Twitter handles the
// 1200x630 size as a "summary_large_image" card.
import { ImageResponse } from "next/og";
import { SITE_NAME, SITE_TAGLINE } from "@/lib/seo";

export const runtime = "edge";
export const alt = `${SITE_NAME} — ${SITE_TAGLINE}`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function TwitterImage() {
  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-start",
          justifyContent: "space-between",
          padding: "70px 80px",
          background:
            "linear-gradient(135deg, #1e1b4b 0%, #312e81 45%, #4c1d95 100%)",
          color: "white",
          fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <svg width="64" height="64" viewBox="0 0 120 120" fill="none">
            <rect x="10" y="50" width="12" height="55" rx="6" fill="#a78bfa" />
            <rect x="30" y="30" width="12" height="75" rx="6" fill="#8b5cf6" />
            <rect x="50" y="15" width="12" height="90" rx="6" fill="#7c3aed" />
            <rect x="70" y="35" width="12" height="70" rx="6" fill="#8b5cf6" />
            <rect x="90" y="55" width="12" height="50" rx="6" fill="#a78bfa" />
          </svg>
          <span style={{ fontSize: 36, fontWeight: 700, letterSpacing: -0.5 }}>
            {SITE_NAME}
          </span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <h1
            style={{
              fontSize: 84,
              fontWeight: 800,
              letterSpacing: -2,
              lineHeight: 1.05,
              margin: 0,
              maxWidth: 1000,
            }}
          >
            Design databases visually, ship schemas faster.
          </h1>
          <p style={{ fontSize: 28, color: "#c4b5fd", margin: 0, maxWidth: 900 }}>
            AI-powered ER diagrams · PostgreSQL · MySQL · SQLite · Prisma · Sequelize
          </p>
        </div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            width: "100%",
            alignItems: "center",
            color: "#a78bfa",
            fontSize: 22,
            fontWeight: 500,
          }}
        >
          <span>Bring your own AI key — Google · OpenAI · Claude · Mistral · Bedrock</span>
        </div>
      </div>
    ),
    { ...size }
  );
}
