// Supabase sessions may exceed native keychain value limits. Keep every chunk encrypted,
// commit the manifest last and serialize storage operations (including logout).
export interface SecureAdapter {
  getItemAsync(key: string): Promise<string | null>;
  setItemAsync(key: string, value: string): Promise<void>;
  deleteItemAsync(key: string): Promise<void>;
}
interface Manifest { generation: string; count: number }
function chunks(value: string) {
  const result: string[] = []; let current = ''; let bytes = 0;
  for (const char of value) {
    const cp = char.codePointAt(0)!; const length = cp < 128 ? 1 : cp < 2048 ? 2 : cp < 65536 ? 3 : 4;
    if (bytes + length > 1500) { result.push(current); current = ''; bytes = 0; }
    current += char; bytes += length;
  }
  result.push(current); return result;
}
export function createChunkedStorage(adapter: SecureAdapter) {
  let serial = Promise.resolve<unknown>(undefined); let sequence = 0;
  const queued = <T>(work: () => Promise<T>) => {
    const result = serial.then(work, work); serial = result.catch(() => undefined); return result;
  };
  const root = (key: string) => { if (!/^[a-zA-Z0-9_.-]{1,200}$/.test(key)) throw new Error('Invalid secure storage key.'); return 'rl.' + key; };
  async function manifest(base: string): Promise<Manifest | null> {
    const raw = await adapter.getItemAsync(base + '.manifest'); if (!raw) return null;
    try {
      const m: unknown = JSON.parse(raw);
      if (m && typeof m === 'object' && 'generation' in m && 'count' in m && typeof m.generation === 'string'
        && /^[a-z0-9-]+$/.test(m.generation) && typeof m.count === 'number' && Number.isInteger(m.count) && m.count > 0 && m.count <= 128)
        return m as Manifest;
    } catch { /* Corrupt session fails closed. */ }
    return null;
  }
  const removeChunks = async (base: string, m: Manifest) => {
    await Promise.all(Array.from({ length: m.count }, (_, i) => adapter.deleteItemAsync(`${base}.${m.generation}.${i}`)));
  };
  return {
    getItem: (key: string) => queued(async () => {
      const base = root(key); const m = await manifest(base); if (!m) return null;
      const data = await Promise.all(Array.from({ length: m.count }, (_, i) => adapter.getItemAsync(`${base}.${m.generation}.${i}`)));
      return data.some(part => part === null) ? null : data.join('');
    }),
    setItem: (key: string, value: string) => queued(async () => {
      const base = root(key); const old = await manifest(base); const parts = chunks(value);
      if (parts.length > 128) throw new Error('Session exceeds secure-storage capacity.');
      const next = { generation: Date.now().toString(36) + '-' + (++sequence).toString(36) + '-' + Math.random().toString(36).slice(2), count: parts.length };
      try {
        for (let i = 0; i < parts.length; i++) await adapter.setItemAsync(`${base}.${next.generation}.${i}`, parts[i]!);
        await adapter.setItemAsync(base + '.manifest', JSON.stringify(next));
      } catch (error) { await removeChunks(base, next).catch(() => undefined); throw error; }
      // A committed new session remains valid even if cleanup of old encrypted chunks fails.
      if (old) await removeChunks(base, old).catch(() => undefined);
    }),
    removeItem: (key: string) => queued(async () => {
      const base = root(key); const old = await manifest(base);
      await adapter.deleteItemAsync(base + '.manifest');
      if (old) await removeChunks(base, old);
    })
  };
}
