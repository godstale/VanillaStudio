import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { vanillaDesign } from '@vanilla/runtime/vite';

const rootDir = fileURLToPath(new URL('.', import.meta.url));

// Standalone play: every scene entry is bundled so dist/ runs on any static
// server. play.html is the presentation screen, index.html redirects to it.
function discoverInputs(): Record<string, string> {
  const inputs: Record<string, string> = { index: 'index.html', play: 'play.html' };
  const scenesDir = join(rootDir, 'scenes');
  if (!existsSync(scenesDir)) return inputs;
  for (const slug of readdirSync(scenesDir)) {
    const sceneFile = join(scenesDir, slug, 'scene.json');
    if (!existsSync(sceneFile)) continue;
    let entry = 'src/index.html';
    try {
      const scene = JSON.parse(readFileSync(sceneFile, 'utf8')) as { runtime?: { entry?: unknown } };
      if (typeof scene.runtime?.entry === 'string' && scene.runtime.entry !== '') entry = scene.runtime.entry;
    } catch {
      // Broken scene.json: fall back to the default entry (validation happens elsewhere).
    }
    const full = join(scenesDir, slug, entry);
    if (existsSync(full)) inputs[`scenes/${slug}/${entry.replace(/\.html$/, '')}`] = `scenes/${slug}/${entry}`;
  }
  return inputs;
}

// 포트는 앱이 프리뷰 서버를 띄울 때 --port로 지정한다. 루트는 워크스페이스이고 신은 scenes/<slug>/src/index.html로 열린다.
export default defineConfig({
  plugins: [react(), vanillaDesign()],
  // dist/를 어떤 정적 서버(또는 file이 아닌 http 경로)에서도 열 수 있게 상대 경로로 만든다.
  base: './',
  // 런타임이 워크스페이스의 react·three를 그대로 쓰게 한다(복수 인스턴스 방지).
  resolve: { dedupe: ['react', 'react-dom', 'three'] },
  server: { host: '127.0.0.1' },
  build: { rollupOptions: { input: discoverInputs() } },
});
