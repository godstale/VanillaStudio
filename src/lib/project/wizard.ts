import { invoke } from '@tauri-apps/api/core';
import {
  AGENT_IDS,
  OUTPUT_TYPES,
  type AgentId,
  type OutputType,
  type ProjectFormat,
  type ProjectManifest,
} from '@/lib/types/project';
import { parseProjectManifest, VANILLA_MANIFEST_VERSION } from './schema';

export interface FormatPreset {
  id: string;
  labelKey: string;
  width: number;
  height: number;
}

/** 유형별 규격 프리셋. 첫 항목이 기본값. */
export const FORMAT_PRESETS: Record<OutputType, FormatPreset[]> = {
  web: [
    { id: 'desktop', labelKey: 'project.preset.desktop', width: 1440, height: 900 },
    { id: 'mobile', labelKey: 'project.preset.mobile', width: 390, height: 844 },
  ],
  interactive: [
    { id: 'landscape', labelKey: 'project.preset.landscape', width: 1920, height: 1080 },
    { id: 'square', labelKey: 'project.preset.square', width: 1080, height: 1080 },
  ],
  slides: [
    { id: 'wide', labelKey: 'project.preset.wide', width: 1920, height: 1080 },
    { id: 'standard', labelKey: 'project.preset.standard', width: 1440, height: 1080 },
  ],
  image: [
    { id: 'square', labelKey: 'project.preset.square', width: 1080, height: 1080 },
    { id: 'portrait', labelKey: 'project.preset.portrait', width: 1080, height: 1350 },
    { id: 'landscape', labelKey: 'project.preset.landscape', width: 1920, height: 1080 },
    { id: 'og', labelKey: 'project.preset.og', width: 1200, height: 630 },
  ],
  video: [
    { id: 'landscape', labelKey: 'project.preset.landscape', width: 1920, height: 1080 },
    { id: 'vertical', labelKey: 'project.preset.vertical', width: 1080, height: 1920 },
    { id: 'square', labelKey: 'project.preset.square', width: 1080, height: 1080 },
    { id: 'hd', labelKey: 'project.preset.hd', width: 1280, height: 720 },
  ],
};

export const FPS_OPTIONS = [24, 30, 60] as const;
export const DEFAULT_FPS = 30;
export const DEFAULT_DURATION_SEC = 30;
export const DEFAULT_SLIDE_COUNT = 10;

export interface WizardValues {
  name: string;
  outputType: OutputType;
  presetId: string;
  fps: number;
  durationSec: number;
  slideCount: number;
  agent: AgentId;
  /** 부모 폴더 절대 경로 */
  parentDir: string;
  /** Built-in template id (gallery selection, W1 wiring). null = 없음 */
  templateId: string | null;
}

export function defaultWizardValues(): WizardValues {
  return {
    name: '',
    outputType: OUTPUT_TYPES[0],
    presetId: FORMAT_PRESETS[OUTPUT_TYPES[0]][0].id,
    fps: DEFAULT_FPS,
    durationSec: DEFAULT_DURATION_SEC,
    slideCount: DEFAULT_SLIDE_COUNT,
    agent: AGENT_IDS[0],
    parentDir: '',
    templateId: null,
  };
}

/** 유형을 바꾸면 규격 프리셋을 그 유형의 기본값으로 되돌린다. */
export function withOutputType(v: WizardValues, outputType: OutputType): WizardValues {
  return { ...v, outputType, presetId: FORMAT_PRESETS[outputType][0].id };
}

export function buildFormat(v: WizardValues): ProjectFormat {
  const presets = FORMAT_PRESETS[v.outputType];
  const p = presets.find((x) => x.id === v.presetId) ?? presets[0];
  const format: ProjectFormat = { width: p.width, height: p.height };
  if (v.outputType === 'video') {
    format.fps = v.fps;
    format.durationSec = v.durationSec;
  } else if (v.outputType === 'slides') {
    format.slideCount = v.slideCount;
  }
  return format;
}

/** 새 프로젝트의 vanilla.json. 팔레트는 기본 고정(설계서: 웨이브 2 범위). */
export function buildManifest(v: WizardValues, now: Date = new Date()): ProjectManifest {
  return {
    version: VANILLA_MANIFEST_VERSION,
    name: v.name.trim(),
    outputType: v.outputType,
    format: buildFormat(v),
    template: v.templateId ? { id: v.templateId } : null,
    palette: { id: 'vanilla-default', source: 'builtin' },
    agents: { default: v.agent, enabled: [v.agent] },
    runtime: { version: '0.0.0' },
    createdAt: now.toISOString(),
  };
}

/** 프로젝트 이름에서 폴더 이름을 만든다. Rust의 검증을 통과하는 단일 경로 요소. */
export function toFolderName(name: string): string {
  const cleaned = name
    .trim()
    // eslint-disable-next-line no-control-regex
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, '-')
    .replace(/\s+/g, ' ')
    .replace(/[. ]+$/, '');
  return cleaned.slice(0, 100);
}

export type WizardErrorKey =
  | 'project.error.nameRequired'
  | 'project.error.folderRequired'
  | 'project.error.invalidManifest'
  | 'project.error.folderName';

export type ValidationResult =
  | { ok: true; manifest: ProjectManifest; manifestJson: string; folderName: string }
  | { ok: false; errorKey: WizardErrorKey; detail?: string };

export function validateWizard(v: WizardValues, now?: Date): ValidationResult {
  if (!v.name.trim()) return { ok: false, errorKey: 'project.error.nameRequired' };
  if (!v.parentDir.trim()) return { ok: false, errorKey: 'project.error.folderRequired' };
  const folderName = toFolderName(v.name);
  if (!folderName) return { ok: false, errorKey: 'project.error.folderName' };
  const manifest = buildManifest(v, now);
  const manifestJson = JSON.stringify(manifest, null, 2);
  const parsed = parseProjectManifest(manifestJson);
  if (!parsed.ok) {
    return { ok: false, errorKey: 'project.error.invalidManifest', detail: parsed.error };
  }
  return { ok: true, manifest: parsed.manifest, manifestJson, folderName };
}

export interface ScaffoldResult {
  path: string;
  files: string[];
}

export function scaffoldProject(
  parentDir: string,
  folderName: string,
  projectName: string,
  manifestJson: string,
): Promise<ScaffoldResult> {
  return invoke<ScaffoldResult>('scaffold_project', {
    parentDir,
    folderName,
    projectName,
    manifestJson,
  });
}
