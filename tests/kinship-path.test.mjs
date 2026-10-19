import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const Kinship = require('../assets/js/utils/kinship.js');

test('displayTerm capitalises the first letter', () => {
  assert.equal(Kinship.displayTerm('first cousin'), 'First cousin');
  assert.equal(Kinship.displayTerm('half-brother'), 'Half-brother');
  assert.equal(Kinship.displayTerm(''), '');
});

test('wrapLines keeps short terms on one line', () => {
  assert.deepEqual(Kinship.wrapLines('Father', 16), ['Father']);
});

test('wrapLines splits long cousin wording', () => {
  const lines = Kinship.wrapLines('Second cousin once removed', 14);
  assert.ok(lines.length >= 2);
  lines.forEach((line) => assert.ok(line.length <= 16));
});

test('layoutPath labels every box after the start, and each hop under its link', () => {
  const path = [
    { id: 'a', givenNames: 'Ann', surname: 'Power' },
    { id: 'b', givenNames: 'Rosaleen', surname: 'Power', kinTerm: 'mother', hopTerm: 'mother' },
    { id: 'c', givenNames: 'Ellen', surname: 'Cullinane', kinTerm: 'grandmother', hopTerm: 'mother' },
    { id: 'd', givenNames: 'James', surname: 'Cullinane', kinTerm: 'great-grandfather', hopTerm: 'father' }
  ];
  const layout = Kinship.layoutPath(path);
  assert.equal(layout.nodes.length, 4);
  assert.equal(layout.edges.length, 3);
  assert.deepEqual(layout.nodes[0].topLabel, []);
  assert.deepEqual(layout.nodes[1].topLabel, ['Mother']);
  assert.deepEqual(layout.nodes[2].topLabel, ['Grandmother']);
  assert.deepEqual(layout.nodes[3].topLabel, ['Great-', 'grandfather']);
  assert.deepEqual(layout.edges[0].belowLabel, ['Mother']);
  assert.deepEqual(layout.edges[1].belowLabel, ['Mother']);
  assert.deepEqual(layout.edges[2].belowLabel, ['Father']);
  assert.ok(layout.nodes[1].y > 0);
  assert.ok(layout.bbox.height > 46);
});

test('two-person path labels the target on top and the hop under the link', () => {
  const layout = Kinship.layoutPath([
    { id: 'a', givenNames: 'John' },
    { id: 'b', givenNames: 'Rosaleen', kinTerm: 'mother', hopTerm: 'mother' }
  ]);
  assert.deepEqual(layout.nodes[1].topLabel, ['Mother']);
  assert.deepEqual(layout.edges[0].belowLabel, ['Mother']);
});
