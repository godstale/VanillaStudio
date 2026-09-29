import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// 포트는 앱이 프리뷰 서버를 띄울 때 --port로 지정한다.
export default defineConfig({
  plugins: [react()],
  server: { host: '127.0.0.1' },
});
