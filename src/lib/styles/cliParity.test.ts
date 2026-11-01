import { execFileSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { checkGuide } from '@/lib/guides/guideMd';
import { parseScene } from '@/lib/scene/schema';

const TEMPLATE = resolve(__dirname, '../../../resources/workspace-template');
let dir: string | null = null;

afterEach(() => {
  if (dir) rmSync(dir, { recursive: true, force: true });
  dir = null;
});

describe('pnpm vanilla styles', () => {
  it('keeps scene styles through sync-guides with a GUIDE.md the app accepts', () => {
    dir = mkdtempSync(join(tmpdir(), 'vs-style-'));
    const root = dir;
    cpSync(join(TEMPLATE, 'scripts'), join(root, 'scripts'), { recursive: true });
    cpSync(join(TEMPLATE, 'STYLE_LIBRARY.json'), join(root, 'STYLE_LIBRARY.json'));
    mkdirSync(join(root, 'scenes'));
    writeFileSync(join(root, 'sequence.json'), JSON.stringify({ version: 1, workspaceId: 'w', mode: 'linear', nodes: [], edges: [], start: null }));
    writeFileSync(
      join(root, 'workspace.json'),
      JSON.stringify({ version: 1, workspaceId: 'w', name: 'W', canvas: { aspect: '16:9', width: 1920, height: 1080, fps: 30 } }),
    );
    const cli = (...args: string[]) =>
      execFileSync(process.execPath, [join(root, 'scripts/vanilla-agent.mjs'), ...args], {
        cwd: root,
        encoding: 'utf8',
        env: { ...process.env, VANILLA_WORKSPACE_ROOT: root },
      });

    expect(cli('styles', '--query', 'chrome')).toContain('chrome');
    cli('scaffold-scene', 'intro', '--name', 'Intro', '--type', 'motion');
    const path = join(root, 'scenes/intro/scene.json');
    writeFileSync(path, JSON.stringify({ ...JSON.parse(readFileSync(path, 'utf8')), styles: [{ id: 'chrome', scope: 'image' }] }));
    cli('sync-guides', 'intro');

    const scene = parseScene(readFileSync(path, 'utf8'));
    expect(scene.styles).toEqual([{ id: 'chrome', scope: 'image' }]);
    expect(checkGuide(readFileSync(join(root, 'scenes/intro/GUIDE.md'), 'utf8'), scene)).toBe('ok');
    expect(readFileSync(join(root, 'scenes/intro/AGENTS.md'), 'utf8')).toContain('mirror finish');
  });
});
