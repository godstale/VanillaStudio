// Shipped-template contract tests (T6.4~T6.6).
// Reads the template skill folders from disk and enforces what the lane
// promised: schema-valid manifests + palettes, parseable DESIGN.md with
// passing contrast, and example code that honours the vanilla-core rules
// (clock contract, token-only colors).
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { parseTemplateManifest } from './template';
import { parsePalette } from './palette';
import { parseDesign } from '@/lib/design/parse';
import { contrastReport } from '@/lib/design/roles';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', 'resources', 'templates');
const IDS = ['editorial-slides', 'product-showcase-video', 'kinetic-type-web'] as const;

const REQUIRED = ['SKILL.md', 'template.json', 'palette.json', 'DESIGN.md', 'CREDITS.md'] as const;

// Clock-contract bans for video/image/slides scenes (vanilla-core §1).
// Math.exp and other pure math are deterministic and allowed.
const BANNED_TIME_API = [/Date\.now\s*\(/, /performance\.now\s*\(/, /Math\.random\s*\(/, /requestAnimationFrame\s*\(/, /setInterval\s*\(/, /new\s+Date\s*\(/];
// Hex/rgb/hsl literals are allowed only as `param.color` fallbacks or behind `ds-ignore`.
// The `(?<!&)` guard skips HTML entities such as `&#9670;`.
const COLOR_LITERAL = /(?<!&)#[0-9a-fA-F]{3,8}\b|(?<![-$])\brgba?\s*\(|\bhsla?\s*\(/;

function filesOf(id: string, sub: string): string[] {
  const dir = join(ROOT, id, sub);
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isFile())
    .map((e) => e.name)
    .sort();
}

describe.each(IDS)('template %s', (id) => {
  it('ships the required skill files and a valid manifest', () => {
    for (const f of REQUIRED) {
      expect(existsSync(join(ROOT, id, f)), `${id}/${f}`).toBe(true);
    }
    const manifest = parseTemplateManifest(readFileSync(join(ROOT, id, 'template.json'), 'utf8'));
    expect(manifest.ok, manifest.ok ? '' : manifest.error).toBe(true);
    if (!manifest.ok) return;
    // The manifest's own pointers must resolve inside the folder.
    expect(existsSync(join(ROOT, id, manifest.manifest.designFile)), 'designFile').toBe(true);
    if (manifest.manifest.preview) {
      expect(existsSync(join(ROOT, id, manifest.manifest.preview)), 'preview').toBe(true);
    }
    expect(filesOf(id, 'examples').filter((f) => f.endsWith('.tsx')).length).toBeGreaterThan(0);
    expect(filesOf(id, 'references').filter((f) => f.endsWith('.md')).length).toBeGreaterThan(0);
  });

  it('ships a schema-valid palette.json matching defaultPalette', () => {
    const palette = parsePalette(readFileSync(join(ROOT, id, 'palette.json'), 'utf8'));
    expect(palette.ok, palette.ok ? '' : palette.error).toBe(true);
    if (!palette.ok) return;
    const manifest = parseTemplateManifest(readFileSync(join(ROOT, id, 'template.json'), 'utf8'));
    expect(manifest.ok).toBe(true);
    if (manifest.ok) expect(manifest.manifest.defaultPalette).toBe(palette.palette.id);
  });

  it('DESIGN.md parses with no issues and passes contrast', () => {
    const { colors, issues } = parseDesign(readFileSync(join(ROOT, id, 'DESIGN.md'), 'utf8'));
    expect(issues).toEqual([]);
    const report = contrastReport(colors);
    for (const r of report) {
      expect(r.ok, `${r.pair}: ${r.ratio} < ${r.min}`).toBe(true);
    }
  });

  it('preview SVG re-tints via CSS vars (no hard-coded fills)', () => {
    const manifest = parseTemplateManifest(readFileSync(join(ROOT, id, 'template.json'), 'utf8'));
    expect(manifest.ok).toBe(true);
    if (!manifest.ok || !manifest.manifest.preview) return;
    const svg = readFileSync(join(ROOT, id, manifest.manifest.preview), 'utf8');
    expect(svg).toContain('var(--color-');
    expect(svg.match(COLOR_LITERAL) ?? []).toEqual([]);
  });

  it('examples honour the Scene runtime contract and token rules', () => {
    for (const f of filesOf(id, 'examples')) {
      if (!f.endsWith('.tsx')) continue;
      const src = readFileSync(join(ROOT, id, 'examples', f), 'utf8');
      expect(src, `${f} registers a scene`).toContain('defineScene');
      for (const re of BANNED_TIME_API) {
        expect(src.match(re) ?? [], `${f} bans ${re}`).toEqual([]);
      }
      // Every scene stays adjustable: color, text and motion params.
      expect(src, `${f} exposes params`).toMatch(/param\.(color|text|number|select)/);
      // No stray color literals outside param fallbacks.
      for (const [n, line] of src.split('\n').entries()) {
        if (line.includes('param.color') || line.includes('ds-ignore')) continue;
        expect(line.match(COLOR_LITERAL) ?? [], `${f}:${n + 1}`).toEqual([]);
      }
    }
  });
});
