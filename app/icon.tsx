import { ImageResponse } from "next/og";

export const runtime = "edge";
export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          background: "linear-gradient(135deg, #7c3aed 0%, #4c1d95 100%)",
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          borderRadius: 6,
        }}
      >
        <svg width="22" height="22" viewBox="0 0 120 120" fill="none">
          <rect x="10" y="50" width="12" height="55" rx="6" fill="#ddd6fe" />
          <rect x="30" y="30" width="12" height="75" rx="6" fill="#c4b5fd" />
          <rect x="50" y="15" width="12" height="90" rx="6" fill="#ffffff" />
          <rect x="70" y="35" width="12" height="70" rx="6" fill="#c4b5fd" />
          <rect x="90" y="55" width="12" height="50" rx="6" fill="#ddd6fe" />
        </svg>
      </div>
    ),
    { ...size }
  );
}
