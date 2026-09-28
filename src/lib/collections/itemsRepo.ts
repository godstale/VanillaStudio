import { getDatabase } from '@/lib/db/client';
import type { CollectionItem } from '@/lib/types/collection';

interface ItemRow {
  id: string;
  title: string;
  body: string;
  created_at: string;
  updated_at: string;
}

function toItem(row: ItemRow): CollectionItem {
  return {
    id: row.id,
    title: row.title,
    body: row.body,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.floor(Math.random() * 1e9)}`;
}

export async function listItems(): Promise<CollectionItem[]> {
  const db = await getDatabase();
  const rows = await db.select<ItemRow[]>(
    'SELECT * FROM items ORDER BY updated_at DESC',
  );
  return rows.map(toItem);
}

export async function getItem(id: string): Promise<CollectionItem | null> {
  const db = await getDatabase();
  const rows = await db.select<ItemRow[]>('SELECT * FROM items WHERE id = ?', [
    id,
  ]);
  return rows.length > 0 ? toItem(rows[0]) : null;
}

export async function createItem(title: string): Promise<CollectionItem> {
  const db = await getDatabase();
  const now = new Date().toISOString();
  const item: CollectionItem = {
    id: newId(),
    title,
    body: '',
    createdAt: now,
    updatedAt: now,
  };
  await db.execute(
    'INSERT INTO items (id, title, body, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
    [item.id, item.title, item.body, item.createdAt, item.updatedAt],
  );
  return item;
}

export async function updateItem(
  id: string,
  patch: { title?: string; body?: string },
): Promise<CollectionItem | null> {
  const db = await getDatabase();
  const current = await getItem(id);
  if (!current) return null;
  const next: CollectionItem = {
    ...current,
    title: patch.title ?? current.title,
    body: patch.body ?? current.body,
    updatedAt: new Date().toISOString(),
  };
  await db.execute(
    'UPDATE items SET title = ?, body = ?, updated_at = ? WHERE id = ?',
    [next.title, next.body, next.updatedAt, id],
  );
  return next;
}

export async function deleteItem(id: string): Promise<void> {
  const db = await getDatabase();
  await db.execute('DELETE FROM items WHERE id = ?', [id]);
}
