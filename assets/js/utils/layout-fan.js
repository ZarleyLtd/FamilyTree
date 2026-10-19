/**
 * Fan chart layout: annular sectors for ancestors.
 * spanDeg 180 (upper semicircle) or 360.
 * graph.person(id), graph.parentsOf(id) → { fatherId, motherId }
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.LayoutFan = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  function layoutFan(focusId, gens, spanDeg, graph) {
    gens = Math.max(2, Math.min(7, gens || 5));
    spanDeg = spanDeg === 360 ? 360 : 180;
    var R0 = 54;
    var RING = gens > 5 ? 56 : 64;
    var span = (spanDeg / 180) * Math.PI;
    var startA = spanDeg === 360 ? -Math.PI / 2 : Math.PI;
    var sectors = [];
    var centre = { id: focusId, person: graph.person(focusId), gen: 0 };

    function place(id, gen, slot) {
      if (!id || gen >= gens) return;
      var person = graph.person(id);
      if (!person) return;
      var count = Math.pow(2, gen);
      var a0 = startA + (slot / count) * span;
      var a1 = startA + ((slot + 1) / count) * span;
      sectors.push({
        id: id,
        person: person,
        gen: gen,
        slot: slot,
        a0: a0,
        a1: a1,
        r0: R0 + (gen - 1) * RING,
        r1: R0 + gen * RING,
        side: slot < count / 2 ? 'pat' : 'mat'
      });
      if (gen + 1 >= gens) return;
      var par = graph.parentsOf(id) || {};
      if (par.fatherId) place(par.fatherId, gen + 1, slot * 2);
      if (par.motherId) place(par.motherId, gen + 1, slot * 2 + 1);
    }

    var rootPar = graph.parentsOf(focusId) || {};
    if (rootPar.fatherId) place(rootPar.fatherId, 1, 0);
    if (rootPar.motherId) place(rootPar.motherId, 1, 1);
    var R = R0 + Math.max(0, gens - 1) * RING;
    var bbox = spanDeg === 360
      ? { x: -R, y: -R, width: 2 * R, height: 2 * R }
      : { x: -R, y: -R, width: 2 * R, height: R + R0 };
    return { centre: centre, sectors: sectors, R0: R0, spanDeg: spanDeg, bbox: bbox };
  }

  return { layoutFan: layoutFan };
});
