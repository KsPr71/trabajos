import * as SQLite from 'expo-sqlite';

const DB_NAME = 'historial_precios_local_cache.db';
const SNAPSHOT_KEY = 'historial_precios';

let initialized = false;
let initPromise: Promise<void> | null = null;
let writeQueue: Promise<void> = Promise.resolve();

const dbPromise = SQLite.openDatabaseAsync(DB_NAME);

type CachedHistorialPreciosSnapshot = {
  payload: unknown;
  updatedAt: string;
};

async function ensureSchema() {
  if (initialized) {
    return;
  }

  if (initPromise) {
    await initPromise;
    return;
  }

  initPromise = (async () => {
    const db = await dbPromise;

    await db.runAsync(
      `create table if not exists historial_precios_cache (
        key text primary key not null,
        payload text not null,
        updated_at text not null
      )`
    );

    initialized = true;
  })();

  try {
    await initPromise;
  } finally {
    initPromise = null;
  }
}

export async function getCachedHistorialPreciosSnapshot(): Promise<CachedHistorialPreciosSnapshot | null> {
  await ensureSchema();
  const db = await dbPromise;

  const row = await db.getFirstAsync<{
    payload: string;
    updated_at: string;
  }>('select payload, updated_at from historial_precios_cache where key = ?', [SNAPSHOT_KEY]);

  if (!row) {
    return null;
  }

  try {
    return {
      payload: JSON.parse(row.payload),
      updatedAt: row.updated_at,
    };
  } catch {
    return null;
  }
}

export async function replaceCachedHistorialPreciosSnapshot(payload: unknown): Promise<void> {
  writeQueue = writeQueue.then(async () => {
    await ensureSchema();
    const db = await dbPromise;
    const now = new Date().toISOString();

    await db.runAsync(
      `insert into historial_precios_cache (key, payload, updated_at)
       values (?, ?, ?)
       on conflict(key) do update set
         payload = excluded.payload,
         updated_at = excluded.updated_at`,
      [SNAPSHOT_KEY, JSON.stringify(payload), now]
    );
  });

  await writeQueue;
}
