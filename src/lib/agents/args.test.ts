import { describe, expect, it } from 'vitest';
import { formatArgs, parseArgs } from './args';

const ok = (s: string) => {
  const r = parseArgs(s);
  if (!r.ok) throw new Error(r.error);
  return r.args;
};

describe('parseArgs', () => {
  it('splits on whitespace', () => {
    expect(ok('--model  opus   --verbose')).toEqual(['--model', 'opus', '--verbose']);
    expect(ok('')).toEqual([]);
    expect(ok('   ')).toEqual([]);
  });

  it('keeps spaces inside double quotes and allows empty arguments', () => {
    expect(ok('--name "My Agent" x')).toEqual(['--name', 'My Agent', 'x']);
    expect(ok('a "" b')).toEqual(['a', '', 'b']);
  });

  it('does not interpret shell syntax', () => {
    expect(ok('a | b && $HOME > out')).toEqual(['a', '|', 'b', '&&', '$HOME', '>', 'out']);
  });

  it('rejects an unclosed quote', () => {
    expect(parseArgs('--x "oops')).toEqual({ ok: false, error: 'unclosed quote' });
  });
});

describe('formatArgs', () => {
  it('round-trips with parseArgs', () => {
    for (const args of [[], ['--model', 'opus'], ['--name', 'My Agent'], ['a', '', 'b']]) {
      expect(ok(formatArgs(args))).toEqual(args);
    }
  });
});
