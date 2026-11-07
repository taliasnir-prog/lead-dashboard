// Infrastructure smoke test only: confirms that `node --test` runs ES modules.
// Real logic tests (AC-x.y) are added together with js/logic.js.
import { test } from 'node:test';
import assert from 'node:assert/strict';

test('infra: node --test runs ES module tests', () => {
  assert.equal(typeof import.meta.url, 'string');
});
