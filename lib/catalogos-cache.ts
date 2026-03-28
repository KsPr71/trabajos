import * as SQLite from 'expo-sqlite';

export type CatalogoKey = 'clientes' | 'tipo_trabajo' | 'especialidad' | 'institucion';

export type CachedCatalogoItem = {
  id: number;
  nombre: string;
  precio?: number | null;
  color?: string | null;
  updatedAt: string;
};

export type CachedClienteItem = {
  id: number;
  nombre: string;
  telefono: string | null;
  updatedAt: string;
};

const DB_NAME = 'catalogos_local_cache.db';

const TABLE_BY_KEY: Record<CatalogoKey, string> = {
  clientes: 'clientes_cache',
  tipo_trabajo: 'tipo_trabajo_cache',
  especialidad: 'especialidad_cache',
  institucion: 'institucion_cache',
};

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
      `create table if not exists clientes_cache (
        id integer primary key not null,
        nombre text not null,
        telefono text,
        updated_at text not null
      )`
    );

    await ensureClientesTelefonoColumn(db);

    await db.runAsync(
      `create table if not exists tipo_trabajo_cache (
        id integer primary key not null,
        nombre text not null,
        precio real,
        color text,
        updated_at text not null
      )`
    );
    await ensureTipoTrabajoColumns(db);

    await db.runAsync(
      `create table if not exists especialidad_cache (
        id integer primary key not null,
        nombre text not null,
        updated_at text not null
      )`
    );

    await db.runAsync(
      `create table if not exists institucion_cache (
        id integer primary key not null,
        nombre text not null,
        updated_at text not null
      )`
    );

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

async function ensureClientesTelefonoColumn(db: SQLite.SQLiteDatabase) {
  const columns = await db.getAllAsync<{ name: string }>('pragma table_info(clientes_cache)');
  const hasTelefono = columns.some((column) => column.name === 'telefono');
  if (!hasTelefono) {
    await db.runAsync('alter table clientes_cache add column telefono text');
  }
}

async function ensureTipoTrabajoColumns(db: SQLite.SQLiteDatabase) {
  const columns = await db.getAllAsync<{ name: string }>('pragma table_info(tipo_trabajo_cache)');
  const hasPrecio = columns.some((column) => column.name === 'precio');
  const hasColor = columns.some((column) => column.name === 'color');

  if (!hasPrecio) {
    await db.runAsync('alter table tipo_trabajo_cache add column precio real');
  }
  if (!hasColor) {
    await db.runAsync('alter table tipo_trabajo_cache add column color text');
  }
}

export async function getCachedCatalogo(catalogo: CatalogoKey): Promise<CachedCatalogoItem[]> {
  await ensureSchema();
  const db = await dbPromise;
  const tableName = TABLE_BY_KEY[catalogo];

  if (catalogo === 'tipo_trabajo') {
    const rows = await db.getAllAsync<{
      id: number;
      nombre: string;
      precio: number | null;
      color: string | null;
      updated_at: string;
    }>(`select id, nombre, precio, color, updated_at from ${tableName} order by nombre asc, id asc`);

    return rows.map((row) => ({
      id: row.id,
      nombre: row.nombre,
      precio: Number.isFinite(Number(row.precio)) ? Number(row.precio) : null,
      color: typeof row.color === 'string' ? row.color : null,
      updatedAt: row.updated_at,
    }));
  }

  const rows = await db.getAllAsync<{ id: number; nombre: string; updated_at: string }>(`select id, nombre, updated_at from ${tableName} order by nombre asc, id asc`);

  return rows.map((row) => ({
    id: row.id,
    nombre: row.nombre,
    updatedAt: row.updated_at,
  }));
}

export async function replaceCachedCatalogo(
  catalogo: CatalogoKey,
  items: CachedCatalogoItem[]
): Promise<void> {
  writeQueue = writeQueue.then(async () => {
    await ensureSchema();
    const db = await dbPromise;
    const tableName = TABLE_BY_KEY[catalogo];
    const now = new Date().toISOString();

    await db.withTransactionAsync(async () => {
      await db.runAsync(`delete from ${tableName}`);

      for (const item of items) {
        if (catalogo === 'tipo_trabajo') {
          await db.runAsync(
            `insert into ${tableName} (id, nombre, precio, color, updated_at) values (?, ?, ?, ?, ?)`,
            [
              item.id,
              item.nombre,
              item.precio ?? null,
              item.color ?? null,
              item.updatedAt || now,
            ]
          );
        } else {
          await db.runAsync(
            `insert into ${tableName} (id, nombre, updated_at) values (?, ?, ?)`,
            [item.id, item.nombre, item.updatedAt || now]
          );
        }
      }

      await db.runAsync(
        `insert into cache_meta (key, value) values (?, ?)
         on conflict(key) do update set value = excluded.value`,
        [getMetaKey(catalogo), now]
      );
    });
  });

  await writeQueue;
}

export async function getCachedClientesConTelefono(): Promise<CachedClienteItem[]> {
  await ensureSchema();
  const db = await dbPromise;
  const rows = await db.getAllAsync<{
    id: number;
    nombre: string;
    telefono: string | null;
    updated_at: string;
  }>('select id, nombre, telefono, updated_at from clientes_cache order by nombre asc, id asc');

  return rows.map((row) => ({
    id: row.id,
    nombre: row.nombre,
    telefono: row.telefono ?? null,
    updatedAt: row.updated_at,
  }));
}

export async function replaceCachedClientesConTelefono(items: CachedClienteItem[]): Promise<void> {
  writeQueue = writeQueue.then(async () => {
    await ensureSchema();
    const db = await dbPromise;
    const now = new Date().toISOString();

    await db.withTransactionAsync(async () => {
      await db.runAsync('delete from clientes_cache');

      for (const item of items) {
        await db.runAsync(
          'insert into clientes_cache (id, nombre, telefono, updated_at) values (?, ?, ?, ?)',
          [item.id, item.nombre, item.telefono ?? null, item.updatedAt || now]
        );
      }

      await db.runAsync(
        `insert into cache_meta (key, value) values (?, ?)
         on conflict(key) do update set value = excluded.value`,
        [getMetaKey('clientes'), now]
      );
    });
  });

  await writeQueue;
}

export async function upsertCachedClienteConTelefono(item: CachedClienteItem): Promise<void> {
  writeQueue = writeQueue.then(async () => {
    await ensureSchema();
    const db = await dbPromise;
    const now = new Date().toISOString();

    await db.withTransactionAsync(async () => {
      await db.runAsync(
        `insert into clientes_cache (id, nombre, telefono, updated_at)
         values (?, ?, ?, ?)
         on conflict(id) do update set
           nombre = excluded.nombre,
           telefono = excluded.telefono,
           updated_at = excluded.updated_at`,
        [item.id, item.nombre, item.telefono ?? null, item.updatedAt || now]
      );

      await db.runAsync(
        `insert into cache_meta (key, value) values (?, ?)
         on conflict(key) do update set value = excluded.value`,
        [getMetaKey('clientes'), now]
      );
    });
  });

  await writeQueue;
}

export async function upsertCachedCatalogo(
  catalogo: CatalogoKey,
  item: CachedCatalogoItem
): Promise<void> {
  writeQueue = writeQueue.then(async () => {
    await ensureSchema();
    const db = await dbPromise;
    const tableName = TABLE_BY_KEY[catalogo];
    const now = new Date().toISOString();

    await db.withTransactionAsync(async () => {
      if (catalogo === 'tipo_trabajo') {
        await db.runAsync(
          `insert into ${tableName} (id, nombre, precio, color, updated_at)
           values (?, ?, ?, ?, ?)
           on conflict(id) do update set
             nombre = excluded.nombre,
             precio = excluded.precio,
             color = excluded.color,
             updated_at = excluded.updated_at`,
          [
            item.id,
            item.nombre,
            item.precio ?? null,
            item.color ?? null,
            item.updatedAt || now,
          ]
        );
      } else {
        await db.runAsync(
          `insert into ${tableName} (id, nombre, updated_at)
           values (?, ?, ?)
           on conflict(id) do update set
             nombre = excluded.nombre,
             updated_at = excluded.updated_at`,
          [item.id, item.nombre, item.updatedAt || now]
        );
      }

      await db.runAsync(
        `insert into cache_meta (key, value) values (?, ?)
         on conflict(key) do update set value = excluded.value`,
        [getMetaKey(catalogo), now]
      );
    });
  });

  await writeQueue;
}

export async function getCatalogoLastSyncAt(catalogo: CatalogoKey): Promise<string | null> {
  await ensureSchema();
  const db = await dbPromise;
  const row = await db.getFirstAsync<{ value: string }>(`select value from cache_meta where key = ?`, [
    getMetaKey(catalogo),
  ]);
  return row?.value ?? null;
}

export function mapSupabaseCatalogRows(rows: unknown): CachedCatalogoItem[] {
  if (!Array.isArray(rows)) {
    return [];
  }

  const now = new Date().toISOString();
  return rows
    .map((row) => {
      const typedRow = row as {
        id?: number | string;
        nombre?: string;
        precio?: number | string | null;
        color?: string | null;
        created_at?: string;
      };
      return {
        id: Number(typedRow.id),
        nombre: String(typedRow.nombre ?? ''),
        precio: parsePrecioValue(typedRow.precio),
        color: parseColorValue(typedRow.color),
        updatedAt: typedRow.created_at ? String(typedRow.created_at) : now,
      };
    })
    .filter((item) => Number.isFinite(item.id) && item.nombre.length > 0);
}

export function mapSupabaseCatalogRow(row: unknown): CachedCatalogoItem | null {
  const typedRow = row as
    | {
        id?: number | string;
        nombre?: string;
        precio?: number | string | null;
        color?: string | null;
        created_at?: string;
      }
    | null;
  if (!typedRow) {
    return null;
  }

  const parsed = {
    id: Number(typedRow.id),
    nombre: String(typedRow.nombre ?? ''),
    precio: parsePrecioValue(typedRow.precio),
    color: parseColorValue(typedRow.color),
    updatedAt: typedRow.created_at ? String(typedRow.created_at) : new Date().toISOString(),
  };

  if (!Number.isFinite(parsed.id) || parsed.nombre.length === 0) {
    return null;
  }

  return parsed;
}

function parsePrecioValue(value: unknown) {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseColorValue(value: unknown) {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function mapSupabaseClienteRows(rows: unknown): CachedClienteItem[] {
  if (!Array.isArray(rows)) {
    return [];
  }

  const now = new Date().toISOString();
  return rows
    .map((row) => {
      const typedRow = row as {
        id?: number | string;
        nombre?: string;
        telefono?: string | null;
        created_at?: string;
      };
      return {
        id: Number(typedRow.id),
        nombre: String(typedRow.nombre ?? ''),
        telefono: typedRow.telefono ? String(typedRow.telefono) : null,
        updatedAt: typedRow.created_at ? String(typedRow.created_at) : now,
      };
    })
    .filter((item) => Number.isFinite(item.id) && item.nombre.length > 0);
}

export function mapSupabaseClienteRow(row: unknown): CachedClienteItem | null {
  const typedRow = row as
    | {
        id?: number | string;
        nombre?: string;
        telefono?: string | null;
        created_at?: string;
      }
    | null;

  if (!typedRow) {
    return null;
  }

  const parsed = {
    id: Number(typedRow.id),
    nombre: String(typedRow.nombre ?? ''),
    telefono: typedRow.telefono ? String(typedRow.telefono) : null,
    updatedAt: typedRow.created_at ? String(typedRow.created_at) : new Date().toISOString(),
  };

  if (!Number.isFinite(parsed.id) || parsed.nombre.length === 0) {
    return null;
  }

  return parsed;
}

function getMetaKey(catalogo: CatalogoKey) {
  return `${catalogo}_last_sync`;
}
