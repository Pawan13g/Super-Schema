import { toPng } from "html-to-image";

// Selectors for floating UI that may overlap the canvas at snapshot time.
// We hide these during the toPng() call and restore them after, so the
// exported PNG shows only the schema and not whatever toolbar / context
// menu / status pill happened to be open when the user clicked Export.
//
// `.react-flow__controls`, `.react-flow__minimap`, and `.react-flow__panel`
// already live OUTSIDE `.react-flow__viewport`, so capturing the viewport
// excludes them automatically — but a user-rendered tooltip / context
// menu portaled into the viewport itself would survive. Belt-and-braces.
const OVERLAY_SELECTORS = [
  ".react-flow__controls",
  ".react-flow__minimap",
  ".react-flow__panel",
  "[data-canvas-overlay]",
  "[data-radix-popper-content-wrapper]", // Radix tooltips/popovers
] as const;

async function captureViewportPng(): Promise<string | null> {
  const viewport = document.querySelector<HTMLElement>(".react-flow__viewport");
  if (!viewport) return null;

  // Snapshot the previous inline `visibility` so we don't permanently hide
  // anything if the user had set it manually.
  const hidden: Array<{ el: HTMLElement; prev: string }> = [];
  for (const sel of OVERLAY_SELECTORS) {
    document.querySelectorAll<HTMLElement>(sel).forEach((el) => {
      hidden.push({ el, prev: el.style.visibility });
      el.style.visibility = "hidden";
    });
  }

  try {
    return await toPng(viewport, {
      backgroundColor: "transparent",
      quality: 1,
      // Defence-in-depth: also reject any node that's a known overlay if
      // the visibility hack gets bypassed by display:contents children.
      filter: (node) => {
        if (!(node instanceof HTMLElement)) return true;
        for (const sel of OVERLAY_SELECTORS) {
          if (node.matches(sel)) return false;
        }
        return true;
      },
    });
  } finally {
    for (const { el, prev } of hidden) {
      el.style.visibility = prev;
    }
  }
}

export async function exportCanvasPng() {
  const dataUrl = await captureViewportPng();
  if (!dataUrl) return;
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = "schema-canvas.png";
  a.click();
}

// Returns the canvas as a PNG byte array — used by bulk export to embed in
// the ZIP. Returns null when the canvas isn't mounted.
export async function getCanvasPngBytes(): Promise<Uint8Array | null> {
  const dataUrl = await captureViewportPng();
  if (!dataUrl) return null;
  // dataUrl: "data:image/png;base64,<b64>"
  const comma = dataUrl.indexOf(",");
  if (comma < 0) return null;
  const b64 = dataUrl.slice(comma + 1);
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
