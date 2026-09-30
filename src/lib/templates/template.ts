import { z } from 'zod';
import { OUTPUT_TYPES } from '@/lib/types/project';

/** template.json 스키마 버전. 계약을 바꾸면 이 값과 설계서·vanilla-core 스킬을 함께 올린다. */
export const TEMPLATE_MANIFEST_VERSION = 1;

const slug = z.string().regex(/^[a-z0-9][a-z0-9-]*$/, 'kebab-case id');

/** 미리보기·예제 파일 참조: 템플릿 폴더 안 상대 경로만 허용한다. */
const relPath = z
  .string()
  .min(1)
  .refine((v) => !v.startsWith('/') && !/^[A-Za-z]:/.test(v) && !v.includes('..'), 'relative path inside the template folder');

export const templateManifestSchema = z
  .object({
    version: z.literal(TEMPLATE_MANIFEST_VERSION),
    id: slug,
    name: z.string().trim().min(1).max(100),
    description: z.string().trim().min(1).max(500),
    /** 이 템플릿이 대상으로 하는 결과물 유형(기획서 §8.3). */
    outputTypes: z.array(z.enum(OUTPUT_TYPES)).min(1),
    tags: z.array(z.string().trim().min(1).max(40)).default([]),
    /** 썸네일·짧은 미리보기 영상 등(기본 팔레트 기준, 기획서 §8.3). */
    preview: z.string().trim().min(1).optional(),
    license: z.string().trim().min(1),
    /** 프로젝트 DESIGN.md 초기본에 적용할 팔레트(없으면 기본 DESIGN.md). */
    defaultPalette: slug.optional(),
    recommendedPalettes: z.array(slug).default([]),
    /** 템플릿 폴더 안 DESIGN.md 위치(기본값 "DESIGN.md"). */
    designFile: relPath.default('DESIGN.md'),
  })
  .strict();

export type TemplateManifest = z.infer<typeof templateManifestSchema>;

export type TemplateParseResult =
  | { ok: true; manifest: TemplateManifest }
  | { ok: false; error: string };

export function parseTemplateManifest(text: string): TemplateParseResult {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch (e) {
    return { ok: false, error: `Invalid JSON: ${e instanceof Error ? e.message : String(e)}` };
  }
  const r = templateManifestSchema.safeParse(raw);
  if (r.success) return { ok: true, manifest: r.data };
  return {
    ok: false,
    error: r.error.issues.map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`).join('; '),
  };
}
