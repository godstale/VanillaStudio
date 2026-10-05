// vanilla.json 데이터 계약 타입. 스키마의 진실 공급원은 src/lib/migrate/legacy-schema.ts (zod).
export const OUTPUT_TYPES = ['web', 'interactive', 'slides', 'image', 'video'] as const;
export type OutputType = (typeof OUTPUT_TYPES)[number];

export const AGENT_IDS = ['claude-code', 'codex', 'opencode', 'hermes', 'agy'] as const;
export type AgentId = (typeof AGENT_IDS)[number];

export interface ProjectFormat {
  width: number;
  height: number;
  /** video 전용 */
  fps?: number;
  /** video 전용(초) */
  durationSec?: number;
  /** slides 전용 */
  slideCount?: number;
  /** image 전용: 추가 규격 변형 */
  variants?: { width: number; height: number }[];
}

export interface ProjectTemplateRef {
  id: string;
  version?: string;
}

export interface ProjectPaletteRef {
  id: string;
  source: 'builtin' | 'user' | 'extracted' | 'generated';
}

export interface ProjectRuntimeRef {
  /** @vanilla/runtime 버전(semver) */
  version: string;
}

export interface ProjectManifest {
  version: 1;
  name: string;
  outputType: OutputType;
  format: ProjectFormat;
  /** 디자인 템플릿. 없음 = null */
  template: ProjectTemplateRef | null;
  palette: ProjectPaletteRef;
  agents: { default: AgentId; enabled: AgentId[] };
  runtime: ProjectRuntimeRef;
  createdAt: string;
}
