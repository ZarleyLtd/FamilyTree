/**
 * Relationship calculator (mock, but real logic): finds the nearest common ancestor
 * and names the relationship in English kinship terms.
 */
window.Kinship = (function () {
  'use strict';

  var S = window.MockStore;

  /** Map ancestorId -> { depth, via: childId } with minimum depth (BFS up the parent links). */
  function ancestors(id) {
    var out = {};
    var queue = [{ id: id, depth: 0, via: null }];
    while (queue.length) {
      var cur = queue.shift();
      if (out[cur.id] != null && out[cur.id].depth <= cur.depth) continue;
      out[cur.id] = { depth: cur.depth, via: cur.via };
      var par = S.parentsOf(cur.id);
      [par.father, par.mother].forEach(function (p) {
        if (p) queue.push({ id: p.id, depth: cur.depth + 1, via: cur.id });
      });
    }
    return out;
  }

  function ordinal(n) {
    var s = ['th', 'st', 'nd', 'rd'];
    var v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
  }
  function greats(n) {
    if (n <= 0) return '';
    if (n === 1) return 'great-';
    if (n === 2) return 'great-great-';
    return n + '\u00d7 great-';
  }
  function g(p, m, f, u) {
    return p.sex === 'M' ? m : p.sex === 'F' ? f : u;
  }

  /** Term describing `other` relative to `me` when `other` is a direct ancestor at `d` generations. */
  function ancestorTerm(other, d) {
    if (d === 1) return g(other, 'father', 'mother', 'parent');
    return greats(d - 2) + g(other, 'grandfather', 'grandmother', 'grandparent');
  }
  function descendantTerm(other, d) {
    if (d === 1) return g(other, 'son', 'daughter', 'child');
    return greats(d - 2) + g(other, 'grandson', 'granddaughter', 'grandchild');
  }

  /** Path from a up to ancestor then down to b (list of person ids). */
  function pathVia(ancId, ancA, ancB) {
    var up = [];
    var cur = ancId;
    while (cur) {
      up.unshift(cur);
      cur = ancA[cur].via;
    }
    var down = [];
    cur = ancId;
    while (cur) {
      down.push(cur);
      cur = ancB[cur].via;
    }
    down.shift();
    return up.concat(down);
  }

  /**
   * @returns {{ term: string, path: string[], description: string } | null}
   */
  function bloodRelation(aId, bId) {
    if (aId === bId) return { term: 'yourself', path: [aId], description: '' };
    var a = S.person(aId);
    var b = S.person(bId);
    var ancA = ancestors(aId);
    var ancB = ancestors(bId);

    if (ancA[bId]) {
      return { term: 'your ' + ancestorTerm(b, ancA[bId].depth), path: pathVia(bId, ancA, { [bId]: { via: null } }), description: '' };
    }
    if (ancB[aId]) {
      var p = pathVia(aId, { [aId]: { via: null } }, ancB);
      return { term: 'your ' + descendantTerm(b, ancB[aId].depth), path: p, description: '' };
    }
    var best = null;
    Object.keys(ancA).forEach(function (id) {
      if (!ancB[id]) return;
      var da = ancA[id].depth;
      var db = ancB[id].depth;
      if (!best || da + db < best.da + best.db) best = { id: id, da: da, db: db };
    });
    if (!best) return null;

    var da = best.da;
    var db = best.db;
    var term;
    if (da === 1 && db === 1) {
      var pa = S.parentsOf(aId);
      var pb = S.parentsOf(bId);
      var shared = [pa.father, pa.mother].filter(function (x) {
        return x && ((pb.father && pb.father.id === x.id) || (pb.mother && pb.mother.id === x.id));
      }).length;
      term = (shared < 2 ? 'half-' : '') + g(b, 'brother', 'sister', 'sibling');
    } else if (da === 1) {
      term = greats(db - 2) + g(b, 'nephew', 'niece', 'nibling');
    } else if (db === 1) {
      term = greats(da - 2) + g(b, 'uncle', 'aunt', 'parent\u2019s sibling');
    } else {
      var degree = Math.min(da, db) - 1;
      var removed = Math.abs(da - db);
      term = ordinal(degree) + ' cousin' + (removed ? ' ' + (removed === 1 ? 'once' : removed === 2 ? 'twice' : removed + ' times') + ' removed' : '');
    }
    var anc = S.person(best.id);
    var par = S.parentsOf(best.id);
    var spouseIds = S.partnersOf(best.id).map(function (x) {
      return x.id;
    });
    var ancLabel = S.shortName(anc);
    var coAnc = spouseIds.map(S.person).filter(function (sp) {
      return sp && ancA[sp.id] && ancB[sp.id];
    })[0];
    if (coAnc) ancLabel += ' and ' + S.shortName(coAnc);
    return {
      term: 'your ' + term,
      path: pathVia(best.id, ancA, ancB),
      description: 'Common ancestor' + (coAnc ? 's' : '') + ': ' + ancLabel + (par ? '' : '')
    };
  }

  function relation(aId, bId) {
    var direct = bloodRelation(aId, bId);
    if (direct) return direct;
    var b = S.person(bId);
    // partner?
    var partners = S.partnersOf(aId);
    for (var i = 0; i < partners.length; i++) {
      if (partners[i].id === bId) return { term: 'your ' + g(b, 'husband', 'wife', 'partner'), path: [aId, bId], description: '' };
    }
    // via b's partner
    var bp = S.partnersOf(bId);
    for (var j = 0; j < bp.length; j++) {
      var r = bloodRelation(aId, bp[j].id);
      if (r) {
        var t = r.term.replace(/^your /, '');
        var term;
        if (/^(brother|sister|half-brother|half-sister)$/.test(t)) term = g(b, 'brother', 'sister', 'sibling') + '-in-law';
        else if (/^(son|daughter)$/.test(t)) term = g(b, 'son', 'daughter', 'child') + '-in-law';
        else if (/^(father|mother)$/.test(t)) term = g(b, 'stepfather', 'stepmother', 'step-parent');
        else term = g(b, 'husband', 'wife', 'partner') + ' of your ' + t;
        return { term: 'your ' + term, path: r.path.concat([bId]), description: r.description };
      }
    }
    // via a's partner
    var ap = S.partnersOf(aId);
    for (var k = 0; k < ap.length; k++) {
      var r2 = bloodRelation(ap[k].id, bId);
      if (r2) {
        var t2 = r2.term.replace(/^your /, '');
        var inlaw2 = /^(father|mother|brother|sister|son|daughter)$/.test(t2);
        return { term: inlaw2 ? 'your ' + t2 + '-in-law' : 'your ' + g(ap[k], 'husband', 'wife', 'partner') + '\u2019s ' + t2, path: [aId].concat(r2.path), description: r2.description };
      }
    }
    return { term: 'no known relationship', path: [], description: 'No shared ancestors or marriages recorded between you.' };
  }

  return { relation: relation, ancestors: ancestors };
})();
