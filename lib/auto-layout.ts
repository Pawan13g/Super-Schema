import type { Schema } from "./types";

export interface NodeMeasure {
  width: number;
  height: number;
}

export type NodeMeasureFn = (
  tableId: string,
  columnCount: number
) => NodeMeasure;

export interface LayoutOptions {
  xGap?: number;
  yGap?: number;
  componentGap?: number;
  xStart?: number;
  yStart?: number;
  measure?: NodeMeasureFn;
}

const DEFAULTS: Required<Omit<LayoutOptions, "measure">> = {
  xGap: 140,
  yGap: 50,
  componentGap: 100,
  xStart: 60,
  yStart: 60,
};

const FALLBACK_W = 240;
const FALLBACK_H = (cols: number) => 60 + Math.max(1, cols) * 30;
const VIRTUAL_PREFIX = "__v_";

/**
 * Sugiyama-style layered layout with virtual-node insertion.
 *
 * 1. Split into connected components (treat relations as undirected).
 * 2. For each component:
 *    a. Reverse back-edges so the DAG flows left-to-right.
 *    b. Longest-path layer assignment.
 *    c. Insert virtual nodes for edges spanning >1 layer (Sugiyama trick).
 *       Without this, edges from layer 0 to layer 3 would draw straight
 *       through layer 1/2 nodes; virtual placeholders reserve a row so the
 *       barycenter ordering keeps the lane clear.
 *    d. Multi-pass barycentric crossing reduction over real + virtual nodes.
 *    e. Position assignment + parent-centroid pull pass + collision sweep.
 * 3. Stack components vertically (largest first).
 * 4. Place orphan tables in a tidy grid below.
 */
export function computeAutoLayout(
  schema: Schema,
  options: LayoutOptions = {}
): Record<string, { x: number; y: number }> {
  const opts = { ...DEFAULTS, ...options };
  const measure: NodeMeasureFn =
    options.measure ??
    ((_id: string, cols: number) => ({ width: FALLBACK_W, height: FALLBACK_H(cols) }));

  if (schema.tables.length === 0) return {};

  const tableById = new Map(schema.tables.map((t) => [t.id, t]));
  const idSet = new Set(schema.tables.map((t) => t.id));

  // Build undirected adjacency (for component discovery only).
  const undirected = new Map<string, Set<string>>();
  for (const t of schema.tables) undirected.set(t.id, new Set());
  for (const r of schema.relations) {
    if (!idSet.has(r.sourceTable) || !idSet.has(r.targetTable)) continue;
    if (r.sourceTable === r.targetTable) continue;
    undirected.get(r.sourceTable)!.add(r.targetTable);
    undirected.get(r.targetTable)!.add(r.sourceTable);
  }

  // 1. Connected components (skip orphans)
  const visited = new Set<string>();
  const components: string[][] = [];
  const orphans: string[] = [];
  for (const t of schema.tables) {
    if (visited.has(t.id)) continue;
    if ((undirected.get(t.id)?.size ?? 0) === 0) {
      orphans.push(t.id);
      visited.add(t.id);
      continue;
    }
    const comp: string[] = [];
    const q = [t.id];
    visited.add(t.id);
    while (q.length) {
      const id = q.shift()!;
      comp.push(id);
      for (const n of undirected.get(id) ?? []) {
        if (!visited.has(n)) {
          visited.add(n);
          q.push(n);
        }
      }
    }
    components.push(comp);
  }
  components.sort((a, b) => b.length - a.length);

  const positions: Record<string, { x: number; y: number }> = {};
  let yOffset = opts.yStart;

  for (const comp of components) {
    const compSet = new Set(comp);

    // 2a. Build directed edges within component, breaking cycles via DFS.
    type Edge = { src: string; tgt: string };
    const compEdges: Edge[] = [];
    for (const r of schema.relations) {
      if (r.sourceTable === r.targetTable) continue;
      if (!compSet.has(r.sourceTable) || !compSet.has(r.targetTable)) continue;
      compEdges.push({ src: r.sourceTable, tgt: r.targetTable });
    }
    // Greedy cycle removal: DFS-mark; reverse any back edge encountered.
    const onStack = new Set<string>();
    const seen = new Set<string>();
    const adj = new Map<string, string[]>();
    for (const id of comp) adj.set(id, []);
    for (const e of compEdges) adj.get(e.src)!.push(e.tgt);
    const reversed = new Set<string>(); // key "src->tgt"
    const dfs = (u: string) => {
      seen.add(u);
      onStack.add(u);
      for (const v of adj.get(u) ?? []) {
        if (onStack.has(v)) {
          // back edge — mark for reversal
          reversed.add(`${u}->${v}`);
        } else if (!seen.has(v)) {
          dfs(v);
        }
      }
      onStack.delete(u);
    };
    for (const id of comp) if (!seen.has(id)) dfs(id);

    const directedEdges: Edge[] = compEdges.map((e) =>
      reversed.has(`${e.src}->${e.tgt}`) ? { src: e.tgt, tgt: e.src } : e
    );

    const incoming = new Map<string, Set<string>>();
    const outgoing = new Map<string, Set<string>>();
    for (const id of comp) {
      incoming.set(id, new Set());
      outgoing.set(id, new Set());
    }
    for (const e of directedEdges) {
      outgoing.get(e.src)!.add(e.tgt);
      incoming.get(e.tgt)!.add(e.src);
    }

    // 2b. Longest-path layer assignment.
    const layer = new Map<string, number>();
    const queue: string[] = [];
    for (const id of comp) {
      if ((incoming.get(id) ?? new Set()).size === 0) {
        layer.set(id, 0);
        queue.push(id);
      }
    }
    while (queue.length) {
      const id = queue.shift()!;
      const d = layer.get(id) ?? 0;
      for (const next of outgoing.get(id) ?? []) {
        const cur = layer.get(next);
        if (cur === undefined || cur < d + 1) {
          layer.set(next, d + 1);
          queue.push(next);
        }
      }
    }
    let maxLayer = 0;
    for (const v of layer.values()) if (v > maxLayer) maxLayer = v;
    for (const id of comp) if (!layer.has(id)) layer.set(id, maxLayer + 1);

    // 2c. Virtual node insertion for edges spanning >1 layer.
    // Each virtual node occupies a slot in an intermediate layer so the
    // barycenter pass keeps that lane clear of real nodes.
    let virtualCounter = 0;
    type ChainEdge = { from: string; to: string };
    const chainEdges: ChainEdge[] = [];
    const virtualLayer = new Map<string, number>();
    for (const e of directedEdges) {
      const ls = layer.get(e.src)!;
      const lt = layer.get(e.tgt)!;
      if (lt <= ls) {
        // Same or back layer (post-cycle-break shouldn't happen, but guard).
        chainEdges.push({ from: e.src, to: e.tgt });
        continue;
      }
      if (lt - ls === 1) {
        chainEdges.push({ from: e.src, to: e.tgt });
        continue;
      }
      // Insert chain of virtuals at layers ls+1 .. lt-1
      let prev = e.src;
      for (let l = ls + 1; l < lt; l++) {
        const vid = `${VIRTUAL_PREFIX}${virtualCounter++}`;
        virtualLayer.set(vid, l);
        chainEdges.push({ from: prev, to: vid });
        prev = vid;
      }
      chainEdges.push({ from: prev, to: e.tgt });
    }

    // Combined node set: real + virtual
    const allNodes = [...comp, ...virtualLayer.keys()];
    const allLayer = new Map<string, number>();
    for (const id of comp) allLayer.set(id, layer.get(id)!);
    for (const [vid, l] of virtualLayer) allLayer.set(vid, l);

    // Re-build incoming/outgoing on the chain graph for ordering.
    const chainIn = new Map<string, Set<string>>();
    const chainOut = new Map<string, Set<string>>();
    for (const id of allNodes) {
      chainIn.set(id, new Set());
      chainOut.set(id, new Set());
    }
    for (const e of chainEdges) {
      chainOut.get(e.from)!.add(e.to);
      chainIn.get(e.to)!.add(e.from);
    }

    // Group by layer
    const layers = new Map<number, string[]>();
    for (const id of allNodes) {
      const l = allLayer.get(id) ?? 0;
      if (!layers.has(l)) layers.set(l, []);
      layers.get(l)!.push(id);
    }
    const sortedLayerKeys = Array.from(layers.keys()).sort((a, b) => a - b);

    // 2d. Crossing reduction (4 forward + 4 backward passes).
    const positionInLayer = (ids: string[]) => {
      const m = new Map<string, number>();
      ids.forEach((id, i) => m.set(id, i));
      return m;
    };
    for (let pass = 0; pass < 4; pass++) {
      for (let li = 1; li < sortedLayerKeys.length; li++) {
        const prev = layers.get(sortedLayerKeys[li - 1])!;
        const curr = layers.get(sortedLayerKeys[li])!;
        const prevPos = positionInLayer(prev);
        const bary = new Map<string, number>();
        for (const id of curr) {
          const parents = chainIn.get(id) ?? new Set();
          let sum = 0;
          let count = 0;
          for (const p of parents) {
            const pos = prevPos.get(p);
            if (pos !== undefined) {
              sum += pos;
              count++;
            }
          }
          bary.set(id, count > 0 ? sum / count : Infinity);
        }
        curr.sort((a, b) => (bary.get(a) ?? Infinity) - (bary.get(b) ?? Infinity));
      }
      for (let li = sortedLayerKeys.length - 2; li >= 0; li--) {
        const next = layers.get(sortedLayerKeys[li + 1])!;
        const curr = layers.get(sortedLayerKeys[li])!;
        const nextPos = positionInLayer(next);
        const bary = new Map<string, number>();
        for (const id of curr) {
          const children = chainOut.get(id) ?? new Set();
          let sum = 0;
          let count = 0;
          for (const c of children) {
            const pos = nextPos.get(c);
            if (pos !== undefined) {
              sum += pos;
              count++;
            }
          }
          bary.set(id, count > 0 ? sum / count : Infinity);
        }
        curr.sort((a, b) => (bary.get(a) ?? Infinity) - (bary.get(b) ?? Infinity));
      }
    }

    // 3. Position assignment.
    const VIRTUAL_H = 24; // small placeholder so virtuals don't dominate spacing
    const sizes = new Map<string, NodeMeasure>();
    for (const id of allNodes) {
      if (id.startsWith(VIRTUAL_PREFIX)) {
        sizes.set(id, { width: 0, height: VIRTUAL_H });
      } else {
        const t = tableById.get(id);
        sizes.set(id, measure(id, t?.columns.length ?? 1));
      }
    }
    // Per-layer column width — only real nodes contribute.
    const colWidths = new Map<number, number>();
    for (const l of sortedLayerKeys) {
      let maxW = 0;
      for (const id of layers.get(l)!) {
        if (id.startsWith(VIRTUAL_PREFIX)) continue;
        const w = sizes.get(id)!.width;
        if (w > maxW) maxW = w;
      }
      colWidths.set(l, maxW > 0 ? maxW : FALLBACK_W);
    }
    // Per-layer total height for centering.
    const layerHeights = new Map<number, number>();
    for (const l of sortedLayerKeys) {
      const ids = layers.get(l)!;
      let total = 0;
      for (const id of ids) total += sizes.get(id)!.height;
      total += Math.max(0, ids.length - 1) * opts.yGap;
      layerHeights.set(l, total);
    }
    const compMaxH = Math.max(...layerHeights.values(), 0);

    // First pass — center each layer.
    const yPos = new Map<string, number>();
    for (const l of sortedLayerKeys) {
      const ids = layers.get(l)!;
      const totalH = layerHeights.get(l) ?? 0;
      let y = yOffset + (compMaxH - totalH) / 2;
      for (const id of ids) {
        const h = sizes.get(id)!.height;
        yPos.set(id, y);
        y += h + opts.yGap;
      }
    }

    // 3b. Pull each non-source layer toward parent centroid + collision sweep.
    for (let pass = 0; pass < 3; pass++) {
      for (let li = 1; li < sortedLayerKeys.length; li++) {
        const ids = layers.get(sortedLayerKeys[li])!;
        const desired = new Map<string, number>();
        for (const id of ids) {
          const parents = chainIn.get(id) ?? new Set();
          let sum = 0;
          let count = 0;
          for (const p of parents) {
            const py = yPos.get(p);
            if (py === undefined) continue;
            sum += py + sizes.get(p)!.height / 2;
            count++;
          }
          if (count > 0) {
            desired.set(id, sum / count - sizes.get(id)!.height / 2);
          } else {
            desired.set(id, yPos.get(id) ?? yOffset);
          }
        }
        const sorted = [...ids].sort(
          (a, b) => (desired.get(a) ?? 0) - (desired.get(b) ?? 0)
        );
        let cursor = yOffset;
        for (const id of sorted) {
          const want = desired.get(id) ?? yOffset;
          const y = Math.max(cursor, want);
          yPos.set(id, y);
          cursor = y + sizes.get(id)!.height + opts.yGap;
        }
      }
      // Mirror pass: from right to left, pull toward children centroid.
      for (let li = sortedLayerKeys.length - 2; li >= 0; li--) {
        const ids = layers.get(sortedLayerKeys[li])!;
        const desired = new Map<string, number>();
        for (const id of ids) {
          const children = chainOut.get(id) ?? new Set();
          let sum = 0;
          let count = 0;
          for (const c of children) {
            const cy = yPos.get(c);
            if (cy === undefined) continue;
            sum += cy + sizes.get(c)!.height / 2;
            count++;
          }
          if (count > 0) {
            desired.set(id, sum / count - sizes.get(id)!.height / 2);
          } else {
            desired.set(id, yPos.get(id) ?? yOffset);
          }
        }
        const sorted = [...ids].sort(
          (a, b) => (desired.get(a) ?? 0) - (desired.get(b) ?? 0)
        );
        let cursor = yOffset;
        for (const id of sorted) {
          const want = desired.get(id) ?? yOffset;
          const y = Math.max(cursor, want);
          yPos.set(id, y);
          cursor = y + sizes.get(id)!.height + opts.yGap;
        }
      }
    }

    // Write final positions for real nodes only.
    let cx = opts.xStart;
    for (const l of sortedLayerKeys) {
      const ids = layers.get(l)!;
      for (const id of ids) {
        if (id.startsWith(VIRTUAL_PREFIX)) continue;
        positions[id] = { x: cx, y: yPos.get(id) ?? yOffset };
      }
      const colW = colWidths.get(l) ?? FALLBACK_W;
      cx += colW + opts.xGap;
    }

    // Advance yOffset for next component.
    let compH = 0;
    for (const id of comp) {
      const y = (yPos.get(id) ?? yOffset) + sizes.get(id)!.height;
      if (y - yOffset > compH) compH = y - yOffset;
    }
    yOffset += compH + opts.componentGap;
  }

  // 4. Orphan tables in a grid below.
  if (orphans.length > 0) {
    const cols = Math.max(1, Math.ceil(Math.sqrt(orphans.length)));
    let ox = opts.xStart;
    let oy = yOffset;
    let rowMaxH = 0;
    orphans.forEach((id, i) => {
      const t = tableById.get(id);
      const { width, height } = measure(id, t?.columns.length ?? 1);
      positions[id] = { x: ox, y: oy };
      rowMaxH = Math.max(rowMaxH, height);
      if ((i + 1) % cols === 0) {
        ox = opts.xStart;
        oy += rowMaxH + opts.yGap;
        rowMaxH = 0;
      } else {
        ox += width + opts.xGap;
      }
    });
  }

  return positions;
}
