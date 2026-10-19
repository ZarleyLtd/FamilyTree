/**
 * Hourglass: ancestors above a focus, descendants below.
 * Composes LayoutPedigree (vertical) and LayoutDescendants.
 */
(function (root, factory) {
  var ped = root.LayoutPedigree;
  var desc = root.LayoutDescendants;
  if ((!ped || !desc) && typeof module === 'object' && module.exports) {
    ped = ped || require('./layout-pedigree.js');
    desc = desc || require('./layout-descendants.js');
  }
  var api = factory(ped, desc);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.LayoutHourglass = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (LayoutPedigree, LayoutDescendants) {
  'use strict';

  function findFocus(nodes, id) {
    for (var i = 0; i < nodes.length; i++) {
      if (nodes[i].id === id && !nodes[i].placeholder) return nodes[i];
    }
    return null;
  }

  function layoutHourglass(focusId, up, down, graph, opts) {
    up = Math.max(2, Math.min(6, up || 3));
    down = Math.max(1, Math.min(6, down || 3));
    var pedigree = LayoutPedigree.layoutPedigree(focusId, up, 'v', graph);
    var descendants = LayoutDescendants.layoutDescendants(focusId, down, graph, opts || {});
    var pFocus = findFocus(pedigree.nodes, focusId);
    var dFocus = findFocus(descendants.nodes, focusId);
    if (!pFocus || !dFocus) {
      return descendants.nodes.length ? descendants : pedigree;
    }
    var shiftX = (dFocus.x + dFocus.w / 2) - (pFocus.x + pFocus.w / 2);
    var shiftY = dFocus.y - pFocus.y;
    pedigree.nodes.forEach(function (n) {
      n.x += shiftX;
      n.y += shiftY;
    });
    var nodes = [];
    pedigree.nodes.forEach(function (n) {
      if (n !== pFocus) nodes.push(n);
    });
    descendants.nodes.forEach(function (n) {
      nodes.push(n);
    });
    var edges = [];
    pedigree.edges.forEach(function (e) {
      edges.push({
        from: e.from === pFocus ? dFocus : e.from,
        to: e.to === pFocus ? dFocus : e.to,
        dashed: e.dashed
      });
    });
    descendants.edges.forEach(function (e) {
      edges.push(e);
    });
    return {
      nodes: nodes,
      edges: edges,
      orient: 'v',
      bbox: LayoutDescendants.bounds(nodes)
    };
  }

  return { layoutHourglass: layoutHourglass };
});
