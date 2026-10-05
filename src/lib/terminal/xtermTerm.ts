import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';
import type { TermLike } from './sessions';

// xterm은 구체적인 색이 필요하므로 앱 시맨틱 토큰(HSL 변수)을 만들 때 읽어 온다.
function token(name: string, fallback: string): string {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v ? `hsl(${v})` : fallback;
}

/** 실제 xterm.Terminal을 TermLike로 감싼다. 호스트에 붙이기 전에도 출력은 버퍼에 쌓인다. */
export function createXtermTerm(): TermLike {
  const term = new Terminal({
    fontSize: 13,
    cursorBlink: true,
    scrollback: 5000,
    theme: { background: token('--background', '#000000'), foreground: token('--foreground', '#ffffff'), cursor: token('--primary', '#ffffff') },
  });
  const fit = new FitAddon();
  term.loadAddon(fit);
  return {
    get cols() {
      return term.cols;
    },
    get rows() {
      return term.rows;
    },
    get element() {
      return term.element ?? null;
    },
    write: (d) => term.write(d),
    paste: (t) => term.paste(t),
    onData: (cb) => term.onData(cb),
    open: (host) => term.open(host),
    fit: () => {
      try {
        fit.fit();
      } catch {
        // 호스트가 아직 크기를 갖지 못했다(숨김 탭).
      }
    },
    focus: () => term.focus(),
    dispose: () => term.dispose(),
  };
}
