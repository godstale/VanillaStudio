import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MemorySqlFallback, setDatabase } from '@/lib/db/client';
import {
  getSettings,
  updateSettings,
  DEFAULT_APP_SETTINGS,
} from '@/lib/db/repositories/settingsRepo';

describe('settingsRepo (MemorySqlFallback)', () => {
  beforeEach(() => {
    setDatabase(new MemorySqlFallback());
  });

  afterEach(() => {
    setDatabase(null);
  });

  it('returns defaults on first read', async () => {
    const settings = await getSettings();
    expect(settings).toMatchObject({
      id: 'singleton',
      openTabs: [],
      activeTabId: null,
      theme: DEFAULT_APP_SETTINGS.theme,
      language: 'ko',
      enabledExtensions: [],
      trustedWorkspaces: [],
      lastWorkspaceRoot: null,
    });
  });

  it('round-trips global fields and tab state', async () => {
    await updateSettings({ language: 'en', theme: 'dark' });
    await updateSettings({
      openTabs: [{ id: 'welcome:1', type: 'welcome', title: 'Welcome' }],
      activeTabId: 'welcome:1',
    });
    const settings = await getSettings();
    expect(settings.language).toBe('en');
    expect(settings.theme).toBe('dark');
    expect(settings.openTabs).toHaveLength(1);
    expect(settings.activeTabId).toBe('welcome:1');
  });

  it('round-trips the enabled extension list', async () => {
    await updateSettings({ enabledExtensions: ['demo-ext'] });
    expect((await getSettings()).enabledExtensions).toEqual(['demo-ext']);
    await updateSettings({ enabledExtensions: [] });
    expect((await getSettings()).enabledExtensions).toEqual([]);
  });
});
