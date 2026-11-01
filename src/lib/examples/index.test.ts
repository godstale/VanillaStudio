import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { EXAMPLE_KINDS, exampleKeys, getExample } from './index';

describe('example library', () => {
  it('loads authored examples and maps motion to a filmstrip', () => {
    expect(getExample('style', 'popart')?.frames).toBe(1);
    expect(getExample('style', 'neonlight')?.frames).toBe(8);
    expect(getExample('style', 'no-such-style')).toBeUndefined();
    expect(exampleKeys().every((key) => (EXAMPLE_KINDS as readonly string[]).includes(key.split('/')[0]))).toBe(true);
  });

  it('keeps every committed example within the authoring rules', () => {
    const out = execFileSync(process.execPath, [resolve(__dirname, '../../../scripts/examples.mjs'), 'check'], { encoding: 'utf8' });
    expect(out).toContain(`ok: ${exampleKeys().length} examples`);
  });
});
