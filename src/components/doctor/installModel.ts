// Pure logic for the "pnpm install" consent flow (T1.15, D-012). Kept free of React and Tauri
// so the consent rules and log handling can be unit tested.

/** Shown to the user; the real argv is fixed in Rust (`OwnedJob::ProjectDeps`). */
export const INSTALL_DISPLAY_COMMAND = 'pnpm install';

export type InstallEvent =
  | { kind: 'started'; program: string; argv: string[] }
  | { kind: 'log'; stream: 'stdout' | 'stderr'; line: string }
  | { kind: 'done'; exitCode: number | null };

export interface LogLine {
  stream: 'stdout' | 'stderr';
  line: string;
}

export const MAX_LOG_LINES = 500;

export type ConsentDecision =
  /** Never consented for this project: ask (the wizard's one-time consent). */
  | 'ask-first'
  /** Consented before, but package.json changed since: ask again. */
  | 'ask-changed'
  /** Same package.json as the one already consented to. */
  | 'skip';

export function decideConsent(
  storedHash: string | null,
  currentHash: string,
): ConsentDecision {
  if (storedHash === null) return 'ask-first';
  return storedHash === currentHash ? 'skip' : 'ask-changed';
}

export async function hashText(text: string): Promise<string> {
  const bytes = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/** Keeps only the newest `MAX_LOG_LINES` so a chatty install cannot grow memory without bound. */
export function appendLog(
  lines: LogLine[],
  event: InstallEvent,
  max = MAX_LOG_LINES,
): LogLine[] {
  if (event.kind !== 'log') return lines;
  const next = [...lines, { stream: event.stream, line: event.line }];
  return next.length > max ? next.slice(next.length - max) : next;
}

export interface ConsentStore {
  get(projectDir: string): string | null;
  set(projectDir: string, hash: string): void;
}

const STORAGE_KEY = 'vanilla.installConsent';

/** Per-viewer convenience store; a DB-backed store can replace it later behind the same shape. */
export const localStorageConsentStore: ConsentStore = {
  get(projectDir) {
    try {
      const all = JSON.parse(
        localStorage.getItem(STORAGE_KEY) ?? '{}',
      ) as Record<string, unknown>;
      const v = all[projectDir];
      return typeof v === 'string' ? v : null;
    } catch {
      return null;
    }
  },
  set(projectDir, hash) {
    try {
      const all = JSON.parse(
        localStorage.getItem(STORAGE_KEY) ?? '{}',
      ) as Record<string, unknown>;
      all[projectDir] = hash;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
    } catch {
      // Storage unavailable: the user is simply asked again next time.
    }
  },
};
