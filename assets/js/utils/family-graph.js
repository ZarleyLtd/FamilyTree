/**
 * Build the chart/kinship graph from an API bundle
 * { persons, families: [{ partner1Id, partner2Id, children: [{ id, seq }] }] }.
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.FamilyGraph = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  function fromBundle(data) {
    var byId = {};
    (data && data.persons || []).forEach(function (p) {
      if (p && p.id) byId[p.id] = p;
    });
    var parents = {};
    var childLists = {};
    var partnerLists = {};

    function addChild(parentId, child) {
      if (!parentId || !child || !child.id) return;
      var list = childLists[parentId] || (childLists[parentId] = []);
      list.push(child);
    }

    function addPartner(a, b) {
      if (!a || !b || a === b) return;
      var list = partnerLists[a] || (partnerLists[a] = []);
      list.push(b);
    }

    (data && data.families || []).forEach(function (f) {
      var p1 = f.partner1Id || null;
      var p2 = f.partner2Id || null;
      addPartner(p1, p2);
      addPartner(p2, p1);
      var kids = f.children || [];
      kids.forEach(function (c) {
        var cid = c && (c.id || c.childId);
        if (!cid) return;
        addChild(p1, c.id ? c : { id: cid, seq: c.seq });
        addChild(p2, c.id ? c : { id: cid, seq: c.seq });
        var cur = parents[cid] || { fatherId: null, motherId: null };
        [p1 && byId[p1], p2 && byId[p2]].forEach(function (x) {
          if (!x) return;
          if (x.sex === 'F' && !cur.motherId) cur.motherId = x.id;
          else if (x.sex === 'M' && !cur.fatherId) cur.fatherId = x.id;
          else if (!cur.fatherId) cur.fatherId = x.id;
          else if (!cur.motherId) cur.motherId = x.id;
        });
        parents[cid] = cur;
      });
    });

    function orderedChildren(id) {
      var seen = {};
      return (childLists[id] || []).filter(function (c) {
        if (!c || !c.id || seen[c.id] || !byId[c.id]) return false;
        seen[c.id] = 1;
        return true;
      }).sort(function (a, b) {
        var ay = byId[a.id].birthYear || 9999;
        var by = byId[b.id].birthYear || 9999;
        if (ay !== by) return ay - by;
        return (Number(a.seq) || 0) - (Number(b.seq) || 0);
      }).map(function (c) {
        return c.id;
      });
    }

    return {
      person: function (id) {
        return byId[id] || null;
      },
      parentsOf: function (id) {
        return parents[id] || { fatherId: null, motherId: null };
      },
      childrenOf: function (id) {
        return orderedChildren(id);
      },
      partnersOf: function (id) {
        var seen = {};
        return (partnerLists[id] || []).filter(function (pid) {
          if (!pid || seen[pid] || !byId[pid]) return false;
          seen[pid] = 1;
          return true;
        });
      }
    };
  }

  return { fromBundle: fromBundle };
});
