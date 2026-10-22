import { describe, expect, it } from 'vitest';

import { aliasNameFor, isAccessViolation, isAscii, needsVite, pickAsciiBase } from '../../../resources/workspace-template/scripts/ascii-cwd.mjs';

describe('ascii-cwd launcher helpers (D-043)', () => {
  it('detects non-ASCII paths', () => {
    expect(isAscii('C:/class/my-work')).toBe(true);
    expect(isAscii('')).toBe(true);
    expect(isAscii('C:/Workspace/강의/day02')).toBe(false);
    expect(isAscii('숲')).toBe(false);
  });

  it('derives a stable ASCII-only alias name per workspace', () => {
    const a = aliasNameFor('C:/Workspace/강의/day02');
    const b = aliasNameFor('C:/Workspace/강의/day02');
    const c = aliasNameFor('C:/Workspace/강의/day03');
    expect(a).toBe(b);
    expect(a).not.toBe(c);
    expect(isAscii(a)).toBe(true);
    expect(a.startsWith('vanilla-ws-')).toBe(true);
  });

  it('picks the first ASCII base or null', () => {
    expect(pickAsciiBase(['C:/Temp', 'C:/Work'])).toBe('C:/Temp');
    expect(pickAsciiBase(['C:/Workspace/강의/tmp', 'C:/Temp'])).toBe('C:/Temp');
    expect(pickAsciiBase(['C:/Workspace/강의/tmp'])).toBeNull();
    expect(pickAsciiBase([])).toBeNull();
  });

  it('detects Vite commands that need an ASCII cwd', () => {
    expect(needsVite('vite', [])).toBe(true);
    expect(needsVite('vite', ['--open', 'play.html'])).toBe(true);
    expect(needsVite('node', ['scripts/vite.js'])).toBe(true);
    expect(needsVite('node', ['scripts/check-scene.mjs'])).toBe(false);
    expect(needsVite('node', ['scripts/vanilla-agent.mjs'])).toBe(false);
  });

  it('recognises the Node loader access-violation exit code only (D-044)', () => {
    expect(isAccessViolation(3221225477)).toBe(true);
    expect(isAccessViolation(-1073741819)).toBe(true);
    expect(isAccessViolation(0)).toBe(false);
    expect(isAccessViolation(1)).toBe(false);
    expect(isAccessViolation(null)).toBe(false);
  });
});
