import { parse as parseYaml } from 'yaml';
import { z } from 'zod';
import { splitFrontMatter } from './frontmatter';
import { isColor } from './color';
import { deriveRoles, type Colors } from './roles';

// Lenient: unknown keys are kept (spec: consumers must preserve unknown content).
const TokensSchema = z
  .object({
    version: z.string().optional(),
    name: z.string().optional(),
    colors: z.record(z.string(), z.string()).default({}),
    /** 분위기 키워드(용어 ID, 선택). 가이드 `visualStyle.mood`와 같은 ID를 쓴다(Technical-Design §4.5). */
    mood: z.array(z.string()).optional(),
    typography: z.record(z.string(), z.record(z.string(), z.union([z.string(), z.number()]))).default({}),
    spacing: z.record(z.string(), z.union([z.string(), z.number()])).default({}),
    rounded: z.record(z.string(), z.string()).default({}),
    components: z.record(z.string(), z.record(z.string(), z.string())).default({}),
  })
  .passthrough();

export type DesignTokens = z.infer<typeof TokensSchema>;

export interface ParsedDesign {
  tokens: DesignTokens;
  /** Colors with references resolved and derived roles filled. */
  colors: Colors;
  issues: string[];
}

const REF = /^\{([A-Za-z0-9_.-]+)\}$/;

function lookup(root: Record<string, unknown>, path: string): unknown {
  return path.split('.').reduce<unknown>((o, k) => (o && typeof o === 'object' ? (o as Record<string, unknown>)[k] : undefined), root);
}

/** Resolve `{a.b}` references; cycles and dangling refs become issues. */
export function resolveRefs<T>(value: T, root: Record<string, unknown>, issues: string[], seen: string[] = []): T {
  if (typeof value === 'string') {
    const m = REF.exec(value);
    if (!m) return value;
    if (seen.includes(m[1])) {
      issues.push(`circular reference: ${[...seen, m[1]].join(' -> ')}`);
      return value;
    }
    const target = lookup(root, m[1]);
    if (target === undefined) {
      issues.push(`broken reference: ${value}`);
      return value;
    }
    return resolveRefs(target as T, root, issues, [...seen, m[1]]);
  }
  if (Array.isArray(value)) return value.map((v) => resolveRefs(v, root, issues, seen)) as T;
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, resolveRefs(v, root, issues, seen)])) as T;
  }
  return value;
}

/** 토큰 문서를 읽기만 한다(참조 해석 전). 상속 병합이 참조 해석보다 먼저 일어나야 해서 나눠 둔다. */
export function parseDesignTokens(text: string): { tokens: DesignTokens; issues: string[] } {
  const split = splitFrontMatter(text);
  const issues: string[] = [];
  if (!split.hasFrontMatter) issues.push('no YAML front matter: tokens unavailable (prose-only DESIGN.md)');
  const raw = split.hasFrontMatter ? (parseYaml(split.yaml) ?? {}) : {};
  const parsed = TokensSchema.safeParse(raw);
  if (!parsed.success) {
    issues.push(...parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`));
  }
  return { tokens: parsed.success ? parsed.data : TokensSchema.parse({}), issues };
}

/** 참조 해석 → 색 검증 → 파생 역할. */
export function resolveDesign(tokens: DesignTokens, issues: string[] = []): ParsedDesign {
  const resolved = resolveRefs(tokens, tokens as Record<string, unknown>, issues);
  for (const [k, v] of Object.entries(resolved.colors)) if (!isColor(v)) issues.push(`colors.${k}: invalid color ${v}`);
  let colors: Colors = resolved.colors;
  try {
    colors = deriveRoles(resolved.colors);
  } catch (e) {
    issues.push((e as Error).message);
  }
  return { tokens: resolved, colors, issues };
}

export function parseDesign(text: string): ParsedDesign {
  const { tokens, issues } = parseDesignTokens(text);
  return resolveDesign(tokens, issues);
}
