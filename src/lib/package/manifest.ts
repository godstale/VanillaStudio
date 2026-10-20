import { z } from 'zod';
import { getBuiltinTemplate } from '@/lib/guides/template';
import type { Scene } from '@/lib/scene/schema';

// `.vsx` 패키지의 manifest.json(T7.1, D-027, Technical-Design §8.4). 만들기·검사·해시는 Rust(`package_commands.rs`)가 한다. 이 스키마는 Rust가 돌려준 값을 화면에서 쓰기 전에 다시 검증한다.
// 계약을 바꾸면 Rust 구조체(`Manifest`)·설계서·`formatVersion`을 함께 올린다.

export const PACKAGE_FORMAT_VERSION = 1;
export const PACKAGE_EXTENSION = 'vsx';

const sha256 = z.string().regex(/^[0-9a-f]{64}$/);
const packagePath = z
  .string()
  .min(1)
  .max(240)
  .refine((p) => !p.startsWith('/') && !p.includes('\\') && !/^[A-Za-z]:/.test(p) && !p.split('/').some((s) => s === '' || s === '.' || s === '..'), 'unsafe path');

export const fileEntrySchema = z.object({ path: packagePath, size: z.number().int().min(0), sha256 }).strict();

export const manifestSchema = z
  .object({
    formatVersion: z.literal(PACKAGE_FORMAT_VERSION),
    kind: z.enum(['sequence', 'scene']),
    app: z.object({ name: z.string(), version: z.string() }).strict(),
    schemas: z.object({ workspace: z.number().int(), scene: z.number().int(), sequence: z.number().int() }).strict(),
    workspace: z.object({ id: z.string().min(1), name: z.string().min(1) }).strict(),
    scene: z.string().nullable(),
    templates: z.array(z.string().regex(/^guide-templates\/[A-Za-z0-9@._-]+$/)),
    files: z.array(fileEntrySchema),
  })
  .strict()
  .superRefine((m, ctx) => {
    if ((m.kind === 'scene') !== (m.scene !== null)) ctx.addIssue({ code: 'custom', path: ['scene'], message: 'scene must be set exactly for scene packages' });
    const seen = new Set<string>();
    m.files.forEach((f, i) => {
      if (seen.has(f.path)) ctx.addIssue({ code: 'custom', path: ['files', i, 'path'], message: `duplicate path ${f.path}` });
      seen.add(f.path);
    });
  });

export type Manifest = z.infer<typeof manifestSchema>;

export const packageInfoSchema = z
  .object({
    manifest: manifestSchema,
    reviewFiles: z.array(z.string()),
    totalBytes: z.number().int().min(0),
  })
  .strict();
export type PackageInfo = z.infer<typeof packageInfoSchema>;

export const packReportSchema = z.object({ path: z.string(), files: z.number().int(), bytes: z.number().int(), manifest: manifestSchema }).strict();
export type PackReport = z.infer<typeof packReportSchema>;

/** 이 패키지를 지금 앱이 열 수 있는가: 스키마 버전이 앱이 아는 것과 같아야 한다(다르면 마이그레이션이 필요하다). */
export function schemaCompatibility(m: Manifest): { ok: true } | { ok: false; reason: string } {
  const known = { workspace: 1, scene: 1, sequence: 1 };
  for (const k of ['workspace', 'scene', 'sequence'] as const) {
    if (m.schemas[k] !== known[k]) return { ok: false, reason: `${k} schema ${m.schemas[k]} (this app understands ${known[k]})` };
  }
  return { ok: true };
}

export const WORKSPACE_TEMPLATES_DIR = 'guide-templates';

/**
 * 신들이 쓰는 사용자 정의 템플릿 폴더(내장이 아닌 것). 패키지에 동봉할 대상이다.
 * `exists`가 없는 폴더(전역 `templatesDir`에서 온 템플릿)는 `missing`에 모은다 — 받는 쪽에 없을 수 있다는 경고용.
 */
export function usedTemplateDirs(scenes: readonly Pick<Scene, 'template'>[], exists: (dir: string) => boolean): { dirs: string[]; missing: string[] } {
  const dirs = new Set<string>();
  const missing = new Set<string>();
  for (const s of scenes) {
    if (getBuiltinTemplate(s.template)) continue;
    const dir = `${WORKSPACE_TEMPLATES_DIR}/${s.template}`;
    (exists(dir) ? dirs : missing).add(dir);
  }
  return { dirs: [...dirs].sort(), missing: [...missing].sort() };
}
