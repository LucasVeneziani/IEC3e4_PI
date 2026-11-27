import type { SQLiteDatabase } from 'expo-sqlite';

export const DATABASE_NAME = 'appbrecho.db';
const DATABASE_VERSION = 1;

/** Executa na inicialização do SQLiteProvider. As imagens ficam como BLOB junto do escaneamento a que pertencem. */
export async function migrateDbIfNeeded(db: SQLiteDatabase) {
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  const current = row?.user_version ?? 0;
  if (current >= DATABASE_VERSION) return;

  if (current === 0) {
    await db.execAsync(`
      PRAGMA journal_mode = WAL;
      PRAGMA foreign_keys = ON;
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL UNIQUE COLLATE NOCASE,
        email TEXT NOT NULL UNIQUE COLLATE NOCASE,
        password_hash TEXT NOT NULL,
        salt TEXT NOT NULL,
        created_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS scans (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        image BLOB NOT NULL,
        thumbnail BLOB NOT NULL,
        data TEXT NOT NULL,
        scanned_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_scans_user_time ON scans(user_id, scanned_at);
      CREATE TABLE IF NOT EXISTS kv (
        key TEXT PRIMARY KEY NOT NULL,
        value TEXT
      );
    `);
  }
  await db.execAsync(`PRAGMA user_version = ${DATABASE_VERSION}`);
}

export async function getKv(db: SQLiteDatabase, key: string): Promise<string | null> {
  const row = await db.getFirstAsync<{ value: string | null }>('SELECT value FROM kv WHERE key = ?', key);
  return row?.value ?? null;
}

export async function setKv(db: SQLiteDatabase, key: string, value: string | null) {
  if (value === null) {
    await db.runAsync('DELETE FROM kv WHERE key = ?', key);
  } else {
    await db.runAsync('INSERT INTO kv (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value', key, value);
  }
}
