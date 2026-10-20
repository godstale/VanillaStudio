import type { AgentEntry, PasteMode } from '@/lib/agents/registry';
import { registerBusy } from '@/lib/workspace/switchGuard';

// 터미널 세션 관리자(D-022): 에이전트 CLI를 PTY에서 실행하고, 화면(도크 탭)이 바뀌어도 세션과 출력 기록이 유지되게 한다.
// xterm과 Tauri 호출은 주입받아 테스트할 수 있다. 앱은 에이전트를 조종하지 않고 실행·입력 전달·종료만 한다.

/** xterm.Terminal 중 이 모듈이 쓰는 부분. */
export interface TermLike {
  cols: number;
  rows: number;
  write(data: Uint8Array | string): void;
  /** xterm의 paste는 앱이 bracketed paste 모드를 켰을 때만 ESC[200~ … ESC[201~로 감싼다. */
  paste(text: string): void;
  onData(cb: (data: string) => void): { dispose(): void };
  open(host: HTMLElement): void;
  /** open 뒤에 생기는 DOM. 탭을 옮길 때 이 요소를 새 호스트로 옮긴다. */
  element?: HTMLElement | null;
  /** 호스트 크기에 맞춘다(FitAddon). */
  fit(): void;
  focus(): void;
  dispose(): void;
}

export interface PtyApi {
  start(opts: { agentId: AgentEntry['id']; sceneSlug: string; args: string[]; cols: number; rows: number }, onEvent: (e: PtyEventLike) => void): Promise<number>;
  write(id: number, data: string): Promise<void>;
  resize(id: number, cols: number, rows: number): Promise<void>;
  kill(id: number): Promise<void>;
  decode(data: string): Uint8Array;
}

export type PtyEventLike = { event: 'output'; data: string } | { event: 'exit'; code: number | null };

export type SessionStatus = 'starting' | 'running' | 'exited' | 'error';

export type FailureKind = 'untrusted' | 'not-installed' | 'other';

export interface TerminalSession {
  /** 화면용 안정 ID. */
  id: string;
  agentId: AgentEntry['id'];
  agentLabel: string;
  sceneSlug: string;
  sceneName: string;
  /** 세션 메타 기록용(없으면 기록하지 않는다). */
  workspaceId?: string;
  sceneId?: string;
  pasteMode: PasteMode;
  status: SessionStatus;
  exitCode: number | null;
  error?: string;
  failure?: FailureKind;
  startedAt: number;
  /** 마지막 출력 시각(ms)과 받은 출력 덩어리 수. 에이전트가 준비됐는지(출력이 잠잠해졌는지) 가늠하는 데 쓴다. */
  lastOutputAt: number | null;
  outputChunks: number;
  term: TermLike;
  ptyId: number | null;
}

export interface SessionDeps {
  api: PtyApi;
  createTerm: () => TermLike;
  classify: (message: string) => FailureKind;
  /** 세션 메타 기록(터미널 세션 DB). 실패해도 실행에 영향이 없다. */
  onStarted?: (s: TerminalSession) => void | Promise<void>;
  onEnded?: (s: TerminalSession) => void | Promise<void>;
  now?: () => number;
}

export interface StartOptions {
  agent: AgentEntry;
  sceneSlug: string;
  sceneName: string;
  workspaceId?: string;
  sceneId?: string;
}

type Listener = () => void;

export class TerminalSessions {
  private list: TerminalSession[] = [];
  private listeners = new Set<Listener>();
  private releases = new Map<string, () => void>();
  private inputs = new Map<string, { dispose(): void }>();
  private counter = 0;

  constructor(private deps: SessionDeps) {}

  /** useSyncExternalStore용: 목록이 바뀔 때마다 새 배열 참조를 돌려준다. */
  getSnapshot = (): readonly TerminalSession[] => this.list;

  subscribe = (cb: Listener): (() => void) => {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  };

  private emit(): void {
    this.list = [...this.list];
    for (const l of this.listeners) l();
  }

  private update(s: TerminalSession, patch: Partial<TerminalSession>): void {
    Object.assign(s, patch);
    this.emit();
  }

  get(id: string): TerminalSession | undefined {
    return this.list.find((s) => s.id === id);
  }

  /** 같은 신에서 같은 에이전트가 이미 돌고 있으면 그 세션을 돌려준다(재연결). */
  find(sceneSlug: string, agentId: string): TerminalSession | undefined {
    return this.list.find((s) => s.sceneSlug === sceneSlug && s.agentId === agentId && (s.status === 'starting' || s.status === 'running'));
  }

  start({ agent, sceneSlug, sceneName, workspaceId, sceneId }: StartOptions): TerminalSession {
    const existing = this.find(sceneSlug, agent.id);
    if (existing) return existing;

    const term = this.deps.createTerm();
    const session: TerminalSession = {
      id: `term-${++this.counter}`,
      agentId: agent.id,
      agentLabel: agent.label,
      sceneSlug,
      sceneName,
      workspaceId,
      sceneId,
      pasteMode: agent.pasteMode,
      status: 'starting',
      exitCode: null,
      startedAt: (this.deps.now ?? Date.now)(),
      lastOutputAt: null,
      outputChunks: 0,
      term,
      ptyId: null,
    };
    this.list = [...this.list, session];
    this.emit();

    this.inputs.set(
      session.id,
      term.onData((d) => {
        if (session.ptyId !== null) void this.deps.api.write(session.ptyId, d).catch(() => undefined);
      }),
    );

    this.deps.api
      .start({ agentId: agent.id, sceneSlug, args: agent.argv.slice(1), cols: term.cols, rows: term.rows }, (e) => {
        if (e.event === 'output') {
          session.lastOutputAt = (this.deps.now ?? Date.now)();
          session.outputChunks += 1;
          term.write(this.deps.api.decode(e.data));
        } else {
          this.finish(session, { status: 'exited', exitCode: e.code });
        }
      })
      .then((ptyId) => {
        if (session.status !== 'starting') {
          void this.deps.api.kill(ptyId).catch(() => undefined); // 시작 도중 닫혔다
          return;
        }
        session.ptyId = ptyId;
        this.update(session, { status: 'running' });
        // 워크스페이스 전환 전에 사용자에게 "실행 중인 터미널"을 알리고 정리할 수 있게 한다(switchGuard).
        this.releases.set(
          session.id,
          registerBusy({ label: `${session.agentLabel} — ${session.sceneName}`, onStop: () => this.kill(session.id) }),
        );
        void Promise.resolve(this.deps.onStarted?.(session)).catch(() => undefined);
      })
      .catch((e: unknown) => {
        const message = e instanceof Error ? e.message : String(e);
        this.finish(session, { status: 'error', error: message, failure: this.deps.classify(message) });
      });
    return session;
  }

  private finish(s: TerminalSession, patch: Partial<TerminalSession>): void {
    if (s.status === 'exited' || s.status === 'error') return;
    const wasRunning = s.status === 'running';
    this.releases.get(s.id)?.();
    this.releases.delete(s.id);
    this.update(s, patch);
    if (wasRunning) void Promise.resolve(this.deps.onEnded?.(s)).catch(() => undefined);
  }

  /**
   * 에이전트가 입력을 받을 준비가 됐는지 기다린다: 첫 출력이 나온 뒤 `quietMs` 동안 출력이 없으면 준비된 것으로 본다.
   * 세션이 끝나거나 `timeoutMs` 안에 그런 순간이 오지 않으면 false(호출한 쪽이 클립보드 붙여넣기 안내로 넘어간다).
   */
  whenReady(id: string, { quietMs = 1500, timeoutMs = 15000, pollMs = 100 }: { quietMs?: number; timeoutMs?: number; pollMs?: number } = {}): Promise<boolean> {
    const now = this.deps.now ?? Date.now;
    const begin = now();
    return new Promise((resolve) => {
      const tick = () => {
        const s = this.get(id);
        if (!s || s.status === 'exited' || s.status === 'error') return resolve(false);
        if (s.status === 'running' && s.lastOutputAt !== null && now() - s.lastOutputAt >= quietMs) return resolve(true);
        if (now() - begin >= timeoutMs) return resolve(false);
        setTimeout(tick, pollMs);
      };
      tick();
    });
  }

  /** 프롬프트를 에이전트에 넣는다. 반환값: 실제로 입력했는가(clipboard 모드·세션 없음이면 false). */
  paste(id: string, text: string): boolean {
    const s = this.get(id);
    if (!s || s.status !== 'running' || s.ptyId === null || s.pasteMode === 'clipboard') return false;
    if (s.pasteMode === 'bracketed') s.term.paste(text);
    else void this.deps.api.write(s.ptyId, text).catch(() => undefined);
    return true;
  }

  async kill(id: string): Promise<void> {
    const s = this.get(id);
    if (!s) return;
    if (s.ptyId !== null && s.status === 'running') await this.deps.api.kill(s.ptyId).catch(() => undefined);
    // 종료 이벤트가 오면 finish가 불리지만, 오지 않아도 화면은 닫힌 것으로 본다.
    this.finish(s, { status: 'exited', exitCode: s.exitCode });
  }

  /** 탭을 닫는다. 실행 중이면 먼저 종료한다. */
  async close(id: string): Promise<void> {
    const s = this.get(id);
    if (!s) return;
    if (s.status === 'running' || s.status === 'starting') await this.kill(id);
    this.inputs.get(id)?.dispose();
    this.inputs.delete(id);
    s.term.dispose();
    this.list = this.list.filter((x) => x.id !== id);
    this.emit();
  }

  /** 실행 중인 세션 수(전환·종료 확인용). */
  runningCount(): number {
    return this.list.filter((s) => s.status === 'running' || s.status === 'starting').length;
  }

  resize(id: string, cols: number, rows: number): void {
    const s = this.get(id);
    if (s && s.ptyId !== null && s.status === 'running') void this.deps.api.resize(s.ptyId, cols, rows).catch(() => undefined);
  }
}
