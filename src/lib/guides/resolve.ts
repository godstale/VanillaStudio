import type { SceneType } from '@/lib/scene/schema';
import { mergeTemplate, TemplateError } from './merge';
import { buildTemplate, type GuideTemplate } from './template';

// 템플릿 해석(D-031): 우선순위 워크스페이스 `guide-templates/` > 설정 `templatesDir` > 내장.
// 사용자 템플릿은 `extends`로 부모를 확장하고, 검증에 실패하면 **사용을 거부**한다(목록에서 빠지고 오류만 남는다).
// 같은 `<id>@<ver>`가 여러 곳에 있으면 우선순위가 높은 쪽이 이긴다. 자기와 같은 ref를 확장할 때는 **더 낮은 우선순위**에서만 부모를 찾는다
// (그래서 워크스페이스의 `commercial@1`이 내장 `commercial@1`을 확장해도 순환하지 않는다).

export type TemplateSource = 'workspace' | 'global' | 'builtin';
const PRIORITY: TemplateSource[] = ['workspace', 'global', 'builtin'];

/** 디스크에서 읽은 템플릿 폴더(Rust `read_template_folders`의 결과). */
export interface RawTemplateFolder {
  dirName: string;
  files: Record<string, string>;
  skipped: string[];
}

export interface CatalogEntry {
  ref: string;
  source: TemplateSource;
  type?: SceneType;
  /** 부모까지 병합한 사용 가능한 템플릿. 오류가 있으면 없다. */
  template?: GuideTemplate;
  /** 사용을 거부하는 이유(검증 실패·부모 없음·순환 등). */
  error?: string;
  /** 읽다가 건너뛴 파일들(너무 큼·심링크…). */
  skipped: string[];
}

export interface Catalog {
  /** 모든 항목(사용 가능 + 거부). 같은 ref는 우선순위가 높은 것만 `usable`로 취급한다. */
  entries: CatalogEntry[];
  /** 사용 가능한 템플릿(같은 ref는 우선순위 최상위 하나). */
  usable(type?: SceneType): CatalogEntry[];
  get(ref: string): CatalogEntry | null;
}

const MAX_DEPTH = 6;

interface RawEntry {
  ref: string;
  source: TemplateSource;
  skipped: string[];
  raw?: GuideTemplate;
  error?: string;
}

function parseFolder(f: RawTemplateFolder, source: TemplateSource): RawEntry {
  try {
    const t = buildTemplate(f.files);
    if (f.dirName !== t.ref) throw new TemplateError(`folder name ${f.dirName} does not match template ${t.ref}`);
    return { ref: t.ref, source, skipped: f.skipped, raw: t };
  } catch (e) {
    return { ref: f.dirName, source, skipped: f.skipped, error: e instanceof Error ? e.message : String(e) };
  }
}

export function buildCatalog(builtin: GuideTemplate[], global: RawTemplateFolder[] = [], workspace: RawTemplateFolder[] = []): Catalog {
  const raws: RawEntry[] = [
    ...workspace.map((f) => parseFolder(f, 'workspace')),
    ...global.map((f) => parseFolder(f, 'global')),
    ...builtin.map((t): RawEntry => ({ ref: t.ref, source: 'builtin', skipped: [], raw: t })),
  ];

  const resolved = new Map<RawEntry, { template?: GuideTemplate; error?: string }>();

  function resolve(entry: RawEntry, depth: number): { template?: GuideTemplate; error?: string } {
    const hit = resolved.get(entry);
    if (hit) return hit;
    let result: { template?: GuideTemplate; error?: string };
    if (entry.error || !entry.raw) {
      result = { error: entry.error ?? 'unreadable template' };
    } else if (entry.raw.meta.extends === null) {
      result = { template: entry.raw };
    } else if (depth >= MAX_DEPTH) {
      result = { error: `${entry.ref}: extends chain too deep` };
    } else {
      const parentRef = entry.raw.meta.extends;
      const lower = PRIORITY.slice(PRIORITY.indexOf(entry.source) + 1);
      // 같은 ref를 확장할 때만 더 낮은 우선순위에서 찾는다(순환 방지). 다른 ref는 어느 출처에서든 찾는다(가장 높은 우선순위 먼저).
      const parentEntry = raws.find((r) => r.ref === parentRef && !r.error && (parentRef !== entry.ref || lower.includes(r.source)));
      if (!parentEntry) {
        result = { error: `${entry.ref}: parent ${parentRef} not found` };
      } else {
        const parent = resolve(parentEntry, depth + 1);
        if (!parent.template) {
          result = { error: `${entry.ref}: parent ${parentRef} is not usable (${parent.error})` };
        } else {
          try {
            result = { template: mergeTemplate(entry.raw, parent.template) };
          } catch (e) {
            result = { error: e instanceof Error ? e.message : String(e) };
          }
        }
      }
    }
    resolved.set(entry, result);
    return result;
  }

  const entries: CatalogEntry[] = raws.map((r) => {
    const res = resolve(r, 0);
    return { ref: r.ref, source: r.source, type: res.template?.meta.type ?? r.raw?.meta.type, template: res.template, error: res.error, skipped: r.skipped };
  });

  const best = (ref: string): CatalogEntry | null => {
    const candidates = entries.filter((e) => e.ref === ref);
    // 우선순위가 가장 높은 **사용 가능한** 항목. 높은 쪽이 거부되면 낮은 쪽으로 물러서지 않는다(조용한 대체를 막는다).
    for (const src of PRIORITY) {
      const c = candidates.find((e) => e.source === src);
      if (c) return c;
    }
    return null;
  };

  return {
    entries,
    get: best,
    usable(type) {
      const refs = [...new Set(entries.map((e) => e.ref))];
      return refs
        .map((r) => best(r))
        .filter((e): e is CatalogEntry => e !== null && e.template !== undefined && (type === undefined || e.type === type));
    },
  };
}
