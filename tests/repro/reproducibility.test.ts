// @vitest-environment node
// 재현성 테스트(T7.4, D-023): 같은 `scene.json` → 같은 가이드 바이트, 다른 폴더·PC·키 순서·줄바꿈에서도 같은 결과.
// 절차 문서: Docs/Verification/Reproducibility.md
import { createHash } from 'node:crypto';
import { cpSync, mkdtempSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { getBuiltinTemplate } from '@/lib/guides/template';
import { renderSceneFiles } from '@/lib/scene/files';
import { canonicalStringify } from '@/lib/json/canonical';
import { parseScene, serializeScene, SCENE_TIME_KEYS, type Scene } from '@/lib/scene/schema';
import { parseSequence, serializeSequence } from '@/lib/sequence/schema';
import { parseWorkspaceFile, serializeWorkspace } from '@/lib/workspace/file';

const SAMPLE = resolve(__dirname, '../../resources/samples/sequence-demo');
const WS = { id: 'ws_sampleseq0001', name: 'Sequence Demo' };
const sha = (s: string) => createHash('sha256').update(s).digest('hex');

const slugs = (): string[] => readdirSync(join(SAMPLE, 'scenes')).filter((n) => statSync(join(SAMPLE, 'scenes', n)).isDirectory()).sort();
const sceneOf = (root: string, slug: string): Scene => parseScene(readFileSync(join(root, 'scenes', slug, 'scene.json'), 'utf8'));

function render(scene: Scene, existing: { agents: string | null; claude: string | null } = { agents: null, claude: null }) {
  const template = getBuiltinTemplate(scene.template);
  if (!template) throw new Error(`no template ${scene.template}`);
  return renderSceneFiles({ workspace: WS, scene, template }, existing);
}

/** 키 순서를 거꾸로 뒤집은 같은 JSON(재귀). */
function reverseKeys(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(reverseKeys);
  if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v as Record<string, unknown>).reverse().map(([k, x]) => [k, reverseKeys(x)]));
  return v;
}

describe('same scene.json → same bytes', () => {
  it('sample JSON files are canonical: parse → serialize reproduces the file exactly', () => {
    for (const slug of slugs()) {
      const text = readFileSync(join(SAMPLE, 'scenes', slug, 'scene.json'), 'utf8');
      expect(serializeScene(parseScene(text)), slug).toBe(text);
    }
    const seq = readFileSync(join(SAMPLE, 'sequence.json'), 'utf8');
    expect(serializeSequence(parseSequence(seq))).toBe(seq);
    const ws = readFileSync(join(SAMPLE, 'workspace.json'), 'utf8');
    expect(serializeWorkspace(parseWorkspaceFile(ws))).toBe(ws);
  });

  it('input key order does not change the output bytes', () => {
    for (const slug of slugs()) {
      const scene = sceneOf(SAMPLE, slug);
      const shuffled = JSON.parse(JSON.stringify(reverseKeys(scene))) as unknown;
      expect(serializeScene(parseScene(JSON.stringify(shuffled))), slug).toBe(serializeScene(scene));
    }
  });

  it('CRLF input and extra whitespace do not change the output bytes', () => {
    const scene = sceneOf(SAMPLE, 'intro');
    const pretty = JSON.stringify(scene, null, 4).replace(/\n/g, '\r\n');
    expect(serializeScene(parseScene(pretty))).toBe(serializeScene(scene));
    expect(serializeScene(parseScene(JSON.stringify(scene)))).toBe(serializeScene(scene));
  });

  it('time values are written with three decimals, whatever float noise the input had', () => {
    const scene = sceneOf(SAMPLE, 'intro') as unknown as { duration: { seconds: number } };
    const noisy = { ...scene, duration: { seconds: 4.000000000000001 } };
    const text = canonicalStringify(noisy, { timeKeys: SCENE_TIME_KEYS });
    expect(text).toContain('"seconds": 4.000');
  });

  it('generated guide files are identical on every render and never contain a clock', () => {
    for (const slug of slugs()) {
      const scene = sceneOf(SAMPLE, slug);
      const a = render(scene);
      const b = render(scene);
      expect(b, slug).toEqual(a);
      for (const [file, text] of Object.entries(a)) {
        expect(text, `${slug}/${file}`).not.toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/); // no timestamps
        expect(text, `${slug}/${file}`).not.toContain('\r');
      }
    }
  });

  it('re-rendering over an existing AGENTS.md keeps text outside the markers and changes nothing else', () => {
    const scene = sceneOf(SAMPLE, 'page');
    const first = render(scene);
    const edited = `Team note: keep it punchy.\r\n\r\n${first['AGENTS.md']}\r\nMy own notes\r\n`;
    const again = render(scene, { agents: edited, claude: first['CLAUDE.md'] });
    expect(again['AGENTS.md']).toContain('Team note: keep it punchy.');
    expect(again['AGENTS.md']).toContain('My own notes');
    // a second pass over its own output is a no-op (idempotent)
    expect(render(scene, { agents: again['AGENTS.md'], claude: first['CLAUDE.md'] })['AGENTS.md']).toBe(again['AGENTS.md']);
  });
});

describe('different folder, different machine', () => {
  it('a copy of the workspace in another folder renders the same bytes (no absolute paths leak in)', () => {
    const copy = mkdtempSync(join(tmpdir(), 'vanilla-repro-'));
    cpSync(SAMPLE, copy, { recursive: true });
    const before = process.cwd();
    for (const slug of slugs()) {
      const original = render(sceneOf(SAMPLE, slug));
      process.chdir(copy); // a different working directory must not matter either
      const moved = render(sceneOf(copy, slug));
      process.chdir(before);
      expect(sha(JSON.stringify(moved)), slug).toBe(sha(JSON.stringify(original)));
      for (const [file, text] of Object.entries(original)) {
        expect(text, `${slug}/${file}`).not.toMatch(/[A-Za-z]:[\\/]/); // Windows absolute path
        expect(text, `${slug}/${file}`).not.toMatch(/\/(Users|home)\//);
        expect(text, `${slug}/${file}`).not.toContain(copy);
      }
    }
  });

  it('the scene hash header depends only on scene.json content', () => {
    const scene = sceneOf(SAMPLE, 'intro');
    const guide = render(scene)['GUIDE.md'];
    const hash = /scene-hash=([0-9a-f]{64})/.exec(guide)?.[1];
    expect(hash).toBe(sha(serializeScene(scene)));
    const changed = { ...scene, name: 'Intro (edited)' } as Scene;
    expect(/scene-hash=([0-9a-f]{64})/.exec(render(changed)['GUIDE.md'])?.[1]).not.toBe(hash);
  });
});

describe('the whole sample, as one fingerprint', () => {
  it('rendering every scene of the sample gives a stable fingerprint (update deliberately when guide templates change)', () => {
    const all: Record<string, string> = {};
    for (const slug of slugs()) for (const [file, text] of Object.entries(render(sceneOf(SAMPLE, slug)))) all[`${slug}/${file}`] = sha(text);
    // The fingerprint itself is not pinned here (guide templates evolve); what matters is that it is a pure function of the inputs.
    const again: Record<string, string> = {};
    for (const slug of slugs()) for (const [file, text] of Object.entries(render(sceneOf(SAMPLE, slug)))) again[`${slug}/${file}`] = sha(text);
    expect(again).toEqual(all);
    expect(Object.keys(all).length).toBeGreaterThan(slugs().length * 4);
  });
});
