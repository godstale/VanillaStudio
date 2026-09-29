import { z } from 'zod';
import { isColor } from '@/lib/design/color';
import { CORE_ROLES } from '@/lib/design/roles';

/** palette.json 스키마 버전. 계약을 바꾸면 이 값과 설계서·vanilla-core 스킬을 함께 올린다. */
export const PALETTE_VERSION = 1;

const slug = z.string().regex(/^[a-z0-9][a-z0-9-]*$/, 'kebab-case id');

/** 역할 → 색. 핵심 4개는 필수, 파생·data-*는 선택(없으면 런타임이 대비 기준에 맞춰 파생). */
const colorValue = z.string().refine(isColor, 'valid CSS color');

export const paletteSchema = z
  .object({
    version: z.literal(PALETTE_VERSION),
    id: slug,
    name: z.string().trim().min(1).max(100),
    tags: z.array(z.string().trim().min(1).max(40)).default([]),
    scheme: z.enum(['light', 'dark']),
    colors: z.record(z.string(), colorValue),
    source: z.enum(['builtin', 'user', 'extracted', 'generated']),
    license: z.string().trim().min(1),
  })
  .strict()
  .superRefine((p, ctx) => {
    for (const role of CORE_ROLES) {
      if (!p.colors[role]) {
        ctx.addIssue({ code: 'custom', path: ['colors', role], message: `missing core role "${role}"` });
      }
    }
  });

export type Palette = z.infer<typeof paletteSchema>;

export type PaletteParseResult =
  | { ok: true; palette: Palette }
  | { ok: false; error: string };

export function parsePalette(text: string): PaletteParseResult {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch (e) {
    return { ok: false, error: `Invalid JSON: ${e instanceof Error ? e.message : String(e)}` };
  }
  const r = paletteSchema.safeParse(raw);
  if (r.success) return { ok: true, palette: r.data };
  return {
    ok: false,
    error: r.error.issues.map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`).join('; '),
  };
}
