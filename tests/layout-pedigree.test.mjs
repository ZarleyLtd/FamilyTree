import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const Layout = require('../assets/js/utils/layout-pedigree.js');

const people = {
  c: { id: 'c', givenNames: 'Child' },
  f: { id: 'f', givenNames: 'Father' },
  m: { id: 'm', givenNames: 'Mother' },
  ff: { id: 'ff', givenNames: 'GF' }
};
const parents = {
  c: { fatherId: 'f', motherId: 'm' },
  f: { fatherId: 'ff', motherId: null },
  m: { fatherId: null, motherId: null },
  ff: { fatherId: null, motherId: null }
};
const graph = {
  person: (id) => people[id] || null,
  parentsOf: (id) => parents[id] || { fatherId: null, motherId: null }
};

test('pedigree includes focus, parents, and placeholders', () => {
  const layout = Layout.layoutPedigree('c', 3, 'h', graph);
  const ids = layout.nodes.filter((n) => n.id).map((n) => n.id);
  assert.ok(ids.includes('c'));
  assert.ok(ids.includes('f'));
  assert.ok(ids.includes('m'));
  assert.ok(ids.includes('ff'));
  const ph = layout.nodes.filter((n) => n.placeholder);
  assert.ok(ph.length >= 2);
  assert.equal(layout.orient, 'h');
  assert.ok(layout.bbox.width > 0);
});

test('vertical orientation stacks generations', () => {
  const layout = Layout.layoutPedigree('c', 2, 'v', graph);
  const child = layout.nodes.find((n) => n.id === 'c');
  const father = layout.nodes.find((n) => n.id === 'f');
  assert.ok(child.y > father.y);
});
