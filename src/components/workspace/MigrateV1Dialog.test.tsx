// @vitest-environment jsdom
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { LanguageProvider } from '@/lib/i18n/LanguageContext';

const state = vi.hoisted(() => ({ picks: [] as (string | null)[], read: null as unknown, readError: null as string | null, applied: [] as unknown[] }));
vi.mock('@tauri-apps/plugin-dialog', () => ({ open: async () => state.picks.shift() ?? null }));
vi.mock('@tauri-apps/api/core', () => ({
  invoke: async (cmd: string) => {
    if (cmd === 'read_v1_project') {
      if (state.readError) throw state.readError;
      return state.read;
    }
    throw new Error(`unexpected ${cmd}`);
  },
}));
vi.mock('@/lib/migrate/applyV1', () => ({
  applyV1Migration: vi.fn(async (dest: string, plan: unknown, root: string) => {
    state.applied.push({ dest, root, plan });
    return { workspaceId: 'ws_x', root: dest, slug: 's', sceneId: 'scn_x', filesWritten: 1, copied: 0 };
  }),
}));

import { MigrateV1Dialog } from './MigrateV1Dialog';
import type { V1Bundle } from '@/lib/migrate/v1';
import type { WorkspaceApi } from '@/lib/workspace/api';

const FIXTURES = resolve(__dirname, '../../../tests/fixtures/v1');
function bundleOf(name: string): V1Bundle {
  const root = join(FIXTURES, name);
  const out: V1Bundle = { root, texts: {}, binaries: [], skipped: ['reviews', 'prompts'] };
  const walk = (dir: string) => {
    for (const n of readdirSync(dir)) {
      const p = join(dir, n);
      if (statSync(p).isDirectory()) {
        if (['reviews', 'prompts'].includes(n) && dir === root) continue;
        walk(p);
      } else out.texts[relative(root, p).split(sep).join('/')] = readFileSync(p, 'utf8');
    }
  };
  walk(root);
  return out;
}

const api = (kind: 'empty' | 'other' = 'empty'): WorkspaceApi => ({
  pickFolder: vi.fn(),
  inspectFolder: vi.fn(async () => ({ kind })),
  createWorkspace: vi.fn(),
  openWorkspace: vi.fn(),
  installDeps: vi.fn(),
}) as unknown as WorkspaceApi;

beforeEach(() => {
  state.picks = [];
  state.read = bundleOf('video-promo');
  state.readError = null;
  state.applied = [];
});

function setup(a: WorkspaceApi = api()) {
  const onMigrated = vi.fn(async () => undefined);
  const onOpenChange = vi.fn();
  render(
    <LanguageProvider>
      <MigrateV1Dialog open onOpenChange={onOpenChange} api={a} onMigrated={onMigrated} />
    </LanguageProvider>,
  );
  return { onMigrated, onOpenChange };
}
const chooseSource = async () => {
  state.picks.push('D:/v1/video-promo');
  fireEvent.click(screen.getByRole('button', { name: /v1 프로젝트 폴더 선택|Choose the v1 project folder/ }));
};
const runButton = () => screen.getByRole('button', { name: /폴더 선택 후 변환|Choose a folder and convert/ }) as HTMLButtonElement;

describe('MigrateV1Dialog', () => {
  it('previews the conversion and lists what is not converted before anything is written', async () => {
    setup();
    expect(runButton().disabled).toBe(true);
    await chooseSource();
    const summary = await screen.findByTestId('migrate-summary');
    expect(summary.textContent).toContain('video-promo');
    expect(summary.textContent).toContain('1920×1080 @ 30fps');
    const unconverted = screen.getByTestId('migrate-unconverted').textContent ?? '';
    expect(unconverted).toContain('brief/brief.md');
    expect(unconverted).toContain('plan/plan.json');
    expect(unconverted).toContain('reviews/');
    expect(state.applied).toEqual([]);
    expect(runButton().disabled).toBe(false);
  });

  it('converts into the empty folder the user picks, then hands over to the app', async () => {
    const { onMigrated, onOpenChange } = setup();
    await chooseSource();
    await screen.findByTestId('migrate-summary');
    state.picks.push('D:/new-workspace');
    fireEvent.click(runButton());
    await waitFor(() => expect(onMigrated).toHaveBeenCalledWith('D:/new-workspace'));
    expect(state.applied).toHaveLength(1);
    expect(state.applied[0]).toMatchObject({ dest: 'D:/new-workspace', root: join(FIXTURES, 'video-promo') });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('refuses a destination that is not empty and writes nothing', async () => {
    const { onMigrated } = setup(api('other'));
    await chooseSource();
    await screen.findByTestId('migrate-summary');
    state.picks.push('D:/not-empty');
    fireEvent.click(runButton());
    expect((await screen.findByRole('alert')).textContent).toMatch(/빈 폴더|empty folder/);
    expect(state.applied).toEqual([]);
    expect(onMigrated).not.toHaveBeenCalled();
  });

  it('a folder that is not a v1 project says so', async () => {
    state.readError = 'not-a-v1-project';
    setup();
    await chooseSource();
    expect((await screen.findByRole('alert')).textContent).toMatch(/v1 프로젝트 폴더가 아닙니다|not a Vanilla Studio v1 project/);
    expect(runButton().disabled).toBe(true);
  });

  it('interactive projects ask which scene type to convert to', async () => {
    const b = bundleOf('web-landing');
    state.read = { ...b, texts: { ...b.texts, 'vanilla.json': b.texts['vanilla.json'].replace('"web"', '"interactive"') } };
    setup();
    await chooseSource();
    await screen.findByTestId('migrate-summary');
    expect(screen.getByTestId('migrate-summary').textContent).toMatch(/정적 페이지|Static/i);
    fireEvent.click(screen.getByRole('radio', { name: /모션|Motion/i }));
    await waitFor(() => expect(screen.getByTestId('migrate-summary').textContent).toMatch(/모션|Motion/i));
  });

  it('cancelling the folder dialogs does nothing', async () => {
    setup();
    fireEvent.click(screen.getByRole('button', { name: /v1 프로젝트 폴더 선택|Choose the v1 project folder/ }));
    await Promise.resolve();
    expect(screen.queryByTestId('migrate-summary')).toBeNull();
  });
});
