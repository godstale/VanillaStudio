import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { LanguageProvider } from '@/lib/i18n/LanguageContext';
import type { PreviewServerState } from '@/lib/review/previewServer';

vi.stubGlobal(
  'ResizeObserver',
  class {
    observe() {}
    unobserve() {}
    disconnect() {}
  },
);

const h = vi.hoisted(() => ({ state: { phase: 'idle' } as unknown, retry: vi.fn() }));
vi.mock('@/lib/review/previewServer', async (orig) => ({
  ...(await orig<typeof import('@/lib/review/previewServer')>()),
  usePreviewServer: () => ({ state: h.state, retry: h.retry }),
}));

import { PreviewPanel } from './PreviewPanel';

const CANVAS = { width: 1080, height: 1920, fps: 24 };

function renderPanel(sceneType: 'static' | 'motion' | '3d' = 'motion', stepsTotal?: number | null) {
  return render(
    <LanguageProvider>
      <PreviewPanel root="/w" slug="intro" sceneType={sceneType} canvas={CANVAS} stepsTotal={stepsTotal} />
    </LanguageProvider>,
  );
}

const running = (): PreviewServerState => ({ phase: 'running', url: 'http://127.0.0.1:5173' });

/** 프리뷰 iframe이 보낸 것처럼 호스트 창에 메시지를 흘려 넣는다(신뢰할 수 있는 출처·창 검사를 통과하도록 contentWindow를 쓴다). */
function fromScene(message: unknown) {
  const frame = screen.getByTitle(/신 미리보기|Scene preview/) as HTMLIFrameElement;
  act(() => {
    window.dispatchEvent(new MessageEvent('message', { data: message, origin: 'http://127.0.0.1:5173', source: frame.contentWindow }));
  });
}

const ready = { v: 2, type: 'ready', payload: { scenes: [{ id: 'demo', params: {} }], duration: 3, format: 'video', design: { hash: 'h', roles: {} } } };

beforeEach(() => {
  h.state = running();
  h.retry.mockClear();
});

describe('PreviewPanel', () => {
  it('opens the scene entry of the workspace server in a sandboxed iframe with the bridge host origin', () => {
    renderPanel();
    const frame = screen.getByTitle(/신 미리보기|Scene preview/) as HTMLIFrameElement;
    const url = new URL(frame.getAttribute('src')!);
    expect(url.origin).toBe('http://127.0.0.1:5173');
    expect(url.pathname).toBe('/scenes/intro/src/index.html');
    expect(url.searchParams.get('mode')).toBe('preview');
    expect(url.searchParams.get('host')).toBe(window.location.origin);
    expect(frame.getAttribute('sandbox')).toBe('allow-scripts allow-same-origin');
  });

  it('disables nav buttons until ready and shows step state without status text', () => {
    renderPanel();
    // 준비 전에는 동작 불가 버튼이 비활성이다. 상태 문구는 표시하지 않는다.
    expect(screen.queryByText(/연결 중|Connecting/)).toBeNull();
    expect(screen.queryByText(/미리보기 연결됨|Preview connected/)).toBeNull();
    const bar = () => within(screen.getByTestId('preview-bar'));
    expect((bar().getByRole('button', { name: /^재생$|^Play$/ }) as HTMLButtonElement).disabled).toBe(true);
    fromScene(ready);
    expect((bar().getByRole('button', { name: /^재생$|^Play$/ }) as HTMLButtonElement).disabled).toBe(false);
    expect(screen.getByTestId('preview-time').textContent).toContain('3.00s');
  });

  it('motion scenes get play/pause; static scenes get previous/next and step progress', () => {
    const { unmount } = renderPanel('motion');
    expect(within(screen.getByTestId('preview-bar')).getByRole('button', { name: /^재생$|^Play$/ })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /다음 단계|Next step/ })).toBeNull();
    unmount();
    renderPanel('static');
    expect(screen.getByRole('button', { name: /다음 단계|Next step/ })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /^재생$|^Play$/ })).toBeNull();
  });

  it('static: shows step progress; the finished notice goes to the toast, not the toolbox', () => {
    renderPanel('static');
    fromScene(ready);
    // 초기에는 안내 문구 대신 자리 표시만 보인다.
    expect(screen.getByTestId('preview-step').textContent).toBe('—');
    fromScene({ v: 2, type: 'step', payload: { index: 1, total: 3 } });
    expect(screen.getByTestId('preview-step').textContent).toMatch(/2 \/ 3/);
    fromScene({ v: 2, type: 'done', payload: {} });
    // 툴박스는 고정 크기 유지: 완료 후에도 단계 숫자만 보인다.
    expect(screen.getByTestId('preview-step').textContent).toMatch(/2 \/ 3/);
    expect(screen.getByTestId('preview-step').textContent).not.toMatch(/마지막 단계|last step/i);
    // 완료 안내는 하단 토스트로 보여준다.
    expect(screen.getByRole('status').textContent).toMatch(/마지막 단계|last step/i);
  });

  it('static: next locks on the last step and unlocks when stepping back', () => {
    renderPanel('static');
    fromScene(ready);
    fromScene({ v: 2, type: 'step', payload: { index: 2, total: 4 } });
    const next = screen.getByRole('button', { name: /다음 단계|Next step/ }) as HTMLButtonElement;
    const prev = screen.getByRole('button', { name: /이전 단계|Previous step/ }) as HTMLButtonElement;
    // 3/4에서는 다음 버튼은 동작한다.
    expect(next.disabled).toBe(false);
    // 마지막 단계(4/4)에서는 다음을 막는다. 완료(done)는 신 안의 입력으로 보고된다.
    fromScene({ v: 2, type: 'step', payload: { index: 3, total: 4 } });
    expect(next.disabled).toBe(true);
    expect(prev.disabled).toBe(false);
    // 뒤로 가면(step 수신) 다음이 다시 활성화된다.
    fromScene({ v: 2, type: 'step', payload: { index: 2, total: 4 } });
    expect(next.disabled).toBe(false);
    expect(screen.getByTestId('preview-step').textContent).toMatch(/3 \/ 4/);
  });

  it('next/prev are sent to the scene as bridge messages', () => {
    renderPanel('static');
    fromScene(ready);
    fromScene({ v: 2, type: 'step', payload: { index: 1, total: 3 } });
    const frame = screen.getByTitle(/신 미리보기|Scene preview/) as HTMLIFrameElement;
    const post = vi.fn();
    Object.defineProperty(frame, 'contentWindow', { value: { postMessage: post }, configurable: true });
    fireEvent.load(frame);
    // 초기(prev 비활성) 상태가 아니라 step 수신 뒤에는 둘 다 동작한다.
    fireEvent.click(screen.getByRole('button', { name: /다음 단계|Next step/ }));
    fireEvent.click(screen.getByRole('button', { name: /이전 단계|Previous step/ }));
    expect(post.mock.calls.map((c) => c[0].type)).toEqual(['next', 'prev']);
    expect(post.mock.calls[0][0].v).toBe(2);
    expect(post.mock.calls[0][1]).toBe('http://127.0.0.1:5173');
  });

  it('shows scene errors', () => {
    renderPanel();
    fromScene(ready);
    fromScene({ v: 2, type: 'error', payload: { message: 'boom', stack: '', sceneId: null } });
    expect(screen.getByRole('alert').textContent).toContain('boom');
  });

  it('motion: shows a seek slider when the duration is known and drives the scene', () => {
    renderPanel();
    fromScene(ready);
    const seek = screen.getByTestId('preview-seek') as HTMLInputElement;
    expect(seek.max).toBe('3');
    const frame = screen.getByTitle(/신 미리보기|Scene preview/) as HTMLIFrameElement;
    const post = vi.fn();
    Object.defineProperty(frame, 'contentWindow', { value: { postMessage: post }, configurable: true });
    fireEvent.load(frame);
    fireEvent.change(seek, { target: { value: '1.5' } });
    expect(post.mock.calls.some((c) => c[0].type === 'seek' && c[0].payload.t === 1.5)).toBe(true);
  });

  it('motion: clicking the stage toggles pause/play', () => {
    renderPanel();
    fromScene(ready);
    const frame = screen.getByTitle(/신 미리보기|Scene preview/) as HTMLIFrameElement;
    const post = vi.fn();
    Object.defineProperty(frame, 'contentWindow', { value: { postMessage: post }, configurable: true });
    fireEvent.load(frame);
    post.mockClear();
    fireEvent.click(screen.getByTestId('preview-stage-toggle'));
    expect(post.mock.calls.some((c) => c[0].type === 'play')).toBe(true);
  });

  it('static with known total shows 1/N immediately after ready (no longer just —)', () => {
    renderPanel('static', 3);
    fromScene(ready);
    expect(screen.getByTestId('preview-step').textContent).toMatch(/1 \/ 3/);
  });

  it('sends the workspace canvas with init after ready', () => {
    renderPanel();
    const frame = screen.getByTitle(/신 미리보기|Scene preview/) as HTMLIFrameElement;
    const post = vi.fn();
    Object.defineProperty(frame, 'contentWindow', { value: { postMessage: post }, configurable: true });
    fireEvent.load(frame);
    act(() => {
      window.dispatchEvent(new MessageEvent('message', { data: ready, origin: 'http://127.0.0.1:5173', source: frame.contentWindow }));
    });
    const init = post.mock.calls.map((c) => c[0]).find((m) => m.type === 'init');
    expect(init.payload.canvas).toEqual(CANVAS);
  });

  it('explains a failed server and retries; shows progress while starting', () => {
    h.state = { phase: 'failed', error: 'not-installed' };
    const { unmount } = renderPanel();
    expect(screen.getByRole('alert').textContent).toMatch(/pnpm install/);
    fireEvent.click(screen.getByRole('button', { name: /다시 시도|Retry/ }));
    expect(h.retry).toHaveBeenCalledOnce();
    expect(screen.queryByTitle(/신 미리보기|Scene preview/)).toBeNull();
    unmount();
    h.state = { phase: 'starting' };
    renderPanel();
    expect(screen.getByRole('status').textContent).toMatch(/시작하는 중|Starting/);
  });
});
