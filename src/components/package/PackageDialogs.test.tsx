import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { LanguageProvider } from '@/lib/i18n/LanguageContext';

const state = vi.hoisted(() => ({
  openResult: null as string | null,
  saveResult: null as string | null,
  inspect: null as unknown,
  inspectError: null as string | null,
  calls: [] as { cmd: string; args: Record<string, unknown> }[],
}));

vi.mock('@tauri-apps/plugin-dialog', () => ({ open: async () => state.openResult, save: async () => state.saveResult }));
vi.mock('@tauri-apps/api/core', () => ({
  invoke: async (cmd: string, args: Record<string, unknown>) => {
    state.calls.push({ cmd, args });
    if (cmd === 'inspect_vsx') {
      if (state.inspectError) throw state.inspectError;
      return state.inspect;
    }
    if (cmd === 'create_vsx') return { path: String(args.outPath), files: 7, bytes: 2048, manifest: manifest() };
    throw new Error(`unexpected ${cmd}`);
  },
}));
vi.mock('@/lib/package/import', async (orig) => {
  const real = await orig<typeof import('@/lib/package/import')>();
  return {
    ...real,
    importScenes: vi.fn(async () => ({ imported: [{ sourceSlug: 'intro', slug: 'intro', sceneId: 'scn_x', scene: {}, templateUnavailable: false }], failed: [], edgesAdded: 1, templates: { imported: [], skipped: [] } })),
  };
});

import { importScenes } from '@/lib/package/import';
import { ExportDialog, ImportDialog } from './PackageDialogs';

const sha = 'a'.repeat(64);
function manifest(over: Record<string, unknown> = {}) {
  return {
    formatVersion: 1,
    kind: 'sequence',
    app: { name: 'vanilla-studio', version: '0.1.0' },
    schemas: { workspace: 1, scene: 1, sequence: 1 },
    workspace: { id: 'ws_theirs', name: 'Their Demo' },
    scene: null,
    templates: [],
    files: [{ path: 'scenes/intro/scene.json', size: 1, sha256: sha }, { path: 'scenes/page/scene.json', size: 1, sha256: sha }],
    ...over,
  };
}
const goodInfo = (over: Record<string, unknown> = {}) => ({ manifest: manifest(over), reviewFiles: ['AGENTS.md', 'scenes/intro/prompts/generate.md'], totalBytes: 4096 });

beforeEach(() => {
  state.openResult = null;
  state.saveResult = null;
  state.inspect = goodInfo();
  state.inspectError = null;
  state.calls = [];
  vi.mocked(importScenes).mockClear();
});

function renderImport() {
  const onImported = vi.fn();
  const onOpenChange = vi.fn();
  render(
    <LanguageProvider>
      <ImportDialog open onOpenChange={onOpenChange} root="/w" workspace={{ id: 'ws_mine', name: 'Mine' }} resolverAfterTemplates={async () => () => null} onImported={onImported} />
    </LanguageProvider>,
  );
  return { onImported, onOpenChange };
}
const choose = async () => {
  state.openResult = 'D:/pack.vsx';
  fireEvent.click(screen.getByRole('button', { name: /\.vsx 파일 선택|Choose a \.vsx file/ }));
};
const importButton = () => screen.getByRole('button', { name: /^가져오기$|^Import$/ }) as HTMLButtonElement;

describe('ImportDialog', () => {
  it('inspects first, shows what is inside and lists the files the agent will read', async () => {
    renderImport();
    await choose();
    expect(await screen.findByText('Their Demo')).toBeTruthy();
    expect(state.calls.map((c) => c.cmd)).toEqual(['inspect_vsx']); // nothing was written yet
    const review = screen.getByTestId('import-review');
    expect(review.textContent).toContain('AGENTS.md');
    expect(review.textContent).toContain('scenes/intro/prompts/generate.md');
    expect(screen.getByRole('checkbox', { name: 'intro' })).toBeTruthy();
    expect(screen.getByRole('checkbox', { name: 'page' })).toBeTruthy();
  });

  it('import stays disabled until the user confirms they trust the package', async () => {
    renderImport();
    await choose();
    await screen.findByText('Their Demo');
    expect(importButton().disabled).toBe(true);
    fireEvent.click(screen.getByRole('checkbox', { name: /신뢰합니다|trust it/ }));
    expect(importButton().disabled).toBe(false);
    fireEvent.click(screen.getByRole('checkbox', { name: 'intro' })); // deselect one
    fireEvent.click(screen.getByRole('checkbox', { name: 'page' }));
    expect(importButton().disabled).toBe(true); // nothing selected
  });

  it('imports the selected scenes and reports the result', async () => {
    const { onImported } = renderImport();
    await choose();
    await screen.findByText('Their Demo');
    fireEvent.click(screen.getByRole('checkbox', { name: 'page' })); // keep only intro
    fireEvent.click(screen.getByRole('checkbox', { name: /신뢰합니다|trust it/ }));
    fireEvent.click(importButton());
    await waitFor(() => expect(screen.getByTestId('import-result')).toBeTruthy());
    const args = vi.mocked(importScenes).mock.calls[0];
    expect(args[0]).toBe('/w');
    expect(args[1]).toEqual({ id: 'ws_mine', name: 'Mine' });
    expect(args[2]).toBe('D:/pack.vsx');
    expect(args[4]).toEqual(['intro']);
    expect(onImported).toHaveBeenCalledOnce();
    expect(screen.getByTestId('import-result').textContent).toMatch(/1개|1 scenes/);
  });

  it('a package in an incompatible format cannot be imported', async () => {
    state.inspect = goodInfo({ schemas: { workspace: 1, scene: 2, sequence: 1 } });
    renderImport();
    await choose();
    await screen.findByText('Their Demo');
    fireEvent.click(screen.getByRole('checkbox', { name: /신뢰합니다|trust it/ }));
    expect(screen.getByText(/열 수 없습니다|cannot be opened/)).toBeTruthy();
    expect(importButton().disabled).toBe(true);
  });

  it.each([
    ['unsafe-entry-name: path traversal: "../evil"', /안전하지 않은|unsafe/],
    ['hash-mismatch: scenes/intro/scene.json', /체크섬|checksums/],
    ['symlink-entry: link', /안전하지 않은|unsafe/],
    ['not-a-zip', /올바른 패키지|not a valid package/],
  ])('a rejected package shows why and offers no import (%s)', async (code, message) => {
    state.inspectError = code;
    renderImport();
    await choose();
    expect(((await screen.findByRole('alert')).textContent ?? '')).toMatch(message);
    expect(screen.queryByTestId('import-review')).toBeNull();
    expect(importButton().disabled).toBe(true);
    expect(vi.mocked(importScenes)).not.toHaveBeenCalled();
  });

  it('cancelling the file dialog does nothing', async () => {
    renderImport();
    state.openResult = null;
    fireEvent.click(screen.getByRole('button', { name: /\.vsx 파일 선택|Choose a \.vsx file/ }));
    await Promise.resolve();
    expect(state.calls).toEqual([]);
  });
});

describe('ExportDialog', () => {
  function renderExport(props: Partial<Parameters<typeof ExportDialog>[0]> = {}) {
    render(
      <LanguageProvider>
        <ExportDialog open onOpenChange={vi.fn()} root="/w" workspaceName="Sequence Demo" selected={{ slug: 'intro', name: 'Intro' }} templates={() => ({ dirs: [], missing: [] })} {...props} />
      </LanguageProvider>,
    );
  }

  it('exports the whole sequence to the chosen file without reference media by default', async () => {
    state.saveResult = 'D:/demo.vsx';
    renderExport();
    fireEvent.click(screen.getByRole('button', { name: /파일 선택 후 내보내기|Choose file and export/ }));
    await waitFor(() => expect(screen.getByTestId('export-result')).toBeTruthy());
    expect(state.calls[0]).toEqual({ cmd: 'create_vsx', args: { workspaceRoot: '/w', outPath: 'D:/demo.vsx', options: { scene: null, includeReferenceMedia: false, templateDirs: [] } } });
    expect(screen.getByTestId('export-result').textContent).toMatch(/7/);
  });

  it('can export just the selected scene with media and the custom templates it needs', async () => {
    state.saveResult = 'D:/intro.vsx';
    renderExport({ templates: (scope) => (scope === 'scene' ? { dirs: ['guide-templates/mine@1'], missing: [] } : { dirs: [], missing: [] }) });
    fireEvent.click(screen.getByRole('radio', { name: /선택한 신만|selected scene/ }));
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: /파일 선택 후 내보내기|Choose file and export/ }));
    await waitFor(() => expect(state.calls.length).toBe(1));
    expect(state.calls[0].args.options).toEqual({ scene: 'intro', includeReferenceMedia: true, templateDirs: ['guide-templates/mine@1'] });
  });

  it('cancelling the save dialog exports nothing; templates outside the workspace are flagged', async () => {
    renderExport({ templates: () => ({ dirs: [], missing: ['guide-templates/global@2'] }) });
    expect(screen.getByText(/global@2/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /파일 선택 후 내보내기|Choose file and export/ }));
    await Promise.resolve();
    expect(state.calls).toEqual([]);
  });

  it('the single-scene option is disabled when no scene is selected', () => {
    renderExport({ selected: null });
    expect((screen.getByRole('radio', { name: /신 하나만|Only one scene/ }) as HTMLInputElement).disabled).toBe(true);
  });
});
