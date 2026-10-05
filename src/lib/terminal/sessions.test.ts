import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BUILTIN_AGENTS, type AgentEntry } from '@/lib/agents/registry';
import { listBusy, stopAllBusy } from '@/lib/workspace/switchGuard';
import { TerminalSessions, type PtyApi, type PtyEventLike, type SessionDeps, type TermLike } from './sessions';

const agent = (id: string, over: Partial<AgentEntry> = {}): AgentEntry => ({ ...BUILTIN_AGENTS.find((a) => a.id === id)!, ...over });

class FakeTerm implements TermLike {
  cols = 100;
  rows = 30;
  written: (Uint8Array | string)[] = [];
  pasted: string[] = [];
  disposed = false;
  private data: ((d: string) => void) | null = null;
  write(d: Uint8Array | string) {
    this.written.push(d);
  }
  paste(t: string) {
    this.pasted.push(t);
  }
  onData(cb: (d: string) => void) {
    this.data = cb;
    return { dispose: () => (this.data = null) };
  }
  open() {}
  fit() {}
  focus() {}
  dispose() {
    this.disposed = true;
  }
  type(d: string) {
    this.data?.(d);
  }
}

interface Harness {
  sessions: TerminalSessions;
  terms: FakeTerm[];
  api: { start: ReturnType<typeof vi.fn>; write: ReturnType<typeof vi.fn>; resize: ReturnType<typeof vi.fn>; kill: ReturnType<typeof vi.fn> };
  emit: (e: PtyEventLike) => void;
  started: ReturnType<typeof vi.fn>;
  ended: ReturnType<typeof vi.fn>;
}

function setup(over: Partial<SessionDeps> = {}, startImpl?: () => Promise<number>): Harness {
  const terms: FakeTerm[] = [];
  let handler: (e: PtyEventLike) => void = () => undefined;
  const api = {
    start: vi.fn((_o: unknown, cb: (e: PtyEventLike) => void) => {
      handler = cb;
      return startImpl ? startImpl() : Promise.resolve(7);
    }),
    write: vi.fn(async () => undefined),
    resize: vi.fn(async () => undefined),
    kill: vi.fn(async () => undefined),
  };
  const started = vi.fn();
  const ended = vi.fn();
  const sessions = new TerminalSessions({
    api: { ...api, decode: (d: string) => new TextEncoder().encode(atob(d)) } as unknown as PtyApi,
    createTerm: () => {
      const t = new FakeTerm();
      terms.push(t);
      return t;
    },
    classify: (m) => (m.includes('untrusted') ? 'untrusted' : m.includes('not found') ? 'not-installed' : 'other'),
    onStarted: started,
    onEnded: ended,
    ...over,
  });
  return { sessions, terms, api, emit: (e) => handler(e), started, ended };
}

const tick = () => new Promise((r) => setTimeout(r, 0));

beforeEach(async () => {
  await stopAllBusy();
});

describe('TerminalSessions', () => {
  it('starts an agent in the scene folder with the registry extra args', async () => {
    const h = setup();
    const s = h.sessions.start({ agent: agent('claude-code', { argv: ['claude', '--model', 'opus'] }), sceneSlug: 'intro', sceneName: 'Intro' });
    expect(s.status).toBe('starting');
    expect(h.api.start.mock.calls[0][0]).toEqual({ agentId: 'claude-code', sceneSlug: 'intro', args: ['--model', 'opus'], cols: 100, rows: 30 });
    await tick();
    expect(s.status).toBe('running');
    expect(s.ptyId).toBe(7);
    expect(h.started).toHaveBeenCalledOnce();
  });

  it('streams output into the terminal and sends typed input to the pty', async () => {
    const h = setup();
    const s = h.sessions.start({ agent: agent('codex'), sceneSlug: 'a', sceneName: 'A' });
    await tick();
    h.emit({ event: 'output', data: btoa('hello') });
    expect(new TextDecoder().decode(h.terms[0].written[0] as Uint8Array)).toBe('hello');
    h.terms[0].type('ls\r');
    expect(h.api.write).toHaveBeenCalledWith(7, 'ls\r');
    expect(s.status).toBe('running');
  });

  it('keeps the session and its output when the view goes away (reconnect)', async () => {
    const h = setup();
    const s = h.sessions.start({ agent: agent('codex'), sceneSlug: 'a', sceneName: 'A' });
    await tick();
    expect(h.sessions.start({ agent: agent('codex'), sceneSlug: 'a', sceneName: 'A' })).toBe(s); // same scene + agent → same session
    expect(h.api.start).toHaveBeenCalledOnce();
    expect(h.sessions.start({ agent: agent('codex'), sceneSlug: 'b', sceneName: 'B' })).not.toBe(s);
  });

  it('records the exit code and ends the metadata', async () => {
    const h = setup();
    const s = h.sessions.start({ agent: agent('codex'), sceneSlug: 'a', sceneName: 'A' });
    await tick();
    h.emit({ event: 'exit', code: 3 });
    expect(s.status).toBe('exited');
    expect(s.exitCode).toBe(3);
    expect(h.ended).toHaveBeenCalledOnce();
    expect(listBusy()).toEqual([]);
    // an exited session can be started again
    expect(h.sessions.start({ agent: agent('codex'), sceneSlug: 'a', sceneName: 'A' })).not.toBe(s);
  });

  it('classifies start failures: untrusted, not installed, other', async () => {
    for (const [msg, kind] of [
      ['untrusted-workspace', 'untrusted'],
      ['agent executable not found: claude', 'not-installed'],
      ['boom', 'other'],
    ] as const) {
      const h = setup({}, () => Promise.reject(new Error(msg)));
      const s = h.sessions.start({ agent: agent('claude-code'), sceneSlug: 'a', sceneName: 'A' });
      await tick();
      expect(s.status).toBe('error');
      expect(s.failure).toBe(kind);
      expect(s.error).toBe(msg);
      expect(h.ended).not.toHaveBeenCalled();
    }
  });

  it('pastes with the agent paste mode', async () => {
    const h = setup();
    const b = h.sessions.start({ agent: agent('claude-code'), sceneSlug: 'a', sceneName: 'A' });
    const p = h.sessions.start({ agent: agent('agy'), sceneSlug: 'b', sceneName: 'B' });
    const c = h.sessions.start({ agent: agent('codex', { pasteMode: 'clipboard' }), sceneSlug: 'c', sceneName: 'C' });
    await tick();
    expect(h.sessions.paste(b.id, 'PROMPT')).toBe(true);
    expect(h.terms[0].pasted).toEqual(['PROMPT']);
    expect(h.sessions.paste(p.id, 'PROMPT')).toBe(true);
    expect(h.api.write).toHaveBeenCalledWith(7, 'PROMPT');
    expect(h.terms[1].pasted).toEqual([]);
    expect(h.sessions.paste(c.id, 'PROMPT')).toBe(false);
    expect(h.terms[2].pasted).toEqual([]);
  });

  it('does not paste into a session that is not running', async () => {
    const h = setup();
    const s = h.sessions.start({ agent: agent('claude-code'), sceneSlug: 'a', sceneName: 'A' });
    expect(h.sessions.paste(s.id, 'x')).toBe(false); // still starting
    await tick();
    h.emit({ event: 'exit', code: 0 });
    expect(h.sessions.paste(s.id, 'x')).toBe(false);
    expect(h.sessions.paste('nope', 'x')).toBe(false);
  });

  it('registers running terminals with the switch guard and stops them on request', async () => {
    const h = setup();
    h.sessions.start({ agent: agent('codex'), sceneSlug: 'a', sceneName: 'Intro' });
    await tick();
    expect(listBusy()).toEqual(['Codex — Intro']);
    await stopAllBusy();
    expect(h.api.kill).toHaveBeenCalledWith(7);
    expect(h.sessions.runningCount()).toBe(0);
    expect(listBusy()).toEqual([]);
  });

  it('close kills a running session, disposes the terminal and removes the tab', async () => {
    const h = setup();
    const s = h.sessions.start({ agent: agent('codex'), sceneSlug: 'a', sceneName: 'A' });
    await tick();
    await h.sessions.close(s.id);
    expect(h.api.kill).toHaveBeenCalledWith(7);
    expect(h.terms[0].disposed).toBe(true);
    expect(h.sessions.getSnapshot()).toHaveLength(0);
  });

  it('kills a pty that finished starting after the tab was closed', async () => {
    let resolve!: (n: number) => void;
    const h = setup({}, () => new Promise<number>((r) => (resolve = r)));
    const s = h.sessions.start({ agent: agent('codex'), sceneSlug: 'a', sceneName: 'A' });
    await h.sessions.close(s.id);
    resolve(9);
    await tick();
    expect(h.api.kill).toHaveBeenCalledWith(9);
    expect(listBusy()).toEqual([]);
  });

  it('notifies subscribers with a new snapshot on every change', async () => {
    const h = setup();
    const seen: number[] = [];
    h.sessions.subscribe(() => seen.push(h.sessions.getSnapshot().length));
    const before = h.sessions.getSnapshot();
    h.sessions.start({ agent: agent('codex'), sceneSlug: 'a', sceneName: 'A' });
    await tick();
    expect(h.sessions.getSnapshot()).not.toBe(before);
    expect(seen.length).toBeGreaterThanOrEqual(2); // added + running
  });

  it('forwards resizes only to running sessions', async () => {
    const h = setup();
    const s = h.sessions.start({ agent: agent('codex'), sceneSlug: 'a', sceneName: 'A' });
    h.sessions.resize(s.id, 120, 40);
    expect(h.api.resize).not.toHaveBeenCalled();
    await tick();
    h.sessions.resize(s.id, 120, 40);
    expect(h.api.resize).toHaveBeenCalledWith(7, 120, 40);
  });
});
