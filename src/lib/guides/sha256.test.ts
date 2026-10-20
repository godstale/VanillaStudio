import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { sha256 } from './sha256';

describe('sha256', () => {
  it('matches known vectors', () => {
    expect(sha256('')).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
    expect(sha256('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
    expect(sha256('abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq')).toBe(
      '248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1',
    );
  });

  it('agrees with node:crypto on UTF-8 and block-boundary lengths', () => {
    for (const text of ['가나다 ✓', 'a'.repeat(55), 'a'.repeat(56), 'a'.repeat(64), 'a'.repeat(1000)]) {
      expect(sha256(text)).toBe(createHash('sha256').update(text, 'utf8').digest('hex'));
    }
  });
});
