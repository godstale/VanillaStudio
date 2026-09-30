// 앱 소유 파일: 런타임 부트스트랩. 수정하지 않는다(에이전트는 composition.tsx와 scenes/를 만든다).
import { mountVanilla } from '@vanilla/runtime/app';
import type { Composition } from '@vanilla/runtime';
import composition from './composition';

let dispose = mountVanilla(composition);

// Scene·composition 수정은 다시 마운트해 반영한다(재생 위치 유지). 새로고침은 하지 않는다.
if (import.meta.hot) {
  import.meta.hot.accept('./composition', (mod) => {
    if (!mod) return;
    dispose();
    dispose = mountVanilla((mod as unknown as { default: Composition }).default);
  });
}
