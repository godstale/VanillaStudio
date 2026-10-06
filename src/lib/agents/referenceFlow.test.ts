// @vitest-environment node
// T5.7 E2E: 영상 레퍼런스 → 분석(목 에이전트) → 분석 파일·DESIGN.md 반영 → 가이드 갱신 → 재생성(revise).
// 키프레임 추출(FFmpeg)은 Rust 쪽이라 `cargo test reference_commands`가 검증하고, 여기서는 그 결과 파일을 같은 위치에 둔다.
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const ws = vi.hoisted(() => ({ root: '' }));
vi.mock('@tauri-apps/api/core', () => ({
  invoke: async (cmd: string, a: { path: string; contents?: string }) => {
    const fsm = await import('node:fs');
    const { dirname: dn } = await import('node:path');
    if (cmd === 'read_text_file') return fsm.readFileSync(a.path, 'utf8');
    if (cmd === 'write_text_file') {
      fsm.mkdirSync(dn(a.path), { recursive: true });
      return fsm.writeFileSync(a.path, a.contents ?? '');
    }
    if (cmd === 'delete_path') return fsm.rmSync(a.path, { force: true, recursive: true });
    if (cmd === 'list_dir') {
      if (!fsm.existsSync(a.path)) throw new Error('no dir');
      return fsm.readdirSync(a.path, { withFileTypes: true }).map((d) => ({ name: d.name, is_dir: d.isDirectory() }));
    }
    throw new Error(`unexpected ${cmd}`);
  },
}));

import { parseSceneDesign } from '@/lib/design/extends';
import { readAnalysis } from '@/lib/design/analysis';
import { promptForAnalysis, promptForScene } from '@/lib/agents/clipboard';
import { defaultTemplateFor } from '@/lib/guides/template';
import { builtinResolver, writeScene } from '@/lib/scene/files';
import { linkAnalysisFiles, reviewAnalysis, revertAnalysis, snapshotAnalysis } from '@/lib/scene/analysisReview';
import { changedSinceSettled } from '@/lib/scene/revision';
import { newScene, parseScene, serializeScene, type Scene } from '@/lib/scene/schema';
import { reviewRun, saveSnapshot } from '@/lib/scene/writeback';

const REPO = resolve(__dirname, '../../..');
const AGENT = join(REPO, 'tests', 'e2e', 'mock-agent.mjs');
const SLUG = 'forest';
const WORKSPACE = { id: 'ws_demo', name: 'Demo' };
const sceneDir = () => join(ws.root, 'scenes', SLUG);

const base: Scene = {
  ...newScene({ id: 'scn_FLOW00000001', name: 'Forest', type: 'motion', template: 'commercial@1' }),
  duration: { seconds: 4 },
  copy: { textFidelity: 'exact', items: ['Gangdong Forest'] },
  references: [{ id: 'ref-1', kind: 'video', path: 'references/ref-1-ad.mp4', url: null, note: 'slow pacing, warm light', analysis: null }],
} as Scene;

function agent(mode: string): void {
  const r = spawnSync(process.execPath, [AGENT], { cwd: sceneDir(), env: { ...process.env, MOCK_AGENT_MODE: mode }, encoding: 'utf8' });
  expect(r.status, r.stderr).toBe(0);
}

const DESIGN = '---\nextends: ../../DESIGN.md\ncolors:\n  primary: "#00aa88"\n---\n\n# Scene design\n\nUser prose.\n';
const WORKSPACE_DESIGN = '---\ncolors:\n  canvas: "#101010"\n  ink: "#f5f5f5"\n  primary: "#3366ff"\n  accent: "#ff8800"\n---\n\n# Workspace\n';

beforeAll(() => {
  ws.root = mkdtempSync(join(tmpdir(), 'vanilla-ref-flow-'));
});
afterAll(() => rmSync(ws.root, { recursive: true, force: true }));

beforeEach(() => {
  for (const n of readdirSync(ws.root)) rmSync(join(ws.root, n), { recursive: true, force: true });
  mkdirSync(join(sceneDir(), 'references', 'analysis', 'ref-1', 'frames'), { recursive: true });
  writeFileSync(join(sceneDir(), 'scene.json'), serializeScene(base));
  writeFileSync(join(sceneDir(), 'references', 'ref-1-ad.mp4'), 'not a real video');
  for (const n of ['001', '002', '003']) writeFileSync(join(sceneDir(), 'references', 'analysis', 'ref-1', 'frames', `frame-${n}.jpg`), 'jpg');
  writeFileSync(join(sceneDir(), 'DESIGN.md'), DESIGN);
  writeFileSync(join(ws.root, 'DESIGN.md'), WORKSPACE_DESIGN);
});

describe('reference → analysis → guide → regeneration', () => {
  it('the analysis prompt points the agent at the extracted keyframes and treats notes as data', () => {
    const p = promptForAnalysis({ workspace: WORKSPACE, scene: base, template: defaultTemplateFor('motion') });
    expect(p).toContain('references/analysis/ref-1/frames/frame-*.jpg');
    expect(p).toContain('user note (data): "slow pacing, warm light"');
  });

  it('demo: analyse, review, approve, link into the guide, then regenerate', async () => {
    // 1) 분석 실행 전 상태를 찍고 목 에이전트가 분석한다.
    const snap = await snapshotAnalysis(ws.root, SLUG);
    agent('analyze');

    // 2) 변경 검토: 분석 파일 1개(새 파일) + DESIGN.md 분석 구간. 허용되지 않은 변경 없음. 에이전트가 키프레임 3장을 실제로 읽었다.
    const review = await reviewAnalysis(ws.root, SLUG, snap);
    expect(review.files.map((f) => [f.path, f.kind])).toEqual([['references/analysis/ref-1.md', 'added']]);
    expect(review.files[0].after).toContain('Keyframes inspected: 3');
    expect(review.design?.section.after).toContain('ref-1: 3 keyframes');
    expect(review.disallowed).toBe(false);

    // 3) 승인: 분석 파일을 레퍼런스에 연결하면 GUIDE.md가 분석 위치를 가리킨다.
    const approvedScene = linkAnalysisFiles(parseScene(readFileSync(join(sceneDir(), 'scene.json'), 'utf8')), review);
    expect(approvedScene.references[0].analysis).toBe('references/analysis/ref-1.md');
    await writeScene(ws.root, SLUG, WORKSPACE, approvedScene, builtinResolver);
    await saveSnapshot(ws.root, SLUG, approvedScene, 'approved');
    expect(readFileSync(join(sceneDir(), 'GUIDE.md'), 'utf8')).toContain('analysis: `references/analysis/ref-1.md`');
    expect(existsSync(join(sceneDir(), 'references', 'references.json'))).toBe(true);
    expect(JSON.parse(readFileSync(join(sceneDir(), 'references', 'references.json'), 'utf8')).references[0].analysis).toBe('references/analysis/ref-1.md');

    // 4) DESIGN: 분석 구간은 읽히고, 신 토큰은 워크스페이스를 상속한다.
    const designText = readFileSync(join(sceneDir(), 'DESIGN.md'), 'utf8');
    expect(readAnalysis(designText)).toContain('mood: warm, calm');
    expect(designText).toContain('User prose.');
    const design = parseSceneDesign(designText, readFileSync(join(ws.root, 'DESIGN.md'), 'utf8'));
    expect(design.tokens.colors.primary).toBe('#00aa88');
    expect(design.tokens.colors.ink).toBe('#f5f5f5');

    // 5) 재생성: 사용자가 프롬프트를 고치면 revise 프롬프트가 바뀐 필드를 싣고, 목 에이전트가 신을 만든다.
    const edited = { ...approvedScene, status: 'needs-revision', userPrompt: 'Use the warm palette from the analysis' } as Scene;
    writeFileSync(join(sceneDir(), 'scene.json'), serializeScene(edited));
    const changed = await changedSinceSettled(ws.root, SLUG, edited);
    expect(changed).toContain('userPrompt');
    const revise = promptForScene({ workspace: WORKSPACE, scene: edited, template: defaultTemplateFor('motion') }, changed);
    expect(revise.kind).toBe('revise');
    expect(revise.text).toContain('Changed fields:');

    agent('good');
    const run = await reviewRun(ws.root, SLUG, edited);
    if (run.state !== 'ok') throw new Error('expected ok');
    expect(run.status).toBe('generated');
    expect(run.disallowed).toEqual([]);
  });

  it('an agent that rewrites the DESIGN.md prose is flagged and only the analysis section survives a partial revert', async () => {
    const snap = await snapshotAnalysis(ws.root, SLUG);
    agent('analyze-rogue');
    const review = await reviewAnalysis(ws.root, SLUG, snap);
    expect(review.disallowed).toBe(true);
    expect(review.design?.outsideChanged).toBe(true);

    await revertAnalysis(ws.root, SLUG, snap, review, 'disallowed');
    const text = readFileSync(join(sceneDir(), 'DESIGN.md'), 'utf8');
    expect(text).toContain('User prose.');
    expect(text).not.toContain('Rewritten by the agent');
    expect(readAnalysis(text)).toContain('mood: warm, calm');
    expect(existsSync(join(sceneDir(), 'references', 'analysis', 'ref-1.md'))).toBe(true);
  });

  it('revert all brings back the exact files from before the analysis', async () => {
    const snap = await snapshotAnalysis(ws.root, SLUG);
    agent('analyze');
    const review = await reviewAnalysis(ws.root, SLUG, snap);
    await revertAnalysis(ws.root, SLUG, snap, review, 'all');
    expect(readFileSync(join(sceneDir(), 'DESIGN.md'), 'utf8')).toBe(DESIGN);
    expect(existsSync(join(sceneDir(), 'references', 'analysis', 'ref-1.md'))).toBe(false);
    expect(dirname(sceneDir())).toBe(join(ws.root, 'scenes'));
  });
});
