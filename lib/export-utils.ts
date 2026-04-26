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
