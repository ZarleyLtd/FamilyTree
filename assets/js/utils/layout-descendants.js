/**
 * Descendant tidy tree. Each subtree keeps a contiguous width and the parent
 * (plus partners beside them) is centred over the children — a simplified
 * Reingold–Tilford layout.
 *
 * graph.person(id), graph.childrenOf(id) → id[], graph.partnersOf(id) → id[]
 * opts.collapsed: { [id]: true } hides that person's descendants.
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.LayoutDescendants = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var W = 132;
  var H = 54;
  var GAPX = 18;
  var GAPY = 72;
  var PW = 112;
  var PGAP = 8;

  function partnerExtra(n) {
    var count = (n.partners && n.partners.length) || 0;
    return count ? count * (PW + PGAP) : 0;
  }

  function bounds(nodes) {
    var minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    (nodes || []).forEach(function (n) {
      minX = Math.min(minX, n.x);
      minY = Math.min(minY, n.y);
      maxX = Math.max(maxX, n.x + n.w + partnerExtra(n));
      maxY = Math.max(maxY, n.y + n.h);
    });
    if (!isFinite(minX)) return { x: 0, y: 0, width: 1, height: 1 };
    return { x: minX, y: minY, width: Math.max(1, maxX - minX), height: Math.max(1, maxY - minY) };
  }

  function layoutDescendants(focusId, gens, graph, opts) {
    gens = Math.max(1, Math.min(8, gens || 4));
    opts = opts || {};
    var collapsed = opts.collapsed || {};
    var nodes = [];
    var edges = [];

    function build(id, depth, seen) {
      if (!id || seen[id]) return null;
      var person = graph.person(id);
      if (!person) return null;
      var nextSeen = {};
      Object.keys(seen).forEach(function (k) { nextSeen[k] = 1; });
      nextSeen[id] = 1;
      var partners = (graph.partnersOf(id) || []).filter(function (pid) {
        return pid && pid !== id && !nextSeen[pid] && graph.person(pid);
      }).map(function (pid) {
        return { id: pid, person: graph.person(pid) };
      });
      var childIds = graph.childrenOf(id) || [];
      var node = {
        id: id,
        person: person,
        gen: depth,
        w: W,
        h: H,
        partners: partners,
        collapsed: false,
        depthLimited: false,
        hiddenCount: 0,
        childCount: childIds.length
      };
      var coupleW = W + partnerExtra(node);
      var hide = !!collapsed[id];
      var canDraw = depth + 1 < gens && childIds.length && !hide;
      node.children = [];
      if (hide && childIds.length) {
        node.collapsed = true;
        node.hiddenCount = childIds.length;
      } else if (canDraw) {
        childIds.forEach(function (cid) {
          var child = build(cid, depth + 1, nextSeen);
          if (child) node.children.push(child);
        });
      } else if (childIds.length && depth + 1 >= gens) {
        node.depthLimited = true;
        node.hiddenCount = childIds.length;
      }
      var sum = node.children.reduce(function (acc, c) { return acc + c.unitWidth; }, 0);
      node.unitWidth = Math.max(coupleW + GAPX, sum || 0);
      return node;
    }

    function assign(node, x0, parent) {
      var coupleW = node.w + partnerExtra(node);
      node.x = x0 + (node.unitWidth - coupleW) / 2;
      node.y = node.gen * (H + GAPY);
      nodes.push(node);
      if (parent) edges.push({ from: parent, to: node });
      var sum = node.children.reduce(function (acc, c) { return acc + c.unitWidth; }, 0);
      var cx = x0 + (node.unitWidth - sum) / 2;
      node.children.forEach(function (c) {
        assign(c, cx, node);
        cx += c.unitWidth;
      });
    }

    var rootNode = build(focusId, 0, {});
    if (!rootNode) return { nodes: [], edges: [], orient: 'v', bbox: bounds([]) };
    assign(rootNode, 0, null);
    return { nodes: nodes, edges: edges, orient: 'v', bbox: bounds(nodes) };
  }

  return { layoutDescendants: layoutDescendants, bounds: bounds, partnerExtra: partnerExtra };
});
