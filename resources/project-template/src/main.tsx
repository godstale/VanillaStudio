// 앱 소유 파일: 런타임 부트스트랩. 수정하지 않는다(에이전트는 composition.tsx와 scenes/를 만든다).
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <main style={{ padding: 32, fontFamily: 'sans-serif' }}>Vanilla Studio project</main>
  </StrictMode>,
);
