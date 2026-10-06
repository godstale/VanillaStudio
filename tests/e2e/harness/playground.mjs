// 하네스 본체: 앱의 실제 모듈(시퀀스 매니저·IframeSceneHost·전환 러너)을 그대로 쓰고, puppeteer가 `window.__pg`로 조작·관찰한다.
import { IframeSceneHost } from '@/lib/playground/iframeScene';
import { createTransitionRunner } from '@/lib/playground/sceneTransitions';
import { createSequenceManager } from '@/lib/sequence/manager';

const stage = document.getElementById('stage');
const log = [];
let manager = null;
let host = null;
let t0 = 0;

window.__pg = {
  /** config: { sequence, scenes: [[id, {type,name,slug,entry}]], serverUrl, canvas, workspaceId } */
  async run(config) {
    const scenes = new Map(config.scenes);
    host = new IframeSceneHost({ container: stage, serverUrl: config.serverUrl, hostOrigin: window.location.origin, canvas: config.canvas, scenes });
    manager = createSequenceManager({ sequence: config.sequence, scenes, workspaceId: config.workspaceId, host, runTransition: createTransitionRunner(new Map()) });
    t0 = performance.now();
    let last = '';
    manager.subscribe(() => {
      const s = manager.getState();
      host.layout(s);
      const key = `${s.status}|${s.current}|${s.next}`;
      if (key !== last) {
        last = key;
        log.push({ at: Math.round(performance.now() - t0), status: s.status, current: s.current, next: s.next });
      }
    });
    await manager.start();
    return manager.getState();
  },
  state: () => manager.getState(),
  log: () => log,
  mark: () => {
    t0 = performance.now();
    log.length = 0;
  },
  input: (i) => manager.input(i),
  choose: (label) => manager.choose(label),
  jump: (id) => manager.jump(id),
  pause: () => manager.pause(),
  resume: () => manager.resume(),
  seek: (t) => manager.seek(t),
  dispose: () => manager?.dispose(),
  iframeCount: () => stage.querySelectorAll('iframe').length,
  layers: () => [...stage.querySelectorAll('iframe')].map((f) => ({ id: f.dataset.sceneId, z: f.style.zIndex, opacity: f.style.opacity })),
};
window.__pgReady = true;
