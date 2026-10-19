/**
 * Relationship calculator. Keep in sync with assets/js/utils/kinship.js.
 */
export type KinPerson = {
  id: string;
  sex: string;
  givenNames: string;
  surname: string;
  birthSurname?: string | null;
};

export type KinGraph = {
  person: (id: string) => KinPerson | null;
  parentsOf: (id: string) => { fatherId: string | null; motherId: string | null };
  partnersOf: (id: string) => string[];
};

export type KinResult = {
  term: string;
  path: string[];
  commonAncestorIds: string[];
  description: string;
  same?: boolean;
  unrelated?: boolean;
};

type AncMap = Record<string, { depth: number; via: string | null }>;

function ancestorsOf(id: string, graph: KinGraph): AncMap {
  const out: AncMap = {};
  if (!id) return out;
  const queue = [id];
  out[id] = { depth: 0, via: null };
  while (queue.length) {
    const cur = queue.shift() as string;
    const depth = out[cur].depth;
    const par = graph.parentsOf(cur) || { fatherId: null, motherId: null };
    for (const pid of [par.fatherId, par.motherId]) {
      if (!pid || out[pid]) continue;
      out[pid] = { depth: depth + 1, via: cur };
      queue.push(pid);
    }
  }
  return out;
}

function ordinal(n: number) {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

function cousinDegree(n: number) {
  if (n === 1) return "first";
  if (n === 2) return "second";
  if (n === 3) return "third";
  if (n === 4) return "fourth";
  return ordinal(n);
}

function greats(n: number) {
  if (n <= 0) return "";
  if (n === 1) return "great-";
  if (n === 2) return "great-great-";
  return n + "\u00d7 great-";
}

function removedWord(n: number) {
  if (!n) return "";
  if (n === 1) return " once removed";
  if (n === 2) return " twice removed";
  return " " + n + " times removed";
}

function bySex(person: KinPerson | null, male: string, female: string, unknown: string) {
  const sex = person && person.sex;
  if (sex === "M") return male;
  if (sex === "F") return female;
  return unknown;
}

export function shortName(p: KinPerson | null) {
  if (!p) return "Unknown";
  const given = String(p.givenNames || "").trim();
  return (given + " " + (p.surname || "")).trim() || "Unknown";
}

function possessive(name: string) {
  return name + "\u2019s";
}

function ancestorTerm(other: KinPerson | null, d: number) {
  if (d === 1) return bySex(other, "father", "mother", "parent");
  return greats(d - 2) + bySex(other, "grandfather", "grandmother", "grandparent");
}

function descendantTerm(other: KinPerson | null, d: number) {
  if (d === 1) return bySex(other, "son", "daughter", "child");
  return greats(d - 2) + bySex(other, "grandson", "granddaughter", "grandchild");
}

function pathVia(ancId: string, ancA: AncMap, ancB: AncMap) {
  const up: string[] = [];
  let cur: string | null = ancId;
  let guard = 0;
  while (cur && guard < 64) {
    up.unshift(cur);
    cur = ancA[cur] ? ancA[cur].via : null;
    guard += 1;
  }
  const down: string[] = [];
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

function siblingWord(graph: KinGraph, aId: string, bId: string, other: KinPerson | null) {
  const pa = graph.parentsOf(aId) || { fatherId: null, motherId: null };
  const pb = graph.parentsOf(bId) || { fatherId: null, motherId: null };
  const sameFather = !!(pa.fatherId && pb.fatherId && pa.fatherId === pb.fatherId);
  const sameMother = !!(pa.motherId && pb.motherId && pa.motherId === pb.motherId);
  const diffFather = !!(pa.fatherId && pb.fatherId && pa.fatherId !== pb.fatherId);
  const diffMother = !!(pa.motherId && pb.motherId && pa.motherId !== pb.motherId);
  const half = (sameFather || sameMother) && (diffFather || diffMother);
  return (half ? "half-" : "") + bySex(other, "brother", "sister", "sibling");
}

function stub(id: string): AncMap {
  return { [id]: { via: null, depth: 0 } };
}

function coAncestor(ancId: string, ancMe: AncMap, ancOther: AncMap, graph: KinGraph) {
  const partners = graph.partnersOf(ancId) || [];
  for (const pid of partners) {
    if (pid !== ancId && ancMe[pid] && ancOther[pid]) return pid;
  }
  return null;
}

function bloodRelation(meId: string, otherId: string, graph: KinGraph): KinResult | null {
  if (meId === otherId) {
    return { term: "", path: [meId], commonAncestorIds: [], description: "", same: true };
  }
  const other = graph.person(otherId);
  const ancMe = ancestorsOf(meId, graph);
  const ancOther = ancestorsOf(otherId, graph);
  if (ancMe[otherId]) {
    return {
      term: ancestorTerm(other, ancMe[otherId].depth),
      path: pathVia(otherId, ancMe, stub(otherId)),
      commonAncestorIds: [],
      description: "",
    };
  }
  if (ancOther[meId]) {
    return {
      term: descendantTerm(other, ancOther[meId].depth),
      path: pathVia(meId, stub(meId), ancOther),
      commonAncestorIds: [],
      description: "",
    };
  }
  let best: { id: string; da: number; db: number } | null = null;
  for (const id of Object.keys(ancMe)) {
    if (!ancOther[id]) continue;
    const da = ancMe[id].depth;
    const db = ancOther[id].depth;
    if (
      !best || da + db < best.da + best.db ||
      (da + db === best.da + best.db && Math.max(da, db) < Math.max(best.da, best.db))
    ) {
      best = { id, da, db };
    }
  }
  if (!best) return null;
  const da = best.da;
  const db = best.db;
  let term: string;
  if (da === 1 && db === 1) term = siblingWord(graph, meId, otherId, other);
  else if (da === 1) term = greats(db - 2) + bySex(other, "nephew", "niece", "nibling");
  else if (db === 1) term = greats(da - 2) + bySex(other, "uncle", "aunt", "parent\u2019s sibling");
  else term = cousinDegree(Math.min(da, db) - 1) + " cousin" + removedWord(Math.abs(da - db));
  const ids = [best.id];
  const co = coAncestor(best.id, ancMe, ancOther, graph);
  if (co) ids.push(co);
  const label = ids.map((id) => shortName(graph.person(id))).join(" and ");
  return {
    term,
    path: pathVia(best.id, ancMe, ancOther),
    commonAncestorIds: ids,
    description: "Common ancestor" + (ids.length > 1 ? "s" : "") + ": " + label,
  };
}

function inLawViaOther(bloodTerm: string, other: KinPerson | null) {
  if (/^(brother|sister|half-brother|half-sister|sibling)$/.test(bloodTerm)) {
    return bySex(other, "brother", "sister", "sibling") + "-in-law";
  }
  if (/^(son|daughter|child)$/.test(bloodTerm)) {
    return bySex(other, "son", "daughter", "child") + "-in-law";
  }
  if (/^(father|mother|parent)$/.test(bloodTerm)) {
    return bySex(other, "stepfather", "stepmother", "step-parent");
  }
  return bySex(other, "husband", "wife", "partner") + " of your " + bloodTerm;
}

function inLawViaMine(bloodTerm: string, partner: KinPerson | null) {
  if (/^(father|mother|parent|brother|sister|sibling|son|daughter|child)$/.test(bloodTerm)) {
    return bloodTerm + "-in-law";
  }
  return bySex(partner, "husband", "wife", "partner") + "\u2019s " + bloodTerm;
}

export function relate(meId: string, otherId: string, graph: KinGraph): KinResult {
  const direct = bloodRelation(meId, otherId, graph);
  if (direct) return direct;
  const other = graph.person(otherId);
  const mine = graph.partnersOf(meId) || [];
  for (const pid of mine) {
    if (pid === otherId) {
      return {
        term: bySex(other, "husband", "wife", "partner"),
        path: [meId, otherId],
        commonAncestorIds: [],
        description: "",
      };
    }
  }
  const theirs = graph.partnersOf(otherId) || [];
  for (const pid of theirs) {
    const via = bloodRelation(meId, pid, graph);
    if (via && via.term && !via.same) {
      return {
        term: inLawViaOther(via.term, other),
        path: via.path.concat([otherId]),
        commonAncestorIds: via.commonAncestorIds,
        description: via.description,
      };
    }
  }
  for (const pid of mine) {
    const via2 = bloodRelation(pid, otherId, graph);
    if (via2 && via2.term && !via2.same) {
      return {
        term: inLawViaMine(via2.term, graph.person(pid)),
        path: [meId].concat(via2.path),
        commonAncestorIds: via2.commonAncestorIds,
        description: via2.description,
      };
    }
  }
  return {
    term: "",
    path: [],
    commonAncestorIds: [],
    description: "No shared ancestors or marriages are recorded.",
    unrelated: true,
  };
}

export function phrase(me: KinPerson | null, other: KinPerson | null, rel: KinResult) {
  const meName = shortName(me);
  const otherName = shortName(other);
  if (!rel || rel.unrelated || !rel.term) {
    if (rel && rel.same) return otherName + " is the same person as " + meName + ".";
    return "No known relationship is recorded between " + meName + " and " + otherName + ".";
  }
  if (rel.same) return otherName + " is the same person as " + meName + ".";
  if (rel.term.indexOf("your ") >= 0) {
    return otherName + " is the " + rel.term.replace("your ", possessive(meName) + " ") + ".";
  }
  if (rel.term.indexOf("\u2019s ") >= 0) {
    return otherName + " is " + meName + "\u2019s " + rel.term + ".";
  }
  return otherName + " is " + possessive(meName) + " " + rel.term + ".";
}
