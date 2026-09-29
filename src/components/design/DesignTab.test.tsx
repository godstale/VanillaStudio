import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { renderWithProviders } from '@/test-utils';
import designFixture from '@/lib/design/__fixtures__/DESIGN.md?raw';
import { DesignTab } from '@/components/design/DesignTab';
import { checkDesign } from '@/components/design/designChecks';

const ROOT = 'C:/proj';
const DESIGN_FILE = `${ROOT}/DESIGN.md`;

const mocks = vi.hoisted(() => ({
  files: new Map<string, string>(),
  writes: [] as { path: string; contents: string }[],
  failWrite: { current: false },
  root: { current: 'C:/proj' as string | null },
}));

vi.mock('@tauri-apps/api/core', () => ({
  invoke: async (cmd: string, args: Record<string, string>) => {
    if (cmd === 'list_dir') {
      const dir = args.path.replace(/\/$/, '');
      const entries = [...mocks.files.keys()]
        .filter((p) => p.startsWith(`${dir}/`) && !p.slice(dir.length + 1).includes('/'))
        .map((p) => ({ name: p.slice(dir.length + 1), path: p, is_dir: false, size: 0 }));
      if (entries.length === 0) throw new Error('not found');
      return entries;
    }
    if (cmd === 'read_text_file') return mocks.files.get(args.path);
    if (cmd === 'write_text_file') {
      if (mocks.failWrite.current) throw new Error('disk full');
      mocks.writes.push({ path: args.path, contents: args.contents });
      mocks.files.set(args.path, args.contents);
      return null;
    }
    throw new Error(`unexpected command ${cmd}`);
  },
}));
vi.mock('@/lib/context/WorkspaceContext', () => ({
  useSafeWorkspace: () => ({ workspaceRoot: mocks.root.current }),
}));

const source = () => screen.getByTestId('design-source') as HTMLTextAreaElement;

beforeEach(() => {
  mocks.files.clear();
  mocks.writes.length = 0;
  mocks.failWrite.current = false;
  mocks.root.current = ROOT;
});

describe('checkDesign', () => {
  it('passes the sample DESIGN.md with contrast rows', () => {
    const c = checkDesign(designFixture);
    expect(c.issues).toEqual([]);
    expect(c.contrast.map((r) => r.pair)).toContain('ink/canvas');
    expect(c.contrastFailures).toBe(0);
  });

  it('reports missing core roles and skips contrast', () => {
    const c = checkDesign('---\ncolors:\n  canvas: "#FFFFFF"\n---\n');
    expect(c.issues.join()).toContain('missing core roles');
    expect(c.contrast).toEqual([]);
  });

  it('flags low contrast pairs', () => {
    const c = checkDesign(
      '---\ncolors:\n  canvas: "#FFFFFF"\n  ink: "#EEEEEE"\n  primary: "#FF0000"\n  accent: "#00FF00"\n---\n',
    );
    expect(c.contrastFailures).toBeGreaterThan(0);
  });

  it('turns broken YAML into an issue instead of throwing', () => {
    expect(checkDesign('---\ncolors: [oops\n---\n').issues.length).toBeGreaterThan(0);
  });
});

describe('DesignTab', () => {
  it('shows tokens, checks and the raw source of the sample DESIGN.md', async () => {
    mocks.files.set(DESIGN_FILE, designFixture);
    renderWithProviders(<DesignTab />);
    await screen.findByTestId('design-tab');
    expect(screen.getByTestId('swatch-canvas').textContent).toContain('#E9E5DB');
    expect(screen.getByTestId('design-typography').textContent).toContain('Georgia');
    expect(screen.getByTestId('design-spacing').textContent).toContain('md');
    expect(screen.getByTestId('design-rounded').textContent).toContain('12px');
    expect(screen.getByTestId('design-components').textContent).toContain('badge');
    expect(screen.getByTestId('contrast-ink/canvas').getAttribute('data-ok')).toBe('true');
    expect(source().value).toContain('name: Solar Parchment');
    expect(screen.getByTestId('design-save-state').textContent).toMatch(/저장됨|Saved/);
  });

  it('updates the visualization and checks live, then saves the edit', async () => {
    mocks.files.set(DESIGN_FILE, designFixture);
    renderWithProviders(<DesignTab />);
    await screen.findByTestId('design-tab');

    fireEvent.change(source(), { target: { value: source().value.replace('"#E9E5DB"', '"#123456"') } });
    expect(screen.getByTestId('swatch-canvas').textContent).toContain('#123456');
    expect(screen.getByTestId('design-save-state').textContent).toMatch(/저장하지 않은|Unsaved/);
    // dark ink on a dark canvas no longer passes
    expect(screen.getByTestId('contrast-ink/canvas').getAttribute('data-ok')).toBe('false');

    fireEvent.click(screen.getByRole('button', { name: /^(저장|Save)$/ }));
    await waitFor(() => expect(mocks.writes).toHaveLength(1));
    expect(mocks.writes[0].path).toBe(DESIGN_FILE);
    expect(mocks.writes[0].contents).toBe(designFixture.replace('"#E9E5DB"', '"#123456"'));
    await waitFor(() => expect(screen.getByTestId('design-save-state').textContent).toMatch(/저장됨|Saved/));
  });

  it('keeps CRLF line endings when saving', async () => {
    const crlf = designFixture.replace(/\r?\n/g, '\r\n');
    mocks.files.set(DESIGN_FILE, crlf);
    renderWithProviders(<DesignTab />);
    await screen.findByTestId('design-tab');
    fireEvent.change(source(), { target: { value: source().value.replace('"#E9E5DB"', '"#FFFFFF"') } });
    fireEvent.click(screen.getByRole('button', { name: /^(저장|Save)$/ }));
    await waitFor(() => expect(mocks.writes).toHaveLength(1));
    expect(mocks.writes[0].contents).toBe(crlf.replace('"#E9E5DB"', '"#FFFFFF"'));
  });

  it('reverts unsaved edits', async () => {
    mocks.files.set(DESIGN_FILE, designFixture);
    renderWithProviders(<DesignTab />);
    await screen.findByTestId('design-tab');
    const original = source().value;
    fireEvent.change(source(), { target: { value: `${original}\nextra` } });
    fireEvent.click(screen.getByRole('button', { name: /^(되돌리기|Revert)/ }));
    expect(source().value).toBe(original);
  });

  it('reports a failed save and stays dirty', async () => {
    mocks.files.set(DESIGN_FILE, designFixture);
    mocks.failWrite.current = true;
    renderWithProviders(<DesignTab />);
    await screen.findByTestId('design-tab');
    fireEvent.change(source(), { target: { value: `${source().value}\nextra` } });
    fireEvent.click(screen.getByRole('button', { name: /^(저장|Save)$/ }));
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('disk full');
    expect(screen.getByTestId('design-save-state').textContent).toMatch(/저장하지 않은|Unsaved/);
  });

  it('shows a message when DESIGN.md does not exist', async () => {
    renderWithProviders(<DesignTab />);
    await screen.findByTestId('design-missing');
    expect(screen.queryByTestId('design-source')).toBeNull();
  });

  it('asks for a project folder when none is open', () => {
    mocks.root.current = null;
    renderWithProviders(<DesignTab />);
    expect(screen.getByTestId('design-no-project')).toBeTruthy();
  });
});
