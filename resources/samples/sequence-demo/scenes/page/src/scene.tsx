import { useState } from 'react';
import { defineScene, useSteps } from '@vanilla/runtime';

// 정적 페이지(steps): 클릭으로만 진행한다(D-032). 마지막 스텝에서 입력이 들어오면 호스트가 시퀀스의 다음 엣지를 평가한다.
const STEPS = [
  { id: 'welcome', title: 'Welcome', body: 'A static page moves on only when you click.', advance: 'click' },
  { id: 'steps', title: 'Steps', body: 'Each click shows the next step.', advance: 'click' },
  { id: 'next', title: 'Next', body: 'The last click leaves the page.', advance: 'click' },
] as const;

function Page() {
  const [index, setIndex] = useState(0);
  // 호스트 Bridge로 step·done이 보고된다(플레이그라운드는 이 값으로 다음 신을 정한다).
  useSteps(STEPS, null, setIndex);
  const step = STEPS[index];
  return (
    <main
      data-testid="page"
      style={{ minHeight: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 16, padding: '0 12%', boxSizing: 'border-box', background: 'var(--color-canvas)', color: 'var(--color-ink)', fontFamily: 'sans-serif' }}
    >
      <p id="step-count" style={{ margin: 0, color: 'var(--color-primary)' }}>
        Step {index + 1} / {STEPS.length}
      </p>
      <h2 id="step-title" style={{ margin: 0, fontSize: 56 }}>
        {step.title}
      </h2>
      <p style={{ margin: 0, fontSize: 28 }}>{step.body}</p>
    </main>
  );
}

export default defineScene({ id: 'page', Component: Page });
