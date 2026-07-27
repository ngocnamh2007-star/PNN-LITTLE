import { env } from "cloudflare:workers";

async function ensureTable() {
  await env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS app_state (
      key TEXT PRIMARY KEY NOT NULL,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `).run();
}

export async function readState<T>(key: string): Promise<T | null> {
  await ensureTable();
  const row = await env.DB.prepare("SELECT value FROM app_state WHERE key = ?")
    .bind(key)
    .first<{ value: string }>();
  if (!row) return null;
  return JSON.parse(row.value) as T;
}

export async function writeState(key: string, value: unknown) {
  await ensureTable();
  await env.DB.prepare(`
    INSERT INTO app_state (key, value, updated_at)
    VALUES (?, ?, ?)
    ON CONFLICT(key) DO UPDATE SET
      value = excluded.value,
      updated_at = excluded.updated_at
  `)
    .bind(key, JSON.stringify(value), new Date().toISOString())
    .run();
}

export async function deleteState(key: string) {
  await ensureTable();
  await env.DB.prepare("DELETE FROM app_state WHERE key = ?").bind(key).run();
}
