// @vitest-environment jsdom
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { mkdtempSync } from 'node:fs';
import { afterAll, describe, expect, it, vi } from 'vitest';
import type { WebJob } from './job';
import {
  EMBED_ELEMENT,
  EMBED_EXAMPLE_FILE,
  EMBED_MODULE_FILE,
  REACT_WRAPPER_FILE,
  buildEmbedExample,
  buildEmbedModule,
  buildReactWrapper,
  exportEmbed,
} from './embed';

const tmp = mkdtempSync(path.join(tmpdir(), 'vanilla-embed-'));
afterAll(() => rmSync(tmp, { recursive: true, force: true }));

const job = (outDir: string): WebJob => ({ version: 1, kind: 'web', format: 'web', projectDir: path.join(tmp, 'proj'), outDir });

/** The generated ES module, typed without `any`. */
interface EmbedModuleShape {
  mountVanillaScene: (el: Element, options?: { src?: string; t?: number }) => () => void;
}

async function loadModule(source: string): Promise<EmbedModuleShape> {
  const url = `data:text/javascript,${encodeURIComponent(source)}`;
  return (await import(url)) as unknown as EmbedModuleShape;
}

describe('embed sources (T5.10)', () => {
  it('generates the module + wrapper + example deterministically', () => {
    expect(buildEmbedModule()).toBe(buildEmbedModule());
    expect(buildReactWrapper()).toBe(buildReactWrapper());
    expect(buildEmbedExample()).toBe(buildEmbedExample());
    expect(buildEmbedModule()).toContain(`customElements.define(TAG, VanillaSceneElement)`);
    expect(buildEmbedModule()).toContain('mountVanillaScene');
    expect(buildReactWrapper()).toContain('VanillaScene');
    expect(buildReactWrapper()).toContain(EMBED_ELEMENT);
    expect(buildReactWrapper()).toContain(`import './${EMBED_MODULE_FILE}'`);
    expect(buildEmbedExample()).toContain(`<${EMBED_ELEMENT} src="./index.html">`);
    expect(buildEmbedExample()).toContain(`src="./${EMBED_MODULE_FILE}"`);
  });

  it('registers <vanilla-scene> and renders an iframe with src + t', async () => {
    await loadModule(buildEmbedModule());
    expect(customElements.get(EMBED_ELEMENT)).toBeDefined();
    document.body.innerHTML = '';
    const el = document.createElement(EMBED_ELEMENT);
    el.setAttribute('src', './index.html');
    el.setAttribute('t', '1.5');
    document.body.appendChild(el);
    const frame = el.shadowRoot?.querySelector('iframe');
    expect(frame).not.toBeNull();
    expect(frame?.getAttribute('src')).toContain('index.html');
    expect(frame?.getAttribute('src')).toContain('t=1.5');
    // Attribute changes remount without throwing; removal cleans up.
    el.setAttribute('t', '2');
    expect(el.shadowRoot?.querySelectorAll('iframe')).toHaveLength(1);
    expect(el.shadowRoot?.querySelector('iframe')?.getAttribute('src')).toContain('t=2');
    el.remove();
    expect(el.shadowRoot?.querySelectorAll('iframe')).toHaveLength(0);
    document.body.innerHTML = '';
  });

  it('mountVanillaScene mounts into any element and cleans up', async () => {
    const mod = await loadModule(buildEmbedModule());
    document.body.innerHTML = '';
    const host = document.createElement('div');
    document.body.appendChild(host);
    const cleanup = mod.mountVanillaScene(host, { src: './index.html' });
    expect(host.shadowRoot?.querySelector('iframe')?.getAttribute('src')).toContain('index.html');
    cleanup();
    expect(host.shadowRoot?.querySelectorAll('iframe')).toHaveLength(0);
    document.body.innerHTML = '';
  });
});

describe('exportEmbed (T5.10)', () => {
  it('writes the unpacked site + module + wrapper + example', async () => {
    const outDir = path.join(tmp, 'embed-out');
    const events: unknown[] = [];
    const runBuild = vi.fn(({ distDir, onLog }: { distDir: string; onLog?: (s: 'stdout' | 'stderr', l: string) => void }) => {
      mkdirSync(path.join(distDir, 'assets'), { recursive: true });
      writeFileSync(path.join(distDir, 'index.html'), '<html><body>scene</body></html>');
      writeFileSync(path.join(distDir, 'assets', 'app.js'), 'console.log(1)');
      onLog?.('stdout', 'built in 1s');
      return Promise.resolve();
    });
    const files = await exportEmbed(job(outDir), { onEvent: (e) => events.push(e) }, { runBuild });
    expect(runBuild).toHaveBeenCalledOnce();
    expect(files).toEqual([
      path.join(outDir, 'index.html'),
      path.join(outDir, EMBED_MODULE_FILE),
      path.join(outDir, REACT_WRAPPER_FILE),
      path.join(outDir, EMBED_EXAMPLE_FILE),
    ]);
    expect(existsSync(path.join(outDir, '.build'))).toBe(false);
    expect(readFileSync(path.join(outDir, 'index.html'), 'utf8')).toContain('scene');
    expect(readFileSync(path.join(outDir, 'assets', 'app.js'), 'utf8')).toBe('console.log(1)');
    expect(readFileSync(path.join(outDir, EMBED_EXAMPLE_FILE), 'utf8')).toContain(`<${EMBED_ELEMENT}`);
    const steps = events.filter((e) => (e as { type: string }).type === 'progress').map((e) => (e as { step: string }).step);
    expect(steps).toEqual(['build', 'embed', 'done']);
  });

  it('fails when the build produces no index.html and aborts when cancelled', async () => {
    const nope = exportEmbed(job(path.join(tmp, 'embed-nope')), { onEvent: () => {} }, { runBuild: ({ distDir }) => {
      mkdirSync(distDir, { recursive: true });
      return Promise.resolve();
    } });
    await expect(nope).rejects.toThrow(/no index.html/);
    const c = new AbortController();
    c.abort();
    await expect(exportEmbed(job(path.join(tmp, 'embed-cancelled')), { onEvent: () => {}, signal: c.signal }, {})).rejects.toThrow(/cancelled/);
  });
});
