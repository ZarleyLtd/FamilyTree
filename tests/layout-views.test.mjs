import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const Desc = require('../assets/js/utils/layout-descendants.js');
const Hour = require('../assets/js/utils/layout-hourglass.js');
const Fan = require('../assets/js/utils/layout-fan.js');
const Kin = require('../assets/js/utils/kinship.js');

function person(id, sex, name) {
  const [givenNames, surname] = name.split(' ');
  return { id, sex, givenNames, surname, birthYear: 1900 };
}

const people = {
  pp: person('pp', 'M', 'Patrick Power'),
  pm: person('pm', 'F', 'Brigid Cullen'),
  u: person('u', 'M', 'Owen Power'),
  f: person('f', 'M', 'John Power'),
  m: person('m', 'F', 'Mary Byrne'),
  a: person('a', 'M', 'James Power'),
  b: person('b', 'F', 'Anne Power'),
  w: person('w', 'F', 'Sara Doyle'),
  h: person('h', 'M', 'Tom Walsh'),
  c: person('c', 'M', 'Liam Power'),
  d: person('d', 'F', 'Nuala Walsh'),
  e: person('e', 'F', 'Aoife Power'),
  e2: person('e2', 'M', 'Cian Walsh'),
  s: person('s', 'M', 'Paul Power'),
  f2: person('f2', 'M', 'Denis Power'),
  z: person('z', 'F', 'Ruth Strange')
};

const parents = {
  f: { fatherId: 'pp', motherId: 'pm' },
  u: { fatherId: 'pp', motherId: 'pm' },
  a: { fatherId: 'f', motherId: 'm' },
  b: { fatherId: 'f', motherId: 'm' },
  s: { fatherId: 'f2', motherId: 'm' },
  c: { fatherId: 'a', motherId: 'w' },
  d: { fatherId: 'h', motherId: 'b' },
  e: { fatherId: 'c', motherId: null },
  e2: { fatherId: null, motherId: 'd' }
};

const children = {
  pp: ['f', 'u'],
  pm: ['f', 'u'],
  f: ['a', 'b'],
  m: ['a', 'b', 's'],
  f2: ['s'],
  a: ['c'],
  w: ['c'],
  b: ['d'],
  h: ['d'],
  c: ['e'],
  d: ['e2']
};

const partners = {
  pp: ['pm'], pm: ['pp'],
  f: ['m'], m: ['f', 'f2'], f2: ['m'],
  a: ['w'], w: ['a'],
  b: ['h'], h: ['b']
};

const graph = {
  person: (id) => people[id] || null,
  parentsOf: (id) => parents[id] || { fatherId: null, motherId: null },
  childrenOf: (id) => (children[id] || []).slice(),
  partnersOf: (id) => (partners[id] || []).slice()
};

function overlaps(a, b) {
  const ax2 = a.x + a.w + Desc.partnerExtra(a);
  const bx2 = b.x + b.w + Desc.partnerExtra(b);
  return a.x < bx2 && ax2 > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

test('descendants place children below and partners beside', () => {
  const layout = Desc.layoutDescendants('f', 3, graph);
  const father = layout.nodes.find((n) => n.id === 'f');
  const james = layout.nodes.find((n) => n.id === 'a');
  const anne = layout.nodes.find((n) => n.id === 'b');
  assert.ok(father && james && anne);
  assert.ok(james.y > father.y);
  assert.ok(anne.y > father.y);
  assert.ok(father.partners.some((p) => p.id === 'm'));
  assert.equal(overlaps(james, anne), false);
  assert.ok(layout.bbox.width > father.w);
});

test('collapsed generation omits descendants', () => {
  const open = Desc.layoutDescendants('f', 3, graph);
  const shut = Desc.layoutDescendants('f', 3, graph, { collapsed: { f: true } });
  assert.ok(open.nodes.some((n) => n.id === 'a'));
  assert.equal(shut.nodes.some((n) => n.id === 'a'), false);
  assert.equal(shut.nodes[0].hiddenCount, 2);
  assert.equal(shut.nodes.length, 1);
});

test('hourglass keeps one focus with ancestors above and descendants below', () => {
  const layout = Hour.layoutHourglass('a', 3, 3, graph);
  const focus = layout.nodes.filter((n) => n.id === 'a' && !n.placeholder);
  assert.equal(focus.length, 1);
  const up = layout.nodes.find((n) => n.id === 'f');
  const down = layout.nodes.find((n) => n.id === 'c');
  assert.ok(up.y < focus[0].y);
  assert.ok(down.y > focus[0].y);
  assert.ok(layout.nodes.some((n) => n.placeholder));
});

test('fan colours the father line paternal and the mother line maternal', () => {
  const fan = Fan.layoutFan('a', 4, 180, graph);
  const father = fan.sectors.find((s) => s.id === 'f');
  const mother = fan.sectors.find((s) => s.id === 'm');
  assert.equal(father.side, 'pat');
  assert.equal(mother.side, 'mat');
  assert.ok(fan.bbox.height < fan.bbox.width);
  const full = Fan.layoutFan('a', 4, 360, graph);
  assert.equal(full.spanDeg, 360);
  assert.equal(full.bbox.width, full.bbox.height);
  assert.ok(full.sectors.length >= fan.sectors.length);
});

test('kinship names siblings, cousins, and in-laws', () => {
  assert.equal(Kin.relate('a', 'f', graph).term, 'father');
  assert.equal(Kin.relate('f', 'a', graph).term, 'son');
  assert.equal(Kin.relate('a', 'b', graph).term, 'sister');
  assert.equal(Kin.relate('a', 's', graph).term, 'half-brother');
  assert.equal(Kin.relate('a', 'd', graph).term, 'niece');
  assert.equal(Kin.relate('d', 'a', graph).term, 'uncle');
  assert.equal(Kin.relate('c', 'd', graph).term, 'first cousin');
  assert.equal(Kin.relate('e', 'd', graph).term, 'first cousin once removed');
  assert.equal(Kin.relate('e', 'e2', graph).term, 'second cousin');
  assert.equal(Kin.relate('c', 'u', graph).term, 'great-uncle');
  assert.equal(Kin.relate('a', 'w', graph).term, 'wife');
  assert.equal(Kin.relate('a', 'h', graph).term, 'brother-in-law');
  assert.equal(Kin.relate('a', 'a', graph).same, true);
  assert.equal(Kin.relate('a', 'z', graph).unrelated, true);
  const rel = Kin.relate('c', 'd', graph);
  assert.ok(rel.path[0] === 'c' && rel.path[rel.path.length - 1] === 'd');
  assert.match(Kin.phrase(people.a, people.d, Kin.relate('a', 'd', graph)), /Nuala Walsh is James Power.s niece/);
});

test('relationship path lays out left to right', () => {
  const path = Kin.layoutPath([people.a, people.f, people.pp]);
  assert.equal(path.nodes.length, 3);
  assert.ok(path.nodes[1].x > path.nodes[0].x);
  assert.equal(path.edges.length, 2);
  assert.ok(path.bbox.width > path.nodes[0].w);
});
