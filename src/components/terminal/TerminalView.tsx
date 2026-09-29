import { useEffect, useRef } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';
import {
  decodeBase64,
  ptyKill,
  ptyResize,
  ptyStart,
  ptyWrite,
  type TerminalAgentId,
} from './terminalApi';

export interface TerminalViewProps {
  agentId: TerminalAgentId;
  onExit: (code: number | null) => void;
  onError: (message: string) => void;
}

// xterm needs concrete colors, so resolve the semantic HSL tokens at mount time.
function token(name: string, fallback: string): string {
  const v = getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim();
  return v ? `hsl(${v})` : fallback;
}

/** Starts the agent CLI in a PTY on mount and kills it on unmount. */
export function TerminalView({ agentId, onExit, onError }: TerminalViewProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const callbacks = useRef({ onExit, onError });
  useEffect(() => {
    callbacks.current = { onExit, onError };
  }, [onExit, onError]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return undefined;
    const term = new Terminal({
      fontSize: 13,
      cursorBlink: true,
      theme: {
        background: token('--background', '#000000'),
        foreground: token('--foreground', '#ffffff'),
        cursor: token('--primary', '#ffffff'),
      },
    });
    const fit = new FitAddon();
    term.loadAddon(fit);
    term.open(host);
    fit.fit();

    let id: number | null = null;
    let disposed = false;
    const inputs = term.onData((d) => {
      if (id !== null) void ptyWrite(id, d).catch(() => undefined);
    });
    const observer = new ResizeObserver(() => {
      fit.fit();
      if (id !== null) void ptyResize(id, term.cols, term.rows).catch(() => undefined);
    });
    observer.observe(host);

    ptyStart(agentId, term.cols, term.rows, (e) => {
      if (e.event === 'output') term.write(decodeBase64(e.data));
      else callbacks.current.onExit(e.code);
    })
      .then((started) => {
        if (disposed) void ptyKill(started).catch(() => undefined);
        else id = started;
      })
      .catch((e: unknown) => callbacks.current.onError(String(e)));

    return () => {
      disposed = true;
      observer.disconnect();
      inputs.dispose();
      if (id !== null) void ptyKill(id).catch(() => undefined);
      term.dispose();
    };
  }, [agentId]);

  return <div ref={hostRef} data-testid="terminal-host" className="h-full w-full p-1" />;
}

export default TerminalView;
