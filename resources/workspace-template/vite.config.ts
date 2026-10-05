import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { vanillaDesign } from '@vanilla/runtime/vite';

// 포트는 앱이 프리뷰 서버를 띄울 때 --port로 지정한다. 루트는 워크스페이스이고 신은 scenes/<slug>/src/index.html로 열린다.
export default defineConfig({
  plugins: [react(), vanillaDesign()],
  // 런타임이 워크스페이스의 react·three를 그대로 쓰게 한다(복수 인스턴스 방지).
  resolve: { dedupe: ['react', 'react-dom', 'three'] },
  server: { host: '127.0.0.1' },
});
