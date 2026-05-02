import { toPng } from "html-to-image";

export async function exportCanvasPng() {
  const viewport = document.querySelector<HTMLElement>(".react-flow__viewport");
  if (!viewport) return;

  const dataUrl = await toPng(viewport, {
    backgroundColor: "transparent",
    quality: 1,
  });

  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = "schema-canvas.png";
  a.click();
}

// Returns the canvas as a PNG byte array — used by bulk export to embed in
// the ZIP. Returns null when the canvas isn't mounted.
export async function getCanvasPngBytes(): Promise<Uint8Array | null> {
  const viewport = document.querySelector<HTMLElement>(".react-flow__viewport");
  if (!viewport) return null;
  const dataUrl = await toPng(viewport, {
    backgroundColor: "transparent",
    quality: 1,
  });
  // dataUrl: "data:image/png;base64,<b64>"
  const comma = dataUrl.indexOf(",");
  if (comma < 0) return null;
  const b64 = dataUrl.slice(comma + 1);
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
