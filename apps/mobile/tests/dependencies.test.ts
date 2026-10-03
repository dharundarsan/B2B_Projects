import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
test('Expo Router query-string keeps CommonJS parse and stringify compatibility', () => {
  const query = require('query-string');
  assert.equal(query.parse('name=Maple%20Residency&unit=A-204').name, 'Maple Residency');
  assert.equal(query.stringify({ unit: 'A-204' }), 'unit=A-204');
});
test('Patched URI decoder handles malformed input without recursive exponential work', () => {
  const query = require('query-string'); const input = '%FF'.repeat(8000); const start = performance.now();
  assert.equal(query.parse('key=' + input).key, input); assert.ok(performance.now() - start < 2000);
});
test('Xcode UUID dependency still exposes its required v4 function', () => {
  const { v4 } = require('uuid'); assert.match(v4(), /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
});
