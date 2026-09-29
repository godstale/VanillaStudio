import { describe, expect, it } from 'vitest';
import { OUTPUT_TYPES } from '@/lib/types/project';
import { parseProjectManifest } from './schema';
import {
  buildManifest,
  defaultWizardValues,
  toFolderName,
  validateWizard,
  withOutputType,
  type WizardValues,
} from './wizard';

const base = (over: Partial<WizardValues> = {}): WizardValues => ({
  ...defaultWizardValues(),
  name: 'Demo',
  parentDir: 'C:\\Projects',
  ...over,
});

describe('wizard manifest', () => {
  it('every output type yields a schema-valid manifest', () => {
    for (const type of OUTPUT_TYPES) {
      const v = withOutputType(base(), type);
      const r = validateWizard(v);
      expect(r.ok, `${type}: ${r.ok ? '' : r.detail}`).toBe(true);
    }
  });

  it('video carries fps/duration, slides carry slideCount, others neither', () => {
    expect(buildManifest(withOutputType(base(), 'video')).format).toMatchObject({
      fps: 30,
      durationSec: 30,
    });
    expect(buildManifest(withOutputType(base(), 'slides')).format.slideCount).toBe(10);
    expect(buildManifest(withOutputType(base(), 'web')).format).toEqual({ width: 1440, height: 900 });
  });

  it('template is none, palette is the builtin default, agent is enabled', () => {
    const m = buildManifest(base({ agent: 'codex' }));
    expect(m.template).toBeNull();
    expect(m.palette).toEqual({ id: 'vanilla-default', source: 'builtin' });
    expect(m.agents).toEqual({ default: 'codex', enabled: ['codex'] });
  });

  it('manifest JSON round-trips through parseProjectManifest', () => {
    const r = validateWizard(base());
    expect(r.ok && parseProjectManifest(r.manifestJson).ok).toBe(true);
  });

  it('rejects missing name/folder and out-of-range video values', () => {
    expect(validateWizard(base({ name: '  ' }))).toMatchObject({ errorKey: 'project.error.nameRequired' });
    expect(validateWizard(base({ parentDir: '' }))).toMatchObject({ errorKey: 'project.error.folderRequired' });
    expect(
      validateWizard(withOutputType(base({ durationSec: 0 }), 'video')),
    ).toMatchObject({ errorKey: 'project.error.invalidManifest' });
  });

  it('toFolderName strips path-hostile characters', () => {
    expect(toFolderName('a/b:c')).toBe('a-b-c');
    expect(toFolderName('  My Demo. ')).toBe('My Demo');
    expect(toFolderName('...')).toBe('');
  });
});
