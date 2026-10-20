import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { LanguageProvider } from '@/lib/i18n/LanguageContext';
import { newScene } from '@/lib/scene/schema';

const fs = new Map<string, string>();
vi.mock('@tauri-apps/api/core', () => ({
  invoke: async (cmd: string, a: { path: string; contents?: string }) => {
    const rel = a.path.replace(/^\/w\//, '');
    if (cmd === 'list_dir') {
      const base = `${rel.replace(/\/$/, '')}/`;
      const names = new Map<string, boolean>();
      for (const k of fs.keys()) {
        if (!k.startsWith(base)) continue;
        const rest = k.slice(base.length);
        const i = rest.indexOf('/');
        names.set(i === -1 ? rest : rest.slice(0, i), i !== -1);
      }
      if (!names.size) throw new Error('no dir');
      return [...names].map(([name, is_dir]) => ({ name, is_dir }));
    }
    if (cmd === 'read_text_file') return fs.get(rel) ?? '';
    if (cmd === 'write_text_file') {
      fs.set(rel, a.contents ?? '');
      return;
    }
    throw new Error(`unexpected ${cmd}`);
  },
}));

import { CheckPanel } from './CheckPanel';

const scene = { ...newScene({ id: 'scn_A', name: 'Intro', type: 'motion', template: 'commercial@1' }) };

beforeEach(() => fs.clear());

const setup = () =>
  render(
    <LanguageProvider>
      <CheckPanel root="/w" slug="intro" scene={scene} />
    </LanguageProvider>,
  );

describe('CheckPanel', () => {
  it('lists errors and writes .vanilla/self-check.md', async () => {
    fs.set('scenes/intro/src/main.ts', 'const t = Date.now();');
    setup();
    fireEvent.click(screen.getByRole('button'));
    expect(await screen.findByText(/no-forbidden-time-api/)).toBeTruthy();
    expect(screen.getByRole('status').textContent).toMatch(/실패|Failed/);
    expect(fs.get('scenes/intro/.vanilla/self-check.md')).toContain('Result: FAIL');
  });

  it('reports a pass for a clean scene', async () => {
    fs.set('scenes/intro/src/main.tsx', 'export default defineScene({});');
    fs.set('scenes/intro/src/composition.tsx', "import { defineComposition } from '@vanilla/runtime';\nimport s from './scene';\nexport default defineComposition({ scenes: [s] });");
    setup();
    fireEvent.click(screen.getByRole('button'));
    expect((await screen.findByRole('status')).textContent).toMatch(/통과|Passed/);
    expect(fs.get('scenes/intro/.vanilla/self-check.md')).toContain('Result: PASS');
  });
});
