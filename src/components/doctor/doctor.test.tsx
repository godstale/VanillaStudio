import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fireEvent, screen, within } from '@testing-library/react';
import { renderWithProviders } from '@/test-utils';
import { getDictionary } from '@/lib/i18n';
import { DoctorPanel } from './DoctorPanel';
import { downloadPercent, severityOf, summarize } from './doctorModel';
import type { DoctorCheck, DoctorReport } from './types';

const RUST = readFileSync(
  resolve(process.cwd(), 'src-tauri/src/commands/doctor_commands.rs'),
  'utf-8',
).split('#[cfg(test)]')[0];

function rustMatches(re: RegExp): string[] {
  return [...RUST.matchAll(re)].map((m) => m[1]);
}

// webview2 is defined twice (per-platform cfg), hence the Set.
const CHECK_IDS = [
  ...new Set(rustMatches(/(?:Check::new\(|tool\()"([a-z0-9-]+)"/g)),
];
const FIX_KEYS = [
  ...new Set(rustMatches(/(?:\.fix\(|path_env, )"([a-z0-9-]+)"/g)),
];

const FIX_COMMANDS: Record<string, string | null> = {
  'install-node': 'winget install OpenJS.NodeJS.LTS',
  'enable-pnpm': 'corepack enable pnpm',
  'install-git': 'winget install Git.Git',
  'download-ffmpeg': null,
};

function check(id: string, patch: Partial<DoctorCheck> = {}): DoctorCheck {
  return {
    id,
    required: false,
    status: 'missing',
    version: null,
    path: null,
    detail: null,
    fix_key: null,
    fix_command: null,
    ...patch,
  };
}

/** What Doctor reports when PATH holds almost nothing: every tool is missing. */
function minimalPathReport(): DoctorReport {
  const fix: Record<string, string> = {
    node: 'install-node',
    pnpm: 'install-node-then-pnpm',
    git: 'install-git',
    'claude-code': 'install-claude-code',
    codex: 'install-codex',
    opencode: 'install-opencode',
    hermes: 'install-hermes',
    agy: 'install-agy',
    ffmpeg: 'download-ffmpeg',
    'render-browser': 'install-render-browser',
    webview2: 'install-webview2',
    winget: 'winget-manual',
  };
  const checks = CHECK_IDS.map((id) =>
    id === 'claude-login'
      ? check(id, { status: 'info', detail: 'claude-code-missing' })
      : check(id, {
          required: ['node', 'pnpm', 'webview2'].includes(id),
          fix_key: fix[id],
          fix_command: FIX_COMMANDS[fix[id]] ?? null,
        }),
  );
  return { checks, any_agent_ok: false, ready: false, took_ms: 12 };
}

const idle = { kind: 'idle' } as const;

function renderPanel(
  overrides: Partial<React.ComponentProps<typeof DoctorPanel>> = {},
) {
  const props = {
    report: minimalPathReport(),
    loading: false,
    error: null,
    onRecheck: vi.fn(),
    ffmpeg: idle,
    onFfmpegDownload: vi.fn(),
    onFfmpegCancel: vi.fn(),
    ...overrides,
  };
  renderWithProviders(<DoctorPanel {...props} />);
  return props;
}

describe('doctor i18n coverage', () => {
  it('finds the 13 checks and their fix keys in the Rust source', () => {
    expect(CHECK_IDS).toHaveLength(13);
    expect(FIX_KEYS.length).toBeGreaterThanOrEqual(15);
  });

  it('has ko and en text for every check, status, and fix key', () => {
    const keys = [
      ...CHECK_IDS.map((id) => `doctor.check.${id}`),
      ...FIX_KEYS.map((k) => `doctor.fix.${k}`),
      ...[
        'ok',
        'missing',
        'outdated',
        'unsupported',
        'not-logged-in',
        'info',
      ].map((s) => `doctor.status.${s}`),
    ];
    for (const locale of ['ko', 'en'] as const) {
      const dict = getDictionary(locale) as Record<string, string>;
      for (const key of keys)
        expect(dict[key], `${locale}:${key}`).toBeTruthy();
    }
  });
});

describe('doctorModel', () => {
  it('summarizes blocking, warnings and the agent rule', () => {
    const s = summarize(minimalPathReport());
    expect(s.blocking).toBe(3);
    expect(s.noAgent).toBe(true);
    expect(s.level).toBe('error');
    const ready: DoctorReport = {
      checks: [check('node', { required: true, status: 'ok' })],
      any_agent_ok: true,
      ready: true,
      took_ms: 1,
    };
    expect(summarize(ready).level).toBe('ok');
  });

  it('treats info without a fix as fine and optional gaps as warnings', () => {
    expect(severityOf(check('x', { status: 'info' }))).toBe('ok');
    expect(severityOf(check('x', { fix_key: 'k' }))).toBe('warn');
    expect(severityOf(check('x', { required: true, fix_key: 'k' }))).toBe(
      'error',
    );
  });

  it('computes download percent', () => {
    expect(downloadPercent(null)).toBeNull();
    expect(downloadPercent({ stage: 'download', done: 50, total: 200 })).toBe(
      25,
    );
    expect(
      downloadPercent({ stage: 'download', done: 1, total: 0 }),
    ).toBeNull();
    expect(downloadPercent({ stage: 'verified', sha256: 'x' })).toBe(100);
  });
});

describe('DoctorPanel with a minimal PATH', () => {
  it('shows a fix for every missing item', () => {
    renderPanel();
    const missing = minimalPathReport().checks.filter((c) => c.fix_key);
    expect(missing.length).toBe(12);
    const ko = getDictionary('ko') as Record<string, string>;
    for (const c of missing) {
      const fix = screen.getByTestId(`doctor-fix-${c.id}`);
      expect(fix.textContent).toBe(ko[`doctor.fix.${c.fix_key}`]);
    }
    const node = screen.getByTestId('doctor-check-node');
    expect(
      within(node).getByText('winget install OpenJS.NodeJS.LTS'),
    ).toBeTruthy();
  });

  it('calls onRecheck', () => {
    const p = renderPanel();
    fireEvent.click(screen.getByRole('button', { name: /다시 점검/ }));
    expect(p.onRecheck).toHaveBeenCalledTimes(1);
  });

  it('never downloads FFmpeg without confirming the consent dialog', () => {
    const p = renderPanel();
    expect(screen.queryByTestId('ffmpeg-consent')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'FFmpeg 내려받기' }));
    expect(screen.getByTestId('ffmpeg-consent')).toBeTruthy();
    expect(p.onFfmpegDownload).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: '취소' }));
    expect(p.onFfmpegDownload).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'FFmpeg 내려받기' }));
    fireEvent.click(screen.getByRole('button', { name: '동의하고 내려받기' }));
    expect(p.onFfmpegDownload).toHaveBeenCalledTimes(1);
  });

  it('shows progress and a cancel button while downloading', () => {
    const p = renderPanel({
      ffmpeg: {
        kind: 'running',
        event: { stage: 'download', done: 50, total: 100 },
      },
    });
    expect(screen.getByTestId('ffmpeg-progress').textContent).toContain('50%');
    fireEvent.click(screen.getByRole('button', { name: '내려받기 취소' }));
    expect(p.onFfmpegCancel).toHaveBeenCalledTimes(1);
  });

  it('maps backend error codes to text', () => {
    renderPanel({ ffmpeg: { kind: 'error', code: 'cancelled' } });
    expect(screen.getByTestId('ffmpeg-error').textContent).toBe(
      '내려받기를 취소했습니다',
    );
  });
});
