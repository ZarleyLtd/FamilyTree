import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const GenDate = require('../assets/js/utils/gen-date.js');

test('year only is about mid-year', () => {
  const d = GenDate.parse('1842');
  assert.equal(d.qualifier, 'about');
  assert.equal(d.sort, '1842-07-01');
  assert.equal(GenDate.yearOf(d), 1842);
});

test('abt / before / after', () => {
  assert.equal(GenDate.parse('abt 1842').qualifier, 'about');
  assert.equal(GenDate.parse('bef 1900').sort, '1900-01-01');
  assert.equal(GenDate.parse('aft 1850').sort, '1850-12-31');
});

test('range and full date', () => {
  const r = GenDate.parse('1850–1855');
  assert.equal(r.qualifier, 'between');
  assert.equal(r.sort, '1850-01-01');
  assert.equal(r.end, '1855-12-31');
  const exact = GenDate.parse('12 Mar 1901');
  assert.equal(exact.sort, '1901-03-12');
  assert.equal(exact.qualifier, 'exact');
});

test('month year and quarter', () => {
  assert.equal(GenDate.parse('Mar 1901').sort, '1901-03-01');
  assert.equal(GenDate.parse('Q2 1864').sort, '1864-05-15');
  assert.equal(GenDate.parse('Q2 1864').qualifier, 'about');
});

test('empty is null', () => {
  assert.equal(GenDate.parse(''), null);
});
