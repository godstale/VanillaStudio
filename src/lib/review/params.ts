// Scene parameter values for the review panel (T4.14, F-REV-03). The schema arrives with the Bridge
// `ready`; user values live in `params/<sceneId>.values.json` (user-owned, AGENTS.md section 4.3) and
// win over schema defaults, like the runtime's own resolution (code < token < user value).
import { invoke } from '@tauri-apps/api/core';
import { projectPath } from '@/lib/pipeline/briefFiles';
import { readOptionalFile } from '@/lib/pipeline/planFiles';
import type { ParamDef, ParamSchema } from './bridgeProtocol';

export type ParamValues = Record<string, unknown>;

/** Save debounce: typing still reflects instantly, the file settles afterwards. */
export const PARAMS_SAVE_DELAY_MS = 500;

export function valuesRelPath(sceneId: string): string {
  return `params/${sceneId}.values.json`;
}

export function defaultValues(schema: ParamSchema): ParamValues {
  const out: ParamValues = {};
  for (const [key, def] of Object.entries(schema)) out[key] = def.default;
  return out;
}

/** Keep a raw value only if it fits the definition (mirrors runtime `coerceParam`). */
export function coerceValue(def: ParamDef, raw: unknown): unknown {
  switch (def.kind) {
    case 'number': {
      if (typeof raw !== 'number' || !Number.isFinite(raw)) return undefined;
      return Math.min(def.max ?? Infinity, Math.max(def.min ?? -Infinity, raw));
    }
    case 'boolean':
      return typeof raw === 'boolean' ? raw : undefined;
    case 'select':
      return typeof raw === 'string' && def.options.includes(raw) ? raw : undefined;
    case 'color':
    case 'text':
      return typeof raw === 'string' && (def.kind === 'text' || raw.trim() !== '') ? raw : undefined;
  }
}

/** Parse a values file: unparseable content becomes empty, unknown keys and bad types are dropped. */
export function parseValuesFile(schema: ParamSchema, text: string): ParamValues {
  let raw: unknown;
  try {
    raw = JSON.parse(text) as unknown;
  } catch {
    return {};
  }
  if (typeof raw !== 'object' || raw === null) return {};
  const record = raw as Record<string, unknown>;
  const out: ParamValues = {};
  for (const [key, def] of Object.entries(schema)) {
    const v = coerceValue(def, record[key]);
    if (v !== undefined) out[key] = v;
  }
  return out;
}

/** Effective values: file values over schema defaults. */
export function effectiveValues(schema: ParamSchema, file: ParamValues): ParamValues {
  return { ...defaultValues(schema), ...file };
}

export async function loadSceneValues(root: string, sceneId: string, schema: ParamSchema): Promise<ParamValues> {
  const text = await readOptionalFile(root, valuesRelPath(sceneId));
  return text === null ? {} : parseValuesFile(schema, text);
}

export async function saveSceneValues(root: string, sceneId: string, values: ParamValues): Promise<void> {
  await invoke('write_text_file', {
    path: projectPath(root, valuesRelPath(sceneId)),
    contents: `${JSON.stringify(values, null, 2)}\n`,
    workspaceRoot: root,
  });
}
