import { describe, expect, it } from 'vitest';
import notice from '../../../NOTICE.md?raw';

// T7.4: NOTICE.md must stay in sync with Feasibility-Risks §2.9.
describe('NOTICE.md license coverage', () => {
  it.each([
    'HyperFrames',
    'Apache-2.0',
    'dom-to-pptx',
    'pptxgenjs',
    'FFmpeg',
    'GPL',
    'BtbN/FFmpeg-Builds',
    'OFL',
    'CC0',
    'CREDITS.md',
    'Feasibility-Risks',
  ])('mentions %s', (keyword) => {
    expect(notice).toContain(keyword);
  });

  it('states FFmpeg is not bundled', () => {
    expect(notice).toMatch(/not bundled/i);
  });
});
