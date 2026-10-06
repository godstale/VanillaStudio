import { describe, expect, it } from 'vitest';
import { paramsForPath } from './paramsFiles';

const files = {
  '/params/hello.values.json': { title: 'root hello' },
  '/params/legacy.values.json': { n: 1 },
  '/scenes/intro/params/hello.values.json': { title: 'intro hello' },
  '/scenes/page/params/hello.values.json': { title: 'page hello' },
  '/scenes/page/params/extra.values.json': { x: true },
};

describe('paramsForPath', () => {
  it('a scene only sees its own folder, over the root values', () => {
    expect(paramsForPath(files, '/scenes/intro/src/index.html')).toEqual({ hello: { title: 'intro hello' }, legacy: { n: 1 } });
    expect(paramsForPath(files, '/scenes/page/src/index.html')).toEqual({ hello: { title: 'page hello' }, legacy: { n: 1 }, extra: { x: true } });
  });

  it('a scene without its own values falls back to the root ones; other scenes never leak in', () => {
    expect(paramsForPath(files, '/scenes/outro/src/index.html')).toEqual({ hello: { title: 'root hello' }, legacy: { n: 1 } });
  });

  it('outside a scene folder (v1 layout or opened directly) only the root values apply', () => {
    expect(paramsForPath(files, '/index.html')).toEqual({ hello: { title: 'root hello' }, legacy: { n: 1 } });
    expect(paramsForPath({}, '/scenes/a/src/index.html')).toEqual({});
  });

  it('a slug cannot reach into another scene through the path', () => {
    expect(paramsForPath(files, '/scenes/intro/../page/src/index.html')).toEqual({ hello: { title: 'intro hello' }, legacy: { n: 1 } });
  });
});
