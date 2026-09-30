// 시작용 composition. 계획서(plan.json)에 맞게 에이전트가 다시 쓴다.
import { defineComposition } from '@vanilla/runtime';
import hello from './scenes/hello';

export default defineComposition({
  scenes: [hello],
  // video·image·slides는 'clock'(기본), web·interactive는 time: 'free', layout: 'sections'.
  format: { width: 1920, height: 1080 },
});
