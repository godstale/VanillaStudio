import { invoke } from '@tauri-apps/api/core';
import { ZodError } from 'zod';
import { projectPath } from '@/lib/workspace/files';
import { WORKSPACE_TEMPLATES_DIR } from './catalog';
import { configurableFields, mergeTemplate } from './merge';
import { buildTemplate, PROMPT_NAMES, type CustomField, type GuideTemplate, type PromptName, type TemplateFiles } from './template';

// 사용자 정의 템플릿 편집(D-031): 복제 → 필드 추가·숨김·규칙 추가 → 워크스페이스 `guide-templates/<id>@<ver>/`에 저장.
// 내장 스키마를 **확장만** 한다(merge.ts가 규칙을 강제). 편집기는 확장 템플릿(`extends`가 있는 것)만 다룬다.

export interface TemplateDraft {
  id: string;
  version: number;
  type: GuideTemplate['meta']['type'];
  extends: string;
  label: { ko: string; en: string };
  hide: string[];
  /** 새 신에 줄 내장 필드 기본값(신 템플릿으로 저장할 때 채워진다). 편집기는 건드리지 않고 그대로 보존한다. */
  defaults: Record<string, unknown>;
  fields: CustomField[];
  rules: string;
  checklist: string;
  prompts: Record<PromptName, string>;
}

export const draftRef = (d: Pick<TemplateDraft, 'id' | 'version'>) => `${d.id}@${d.version}`;

/** 부모를 복제한 새 초안(아무것도 바꾸지 않은 상태). */
export function duplicateDraft(parent: GuideTemplate, id: string, label: { ko: string; en: string }): TemplateDraft {
  return {
    id,
    version: 1,
    type: parent.meta.type,
    extends: parent.ref,
    label,
    hide: [],
    defaults: {},
    fields: [],
    rules: '',
    checklist: '',
    prompts: { generate: '', 'analyze-reference': '', revise: '' },
  };
}

/** 저장된 확장 템플릿(병합 전)을 편집 초안으로. */
export function draftFromTemplate(t: GuideTemplate): TemplateDraft {
  if (t.meta.extends === null) throw new Error('Built-in templates cannot be edited; duplicate them first');
  return {
    id: t.meta.id,
    version: t.meta.version,
    type: t.meta.type,
    extends: t.meta.extends,
    label: t.meta.label,
    hide: t.schema.hide,
    defaults: t.schema.defaults,
    fields: t.schema.fields,
    rules: t.rules.trim(),
    checklist: t.checklist.trim(),
    prompts: Object.fromEntries(PROMPT_NAMES.map((p) => [p, t.prompts[p].trim()])) as Record<PromptName, string>,
  };
}

const lines = (s: string) => (s.trim() ? `${s.trimEnd()}\n` : '');

/** 초안 → 디스크 파일들. 비어 있는 선택 파일은 쓰지 않는다. */
export function draftToFiles(d: TemplateDraft): TemplateFiles {
  const json = (v: unknown) => `${JSON.stringify(v, null, 2)}\n`;
  const files: TemplateFiles = {
    'template.json': json({ id: d.id, version: d.version, type: d.type, label: d.label, extends: d.extends }),
    'schema.json': json({ version: 1, hide: d.hide, defaults: d.defaults, fields: d.fields }),
  };
  if (d.rules.trim()) files['rules.md'] = lines(d.rules);
  if (d.checklist.trim()) files['checklist.md'] = lines(d.checklist);
  for (const p of PROMPT_NAMES) if (d.prompts[p].trim()) files[`prompts/${p}.md`] = lines(d.prompts[p]);
  return files;
}

/** 저장 전 검증: 형식(buildTemplate)과 확장 규칙(mergeTemplate). 통과하면 병합된 템플릿을 돌려준다. */
export function validateDraft(d: TemplateDraft, parent: GuideTemplate): { ok: true; template: GuideTemplate } | { ok: false; error: string } {
  if (!/^[a-z0-9][a-z0-9-]*$/.test(d.id)) return { ok: false, error: 'id must be lowercase letters, digits and dashes' };
  if (!d.label.ko.trim() || !d.label.en.trim()) return { ok: false, error: 'label needs both languages' };
  if (parent.ref !== d.extends) return { ok: false, error: `parent must be ${d.extends}` };
  try {
    const child = buildTemplate(draftToFiles(d), d.type);
    return { ok: true, template: mergeTemplate(child, parent) };
  } catch (e) {
    return { ok: false, error: describeError(e) };
  }
}

/** zod 오류는 `경로: 메시지`로 읽기 쉽게 바꾼다. */
function describeError(e: unknown): string {
  if (e instanceof ZodError) return e.issues.slice(0, 2).map((i) => `${i.path.join('.') || 'template'}: ${i.message}`).join('; ');
  return e instanceof Error ? e.message : String(e);
}

/** 숨길 수 있는 내장 필드 이름(편집기 체크박스 목록). */
export const hideableFields = (type: TemplateDraft['type']): string[] => configurableFields(type);

/** 워크스페이스 `guide-templates/<ref>/`에 저장한다. */
export async function saveDraft(root: string, d: TemplateDraft): Promise<void> {
  const base = `${WORKSPACE_TEMPLATES_DIR}/${draftRef(d)}`;
  for (const [rel, contents] of Object.entries(draftToFiles(d))) {
    await invoke('write_text_file', { path: projectPath(root, `${base}/${rel}`), contents, workspaceRoot: root });
  }
}
