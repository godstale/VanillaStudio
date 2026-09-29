import { describe, expect, it } from 'vitest';
import { parseTemplateManifest, TEMPLATE_MANIFEST_VERSION } from './template';

const valid = {
  version: TEMPLATE_MANIFEST_VERSION,
  id: 'editorial-slides',
  name: 'Editorial Slides',
  description: 'Minimal editorial slide deck.',
  outputTypes: ['slides'],
  tags: ['editorial', 'minimal'],
  preview: 'preview/cover.png',
  license: 'CC0-1.0',
  defaultPalette: 'biennale-yellow',
  recommendedPalettes: ['biennale-yellow'],
  designFile: 'DESIGN.md',
};

describe('parseTemplateManifest', () => {
  it('accepts a valid template.json', () => {
    const r = parseTemplateManifest(JSON.stringify(valid));
    expect(r.ok, r.ok ? '' : r.error).toBe(true);
    if (r.ok) {
      expect(r.manifest.id).toBe('editorial-slides');
      expect(r.manifest.outputTypes).toEqual(['slides']);
    }
  });

  it('fills defaults for optional fields', () => {
    const { tags, recommendedPalettes, designFile, ...rest } = valid;
    void tags;
    void recommendedPalettes;
    void designFile;
    const r = parseTemplateManifest(JSON.stringify(rest));
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.manifest.tags).toEqual([]);
      expect(r.manifest.recommendedPalettes).toEqual([]);
      expect(r.manifest.designFile).toBe('DESIGN.md');
    }
  });

  it('rejects bad id, unknown output type, missing fields', () => {
    expect(parseTemplateManifest(JSON.stringify({ ...valid, id: 'Bad_Id' })).ok).toBe(false);
    expect(parseTemplateManifest(JSON.stringify({ ...valid, outputTypes: ['pdf'] })).ok).toBe(false);
    expect(parseTemplateManifest(JSON.stringify({ ...valid, outputTypes: [] })).ok).toBe(false);
    const { name, ...noName } = valid;
    void name;
    expect(parseTemplateManifest(JSON.stringify(noName)).ok).toBe(false);
  });

  it('rejects escaping designFile paths and unknown keys', () => {
    expect(parseTemplateManifest(JSON.stringify({ ...valid, designFile: '../DESIGN.md' })).ok).toBe(false);
    expect(parseTemplateManifest(JSON.stringify({ ...valid, designFile: '/abs/DESIGN.md' })).ok).toBe(false);
    expect(parseTemplateManifest(JSON.stringify({ ...valid, extra: 1 })).ok).toBe(false);
  });

  it('rejects invalid JSON and wrong version', () => {
    expect(parseTemplateManifest('not json').ok).toBe(false);
    expect(parseTemplateManifest(JSON.stringify({ ...valid, version: 999 })).ok).toBe(false);
  });
});
