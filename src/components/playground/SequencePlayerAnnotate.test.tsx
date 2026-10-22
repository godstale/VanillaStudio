import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { LanguageProvider } from '@/lib/i18n/LanguageContext';
import { addNode, newSequence, type Sequence } from '@/lib/sequence/schema';
import { SequencePlayer } from './SequencePlayer';

vi.stubGlobal(
  'ResizeObserver',
  class {
    observe() {}
    unobserve() {}
    disconnect() {}
  },
);

const SERVER = 'http://127.0.0.1:5555';
const TR = { type: 'cut', durationMs: 0, easing: '', params: {} };
const edge = (from: string, to: string, trigger: string) => ({ from, to, trigger, transition: { ...TR } });

const scenes = new Map([
  ['scn_m', { type: 'motion' as const, name: 'Intro', slug: 'intro' }],
  ['scn_s', { type: 'static' as const, name: 'Page', slug: 'page' }],
]);
const canvas = { width: 1920, height: 1080, fps: 30 };

function sequence(edges: Sequence['edges'], ids = ['scn_s']): Sequence {
  let s = newSequence('ws_1');
  for (const id of ids) s = addNode(s, id, { x: 0, y: 0 });
  return { ...s, mode: 'interactive', edges };
}

const frames = () => [...document.querySelectorAll('iframe')] as HTMLIFrameElement[];
const frameOf = (id: string) => frames().find((f) => f.dataset.sceneId === id)!;

function fromScene(id: string, type: string, payload: unknown) {
  act(() => {
    const f = frameOf(id);
    window.dispatchEvent(new MessageEvent('message', { data: { v: 2, type, payload }, origin: SERVER, source: f.contentWindow as MessageEventSource }));
  });
}
const ready = (duration?: number) => ({ scenes: [], format: '16:9', design: { hash: 'h', roles: {} }, ...(duration === undefined ? {} : { duration }) });

function renderPlayer(seq: Sequence) {
  return render(
    <LanguageProvider>
      <div style={{ width: 1000, height: 700 }}>
        <SequencePlayer sequence={seq} workspaceId="ws_1" scenes={scenes} serverUrl={SERVER} hostOrigin={window.location.origin} canvas={canvas} />
      </div>
    </LanguageProvider>,
  );
}

/** jsdom의 getBoundingClientRect(0 채움)를 캔버스 크기로 고정한다. */
function mockSvgRect() {
  const svg = screen.getByTestId('player-annotations');
  vi.spyOn(svg, 'getBoundingClientRect').mockReturnValue({
    x: 0, y: 0, left: 0, top: 0, right: 1920, bottom: 1080, width: 1920, height: 1080, toJSON: () => ({}),
  } as DOMRect);
}

afterEach(cleanup);

describe('SequencePlayer slide annotations', () => {
  it('shows draw/erase tools only for static (slide) scenes', async () => {
    renderPlayer(sequence([], ['scn_s']));
    await waitFor(() => expect(frameOf('scn_s')).toBeTruthy());
    fromScene('scn_s', 'ready', ready());
    await waitFor(() => expect(screen.getByRole('button', { name: /그리기|Draw/ })).toBeTruthy());
    expect(screen.getByRole('button', { name: /지우개|Eraser/ })).toBeTruthy();

    cleanup();
    renderPlayer(sequence([edge('scn_m', 'scn_s', 'end')], ['scn_m', 'scn_s']));
    await waitFor(() => expect(frameOf('scn_m')).toBeTruthy());
    fromScene('scn_m', 'ready', ready(4));
    expect(screen.queryByRole('button', { name: /그리기|Draw/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /지우개|Eraser/ })).toBeNull();
  });

  it('draws a stroke with the pen and clears it', async () => {
    renderPlayer(sequence([], ['scn_s']));
    await waitFor(() => expect(frameOf('scn_s')).toBeTruthy());
    fromScene('scn_s', 'ready', ready());
    await waitFor(() => expect(screen.getByRole('button', { name: /그리기|Draw/ })).toBeTruthy());
    mockSvgRect();

    fireEvent.click(screen.getByRole('button', { name: /그리기|Draw/ }));
    const svg = screen.getByTestId('player-annotations');
    expect(svg.getAttribute('class')).toContain('cursor-crosshair');
    // 필기 중에는 클릭 진행이 막힌다.
    expect(screen.getByTestId('player-input').hasAttribute('disabled')).toBe(true);

    fireEvent.pointerDown(svg, { clientX: 100, clientY: 100, pointerId: 1 });
    fireEvent.pointerMove(svg, { clientX: 200, clientY: 200, pointerId: 1 });
    fireEvent.pointerUp(svg, { pointerId: 1 });
    await waitFor(() => expect(svg.querySelectorAll('path')).toHaveLength(1));

    const clear = screen.getByRole('button', { name: /필기 모두|Clear drawings/ });
    expect(clear.hasAttribute('disabled')).toBe(false);
    fireEvent.click(clear);
    await waitFor(() => expect(svg.querySelectorAll('path')).toHaveLength(0));
  });

  it('erases the stroke the eraser touches', async () => {
    renderPlayer(sequence([], ['scn_s']));
    await waitFor(() => expect(frameOf('scn_s')).toBeTruthy());
    fromScene('scn_s', 'ready', ready());
    await waitFor(() => expect(screen.getByRole('button', { name: /그리기|Draw/ })).toBeTruthy());
    mockSvgRect();

    fireEvent.click(screen.getByRole('button', { name: /그리기|Draw/ }));
    const svg = screen.getByTestId('player-annotations');
    fireEvent.pointerDown(svg, { clientX: 100, clientY: 100, pointerId: 1 });
    fireEvent.pointerMove(svg, { clientX: 200, clientY: 100, pointerId: 1 });
    fireEvent.pointerUp(svg, { pointerId: 1 });
    await waitFor(() => expect(svg.querySelectorAll('path')).toHaveLength(1));

    fireEvent.click(screen.getByRole('button', { name: /지우개|Eraser/ }));
    fireEvent.pointerDown(svg, { clientX: 150, clientY: 100, pointerId: 2 });
    fireEvent.pointerUp(svg, { pointerId: 2 });
    await waitFor(() => expect(svg.querySelectorAll('path')).toHaveLength(0));
  });
});
