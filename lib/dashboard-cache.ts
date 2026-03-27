import * as SQLite from "expo-sqlite";

const DB_NAME = "dashboard_local_cache.db";
const SNAPSHOT_KEY = "dashboard_resumen";

let initialized = false;
let initPromise: Promise<void> | null = null;
let writeQueue: Promise<void> = Promise.resolve();

const dbPromise = SQLite.openDatabaseAsync(DB_NAME);

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
      `create table if not exists dashboard_cache (
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

export type CachedDashboardSnapshot = {
  payload: unknown;
  updatedAt: string;
};

export async function getCachedDashboardSnapshot(): Promise<CachedDashboardSnapshot | null> {
  await ensureSchema();
  const db = await dbPromise;

  const row = await db.getFirstAsync<{
    payload: string;
    updated_at: string;
  }>("select payload, updated_at from dashboard_cache where key = ?", [SNAPSHOT_KEY]);

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

export async function replaceCachedDashboardSnapshot(payload: unknown): Promise<void> {
  writeQueue = writeQueue.then(async () => {
    await ensureSchema();
    const db = await dbPromise;
    const now = new Date().toISOString();

    await db.runAsync(
      `insert into dashboard_cache (key, payload, updated_at)
       values (?, ?, ?)
       on conflict(key) do update set
         payload = excluded.payload,
         updated_at = excluded.updated_at`,
      [SNAPSHOT_KEY, JSON.stringify(payload), now]
    );
  });

  await writeQueue;
}
