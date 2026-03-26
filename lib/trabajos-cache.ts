import * as SQLite from 'expo-sqlite';

export type CachedTrabajo = {
  id: number;
  nombreTrabajo: string;
  autor: string;
  especialidad: string;
  tipoTrabajo: string;
  fechaEntrega: string | null;
  estado: 'creado' | 'en_proceso' | 'terminado' | 'entregado';
  updatedAt: string;
};

const DB_NAME = 'trabajos_local_cache.db';

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
      `create table if not exists trabajos_cache (
        id integer primary key not null,
        nombre_trabajo text not null,
        autor text not null,
        especialidad text not null,
        tipo_trabajo text not null default '',
        fecha_entrega text,
        estado text not null,
        updated_at text not null
      )`
    );

    await ensureColumn(db, 'trabajos_cache', 'tipo_trabajo');
    await ensureColumn(db, 'trabajos_cache', 'fecha_entrega');

    await db.runAsync(
      `create table if not exists cache_meta (
        key text primary key not null,
        value text not null
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

async function ensureColumn(
  db: SQLite.SQLiteDatabase,
  tableName: 'trabajos_cache',
  columnName: 'tipo_trabajo' | 'fecha_entrega'
) {
  const columns = await db.getAllAsync<{ name: string }>(`pragma table_info(${tableName})`);
  const exists = columns.some((column) => column.name === columnName);

  if (exists) {
    return;
  }

  if (columnName === 'tipo_trabajo') {
    await db.runAsync(`alter table ${tableName} add column tipo_trabajo text not null default ''`);
    return;
  }

  await db.runAsync(`alter table ${tableName} add column fecha_entrega text`);
}

export async function getCachedTrabajos(): Promise<CachedTrabajo[]> {
  await ensureSchema();
  const db = await dbPromise;

  const rows = await db.getAllAsync<{
    id: number;
    nombre_trabajo: string;
    autor: string;
    especialidad: string;
    tipo_trabajo: string;
    fecha_entrega: string | null;
    estado: string;
    updated_at: string;
  }>(
    `select id, nombre_trabajo, autor, especialidad, tipo_trabajo, fecha_entrega, estado, updated_at
     from trabajos_cache
     order by updated_at desc, id desc`
  );

  return rows.map((row) => ({
    id: row.id,
    nombreTrabajo: row.nombre_trabajo,
    autor: row.autor,
    especialidad: row.especialidad,
    tipoTrabajo: row.tipo_trabajo ?? '',
    fechaEntrega: row.fecha_entrega ?? null,
    estado: parseEstado(row.estado),
    updatedAt: row.updated_at,
  }));
}

export async function replaceCachedTrabajos(trabajos: CachedTrabajo[]): Promise<void> {
  writeQueue = writeQueue.then(async () => {
    await ensureSchema();
    const db = await dbPromise;
    const now = new Date().toISOString();

    await db.withTransactionAsync(async () => {
      await db.runAsync('delete from trabajos_cache');

      for (const trabajo of trabajos) {
        await db.runAsync(
          `insert into trabajos_cache (id, nombre_trabajo, autor, especialidad, tipo_trabajo, fecha_entrega, estado, updated_at)
           values (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            trabajo.id,
            trabajo.nombreTrabajo,
            trabajo.autor,
            trabajo.especialidad,
            trabajo.tipoTrabajo ?? '',
            trabajo.fechaEntrega ?? null,
            trabajo.estado,
            trabajo.updatedAt || now,
          ]
        );
      }

      await db.runAsync(
        `insert into cache_meta (key, value) values (?, ?)
         on conflict(key) do update set value = excluded.value`,
        ['trabajos_last_sync', now]
      );
    });
  });

  await writeQueue;
}

export async function getLastSyncAt(): Promise<string | null> {
  await ensureSchema();
  const db = await dbPromise;
  const row = await db.getFirstAsync<{ value: string }>(
    `select value from cache_meta where key = ?`,
    ['trabajos_last_sync']
  );
  return row?.value ?? null;
}

function parseEstado(rawValue: unknown): 'creado' | 'en_proceso' | 'terminado' | 'entregado' {
  if (rawValue === 'entregado') {
    return 'entregado';
  }
  if (rawValue === 'en_proceso') {
    return 'en_proceso';
  }
  if (rawValue === 'terminado') {
    return 'terminado';
  }
  return 'creado';
}
