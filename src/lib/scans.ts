import type { SQLiteDatabase } from 'expo-sqlite';

import { hexToDataUri } from './base64';
import type { ClothingInfo, Scan, ScanSummary } from './types';

type SummaryRow = { id: number; name: string; scanned_at: number; thumbnail_hex: string };

// As imagens são gravadas como BLOB, mas lidas via hex(): na web, o expo-sqlite (alpha) pode devolver
// arrays de BLOB com os primeiros bytes sobrescritos por uma consulta seguinte, o que corrompe o JPEG.
const SUMMARY_COLUMNS = 'id, name, scanned_at, hex(thumbnail) AS thumbnail_hex';

function toSummary({ thumbnail_hex, ...row }: SummaryRow): ScanSummary {
  return { ...row, thumbnailUri: hexToDataUri(thumbnail_hex) };
}

export type SortOrder = 'newest' | 'oldest';

export async function insertScan(
  db: SQLiteDatabase,
  userId: number,
  image: Uint8Array,
  thumbnail: Uint8Array,
  data: ClothingInfo,
): Promise<number> {
  const result = await db.runAsync(
    'INSERT INTO scans (user_id, name, image, thumbnail, data, scanned_at) VALUES (?, ?, ?, ?, ?, ?)',
    userId,
    data.name,
    image,
    thumbnail,
    JSON.stringify(data),
    Date.now(),
  );
  return result.lastInsertRowId;
}

export async function listScans(db: SQLiteDatabase, userId: number, order: SortOrder): Promise<ScanSummary[]> {
  const dir = order === 'newest' ? 'DESC' : 'ASC';
  const rows = await db.getAllAsync<SummaryRow>(
    `SELECT ${SUMMARY_COLUMNS} FROM scans WHERE user_id = ? ORDER BY scanned_at ${dir}, id ${dir}`,
    userId,
  );
  return rows.map(toSummary);
}

export async function getLatestScan(db: SQLiteDatabase, userId: number): Promise<ScanSummary | null> {
  const row = await db.getFirstAsync<SummaryRow>(
    `SELECT ${SUMMARY_COLUMNS} FROM scans WHERE user_id = ? ORDER BY scanned_at DESC, id DESC LIMIT 1`,
    userId,
  );
  return row ? toSummary(row) : null;
}

export async function getScan(db: SQLiteDatabase, userId: number, id: number): Promise<Scan | null> {
  const row = await db.getFirstAsync<SummaryRow & { image_hex: string; data: string }>(
    `SELECT ${SUMMARY_COLUMNS}, hex(image) AS image_hex, data FROM scans WHERE user_id = ? AND id = ?`,
    userId,
    id,
  );
  if (!row) return null;
  const { image_hex, data, ...summary } = row;
  return { ...toSummary(summary), imageUri: hexToDataUri(image_hex), data: JSON.parse(data) as ClothingInfo };
}

export async function deleteScan(db: SQLiteDatabase, userId: number, id: number) {
  await db.runAsync('DELETE FROM scans WHERE user_id = ? AND id = ?', userId, id);
}
