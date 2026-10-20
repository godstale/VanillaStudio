// @vitest-environment node
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import en from '@/lib/i18n/dictionaries/en';
import ko from '@/lib/i18n/dictionaries/ko';
import { USER_GUIDES } from './userGuides';

// T7.7: the user guide shown in the app must match the files in Docs/User-Guide/.
const DIR = resolve(__dirname, '../../../Docs/User-Guide');
const text = (file: string) => readFileSync(resolve(DIR, file), 'utf8');

describe('user guide links', () => {
  it('every linked document exists and every current document is linked', () => {
    for (const g of USER_GUIDES) expect(existsSync(resolve(DIR, g.file)), g.file).toBe(true);
    const current = readdirSync(DIR).filter((f) => f.endsWith('.md')).sort();
    expect(USER_GUIDES.map((g) => g.file).sort()).toEqual(current);
  });

  it('each link has a label in both languages', () => {
    for (const g of USER_GUIDES) {
      expect(en[g.key as keyof typeof en], `en ${g.key}`).toBeTruthy();
      expect(ko[g.key as keyof typeof ko], `ko ${g.key}`).toBeTruthy();
    }
  });

  it('documents link only to documents that exist', () => {
    const existing = new Set([...readdirSync(DIR), 'Docs/Verification/Reproducibility.md', 'Docs/Verification/Golden-Samples.md']);
    for (const g of USER_GUIDES) {
      const body = text(g.file);
      const refs = [...body.matchAll(/`((?:Docs\/[A-Za-z-]+\/)?\d\d-[a-z-]+\.md|Docs\/Verification\/[A-Za-z-]+\.md)`/g)].map((m) => m[1]);
      for (const r of refs) expect(existing.has(r), `${g.file} links to ${r}`).toBe(true);
    }
  });

  it('v1 documents are archived, not linked', () => {
    const legacy = readdirSync(resolve(DIR, 'legacy'));
    expect(legacy.length).toBeGreaterThan(0);
    for (const f of legacy) expect(text(`legacy/${f}`).startsWith('> **보관용(v1)**')).toBe(true);
    for (const g of USER_GUIDES) expect(text(g.file)).not.toMatch(/03-pipeline|04-export-limits/);
  });
});
