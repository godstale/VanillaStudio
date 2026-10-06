// @vitest-environment node
// T4.11 통합: 목 에이전트(tests/e2e/mock-agent.mjs)가 신 폴더에서 일한 뒤, 앱의 완료 판정·되돌림·계약 검사·재생성 경로가 실제 파일로 동작하는지 본다.
import { execFileSync, spawnSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const ws = vi.hoisted(() => ({ root: '' }));

// Tauri 파일 명령을 실제 디스크(임시 워크스페이스)로 대신한다.
vi.mock('@tauri-apps/api/core', () => ({
  invoke: async (cmd: string, a: { path: string; contents?: string }) => {
    const { readFileSync: read, writeFileSync: write, readdirSync: ls, mkdirSync: mk, existsSync: ex } = await import('node:fs');
    const { dirname: dn } = await import('node:path');
    if (cmd === 'read_text_file') return read(a.path, 'utf8');
    if (cmd === 'write_text_file') {
      mk(dn(a.path), { recursive: true });
      return write(a.path, a.contents ?? '');
    }
    if (cmd === 'list_dir') {
      if (!ex(a.path)) throw new Error('no dir');
      return ls(a.path, { withFileTypes: true }).map((d) => ({ name: d.name, is_dir: d.isDirectory() }));
    }
    throw new Error(`unexpected ${cmd}`);
  },
}));

import { newScene, parseScene, serializeScene, type Scene } from '@/lib/scene/schema';
import { runSceneCheck } from '@/lib/scene/check';
import { changedSinceSettled } from '@/lib/scene/revision';
import { reviewRun, revertFields, saveSnapshot } from '@/lib/scene/writeback';

const REPO = resolve(__dirname, '../../..');
const AGENT = join(REPO, 'tests', 'e2e', 'mock-agent.mjs');
const SLUG = 'intro';

const base: Scene = {
  ...newScene({ id: 'scn_E2E000000001', name: 'Intro', type: 'motion', template: 'commercial-v1@1' }),
  duration: { seconds: 4 },
  copy: { textFidelity: 'exact', items: ['Vanilla Studio', 'Say "hello" to motion'] },
} as Scene;

function runAgent(mode: string): void {
  const r = spawnSync(process.execPath, [AGENT], { cwd: join(ws.root, 'scenes', SLUG), env: { ...process.env, MOCK_AGENT_MODE: mode }, encoding: 'utf8' });
  expect(r.status, r.stderr).toBe(0);
}

beforeAll(() => {
  ws.root = mkdtempSync(join(tmpdir(), 'vanilla-mock-agent-'));
});
afterAll(() => rmSync(ws.root, { recursive: true, force: true }));

beforeEach(() => {
  for (const n of readdirSync(ws.root)) rmSync(join(ws.root, n), { recursive: true, force: true });
  mkdirSync(join(ws.root, 'scenes', SLUG), { recursive: true });
  writeFileSync(join(ws.root, 'scenes', SLUG, 'scene.json'), serializeScene(base));
});

describe('mock agent run → app review', () => {
  it('good run: valid scene.json, entry exists, only whitelisted fields changed → generated, check passes', async () => {
    runAgent('good');
    const review = await reviewRun(ws.root, SLUG, base);
    expect(review.state).toBe('ok');
    if (review.state !== 'ok') return;
    expect(review.entryExists).toBe(true);
    expect(review.disallowed).toEqual([]);
    expect(review.status).toBe('generated');
    expect(review.changes.map((c) => c.field).sort()).toEqual(['beats', 'endCard']);

    const check = await runSceneCheck(ws.root, SLUG, review.after);
    expect(check.findings.filter((f) => f.severity === 'error')).toEqual([]);
    expect(readFileSync(join(ws.root, 'scenes', SLUG, '.vanilla', 'self-check.md'), 'utf8')).toContain('Result: PASS');
  });

  it('rogue run: a non-whitelisted field is flagged and can be reverted', async () => {
    runAgent('rogue');
    const review = await reviewRun(ws.root, SLUG, base);
    if (review.state !== 'ok') throw new Error('expected ok');
    expect(review.disallowed).toEqual(['name']);
    const fixed = revertFields(review.after, base, review.disallowed);
    expect(fixed.name).toBe('Intro');
    expect((fixed as { beats: unknown[] }).beats).toHaveLength(2); // allowed work is kept
  });

  it('broken run: invalid scene.json is reported, nothing is applied', async () => {
    runAgent('broken');
    const review = await reviewRun(ws.root, SLUG, base);
    expect(review.state).toBe('invalid');
  });

  it('forbidden time API is caught by the contract check', async () => {
    runAgent('late-clock');
    const review = await reviewRun(ws.root, SLUG, base);
    if (review.state !== 'ok') throw new Error('expected ok');
    const check = await runSceneCheck(ws.root, SLUG, review.after);
    expect(check.findings.map((f) => f.rule)).toContain('no-forbidden-time-api');
  });

  it('the workspace CLI (pnpm check:scene) agrees with the app and writes self-check.md', () => {
    runAgent('good');
    const scripts = join(ws.root, 'scripts');
    cpSync(join(REPO, 'resources', 'workspace-template', 'scripts'), scripts, { recursive: true });
    const out = execFileSync(process.execPath, [join(scripts, 'check-scene.mjs'), SLUG], { cwd: ws.root, encoding: 'utf8' });
    expect(out).toContain(`${SLUG}: PASS`);
    runAgent('late-clock');
    const bad = spawnSync(process.execPath, [join(scripts, 'check-scene.mjs'), SLUG], { cwd: ws.root, encoding: 'utf8' });
    expect(bad.status).toBe(1);
  });

  it('revise loop: after approval, an edit is reported as changed field and the agent can run again', async () => {
    runAgent('good');
    const review = await reviewRun(ws.root, SLUG, base);
    if (review.state !== 'ok') throw new Error('expected ok');
    const approved = { ...review.after, status: 'generated' } as Scene;
    await saveSnapshot(ws.root, SLUG, approved, 'approved');

    const edited = { ...approved, status: 'needs-revision', userPrompt: 'Make the second line bigger' } as Scene;
    writeFileSync(join(ws.root, 'scenes', SLUG, 'scene.json'), serializeScene(edited));
    expect(await changedSinceSettled(ws.root, SLUG, parseScene(readFileSync(join(ws.root, 'scenes', SLUG, 'scene.json'), 'utf8')))).toEqual(['userPrompt']);

    runAgent('good'); // 두 번째 실행: 같은 입력이면 같은 결과(결정성)
    const again = await reviewRun(ws.root, SLUG, edited);
    if (again.state !== 'ok') throw new Error('expected ok');
    expect(again.status).toBe('generated');
  });

  it('keeps the agent inside the scene folder (nothing written elsewhere)', () => {
    runAgent('good');
    expect(readdirSync(ws.root)).toEqual(['scenes']);
    expect(readdirSync(join(ws.root, 'scenes'))).toEqual([SLUG]);
  });
});
