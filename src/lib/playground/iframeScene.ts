import { isTrustedSource, parseSceneMessage, previewFrameUrl, previewOriginOf, sceneEntryPath, withVersion, type HostMessage } from '@/lib/review/bridgeProtocol';
import type { SceneType } from '@/lib/scene/schema';
import type { ManagerState, SceneEvent, SceneHandle, SceneHost, UserInput } from '@/lib/sequence/manager';

// 신 하나를 iframe(+Bridge v2)으로 여는 `SceneHandle` 구현(T6.6). 시퀀스 매니저는 이 구현을 모른다.
// 보안: iframe은 프리뷰 서버(127.0.0.1) origin이고 Tauri IPC가 없다. 메시지는 우리가 만든 iframe 창에서, 고정한 origin으로 온 것만 받는다(isTrustedSource).

export type Layer = 'top' | 'under' | 'hidden';

export interface SceneSource {
  slug: string;
  type: SceneType;
  /** `runtime.entry`(신 폴더 기준). 기본 `src/index.html`. */
  entry?: string;
}

export interface IframeSceneOptions extends SceneSource {
  sceneId: string;
  /** 프리뷰 서버 URL(`http://127.0.0.1:<port>`). */
  serverUrl: string;
  /** 이 앱의 origin: 신 Bridge가 메시지를 보낼 곳(`?host=`). */
  hostOrigin: string;
  /** workspace.json.canvas. `init`으로 주입한다(D-030). */
  canvas?: { width: number; height: number; fps: number };
  /** iframe을 붙일 컨테이너(같은 크기로 겹쳐 쌓인다). */
  container: HTMLElement;
  loadTimeoutMs?: number;
  /** 메시지를 듣는 창(테스트용). */
  win?: Window;
}

const DONE_EPSILON = 0.001;

export class IframeScene implements SceneHandle {
  readonly sceneId: string;
  readonly element: HTMLIFrameElement;
  duration: number | undefined;

  private readonly opts: IframeSceneOptions;
  private readonly origin: string | null;
  private readonly listeners = new Set<(e: SceneEvent) => void>();
  private readonly win: Window;
  private loadPromise: Promise<void> | null = null;
  private inited = false;
  private doneSent = false;
  private disposed = false;

  constructor(opts: IframeSceneOptions) {
    this.opts = opts;
    this.sceneId = opts.sceneId;
    this.win = opts.win ?? window;
    this.origin = previewOriginOf(opts.serverUrl);
    const frame = document.createElement('iframe');
    frame.title = opts.sceneId;
    frame.setAttribute('sandbox', 'allow-scripts allow-same-origin'); // allow-same-origin: 프리뷰 서버 origin(HMR). 앱 origin과는 다르다.
    frame.setAttribute('referrerpolicy', 'no-referrer');
    frame.dataset.sceneId = opts.sceneId;
    Object.assign(frame.style, { position: 'absolute', inset: '0', width: '100%', height: '100%', border: '0', background: 'transparent' });
    this.element = frame;
    this.setLayer('hidden');
  }

  /**
   * 층 배치. 숨긴 신(프리로드)도 `visibility:hidden`/`display:none`으로 감추지 않는다: Chrome은 보이지 않는 cross-origin iframe의
   * 렌더링을 멈추므로 신이 `ready`(두 프레임 그림)에 도달하지 못한다. 대신 맨 아래에 투명하게 두어 계속 그려지게 한다.
   */
  setLayer(layer: Layer): void {
    const s = this.element.style;
    s.zIndex = layer === 'top' ? '2' : layer === 'under' ? '1' : '0';
    s.opacity = layer === 'hidden' ? '0' : '1';
    s.pointerEvents = 'none'; // 입력은 호스트의 입력 레이어가 받는다
  }

  load(): Promise<void> {
    if (this.loadPromise) return this.loadPromise;
    this.loadPromise = new Promise<void>((resolve, reject) => {
      if (!this.origin) {
        reject(new Error('invalid preview server url'));
        return;
      }
      const timeout = setTimeout(() => finish(new Error('timed out waiting for the scene to become ready')), this.opts.loadTimeoutMs ?? 20_000);
      const finish = (err?: Error) => {
        clearTimeout(timeout);
        off();
        if (err) reject(err);
        else resolve();
      };
      const off = this.on((e) => {
        if (e.type === 'ready') finish();
        else if (e.type === 'error') finish(new Error(e.message));
      });
      this.win.addEventListener('message', this.onMessage);
      this.element.src = previewFrameUrl(this.opts.serverUrl, this.opts.hostOrigin, sceneEntryPath(this.opts.slug, this.opts.entry));
      this.opts.container.appendChild(this.element);
    });
    // 로드 실패를 아무도 기다리지 않아도 "처리되지 않은 거부"가 되지 않게 한다(오류는 호출한 쪽이 load()에서 받는다).
    this.loadPromise.catch(() => undefined);
    return this.loadPromise;
  }

  private on(l: (e: SceneEvent) => void): () => void {
    this.listeners.add(l);
    return () => this.listeners.delete(l);
  }

  private emit(e: SceneEvent): void {
    [...this.listeners].forEach((l) => l(e));
  }

  private send(msg: HostMessage): void {
    const w = this.element.contentWindow;
    if (!w || !this.origin || this.disposed) return;
    w.postMessage(withVersion(msg), this.origin);
  }

  private readonly onMessage = (event: MessageEvent): void => {
    if (!isTrustedSource(event, this.origin, this.element.contentWindow)) return;
    const msg = parseSceneMessage(event.data);
    if (!msg) return;
    switch (msg.type) {
      case 'ready': {
        // HMR 재마운트·새로고침 뒤에도 `ready`가 다시 오므로 그때마다 canvas를 다시 주입한다.
        this.send({ type: 'init', payload: { mode: 'preview', paramsValues: {}, ...(this.opts.canvas ? { canvas: this.opts.canvas } : {}) } });
        this.inited = true;
        this.duration = msg.payload.duration;
        this.emit({ type: 'ready', duration: msg.payload.duration });
        return;
      }
      case 'time': {
        this.emit({ type: 'time', t: msg.payload.t });
        // 런타임은 끝 시각에서 멈출 뿐 `done`을 보내지 않는다: 호스트가 길이와 비교해 끝을 판단한다(motion·3d).
        if (this.opts.type !== 'static' && this.duration !== undefined && !this.doneSent && msg.payload.t >= this.duration - DONE_EPSILON) {
          this.doneSent = true;
          this.emit({ type: 'done' });
        }
        return;
      }
      case 'step':
        this.emit({ type: 'step', index: msg.payload.index, total: msg.payload.total });
        return;
      case 'done':
        if (this.opts.type === 'static') this.emit({ type: 'done' });
        return;
      case 'choice':
        this.emit({ type: 'choice', label: msg.payload.label });
        return;
      case 'error':
        this.emit({ type: 'error', message: msg.payload.message });
        return;
      default:
        return; // captured·hmr: 플레이그라운드는 쓰지 않는다
    }
  };

  start(): void {
    this.doneSent = false;
    if (this.opts.type === 'static') return; // static은 step 0에서 입력을 기다린다
    this.send({ type: 'seek', payload: { t: 0 } });
    this.send({ type: 'play' });
  }

  pause(): void {
    if (this.opts.type !== 'static') this.send({ type: 'pause' });
  }

  resume(): void {
    if (this.opts.type !== 'static') this.send({ type: 'play' });
  }

  seek(t: number): void {
    this.doneSent = false;
    this.send({ type: 'seek', payload: { t } });
  }

  next(): void {
    this.send({ type: 'next' });
  }

  prev(): void {
    this.send({ type: 'prev' });
  }

  input(input: UserInput): void {
    this.send(input.kind === 'click' ? { type: 'input', payload: { kind: 'click' } } : { type: 'input', payload: { kind: 'key', key: input.key } });
  }

  setParams(sceneId: string, values: Record<string, unknown>): void {
    this.send({ type: 'setParams', payload: { sceneId, values } });
  }

  subscribe(listener: (e: SceneEvent) => void): () => void {
    return this.on(listener);
  }

  /** 테스트·진단용: 지금까지 `init`을 보냈는가. */
  get initialized(): boolean {
    return this.inited;
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.win.removeEventListener('message', this.onMessage);
    this.listeners.clear();
    this.element.remove();
  }
}

export interface IframeSceneHostOptions {
  container: HTMLElement;
  serverUrl: string;
  hostOrigin: string;
  canvas?: { width: number; height: number; fps: number };
  /** sceneId → 폴더·타입. */
  scenes: ReadonlyMap<string, SceneSource>;
  win?: Window;
  loadTimeoutMs?: number;
}

/** 시퀀스 매니저에 신 핸들을 만들어 주는 호스트. 만든 iframe의 층(현재·아래·숨김)도 관리한다. */
export class IframeSceneHost implements SceneHost {
  private readonly made = new Map<string, IframeScene>();

  constructor(private readonly opts: IframeSceneHostOptions) {}

  create(sceneId: string): IframeScene {
    const source = this.opts.scenes.get(sceneId);
    if (!source) throw new Error(`unknown scene ${sceneId}`);
    const scene = new IframeScene({ ...source, sceneId, ...this.opts });
    this.made.set(sceneId, scene);
    return scene;
  }

  /** 매니저 상태에 맞춰 층을 배치한다: 현재 신은 위, 전환 중 들어오는 신은 그 아래, 나머지(프리로드)는 숨김. */
  layout(state: Pick<ManagerState, 'current' | 'next'>): void {
    for (const [id, scene] of this.made) {
      scene.setLayer(id === state.current ? 'top' : id === state.next ? 'under' : 'hidden');
    }
  }

  get(sceneId: string): IframeScene | undefined {
    return this.made.get(sceneId);
  }
}
