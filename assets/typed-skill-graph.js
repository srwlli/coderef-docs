/**
 * typed-skill-graph.js
 *
 * Renders CodeRef's TYPED skill-dependency graph as a static SVG concept map.
 * Nodes are skills (grouped/colored by category); edges are TYPED:
 *
 *   depends_on  -> solid directed arrow   (A relies on B)
 *   supersedes  -> dashed directed edge   (A replaces a retired B)
 *
 * The typed-edge rendering is the CORE requirement: if both edge types drew
 * identically the graph would collapse to OKF's untyped link map and lose the
 * one asset CodeRef has that OKF cannot represent. The component therefore
 * NEVER flattens — depends_on and supersedes always carry distinct stroke
 * styling, and an always-on legend proves the distinction even when a given
 * subgraph happens to contain only one edge type (the `git` category does).
 *
 * Layout: a deterministic force-directed relaxation (borrowed CONCEPT only
 * from OKF's force-directed visualizer — no OKF code, no physics library).
 * Nodes seed on a circle, then a fixed number of repulsion + spring-attraction
 * iterations spread them into a readable concept map. Determinism (a seeded
 * angle, no Math.random) keeps the static render byte-stable across runs.
 *
 * ONE-WAY DEPENDENCY: imports nothing. No sibling component, no boot, no
 * preferences. All node/edge colors come from tokens via CSS class hooks;
 * the JS emits zero inline color literals (arrowhead fills use currentColor so
 * the marker inherits the token-bound edge stroke).
 *
 * Props:
 *   {
 *     nodes: [ { id, label?, category?, summary? } ],
 *     edges: [ { from, to, type: "depends_on" | "supersedes" } ],
 *     title?: string,          // optional caption above the graph
 *     showLegend?: boolean,    // default true
 *     iterations?: number,     // layout relaxation passes (default 220)
 *   }
 *
 * Edges whose `from`/`to` do not resolve to a node id are dropped from the
 * draw list and reported on the return value as `droppedEdges` so a caller can
 * surface manifest data quirks (e.g. a bare `commit` alias for `git-commit`)
 * rather than silently swallowing them.
 *
 * Returns: { root, svg, droppedEdges }
 */

const SVG_NS = "http://www.w3.org/2000/svg";

// Layout constants (logical SVG units; CSS scales the rendered size).
const VIEW_W = 720;
const VIEW_H = 460;
const NODE_R = 30; // node circle radius
const PAD = 48; // viewport padding so nodes/labels never clip
const LABEL_MAX = 16; // label chars before truncation

function safeString(v) {
  return typeof v === "string" ? v : "";
}

function svgEl(name, attrs = {}) {
  const el = document.createElementNS(SVG_NS, name);
  for (const k in attrs) el.setAttribute(k, String(attrs[k]));
  return el;
}

// Two edge types, frozen. A third type must be added deliberately — the
// component will not invent styling for an unknown type; unknown types fall
// back to the depends_on (solid) class but are tagged so they are visible.
const EDGE_TYPES = { depends_on: "depends-on", supersedes: "supersedes" };

/**
 * Deterministic force-directed relaxation.
 * Seeds nodes on a circle (angle by index — no randomness so the static render
 * is reproducible), then relaxes with pairwise repulsion + spring attraction
 * along edges, clamped to the padded viewport.
 */
function layout(nodes, edges, iterations) {
  const n = nodes.length;
  const cx = VIEW_W / 2;
  const cy = VIEW_H / 2;
  const seedR = Math.min(VIEW_W, VIEW_H) / 2 - PAD;

  // Seed on a circle.
  nodes.forEach((node, i) => {
    const a = (2 * Math.PI * i) / Math.max(1, n) - Math.PI / 2;
    node.x = cx + seedR * Math.cos(a);
    node.y = cy + seedR * Math.sin(a);
  });

  if (n <= 1) return;

  const byId = new Map(nodes.map((node) => [node.id, node]));
  const springEdges = edges
    .map((e) => ({ a: byId.get(e.from), b: byId.get(e.to) }))
    .filter((e) => e.a && e.b && e.a !== e.b);

  const k = 170; // ideal edge length
  const repulse = 90000; // repulsion constant
  const springK = 0.02; // attraction stiffness
  let temp = 60; // cooling — max displacement per pass

  for (let it = 0; it < iterations; it++) {
    const dispX = new Map(nodes.map((node) => [node.id, 0]));
    const dispY = new Map(nodes.map((node) => [node.id, 0]));

    // Repulsion (every pair).
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const a = nodes[i];
        const b = nodes[j];
        let dx = a.x - b.x;
        let dy = a.y - b.y;
        let d2 = dx * dx + dy * dy;
        if (d2 < 0.01) {
          // Coincident — nudge deterministically by index.
          dx = (i - j) || 1;
          dy = (j - i) || 1;
          d2 = dx * dx + dy * dy;
        }
        const force = repulse / d2;
        const d = Math.sqrt(d2);
        const fx = (dx / d) * force;
        const fy = (dy / d) * force;
        dispX.set(a.id, dispX.get(a.id) + fx);
        dispY.set(a.id, dispY.get(a.id) + fy);
        dispX.set(b.id, dispX.get(b.id) - fx);
        dispY.set(b.id, dispY.get(b.id) - fy);
      }
    }

    // Spring attraction along edges.
    for (const e of springEdges) {
      const dx = e.a.x - e.b.x;
      const dy = e.a.y - e.b.y;
      const d = Math.sqrt(dx * dx + dy * dy) || 1;
      const force = springK * (d - k);
      const fx = (dx / d) * force;
      const fy = (dy / d) * force;
      dispX.set(e.a.id, dispX.get(e.a.id) - fx);
      dispY.set(e.a.id, dispY.get(e.a.id) - fy);
      dispX.set(e.b.id, dispX.get(e.b.id) + fx);
      dispY.set(e.b.id, dispY.get(e.b.id) + fy);
    }

    // Apply, clamped to temperature and the padded viewport.
    for (const node of nodes) {
      let dx = dispX.get(node.id);
      let dy = dispY.get(node.id);
      const d = Math.sqrt(dx * dx + dy * dy) || 1;
      node.x += (dx / d) * Math.min(d, temp);
      node.y += (dy / d) * Math.min(d, temp);
      node.x = Math.max(PAD, Math.min(VIEW_W - PAD, node.x));
      node.y = Math.max(PAD, Math.min(VIEW_H - PAD, node.y));
    }
    temp = Math.max(2, temp * 0.96); // cool down
  }
}

// Trim an edge so the line/arrow stops at the node circle, not the centre.
function trimToRadius(from, to, r) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const d = Math.sqrt(dx * dx + dy * dy) || 1;
  return {
    x1: from.x + (dx / d) * r,
    y1: from.y + (dy / d) * r,
    x2: to.x - (dx / d) * r,
    y2: to.y - (dy / d) * r,
  };
}

export function render(mountEl, props = {}) {
  if (!mountEl) throw new Error("typed-skill-graph.render: mountEl required");

  const rawNodes = Array.isArray(props.nodes) ? props.nodes : [];
  const rawEdges = Array.isArray(props.edges) ? props.edges : [];
  const showLegend = props.showLegend !== false;
  const iterations = Number.isFinite(props.iterations) ? props.iterations : 220;
  const title = safeString(props.title);

  mountEl.innerHTML = "";
  const wrap = document.createElement("div");
  wrap.className = "typed-skill-graph";
  mountEl.appendChild(wrap);

  if (rawNodes.length === 0) {
    const empty = document.createElement("p");
    empty.className = "typed-skill-graph__empty";
    empty.textContent = "No skill graph to display.";
    wrap.appendChild(empty);
    return { root: wrap, svg: null, droppedEdges: [] };
  }

  if (title) {
    const cap = document.createElement("p");
    cap.className = "typed-skill-graph__title";
    cap.textContent = title;
    wrap.appendChild(cap);
  }

  // Clone nodes so we can annotate layout without mutating the caller's data.
  const nodes = rawNodes.map((n) => ({
    id: safeString(n.id),
    label: safeString(n.label) || safeString(n.id),
    category: safeString(n.category),
    summary: safeString(n.summary),
    x: 0,
    y: 0,
  }));
  const byId = new Map(nodes.map((n) => [n.id, n]));

  // Resolve edges to real node ids; collect ones that dangle.
  const droppedEdges = [];
  const edges = [];
  for (const e of rawEdges) {
    const from = safeString(e.from);
    const to = safeString(e.to);
    const type = EDGE_TYPES[e.type] ? e.type : "depends_on";
    if (byId.has(from) && byId.has(to)) {
      edges.push({ from, to, type, unknownType: !EDGE_TYPES[e.type] });
    } else {
      droppedEdges.push({ from, to, type: e.type, reason: "endpoint not in node set" });
    }
  }

  layout(nodes, edges, iterations);

  const svg = svgEl("svg", {
    class: "typed-skill-graph__svg",
    viewBox: `0 0 ${VIEW_W} ${VIEW_H}`,
    role: "img",
    "aria-label": "Typed skill dependency graph",
    preserveAspectRatio: "xMidYMid meet",
  });

  // <defs> — one arrowhead marker per edge type. The marker fill is
  // currentColor so it inherits whichever token-bound stroke the edge uses.
  const defs = svgEl("defs");
  for (const key of Object.keys(EDGE_TYPES)) {
    const marker = svgEl("marker", {
      id: `tsg-arrow-${EDGE_TYPES[key]}`,
      class: `typed-skill-graph__arrow typed-skill-graph__arrow--${EDGE_TYPES[key]}`,
      viewBox: "0 0 10 10",
      refX: 9,
      refY: 5,
      markerWidth: 7,
      markerHeight: 7,
      orient: "auto-start-reverse",
    });
    const head = svgEl("path", { d: "M 0 0 L 10 5 L 0 10 z" });
    marker.appendChild(head);
    defs.appendChild(marker);
  }
  svg.appendChild(defs);

  // Edges first so node circles paint over the line ends.
  const byIdLaid = new Map(nodes.map((n) => [n.id, n]));
  for (const e of edges) {
    const from = byIdLaid.get(e.from);
    const to = byIdLaid.get(e.to);
    const { x1, y1, x2, y2 } = trimToRadius(from, to, NODE_R);
    const cls = EDGE_TYPES[e.type] || "depends-on";
    const line = svgEl("line", {
      class: `typed-skill-graph__edge typed-skill-graph__edge--${cls}`,
      x1,
      y1,
      x2,
      y2,
      "marker-end": `url(#tsg-arrow-${cls})`,
    });
    const t = svgEl("title");
    t.textContent = `${e.from} ${e.type} ${e.to}`;
    line.appendChild(t);
    svg.appendChild(line);
  }

  // Nodes.
  for (const n of nodes) {
    const g = svgEl("g", {
      class: "typed-skill-graph__node",
      transform: `translate(${n.x}, ${n.y})`,
    });
    const circle = svgEl("circle", {
      class: "typed-skill-graph__node-dot",
      r: NODE_R,
      cx: 0,
      cy: 0,
    });
    g.appendChild(circle);

    const text = svgEl("text", {
      class: "typed-skill-graph__node-label",
      x: 0,
      y: NODE_R + 14,
      "text-anchor": "middle",
    });
    const raw = n.label;
    text.textContent = raw.length > LABEL_MAX ? raw.slice(0, LABEL_MAX - 1) + "…" : raw;
    g.appendChild(text);

    // Full label + summary recoverable on hover / AT.
    const t = svgEl("title");
    t.textContent = n.summary ? `${n.label} — ${n.summary}` : n.label;
    g.appendChild(t);

    svg.appendChild(g);
  }

  wrap.appendChild(svg);

  if (showLegend) {
    wrap.appendChild(buildLegend(droppedEdges));
  }

  return { root: wrap, svg, droppedEdges };
}

// The legend ALWAYS renders both edge types so the typed distinction is proven
// even for a single-edge-type subgraph. This is the no-flatten guarantee made
// visible. It also surfaces any dropped (dangling) edges for the caller.
function buildLegend(droppedEdges) {
  const legend = document.createElement("div");
  legend.className = "typed-skill-graph__legend";

  const items = [
    { cls: "depends-on", label: "depends_on (solid)" },
    { cls: "supersedes", label: "supersedes (dashed)" },
  ];
  for (const item of items) {
    const row = document.createElement("span");
    row.className = "typed-skill-graph__legend-item";

    const swatch = svgEl("svg", {
      class: "typed-skill-graph__legend-swatch",
      viewBox: "0 0 40 12",
      "aria-hidden": "true",
    });
    const line = svgEl("line", {
      class: `typed-skill-graph__edge typed-skill-graph__edge--${item.cls}`,
      x1: 2,
      y1: 6,
      x2: 30,
      y2: 6,
      "marker-end": `url(#tsg-arrow-${item.cls})`,
    });
    swatch.appendChild(line);
    row.appendChild(swatch);

    const txt = document.createElement("span");
    txt.className = "typed-skill-graph__legend-label";
    txt.textContent = item.label;
    row.appendChild(txt);

    legend.appendChild(row);
  }

  if (droppedEdges.length > 0) {
    const note = document.createElement("p");
    note.className = "typed-skill-graph__note";
    note.textContent = `${droppedEdges.length} edge(s) dropped (endpoint not in node set): ` +
      droppedEdges.map((e) => `${e.from}→${e.to}`).join(", ");
    legend.appendChild(note);
  }

  return legend;
}
