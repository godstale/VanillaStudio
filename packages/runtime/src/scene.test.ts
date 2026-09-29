import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { beforeEach, describe, expect, it } from 'vitest';
import { param, ParamsProvider, resolveParams, token, useParams } from './params';
import { clearScenes, defineScene, getScene, getScenes, sceneMeta } from './scene';

const Noop = () => null;

describe('defineScene', () => {
  beforeEach(clearScenes);

  it('registers the scene and returns the definition', () => {
    const s = defineScene({ id: 's1-intro', duration: 4, params: { speed: param.number(1) }, Component: Noop });
    expect(getScene('s1-intro')).toBe(s);
    expect(getScenes()).toHaveLength(1);
    expect(sceneMeta(s)).toEqual({ id: 's1-intro', duration: 4, params: { speed: { kind: 'number', default: 1 } } });
  });

  it('replaces a scene registered again under the same id (HMR)', () => {
    defineScene({ id: 'a', Component: Noop });
    const next = defineScene({ id: 'a', duration: 2, Component: Noop });
    expect(getScenes()).toEqual([next]);
  });

  it('rejects bad ids and durations', () => {
    expect(() => defineScene({ id: '../x', Component: Noop })).toThrow(/invalid id/);
    expect(() => defineScene({ id: 'x', duration: 0, Component: Noop })).toThrow(/duration/);
    expect(() => defineScene({ id: 'x', duration: Number.NaN, Component: Noop })).toThrow(/duration/);
  });
});

describe('resolveParams precedence: code < token < user', () => {
  const schema = {
    bg: param.color(token('accent'), { fallback: '#111111' }),
    fg: param.color('#222222'),
    speed: param.number(1, { min: 0.2, max: 3 }),
    title: param.text('Hello'),
    on: param.boolean(false),
    mode: param.select(['a', 'b'], 'a'),
  };

  it('uses code defaults when nothing else applies', () => {
    expect(resolveParams(schema)).toEqual({ bg: '#111111', fg: '#222222', speed: 1, title: 'Hello', on: false, mode: 'a' });
  });

  it('lets a token override the literal default of a bound color param', () => {
    const v = resolveParams(schema, { tokens: { accent: '#ABCDEF', ink: '#000000' } });
    expect(v.bg).toBe('#ABCDEF');
    expect(v.fg).toBe('#222222');
  });

  it('lets user values override tokens', () => {
    const v = resolveParams(schema, { tokens: { accent: '#ABCDEF' }, user: { bg: '#FF0000', speed: 2, mode: 'b', on: true, title: '' } });
    expect(v).toMatchObject({ bg: '#FF0000', speed: 2, mode: 'b', on: true, title: '' });
  });

  it('clamps numbers and ignores values of the wrong type or unknown keys', () => {
    const v = resolveParams(schema, { user: { speed: 99, mode: 'zzz', on: 'yes', bg: 5, extra: 1 } });
    expect(v).toMatchObject({ speed: 3, mode: 'a', on: false, bg: '#111111' });
    expect('extra' in v).toBe(false);
  });

  it('does not read inherited keys of the user object', () => {
    const user = JSON.parse('{"__proto__": {"speed": 3}}') as Record<string, unknown>;
    expect(resolveParams(schema, { user }).speed).toBe(1);
  });
});

describe('useParams', () => {
  it('reads the provided values and throws outside a provider', () => {
    const Probe = () => createElement('b', null, useParams<{ title: ReturnType<typeof param.text> }>().title);
    expect(renderToString(createElement(ParamsProvider, { values: { title: 'Hi' } }, createElement(Probe)))).toContain('Hi');
    expect(() => renderToString(createElement(Probe))).toThrow(/useParams/);
  });
});
