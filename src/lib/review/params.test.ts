import { describe, expect, it } from 'vitest';
import {
  coerceValue,
  defaultValues,
  effectiveValues,
  parseValuesFile,
  valuesRelPath,
  type ParamValues,
} from './params';
import type { ParamSchema } from './bridgeProtocol';

const schema: ParamSchema = {
  speed: { kind: 'number', default: 1, min: 0, max: 10 },
  title: { kind: 'text', default: 'Hi' },
  fg: { kind: 'color', default: '#000000' },
  on: { kind: 'boolean', default: false },
  mode: { kind: 'select', options: ['a', 'b'], default: 'a' },
};

describe('valuesRelPath', () => {
  it('points at the user-owned values file', () => {
    expect(valuesRelPath('s1')).toBe('params/s1.values.json');
  });
});

describe('coerceValue', () => {
  it('clamps numbers and rejects non-numbers', () => {
    expect(coerceValue(schema.speed, 99)).toBe(10);
    expect(coerceValue(schema.speed, -5)).toBe(0);
    expect(coerceValue(schema.speed, 'x')).toBeUndefined();
    expect(coerceValue(schema.speed, Number.NaN)).toBeUndefined();
  });

  it('accepts only fitting booleans, options and non-empty colors', () => {
    expect(coerceValue(schema.on, true)).toBe(true);
    expect(coerceValue(schema.on, 1)).toBeUndefined();
    expect(coerceValue(schema.mode, 'b')).toBe('b');
    expect(coerceValue(schema.mode, 'c')).toBeUndefined();
    expect(coerceValue(schema.fg, '#fff')).toBe('#fff');
    expect(coerceValue(schema.fg, '  ')).toBeUndefined();
    expect(coerceValue(schema.title, '')).toBe('');
  });
});

describe('parseValuesFile', () => {
  it('drops unknown keys, bad types and unparseable content', () => {
    expect(parseValuesFile(schema, '{oops')).toEqual({});
    expect(parseValuesFile(schema, '[1,2]')).toEqual({});
    expect(
      parseValuesFile(schema, JSON.stringify({ speed: 3, title: 42, extra: true, mode: 'z' })),
    ).toEqual({ speed: 3 });
  });
});

describe('defaults and effective values', () => {
  it('falls back to schema defaults under file values', () => {
    expect(defaultValues(schema)).toMatchObject({ speed: 1, title: 'Hi', on: false, mode: 'a' });
    const file: ParamValues = { speed: 2 };
    expect(effectiveValues(schema, file)).toMatchObject({ speed: 2, title: 'Hi' });
  });
});
