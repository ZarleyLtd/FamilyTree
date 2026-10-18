/**
 * Pure pedigree layout: data in → node positions out.
 * graph.parentsOf(id) → { fatherId, motherId }
 * graph.person(id) → person summary or null
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.LayoutPedigree = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  function bbox(nodes) {
    var minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    nodes.forEach(function (n) {
      minX = Math.min(minX, n.x);
      minY = Math.min(minY, n.y);
      maxX = Math.max(maxX, n.x + n.w);
      maxY = Math.max(maxY, n.y + n.h);
    });
    return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
  }

  /**
   * @param {string} focusId
   * @param {number} gens generations including focus
   * @param {'h'|'v'} orient
   * @param {{ person: function(string): object|null, parentsOf: function(string): {fatherId:?string, motherId:?string} }} graph
   */
  function layoutPedigree(focusId, gens, orient, graph) {
    gens = Math.max(2, Math.min(8, gens || 4));
    orient = orient === 'v' ? 'v' : 'h';
    var W = orient === 'h' ? 150 : 118;
    var H = 46;
    var GAPX = 56;
    var GAPY = orient === 'h' ? 10 : 8;
    var nodes = [];
    var edges = [];
    var slots = Math.pow(2, gens - 1);
    var total = orient === 'h' ? slots * (H + GAPY) : slots * (W + GAPY);

    function pos(gen, slot) {
      var span = total / Math.pow(2, gen);
      var c = (slot + 0.5) * span;
      if (orient === 'h') return { x: gen * (W + GAPX), y: c - H / 2 };
      return { x: c - W / 2, y: (gens - 1 - gen) * (H + GAPX) };
    }

    function place(id, gen, slot, childNode) {
      var p = id ? graph.person(id) : null;
      var pt = pos(gen, slot);
      var node = {
        id: id,
        person: p,
        gen: gen,
        slot: slot,
        x: pt.x,
        y: pt.y,
        w: W,
        h: H
      };
      nodes.push(node);
      if (childNode) edges.push({ from: childNode, to: node });
      if (gen + 1 >= gens) return;
      var par = id ? graph.parentsOf(id) : { fatherId: null, motherId: null };
      var ids = [par && par.fatherId, par && par.motherId];
      ids.forEach(function (parentId, i) {
        var sl = slot * 2 + i;
        if (parentId && graph.person(parentId)) {
          place(parentId, gen + 1, sl, node);
        } else {
          var pp = pos(gen + 1, sl);
          var ph = {
            id: null,
            placeholder: i === 0 ? 'father' : 'mother',
            forId: id,
            gen: gen + 1,
            slot: sl,
            x: pp.x,
            y: pp.y,
            w: W,
            h: H
          };
          nodes.push(ph);
          edges.push({ from: node, to: ph, dashed: true });
        }
      });
    }

    place(focusId, 0, 0, null);
    return { nodes: nodes, edges: edges, orient: orient, bbox: bbox(nodes) };
  }

  return { layoutPedigree: layoutPedigree, bbox: bbox };
});
