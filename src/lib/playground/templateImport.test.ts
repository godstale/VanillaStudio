import { describe, expect, it } from 'vitest';
import { isImportableFolder, validateTemplateFileList, validateTemplateFolder } from './templateImport';

const MANIFEST = JSON.stringify({
  version: 1,
  id: 'my-slides',
  name: 'My Slides',
  description: 'A minimal slide template.',
  outputTypes: ['slides'],
  license: 'CC-BY-4.0',
});

describe('templateImport', () => {
  it('requires the three skill files', () => {
    expect(validateTemplateFileList(['SKILL.md', 'DESIGN.md'])).toEqual({ ok: false, missing: ['template.json'] });
    expect(validateTemplateFileList(['SKILL.md', 'template.json', 'DESIGN.md', 'frame.md']).ok).toBe(true);
  });

  it('validates a complete folder', () => {
    const report = validateTemplateFolder(['SKILL.md', 'template.json', 'DESIGN.md'], MANIFEST);
    expect(isImportableFolder(report)).toBe(true);
    expect(report.manifest?.id).toBe('my-slides');
  });

  it('reports a broken manifest', () => {
    const report = validateTemplateFolder(['SKILL.md', 'template.json', 'DESIGN.md'], '{oops');
    expect(isImportableFolder(report)).toBe(false);
    expect(report.manifestError).toContain('Invalid JSON');
  });

  it('reports a missing manifest file', () => {
    const report = validateTemplateFolder(['SKILL.md', 'DESIGN.md'], null);
    expect(report.manifestError).toBe('missing template.json');
    expect(isImportableFolder(report)).toBe(false);
  });
});
