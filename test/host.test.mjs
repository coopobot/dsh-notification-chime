import assert from 'node:assert/strict';
import test from 'node:test';

import { apply } from '../index.js';

test('the host half is an inert bundle row', () => {
  assert.equal(typeof apply, 'function');
  assert.equal(apply(), undefined);
});
