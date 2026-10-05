import { describe, expect, it } from 'vitest';
import { parseProjectManifest, projectManifestSchema } from './legacy-schema';

const base = {
  version: 1,
  name: 'demo',
  outputType: 'video',
  format: { width: 1920, height: 1080, fps: 30, durationSec: 15 },
  template: null,
  palette: { id: 'biennale-yellow', source: 'builtin' },
  agents: { default: 'claude-code', enabled: ['claude-code', 'codex'] },
  runtime: { version: '0.1.0' },
  createdAt: '2026-09-29T00:00:00.000Z',
};
const clone = () => structuredClone(base) as Record<string, unknown>;
const valid = (patch: (m: Record<string, unknown>) => void) => {
  const m = clone();
  patch(m);
  return projectManifestSchema.safeParse(m).success;
};

describe('vanilla.json schema', () => {
  it('accepts a valid video manifest', () => {
    expect(projectManifestSchema.safeParse(base).success).toBe(true);
  });

  it('accepts each output type with its own format fields', () => {
    const slides = { ...clone(), outputType: 'slides', format: { width: 1920, height: 1080, slideCount: 8 } };
    const image = {
      ...clone(),
      outputType: 'image',
      format: { width: 1080, height: 1080, variants: [{ width: 1080, height: 1350 }] },
    };
    const web = {
      ...clone(),
      outputType: 'web',
      format: { width: 1920, height: 1080 },
      template: { id: 'landing', version: '1.0.0' },
    };
    for (const m of [slides, image, web]) expect(projectManifestSchema.safeParse(m).success).toBe(true);
  });

  it('rejects wrong version, unknown type, unknown agent, unknown keys', () => {
    expect(valid((m) => (m.version = 2))).toBe(false);
    expect(valid((m) => (m.outputType = 'audio'))).toBe(false);
    expect(valid((m) => (m.agents = { default: 'gpt', enabled: ['gpt'] }))).toBe(false);
    expect(valid((m) => (m.extra = 1))).toBe(false);
  });

  it('rejects bad dimensions, semver, empty name', () => {
    expect(valid((m) => (m.format = { width: 0, height: 1080, fps: 30, durationSec: 5 }))).toBe(false);
    expect(valid((m) => (m.runtime = { version: 'latest' }))).toBe(false);
    expect(valid((m) => (m.name = '  '))).toBe(false);
  });

  it('enforces cross-field rules', () => {
    expect(valid((m) => (m.agents = { default: 'agy', enabled: ['codex'] }))).toBe(false);
    expect(valid((m) => (m.format = { width: 1920, height: 1080 }))).toBe(false); // video needs fps/duration
    expect(valid((m) => (m.outputType = 'web'))).toBe(false); // fps on non-video
  });

  it('parseProjectManifest reports errors as strings', () => {
    expect(parseProjectManifest(JSON.stringify(base)).ok).toBe(true);
    expect(parseProjectManifest('{nope').ok).toBe(false);
    const r = parseProjectManifest(JSON.stringify({ ...base, name: '' }));
    expect(r.ok === false && r.error).toContain('name');
  });
});
