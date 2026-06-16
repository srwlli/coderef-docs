/* visualizations.js -- consumer glue for the docs-site Visualizations page.
 *
 * CR-HTML side of DISPATCH-2026-06-16-CR-HTML-003. This is NOT the component --
 * it imports the typed-skill-graph leaf (owned by SURFACES-HTML, vendored as-is
 * into assets/) and mounts the `git` category's typed subgraph into the page.
 *
 * Data: assets/git-subgraph.json (vendored from the eval spike; the bare
 * `commit` -> `git-commit` alias is already resolved in that fixture). Edges are
 * TYPED -- solid = depends_on, dashed = supersedes -- and never flattened; the
 * always-on legend proves the distinction even though the git category is all
 * depends_on.
 *
 * If the component needs a behavior change, dispatch it back to SURFACES-HTML.
 */
import * as typedSkillGraph from "./typed-skill-graph.js";

// The docs markdown renderer escapes raw HTML, so the page body cannot carry a
// literal mount <div>. Instead, find the marker paragraph the md DOES emit
// (data-tsg-mount via a fenced sentinel) -- or fall back to appending into the
// prose article -- and create the mount element here in the consumer glue.
function resolveMount() {
  const byId = document.getElementById("tsg-git-mount");
  if (byId) return byId;
  // sentinel: a paragraph whose text is exactly [[tsg-git-mount]]
  const paras = document.querySelectorAll(".prose p");
  for (const p of paras) {
    if (p.textContent.trim() === "[[tsg-git-mount]]") {
      const div = document.createElement("div");
      div.id = "tsg-git-mount";
      p.replaceWith(div);
      return div;
    }
  }
  // last resort: append to the prose article so the graph still renders
  const prose = document.querySelector(".prose");
  if (prose) {
    const div = document.createElement("div");
    div.id = "tsg-git-mount";
    prose.appendChild(div);
    return div;
  }
  return null;
}

const mount = resolveMount();
if (mount) {
  fetch("assets/git-subgraph.json")
    .then((r) => {
      if (!r.ok) throw new Error("HTTP " + r.status);
      return r.json();
    })
    .then((data) => {
      const { droppedEdges } = typedSkillGraph.render(mount, {
        title: "git -- typed dependency subgraph (5 skills)",
        nodes: data.nodes,
        edges: data.edges,
        showLegend: true,
      });
      if (droppedEdges && droppedEdges.length) {
        // Surfaced by the component's legend note too; also log for the curious.
        console.warn("[visualizations] dropped edges:", droppedEdges);
      }
    })
    .catch((err) => {
      const p = document.createElement("p");
      p.className = "typed-skill-graph__empty";
      p.textContent =
        "Could not load the skill graph (" + err.message +
        "). This page must be served over http:// -- file:// is blocked by the browser.";
      mount.appendChild(p);
    });
}
