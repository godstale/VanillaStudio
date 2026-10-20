import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
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

function renderPanel(sceneType: 'static' | 'motion' | '3d' = 'motion') {
  return render(
    <LanguageProvider>
      <PreviewPanel root="/w" slug="intro" sceneType={sceneType} canvas={CANVAS} />
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

  it('shows connecting until the scene says ready, then connected with the duration', () => {
    renderPanel();
    expect(screen.getByText(/연결 중|Connecting/)).toBeTruthy();
    fromScene(ready);
    expect(screen.getByText(/미리보기 연결됨|Preview connected/)).toBeTruthy();
    expect(screen.getByTestId('preview-time').textContent).toContain('3.00s');
  });

  it('motion scenes get play/pause; static scenes get previous/next and step progress', () => {
    const { unmount } = renderPanel('motion');
    expect(screen.getByRole('button', { name: /^재생$|^Play$/ })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /다음 단계|Next step/ })).toBeNull();
    unmount();
    renderPanel('static');
    expect(screen.getByRole('button', { name: /다음 단계|Next step/ })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /^재생$|^Play$/ })).toBeNull();
  });

  it('static: shows step progress and the finished state from the page', () => {
    renderPanel('static');
    fromScene(ready);
    expect(screen.getByTestId('preview-step').textContent).toMatch(/클릭하거나|Click the page/);
    fromScene({ v: 2, type: 'step', payload: { index: 1, total: 3 } });
    expect(screen.getByTestId('preview-step').textContent).toMatch(/2 \/ 3/);
    fromScene({ v: 2, type: 'done', payload: {} });
    expect(screen.getByTestId('preview-step').textContent).toMatch(/마지막 단계|last step/);
  });

  it('next/prev are sent to the scene as bridge messages', () => {
    renderPanel('static');
    fromScene(ready);
    const frame = screen.getByTitle(/신 미리보기|Scene preview/) as HTMLIFrameElement;
    const post = vi.fn();
    Object.defineProperty(frame, 'contentWindow', { value: { postMessage: post }, configurable: true });
    fireEvent.load(frame);
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
