/**
 * Storage adapter.
 *
 * Everything below the repository layer talks to this interface, never to
 * `localStorage` directly. When the Supabase (or NestJS) backend lands, the
 * repositories swap this adapter for a network client and nothing above the
 * repository layer changes.
 */
export interface StorageAdapter {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T): Promise<void>;
  remove(key: string): Promise<void>;
  keys(prefix: string): Promise<string[]>;
}

const NAMESPACE = "speech-therapy:v1";

function namespaced(key: string) {
  return `${NAMESPACE}:${key}`;
}

/** Used during SSR and in tests, where `window` does not exist. */
class MemoryStorageAdapter implements StorageAdapter {
  private store = new Map<string, string>();

  async get<T>(key: string): Promise<T | null> {
    const raw = this.store.get(namespaced(key));
    return raw ? (JSON.parse(raw) as T) : null;
  }

  async set<T>(key: string, value: T): Promise<void> {
    this.store.set(namespaced(key), JSON.stringify(value));
  }

  async remove(key: string): Promise<void> {
    this.store.delete(namespaced(key));
  }

  async keys(prefix: string): Promise<string[]> {
    const full = namespaced(prefix);
    return [...this.store.keys()]
      .filter((k) => k.startsWith(full))
      .map((k) => k.slice(NAMESPACE.length + 1));
  }
}

class LocalStorageAdapter implements StorageAdapter {
  async get<T>(key: string): Promise<T | null> {
    try {
      const raw = window.localStorage.getItem(namespaced(key));
      return raw ? (JSON.parse(raw) as T) : null;
    } catch {
      // Corrupt JSON or blocked storage: behave as if nothing was stored.
      return null;
    }
  }

  async set<T>(key: string, value: T): Promise<void> {
    try {
      window.localStorage.setItem(namespaced(key), JSON.stringify(value));
    } catch {
      // Quota or private-mode failures must not break a practice session.
    }
  }

  async remove(key: string): Promise<void> {
    window.localStorage.removeItem(namespaced(key));
  }

  async keys(prefix: string): Promise<string[]> {
    const full = namespaced(prefix);
    const out: string[] = [];
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i);
      if (k?.startsWith(full)) out.push(k.slice(NAMESPACE.length + 1));
    }
    return out;
  }
}

const memoryAdapter = new MemoryStorageAdapter();
const localAdapter = new LocalStorageAdapter();

export function getStorage(): StorageAdapter {
  return typeof window === "undefined" ? memoryAdapter : localAdapter;
}

export async function clearAllData(): Promise<void> {
  const storage = getStorage();
  const keys = await storage.keys("");
  await Promise.all(keys.map((k) => storage.remove(k)));
}
