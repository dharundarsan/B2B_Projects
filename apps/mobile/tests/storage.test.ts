import test from 'node:test';
import assert from 'node:assert/strict';
import { createChunkedStorage, type SecureAdapter } from '../src/lib/chunkedStorage';

function fixture() {
  const data = new Map<string, string>(); let fail = '';
  const adapter: SecureAdapter = {
    getItemAsync: async key => data.get(key) ?? null,
    setItemAsync: async (key, value) => { if (fail && key.endsWith(fail)) throw new Error('Native write failed'); assert.ok(Buffer.byteLength(value) <= 1500); data.set(key, value); },
    deleteItemAsync: async key => { data.delete(key); }
  };
  return { data, storage: createChunkedStorage(adapter), fail: (value: string) => { fail = value; } };
}
test('Large Unicode sessions round-trip through bounded encrypted chunks', async () => {
  const { storage, data } = fixture(); const value = JSON.stringify({ token: 'தமிழ் हिन्दी 🔑'.repeat(1000) });
  await storage.setItem('sb-project-auth-token', value); assert.equal(await storage.getItem('sb-project-auth-token'), value); assert.ok(data.size > 2);
});
test('Replacing a session removes old chunks and logout removes the manifest first', async () => {
  const { storage, data } = fixture(); await storage.setItem('session', 'a'.repeat(6000)); await storage.setItem('session', 'b');
  assert.equal(data.size, 2); assert.equal(await storage.getItem('session'), 'b'); await storage.removeItem('session'); assert.equal(await storage.getItem('session'), null); assert.equal(data.size, 0);
});
test('A failed manifest commit preserves the last valid session', async () => {
  const f = fixture(); await f.storage.setItem('session', 'old'); f.fail('.manifest'); await assert.rejects(f.storage.setItem('session', 'new'), /Native write/);
  assert.equal(await f.storage.getItem('session'), 'old'); assert.equal(f.data.size, 2);
});
test('Missing or corrupt chunks fail closed', async () => {
  const { storage, data } = fixture(); await storage.setItem('session', 'value'); const part = [...data.keys()].find(k => !k.endsWith('.manifest'))!; data.delete(part);
  assert.equal(await storage.getItem('session'), null); data.set('rl.session.manifest', '{not json'); assert.equal(await storage.getItem('session'), null);
});
test('Concurrent refresh and logout are serialized', async () => {
  const { storage } = fixture(); const writes = [storage.setItem('session', 'first'), storage.setItem('session', 'second'), storage.removeItem('session')];
  await Promise.all(writes); assert.equal(await storage.getItem('session'), null);
});
