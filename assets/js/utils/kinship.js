/**
 * Relationship calculator. BFS up parent links to a nearest common ancestor,
 * then an English kinship term for how `other` is related to `me`.
 * Keep in sync with supabase/functions/familytree-api/kinship.ts.
 *
 * graph.person(id) → { id, sex, givenNames, surname } | null
 * graph.parentsOf(id) → { fatherId, motherId }
 * graph.partnersOf(id) → string[]
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.Kinship = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  function ancestorsOf(id, graph) {
    var out = {};
    if (!id) return out;
    var queue = [id];
    out[id] = { depth: 0, via: null };
    while (queue.length) {
      var cur = queue.shift();
      var depth = out[cur].depth;
      var par = graph.parentsOf(cur) || {};
      [par.fatherId, par.motherId].forEach(function (pid) {
        if (!pid || out[pid]) return;
        out[pid] = { depth: depth + 1, via: cur };
        queue.push(pid);
      });
    }
    return out;
  }

  function ordinal(n) {
    var s = ['th', 'st', 'nd', 'rd'];
    var v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
  }

  function cousinDegree(n) {
    if (n === 1) return 'first';
    if (n === 2) return 'second';
    if (n === 3) return 'third';
    if (n === 4) return 'fourth';
    return ordinal(n);
  }

  function greats(n) {
    if (n <= 0) return '';
    if (n === 1) return 'great-';
    if (n === 2) return 'great-great-';
    return n + '\u00d7 great-';
  }

  function removedWord(n) {
    if (!n) return '';
    if (n === 1) return ' once removed';
    if (n === 2) return ' twice removed';
    return ' ' + n + ' times removed';
  }

  function bySex(person, male, female, unknown) {
    var sex = person && person.sex;
    if (sex === 'M') return male;
    if (sex === 'F') return female;
    return unknown;
  }

  function shortName(p) {
    if (!p) return 'Unknown';
    var given = String(p.givenNames || p.given || '').trim();
    var name = (given + ' ' + (p.surname || '')).trim();
    return name || 'Unknown';
  }

  function possessive(name) {
    return name + '\u2019s';
  }

  function ancestorTerm(other, d) {
    if (d === 1) return bySex(other, 'father', 'mother', 'parent');
    return greats(d - 2) + bySex(other, 'grandfather', 'grandmother', 'grandparent');
  }

  function descendantTerm(other, d) {
    if (d === 1) return bySex(other, 'son', 'daughter', 'child');
    return greats(d - 2) + bySex(other, 'grandson', 'granddaughter', 'grandchild');
  }

  function pathVia(ancId, ancA, ancB) {
    var up = [];
    var cur = ancId;
    var guard = 0;
    while (cur && guard < 64) {
      up.unshift(cur);
      cur = ancA[cur] ? ancA[cur].via : null;
      guard += 1;
    }
    var down = [];
    cur = ancId;
    guard = 0;
    while (cur && guard < 64) {
      down.push(cur);
      cur = ancB[cur] ? ancB[cur].via : null;
      guard += 1;
    }
    down.shift();
    return up.concat(down);
  }

  function siblingWord(graph, aId, bId, other) {
    var pa = graph.parentsOf(aId) || {};
    var pb = graph.parentsOf(bId) || {};
    var sameFather = pa.fatherId && pb.fatherId && pa.fatherId === pb.fatherId;
    var sameMother = pa.motherId && pb.motherId && pa.motherId === pb.motherId;
    var diffFather = pa.fatherId && pb.fatherId && pa.fatherId !== pb.fatherId;
    var diffMother = pa.motherId && pb.motherId && pa.motherId !== pb.motherId;
    var half = (sameFather || sameMother) && (diffFather || diffMother);
    return (half ? 'half-' : '') + bySex(other, 'brother', 'sister', 'sibling');
  }

  function bloodRelation(meId, otherId, graph) {
    if (meId === otherId) {
      return { term: '', path: [meId], commonAncestorIds: [], description: '', same: true };
    }
    var other = graph.person(otherId);
    var ancMe = ancestorsOf(meId, graph);
    var ancOther = ancestorsOf(otherId, graph);

    if (ancMe[otherId]) {
      var depthUp = ancMe[otherId].depth;
      return {
        term: ancestorTerm(other, depthUp),
        path: pathVia(otherId, ancMe, stub(otherId)),
        commonAncestorIds: [],
        description: ''
      };
    }
    if (ancOther[meId]) {
      var depthDown = ancOther[meId].depth;
      return {
        term: descendantTerm(other, depthDown),
        path: pathVia(meId, stub(meId), ancOther),
        commonAncestorIds: [],
        description: ''
      };
    }

    var best = null;
    Object.keys(ancMe).forEach(function (id) {
      if (!ancOther[id]) return;
      var da = ancMe[id].depth;
      var db = ancOther[id].depth;
      if (!best || da + db < best.da + best.db || (da + db === best.da + best.db && Math.max(da, db) < Math.max(best.da, best.db))) {
        best = { id: id, da: da, db: db };
      }
    });
    if (!best) return null;

    var da = best.da;
    var db = best.db;
    var term;
    if (da === 1 && db === 1) term = siblingWord(graph, meId, otherId, other);
    else if (da === 1) term = greats(db - 2) + bySex(other, 'nephew', 'niece', 'nibling');
    else if (db === 1) term = greats(da - 2) + bySex(other, 'uncle', 'aunt', 'parent\u2019s sibling');
    else term = cousinDegree(Math.min(da, db) - 1) + ' cousin' + removedWord(Math.abs(da - db));

    var ids = [best.id];
    var co = coAncestor(best.id, ancMe, ancOther, graph);
    if (co) ids.push(co);
    var label = ids.map(function (id) {
      return shortName(graph.person(id));
    }).join(' and ');
    return {
      term: term,
      path: pathVia(best.id, ancMe, ancOther),
      commonAncestorIds: ids,
      description: 'Common ancestor' + (ids.length > 1 ? 's' : '') + ': ' + label
    };
  }

  function stub(id) {
    var o = {};
    o[id] = { via: null, depth: 0 };
    return o;
  }

  function coAncestor(ancId, ancMe, ancOther, graph) {
    var partners = graph.partnersOf(ancId) || [];
    for (var i = 0; i < partners.length; i++) {
      var pid = partners[i];
      if (pid !== ancId && ancMe[pid] && ancOther[pid]) return pid;
    }
    return null;
  }

  function inLawViaOther(bloodTerm, other) {
    if (/^(brother|sister|half-brother|half-sister|sibling)$/.test(bloodTerm)) {
      return bySex(other, 'brother', 'sister', 'sibling') + '-in-law';
    }
    if (/^(son|daughter|child)$/.test(bloodTerm)) {
      return bySex(other, 'son', 'daughter', 'child') + '-in-law';
    }
    if (/^(father|mother|parent)$/.test(bloodTerm)) {
      return bySex(other, 'stepfather', 'stepmother', 'step-parent');
    }
    return bySex(other, 'husband', 'wife', 'partner') + ' of your ' + bloodTerm;
  }

  function inLawViaMine(bloodTerm, partner) {
    if (/^(father|mother|parent|brother|sister|sibling|son|daughter|child)$/.test(bloodTerm)) {
      return bloodTerm + '-in-law';
    }
    return bySex(partner, 'husband', 'wife', 'partner') + '\u2019s ' + bloodTerm;
  }

  /**
   * How `otherId` is related to `meId`.
   * @returns {{ term: string, path: string[], commonAncestorIds: string[], description: string, same?: boolean, unrelated?: boolean }}
   */
  function relate(meId, otherId, graph) {
    var direct = bloodRelation(meId, otherId, graph);
    if (direct) return direct;
    var other = graph.person(otherId);
    var mine = graph.partnersOf(meId) || [];
    for (var i = 0; i < mine.length; i++) {
      if (mine[i] === otherId) {
        return {
          term: bySex(other, 'husband', 'wife', 'partner'),
          path: [meId, otherId],
          commonAncestorIds: [],
          description: ''
        };
      }
    }
    var theirs = graph.partnersOf(otherId) || [];
    for (var j = 0; j < theirs.length; j++) {
      var via = bloodRelation(meId, theirs[j], graph);
      if (via && via.term && !via.same) {
        return {
          term: inLawViaOther(via.term, other),
          path: via.path.concat([otherId]),
          commonAncestorIds: via.commonAncestorIds,
          description: via.description
        };
      }
    }
    for (var k = 0; k < mine.length; k++) {
      var via2 = bloodRelation(mine[k], otherId, graph);
      if (via2 && via2.term && !via2.same) {
        var partner = graph.person(mine[k]);
        return {
          term: inLawViaMine(via2.term, partner),
          path: [meId].concat(via2.path),
          commonAncestorIds: via2.commonAncestorIds,
          description: via2.description
        };
      }
    }
    return {
      term: '',
      path: [],
      commonAncestorIds: [],
      description: 'No shared ancestors or marriages are recorded.',
      unrelated: true
    };
  }

  function phrase(me, other, rel) {
    var meName = shortName(me);
    var otherName = shortName(other);
    if (!rel || rel.unrelated || !rel.term) {
      if (rel && rel.same) return otherName + ' is the same person as ' + meName + '.';
      return 'No known relationship is recorded between ' + meName + ' and ' + otherName + '.';
    }
    if (rel.same) return otherName + ' is the same person as ' + meName + '.';
    if (rel.term.indexOf('your ') >= 0) {
      return otherName + ' is the ' + rel.term.replace('your ', possessive(meName) + ' ') + '.';
    }
    if (rel.term.indexOf('\u2019s ') >= 0) {
      return otherName + ' is ' + meName + '\u2019s ' + rel.term + '.';
    }
    return otherName + ' is ' + possessive(meName) + ' ' + rel.term + '.';
  }

  function layoutPath(persons) {
    var W = 116;
    var H = 46;
    var GAP = 32;
    var nodes = [];
    var edges = [];
    (persons || []).forEach(function (p) {
      if (!p) return;
      var node = { id: p.id, person: p, x: nodes.length * (W + GAP), y: 0, w: W, h: H };
      if (nodes.length) edges.push({ from: nodes[nodes.length - 1], to: node });
      nodes.push(node);
    });
    var bbox = nodes.length
      ? { x: 0, y: 0, width: nodes[nodes.length - 1].x + W, height: H }
      : { x: 0, y: 0, width: 0, height: 0 };
    return { nodes: nodes, edges: edges, bbox: bbox };
  }

  return {
    relate: relate,
    phrase: phrase,
    ancestorsOf: ancestorsOf,
    layoutPath: layoutPath,
    shortName: shortName
  };
});
