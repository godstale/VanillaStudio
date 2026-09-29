import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseProjectManifest } from './schema';

const root = resolve(__dirname, '../../../resources');
const read = (p: string) => readFileSync(resolve(root, p), 'utf8');

describe('project template resources', () => {
  it('ships every scaffold file', () => {
    for (const f of [
      'vanilla.json', 'AGENTS.md', 'CLAUDE.md', 'DESIGN.md', 'package.json',
      'vite.config.ts', 'index.html', 'src/main.tsx', '.gitignore', 'tsconfig.json',
    ]) {
      expect(existsSync(resolve(root, 'project-template', f)), f).toBe(true);
    }
  });

  it('vanilla.json validates once placeholders are filled', () => {
    const text = read('project-template/vanilla.json')
      .replace('{{projectName}}', 'demo')
      .replace('{{createdAt}}', '2026-09-29T00:00:00.000Z');
    const r = parseProjectManifest(text);
    expect(r.ok, r.ok ? '' : r.error).toBe(true);
  });

  it('CLAUDE.md imports AGENTS.md', () => {
    expect(read('project-template/CLAUDE.md').trim()).toBe('@AGENTS.md');
  });

  it('default DESIGN.md defines the required color roles and matches the template copy', () => {
    const design = read('design/DESIGN.md');
    const front = /^---\r?\n([\s\S]*?)\r?\n---/.exec(design)?.[1] ?? '';
    for (const role of ['canvas', 'surface', 'ink', 'ink-muted', 'primary', 'on-primary', 'line']) {
      expect(front, role).toMatch(new RegExp(`^  ${role}: "#[0-9A-Fa-f]{6}"`, 'm'));
    }
    expect(read('project-template/DESIGN.md')).toBe(design);
  });
});
