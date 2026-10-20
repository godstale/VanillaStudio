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
  ['scn_d', { type: '3d' as const, name: 'Globe', slug: 'globe' }],
]);
const canvas = { width: 1920, height: 1080, fps: 30 };

function sequence(edges: Sequence['edges'], ids = ['scn_m', 'scn_s', 'scn_d']): Sequence {
  let s = newSequence('ws_1');
  for (const id of ids) s = addNode(s, id, { x: 0, y: 0 });
  return { ...s, mode: 'interactive', edges };
}

const frames = () => [...document.querySelectorAll('iframe')] as HTMLIFrameElement[];
const frameOf = (id: string) => frames().find((f) => f.dataset.sceneId === id)!;

/** 그 신 iframe이 보낸 것처럼 메시지를 흘려 넣는다. */
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

afterEach(cleanup);

describe('SequencePlayer', () => {
  it('loads the start scene into a stacked iframe, then plays it; neighbours are preloaded hidden', async () => {
    renderPlayer(sequence([edge('scn_m', 'scn_d', 'end')]));
    await waitFor(() => expect(frameOf('scn_m')).toBeTruthy());
    expect(screen.getByRole('status').textContent).toMatch(/불러오는 중|Loading/);
    fromScene('scn_m', 'ready', ready(4));
    await waitFor(() => expect(screen.queryByText(/불러오는 중|Loading/)).toBeNull());
    expect(frameOf('scn_m').style.opacity).toBe('1');
    expect(frameOf('scn_d').style.opacity).toBe('0'); // preloaded neighbour (kept rendering, invisible)
    expect(frameOf('scn_s')).toBeUndefined(); // not adjacent
    expect(screen.getByTestId('player-time').textContent).toMatch(/0\.0s \/ 4\.0s/);
  });

  it('end trigger: reaching the duration moves on to the next scene', async () => {
    renderPlayer(sequence([edge('scn_m', 'scn_d', 'end')]));
    await waitFor(() => expect(frameOf('scn_m')).toBeTruthy());
    fromScene('scn_m', 'ready', ready(4));
    await waitFor(() => expect(frameOf('scn_d')).toBeTruthy());
    fromScene('scn_d', 'ready', ready(2));
    fromScene('scn_m', 'time', { t: 4, sceneId: null });
    await waitFor(() => expect(screen.getByTestId('player-progress').textContent).toBe('3 / 3'));
    expect(frameOf('scn_m')).toBeUndefined(); // old scene disposed
    expect(frameOf('scn_d').style.opacity).toBe('1');
  });

  it('click layer advances: a motion scene waiting for a click, then the end', async () => {
    renderPlayer(sequence([edge('scn_m', 'scn_d', 'click')]));
    await waitFor(() => expect(frameOf('scn_m')).toBeTruthy());
    fromScene('scn_m', 'ready', ready(4));
    await waitFor(() => expect(frameOf('scn_d')).toBeTruthy());
    fromScene('scn_d', 'ready', ready(2));
    fireEvent.click(screen.getByTestId('player-input'));
    await waitFor(() => expect(frameOf('scn_m')).toBeUndefined());
  });

  it('keyboard: the matching key moves on, other keys and typing in inputs do not', async () => {
    renderPlayer(sequence([edge('scn_m', 'scn_d', 'key:ArrowRight')]));
    await waitFor(() => expect(frameOf('scn_m')).toBeTruthy());
    fromScene('scn_m', 'ready', ready(4));
    await waitFor(() => expect(frameOf('scn_d')).toBeTruthy());
    fromScene('scn_d', 'ready', ready(2));
    fireEvent.keyDown(window, { key: 'Enter' });
    expect(frameOf('scn_m')).toBeTruthy();
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    await waitFor(() => expect(frameOf('scn_m')).toBeUndefined());
  });

  it('static scene keyboard: keys go to the page as typed input, not as unconditional next (ArrowLeft goes back)', async () => {
    renderPlayer(sequence([edge('scn_s', 'scn_d', 'key:ArrowRight')], ['scn_s', 'scn_d']));
    await waitFor(() => expect(frameOf('scn_s')).toBeTruthy());
    const post = vi.fn();
    Object.defineProperty(frameOf('scn_s'), 'contentWindow', { value: { postMessage: post }, configurable: true });
    fromScene('scn_s', 'ready', ready());
    await waitFor(() => expect(frameOf('scn_d')).toBeTruthy());
    fromScene('scn_d', 'ready', ready(2));
    post.mockClear();
    fireEvent.keyDown(window, { key: 'n' }); // scene shortcut key: typed input, never next
    expect(post.mock.calls.map((c) => c[0])).toEqual([
      { v: 2, type: 'input', payload: { kind: 'key', key: 'n' } },
    ]);
    expect(frameOf('scn_s')).toBeTruthy(); // the page decides; the host does not leave
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    expect(post.mock.calls.at(-1)?.[0]).toEqual({ v: 2, type: 'input', payload: { kind: 'key', key: 'ArrowRight' } });
  });

  it('static scene ArrowLeft goes to the previous step, or the previous scene at the first step', async () => {
    renderPlayer(sequence([edge('scn_s', 'scn_d', 'click')], ['scn_s', 'scn_d']));
    await waitFor(() => expect(frameOf('scn_s')).toBeTruthy());
    const post = vi.fn();
    Object.defineProperty(frameOf('scn_s'), 'contentWindow', { value: { postMessage: post }, configurable: true });
    fromScene('scn_s', 'ready', ready());
    await waitFor(() => expect(frameOf('scn_d')).toBeTruthy());
    fromScene('scn_d', 'ready', ready(2));
    fromScene('scn_s', 'step', { index: 1, total: 3 });
    post.mockClear();
    fireEvent.keyDown(window, { key: 'ArrowLeft' }); // step 1 -> prev message
    expect(post.mock.calls.at(-1)?.[0]).toEqual({ v: 2, type: 'prev' });
  });

  it('choices are shown as buttons and the chosen label wins', async () => {
    renderPlayer(sequence([edge('scn_m', 'scn_d', 'choice:Globe'), edge('scn_m', 'scn_s', 'choice:Page')]));
    await waitFor(() => expect(frameOf('scn_m')).toBeTruthy());
    fromScene('scn_m', 'ready', ready(4));
    await waitFor(() => expect(screen.getByTestId('player-choices')).toBeTruthy());
    await waitFor(() => expect(frameOf('scn_s')).toBeTruthy());
    fromScene('scn_s', 'ready', ready());
    fireEvent.click(screen.getByRole('button', { name: 'Page' }));
    await waitFor(() => expect(frameOf('scn_m')).toBeUndefined());
    expect(frameOf('scn_s').style.opacity).toBe('1');
  });

  it('a static scene shows steps and step buttons delegate to the page', async () => {
    renderPlayer(sequence([edge('scn_s', 'scn_d', 'click')], ['scn_s', 'scn_d']));
    await waitFor(() => expect(frameOf('scn_s')).toBeTruthy());
    const post = vi.fn();
    Object.defineProperty(frameOf('scn_s'), 'contentWindow', { value: { postMessage: post }, configurable: true });
    fromScene('scn_s', 'ready', ready());
    await waitFor(() => expect(screen.queryByText(/불러오는 중|Loading/)).toBeNull());
    fromScene('scn_s', 'step', { index: 0, total: 3 });
    expect(screen.getByTestId('player-step').textContent).toMatch(/1 \/ 3/);
    expect(screen.queryByRole('button', { name: /일시정지|Pause/ })).toBeNull(); // no play/pause for static
    fireEvent.click(screen.getByRole('button', { name: /다음 단계|Next step/ }));
    expect(post.mock.calls.some((c) => c[0].type === 'next')).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: /이전 단계|Previous step/ }));
    expect(post.mock.calls.some((c) => c[0].type === 'prev')).toBe(true);
  });

  it('pause and resume are offered for timed scenes; the seek bar drives the scene', async () => {
    renderPlayer(sequence([edge('scn_m', 'scn_d', 'end')]));
    await waitFor(() => expect(frameOf('scn_m')).toBeTruthy());
    const post = vi.fn();
    Object.defineProperty(frameOf('scn_m'), 'contentWindow', { value: { postMessage: post }, configurable: true });
    fromScene('scn_m', 'ready', ready(4));
    await waitFor(() => expect(screen.getByRole('button', { name: /일시정지|Pause/ })).toBeTruthy());
    fireEvent.click(screen.getByRole('button', { name: /일시정지|Pause/ }));
    expect(post.mock.calls.some((c) => c[0].type === 'pause')).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: /재생|Play/ }));
    fireEvent.change(screen.getByLabelText(/시크|Seek/), { target: { value: '2.5' } });
    expect(post.mock.calls.some((c) => c[0].type === 'seek' && c[0].payload.t === 2.5)).toBe(true);
  });

  it('a scene error shows a banner with retry', async () => {
    renderPlayer(sequence([edge('scn_m', 'scn_d', 'end')]));
    await waitFor(() => expect(frameOf('scn_m')).toBeTruthy());
    fromScene('scn_m', 'ready', ready(4));
    await waitFor(() => expect(frameOf('scn_d')).toBeTruthy());
    fromScene('scn_m', 'error', { message: 'WebGL lost', stack: '', sceneId: null });
    expect((await screen.findByTestId('player-error')).textContent).toContain('WebGL lost');
    expect(screen.getByRole('button', { name: /다시 시도|Retry/ })).toBeTruthy();
  });

  it('the last scene shows the end screen with restart', async () => {
    renderPlayer(sequence([], ['scn_m']));
    await waitFor(() => expect(frameOf('scn_m')).toBeTruthy());
    fromScene('scn_m', 'ready', ready(2));
    await waitFor(() => expect(screen.getByTestId('player-time')).toBeTruthy());
    fromScene('scn_m', 'time', { t: 2, sceneId: null });
    await waitFor(() => expect(screen.getByText(/끝났습니다|ended/)).toBeTruthy());
    expect(screen.getAllByRole('button', { name: /처음부터|Restart/ }).length).toBeGreaterThan(0);
  });

  it('an invalid sequence reports why it cannot start instead of loading scenes', async () => {
    const bad = sequence([edge('scn_s', 'scn_d', 'end')]); // static scene with an automatic trigger
    renderPlayer(bad);
    expect((await screen.findByTestId('player-error')).textContent).toMatch(/errors|오류|has errors/i);
    expect(frames()).toHaveLength(0);
  });

  it('the nav bar shows only the scene position without names, hints, or jump buttons', async () => {
    renderPlayer(sequence([edge('scn_m', 'scn_d', 'end')]));
    await waitFor(() => expect(frameOf('scn_m')).toBeTruthy());
    fromScene('scn_m', 'ready', ready(4));
    await waitFor(() => expect(frameOf('scn_d')).toBeTruthy());
    fromScene('scn_d', 'ready', ready(2));
    await waitFor(() => expect(screen.getByTestId('player-progress').textContent).toBe('1 / 3'));
    expect(screen.queryByTestId('player-hints')).toBeNull();
    expect(screen.queryByRole('button', { name: /Globe/ })).toBeNull();
  });

  it('right-click on next opens the scene jump popup and jumps on select', async () => {
    renderPlayer(sequence([edge('scn_s', 'scn_d', 'click')], ['scn_s', 'scn_d']));
    await waitFor(() => expect(frameOf('scn_s')).toBeTruthy());
    fromScene('scn_s', 'ready', ready());
    await waitFor(() => expect(frameOf('scn_d')).toBeTruthy());
    fromScene('scn_d', 'ready', ready(2));
    fromScene('scn_s', 'step', { index: 0, total: 3 });
    const next = screen.getByRole('button', { name: /다음 단계|Next step/ });
    fireEvent.contextMenu(next);
    const menu = await screen.findByTestId('player-jump-menu');
    expect(menu.textContent).toContain('Page');
    expect(menu.textContent).toContain('Globe');
    fireEvent.click(screen.getByRole('menuitem', { name: /Globe/ }));
    await waitFor(() => expect(frameOf('scn_d')).toBeTruthy());
    fromScene('scn_d', 'ready', ready(2));
    await waitFor(() => expect(frameOf('scn_d').style.opacity).toBe('1'));
    expect(screen.queryByTestId('player-jump-menu')).toBeNull();
  });

  it('long-press on next opens the jump popup without stepping', async () => {
    renderPlayer(sequence([edge('scn_s', 'scn_d', 'click')], ['scn_s', 'scn_d']));
    await waitFor(() => expect(frameOf('scn_s')).toBeTruthy());
    const post = vi.fn();
    Object.defineProperty(frameOf('scn_s'), 'contentWindow', { value: { postMessage: post }, configurable: true });
    fromScene('scn_s', 'ready', ready());
    await waitFor(() => expect(frameOf('scn_d')).toBeTruthy());
    fromScene('scn_d', 'ready', ready(2));
    fromScene('scn_s', 'step', { index: 0, total: 3 });
    const next = screen.getByRole('button', { name: /다음 단계|Next step/ });
    post.mockClear();
    fireEvent.pointerDown(next);
    expect(await screen.findByTestId('player-jump-menu', undefined, { timeout: 2000 })).toBeTruthy();
    // 길게 누른 뒤의 click은 스텝 이동이 아니라 무시된다.
    fireEvent.click(next);
    expect(post.mock.calls.some((c) => c[0].type === 'next')).toBe(false);
  });
});
