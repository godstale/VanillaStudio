// Minimal Bridge host for standalone play (one scene at a time).
// Speaks the same wire format as Vanilla Studio (Technical-Design §5, v: 2):
// host->scene init/play/pause/seek/setParams/input/next/prev, scene->host
// ready/time/step/done/choice/error. Unknown messages are ignored so old
// runtimes (which ignore `input`, pre-v2.1) and new scenes stay compatible.

import type { CanvasSpec } from './manifest';

export type UserInput = { kind: 'click' } | { kind: 'key'; key: string };

export type SceneEvent =
  | { type: 'ready'; duration?: number }
  | { type: 'time'; t: number }
  | { type: 'step'; index: number; total: number }
  | { type: 'done' }
  | { type: 'choice'; label: string }
  | { type: 'error'; message: string };

export interface SceneDriver {
  load(): Promise<void>;
  start(): void;
  pause(): void;
  resume(): void;
  seek(t: number): void;
  next(): void;
  prev(): void;
  input(input: UserInput): void;
  subscribe(listener: (e: SceneEvent) => void): () => void;
  dispose(): void;
}

const BRIDGE_VERSION = 2;
const LOAD_TIMEOUT_MS = 20_000;

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;

/**
 * One scene in one iframe, same origin as the player (dev server, preview
 * server, or any static host). The iframe never takes pointer focus: it is
 * covered by the player's input layer, so every click/key arrives here and is
 * forwarded as a typed `input` the scene matches against its advance rules.
 */
export class SameOriginScene implements SceneDriver {
  private readonly iframe: HTMLIFrameElement;
  private readonly entry: string;
  private readonly canvas: CanvasSpec;
  private readonly origin: string;
  private readonly listeners = new Set<(e: SceneEvent) => void>();
  private loadPromise: Promise<void> | null = null;
  private readySeen = false;
  private disposed = false;
  private rejectLoad: ((e: Error) => void) | null = null;

  constructor(iframe: HTMLIFrameElement, entry: string, canvas: CanvasSpec) {
    this.iframe = iframe;
    this.entry = entry;
    this.canvas = canvas;
    this.origin = window.location.origin;
  }

  load(): Promise<void> {
    if (this.loadPromise) return this.loadPromise;
    this.loadPromise = new Promise<void>((resolve, reject) => {
      this.rejectLoad = reject;
      const timer = window.setTimeout(() => {
        finish(
          new Error(
            `timed out waiting for the scene (${this.entry}). ` +
              `Open dist/ through a static server ("pnpm preview"), not as a file — modules and postMessage need http(s).`,
          ),
        );
      }, LOAD_TIMEOUT_MS);
      const finish = (err?: Error) => {
        window.clearTimeout(timer);
        this.rejectLoad = null;
        if (err) {
          this.dispose();
          reject(err);
        } else {
          resolve();
        }
      };
      const off = this.subscribe((e) => {
        if (e.type === 'ready' && !this.readySeen) {
          this.readySeen = true;
          off();
          finish();
        } else if (e.type === 'error' && !this.readySeen) {
          off();
          finish(new Error(e.message));
        }
      });
      window.addEventListener('message', this.onMessage);
      const url = new URL(this.entry, document.baseURI);
      url.searchParams.set('host', this.origin);
      this.iframe.src = url.toString();
    });
    this.loadPromise.catch(() => undefined);
    return this.loadPromise;
  }

  private emit(e: SceneEvent): void {
    for (const l of [...this.listeners]) l(e);
  }

  private send(type: string, payload?: unknown): void {
    const target = this.iframe.contentWindow;
    if (!target || this.disposed) return;
    target.postMessage({ v: BRIDGE_VERSION, type, payload }, this.origin === 'null' ? '*' : this.origin);
  }

  private readonly onMessage = (event: MessageEvent): void => {
    if (this.disposed || event.source !== this.iframe.contentWindow) return;
    if (event.origin !== this.origin) return;
    const data: unknown = event.data;
    if (!isRecord(data) || data['v'] !== BRIDGE_VERSION || typeof data['type'] !== 'string') return;
    const payload: unknown = data['payload'];
    const body = isRecord(payload) ? payload : {};
    switch (data['type'] as string) {
      case 'ready': {
        // HMR remounts report ready again: re-inject canvas every time.
        this.send('init', { mode: 'preview', paramsValues: {}, canvas: this.canvas });
        const duration = typeof body['duration'] === 'number' ? (body['duration'] as number) : undefined;
        this.emit({ type: 'ready', duration });
        return;
      }
      case 'time': {
        if (typeof body['t'] === 'number') this.emit({ type: 'time', t: body['t'] as number });
        return;
      }
      case 'step': {
        if (typeof body['index'] === 'number' && typeof body['total'] === 'number') {
          this.emit({ type: 'step', index: body['index'] as number, total: body['total'] as number });
        }
        return;
      }
      case 'done':
        this.emit({ type: 'done' });
        return;
      case 'choice': {
        if (typeof body['label'] === 'string') this.emit({ type: 'choice', label: body['label'] as string });
        return;
      }
      case 'error': {
        const message = typeof body['message'] === 'string' ? (body['message'] as string) : 'scene error';
        this.emit({ type: 'error', message });
        return;
      }
      default:
        return;
    }
  };

  start(): void {
    this.send('seek', { t: 0 });
    this.send('play');
  }

  pause(): void {
    this.send('pause');
  }

  resume(): void {
    this.send('play');
  }

  seek(t: number): void {
    this.send('seek', { t });
  }

  next(): void {
    this.send('next');
  }

  prev(): void {
    this.send('prev');
  }

  input(input: UserInput): void {
    this.send('input', input.kind === 'click' ? { kind: 'click' } : { kind: 'key', key: input.key });
  }

  subscribe(listener: (e: SceneEvent) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    window.removeEventListener('message', this.onMessage);
    this.listeners.clear();
    this.rejectLoad?.(new Error('scene disposed'));
    this.rejectLoad = null;
  }
}
