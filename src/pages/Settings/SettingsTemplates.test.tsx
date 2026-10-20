import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { LanguageProvider } from '@/lib/i18n/LanguageContext';

const fs = new Map<string, string>();
const m = vi.hoisted(() => ({ root: '/w' as string | null }));

vi.mock('@/lib/context/WorkspaceContext', () => ({ useWorkspace: () => ({ workspaceRoot: m.root }) }));
vi.mock('@/lib/db/repositories/settingsRepo', () => ({ getSettings: async () => ({ templatesDir: null }) }));
vi.mock('@tauri-apps/api/core', () => ({
  invoke: async (cmd: string, a: Record<string, string>) => {
    if (cmd === 'write_text_file') {
      fs.set(a.path.replace(/^\/w\//, ''), a.contents);
      return;
    }
    if (cmd === 'read_template_folders') {
      const base = `${a.dir.replace(/^\/w\//, '')}/`;
      const by = new Map<string, Record<string, string>>();
      for (const [k, v] of fs) {
        if (!k.startsWith(base)) continue;
        const [dirName, ...rest] = k.slice(base.length).split('/');
        by.set(dirName, { ...(by.get(dirName) ?? {}), [rest.join('/')]: v });
      }
      return [...by.entries()].map(([dirName, files]) => ({ dirName, files, skipped: [] }));
    }
    throw new Error(`unexpected ${cmd}`);
  },
}));

import { SettingsTemplates } from './SettingsTemplates';

const renderPage = () =>
  render(
    <LanguageProvider>
      <SettingsTemplates />
    </LanguageProvider>,
  );

beforeEach(() => {
  fs.clear();
  m.root = '/w';
});

describe('SettingsTemplates', () => {
  it('needs an open workspace', () => {
    m.root = null;
    renderPage();
    expect(screen.getByText(/열린 워크스페이스가 없습니다|No workspace is open/)).toBeTruthy();
  });

  it('lists the built-in templates as usable', async () => {
    renderPage();
    const list = await screen.findByTestId('template-list');
    expect(within(list).getAllByRole('listitem')).toHaveLength(15);
    expect(within(list).getAllByText(/^내장$|^Built-in$/)).toHaveLength(15);
    expect(within(list).getAllByText(/사용 가능|Usable/)).toHaveLength(15);
    expect(within(list).queryByRole('button', { name: /^편집$|^Edit$/ })).toBeNull(); // built-ins are not editable
  });

  it('duplicate → edit → save writes the template files and lists it', async () => {
    renderPage();
    const list = await screen.findByTestId('template-list');
    const motion = within(list).getByText('commercial@1').closest('li')!;
    fireEvent.click(within(motion).getByRole('button', { name: /^복제$|^Duplicate$/ }));
    fireEvent.change(await screen.findByPlaceholderText('my-template'), { target: { value: 'house' } });
    fireEvent.click(screen.getByRole('button', { name: /^만들기$|^Create$/ }));
    const editor = await screen.findByTestId('template-editor');
    fireEvent.change(within(editor).getByLabelText(/추가 규칙|Additional rules/), { target: { value: 'Always end on the logo.' } });
    fireEvent.click(within(editor).getByRole('button', { name: /^저장$|^Save$/ }));
    await waitFor(() => expect(fs.has('guide-templates/house@1/template.json')).toBe(true));
    expect(fs.get('guide-templates/house@1/rules.md')).toContain('Always end on the logo.');
    const after = await screen.findByTestId('template-list');
    const row = (await within(after).findByText('house@1')).closest('li')!;
    expect(within(row).getByText(/^워크스페이스$|^Workspace$/)).toBeTruthy();
    expect(within(row).getByRole('button', { name: /^편집$|^Edit$/ })).toBeTruthy();
  });

  it('shows a refused template with the reason instead of offering it', async () => {
    fs.set('guide-templates/bad@1/template.json', JSON.stringify({ id: 'bad', version: 1, type: 'motion', label: { ko: '나쁨', en: 'Bad' }, extends: 'commercial@1' }));
    fs.set('guide-templates/bad@1/schema.json', JSON.stringify({ version: 1, hide: ['id'], defaults: {}, fields: [] }));
    renderPage();
    const row = (await screen.findByText('bad@1')).closest('li')!;
    expect(within(row).getByRole('alert').textContent).toMatch(/cannot hide/);
    expect(within(row).queryByRole('button', { name: /^복제$|^Duplicate$/ })).toBeNull();
  });
});
