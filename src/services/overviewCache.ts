const store = new Map<string, { at: number; data: unknown }>();
const flights = new Map<string, Promise<unknown>>();

export function clearOverviewCache() {
  store.clear();
}

export async function cachedOverview<T>(key: string, ttlMs: number, load: () => Promise<T>): Promise<T> {
  const hit = store.get(key);
  if (hit && Date.now() - hit.at < ttlMs) return hit.data as T;
  const existing = flights.get(key);
  if (existing) return existing as Promise<T>;
  const promise = load()
    .then((data) => {
      store.set(key, { at: Date.now(), data });
      flights.delete(key);
      return data;
    })
    .catch((error: unknown) => {
      flights.delete(key);
      throw error;
    });
  flights.set(key, promise);
  return promise;
}
