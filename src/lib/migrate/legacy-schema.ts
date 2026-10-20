import { z } from 'zod';
import { AGENT_IDS, OUTPUT_TYPES, type ProjectManifest } from '@/lib/types/project';

/** vanilla.json 스키마 버전. 계약을 바꾸면 이 값과 설계서·vanilla-core 스킬을 함께 올린다. */
export const VANILLA_MANIFEST_VERSION = 1;

const dimension = z.number().int().min(1).max(16384);
const semver = z.string().regex(/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/, 'semver');
const slug = z.string().regex(/^[a-z0-9][a-z0-9-]*$/, 'kebab-case id');

const formatSchema = z
  .object({
    width: dimension,
    height: dimension,
    fps: z.number().int().min(1).max(120).optional(),
    durationSec: z.number().positive().max(3600).optional(),
    slideCount: z.number().int().min(1).max(500).optional(),
    variants: z.array(z.object({ width: dimension, height: dimension }).strict()).optional(),
  })
  .strict();

export const projectManifestSchema = z
  .object({
    version: z.literal(VANILLA_MANIFEST_VERSION),
    name: z.string().trim().min(1).max(100),
    outputType: z.enum(OUTPUT_TYPES),
    format: formatSchema,
    template: z.object({ id: slug, version: semver.optional() }).strict().nullable(),
    palette: z
      .object({
        id: slug,
        source: z.enum(['builtin', 'user', 'extracted', 'generated']),
      })
      .strict(),
    agents: z
      .object({
        default: z.enum(AGENT_IDS),
        enabled: z.array(z.enum(AGENT_IDS)).min(1),
      })
      .strict(),
    runtime: z.object({ version: semver }).strict(),
    createdAt: z.string().datetime(),
  })
  .strict()
  .superRefine((m, ctx) => {
    if (!m.agents.enabled.includes(m.agents.default)) {
      ctx.addIssue({
        code: 'custom',
        path: ['agents', 'default'],
        message: 'default agent must be in enabled',
      });
    }
    if (m.outputType === 'video') {
      for (const key of ['fps', 'durationSec'] as const) {
        if (m.format[key] === undefined) {
          ctx.addIssue({ code: 'custom', path: ['format', key], message: 'required for video' });
        }
      }
    }
    const only: [keyof typeof m.format, string][] = [
      ['fps', 'video'],
      ['durationSec', 'video'],
      ['slideCount', 'slides'],
      ['variants', 'image'],
    ];
    for (const [key, type] of only) {
      if (m.format[key] !== undefined && m.outputType !== type) {
        ctx.addIssue({ code: 'custom', path: ['format', key], message: `only for ${type}` });
      }
    }
  });

// 스키마 ↔ 타입 정합을 컴파일 타임에 확인한다.
type Inferred = z.infer<typeof projectManifestSchema>;
const _assignable: (m: Inferred) => ProjectManifest = (m) => m;
void _assignable;

export type ParseResult =
  | { ok: true; manifest: ProjectManifest }
  | { ok: false; error: string };

export function parseProjectManifest(text: string): ParseResult {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch (e) {
    return { ok: false, error: `Invalid JSON: ${e instanceof Error ? e.message : String(e)}` };
  }
  const r = projectManifestSchema.safeParse(raw);
  if (r.success) return { ok: true, manifest: r.data };
  return {
    ok: false,
    error: r.error.issues.map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`).join('; '),
  };
}
