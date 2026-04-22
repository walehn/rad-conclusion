/**
 * Minimal in-memory mock of Next.js `cookies()` return shape.
 *
 * Does NOT call vi.mock itself — each test file declares its own vi.mock for
 * 'next/headers' that references its own cookieStoreRef. That prevents
 * vitest's mock-hoisting transform from trying to resolve a factory across
 * module boundaries.
 *
 * Exports a single shared store per createCookieStore() call and factories
 * that match the signatures iron-session / our csrf helpers actually use:
 * .get(name), .set({ name, value, ...options }) / .set(name, value, options),
 * and .delete(name).
 */

export interface CookieValue {
  value: string;
  options?: Record<string, unknown>;
}

export interface CookieStore {
  store: Map<string, CookieValue>;
  jar: {
    get(name: string): { name: string; value: string } | undefined;
    set(
      arg1: string | { name: string; value: string; [k: string]: unknown },
      value?: string,
      options?: Record<string, unknown>
    ): void;
    delete(name: string): void;
    has(name: string): boolean;
    getAll(): Array<{ name: string; value: string }>;
  };
}

/** Creates a fresh cookie store and returns handles for assertions. */
export function createCookieStore(): CookieStore {
  const store = new Map<string, CookieValue>();
  const jar: CookieStore['jar'] = {
    get(name: string) {
      const entry = store.get(name);
      return entry ? { name, value: entry.value } : undefined;
    },
    set(
      arg1: string | { name: string; value: string; [k: string]: unknown },
      value?: string,
      options?: Record<string, unknown>
    ) {
      if (typeof arg1 === 'string') {
        store.set(arg1, { value: value ?? '', options });
      } else {
        const { name, value: v, ...rest } = arg1;
        store.set(name, { value: v, options: rest });
      }
    },
    delete(name: string) {
      store.delete(name);
    },
    has(name: string) {
      return store.has(name);
    },
    getAll() {
      return Array.from(store.entries()).map(([name, { value }]) => ({
        name,
        value,
      }));
    },
  };
  return { store, jar };
}

/** Redirect shim used for requireSession tests. */
export class RedirectError extends Error {
  constructor(public url: string) {
    super('REDIRECT');
    this.name = 'RedirectError';
  }
}
