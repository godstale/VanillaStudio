import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MemorySqlFallback, setDatabase } from '@/lib/db/client';
import {
  listItems,
  getItem,
  createItem,
  updateItem,
  deleteItem,
} from '@/lib/collections/itemsRepo';

describe('itemsRepo (MemorySqlFallback)', () => {
  beforeEach(() => {
    setDatabase(new MemorySqlFallback());
  });

  afterEach(() => {
    setDatabase(null);
  });

  it('creates, reads, updates, and deletes an item', async () => {
    const created = await createItem('First');
    expect(created.id).toBeTruthy();
    expect(created.title).toBe('First');

    const listed = await listItems();
    expect(listed.map((i) => i.id)).toContain(created.id);

    const updated = await updateItem(created.id, {
      title: 'Renamed',
      body: 'hello',
    });
    expect(updated?.title).toBe('Renamed');
    expect(updated?.body).toBe('hello');
    expect(await getItem(created.id)).toMatchObject({ title: 'Renamed' });

    await deleteItem(created.id);
    expect(await getItem(created.id)).toBeNull();
    expect(await listItems()).toHaveLength(0);
  });

  it('returns null for unknown ids', async () => {
    expect(await getItem('missing')).toBeNull();
    expect(await updateItem('missing', { title: 'x' })).toBeNull();
  });
});
