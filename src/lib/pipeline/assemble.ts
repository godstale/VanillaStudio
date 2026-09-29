import type { Locale } from '@/lib/i18n/types';
import type { ProjectManifest } from '@/lib/types/project';
import buildPreamble from './prompts/build.md?raw';
import planPreamble from './prompts/plan.md?raw';
import promptsPreamble from './prompts/prompts.md?raw';
import revisionPreamble from './prompts/revision.md?raw';
import type { Task } from './schemas/tasks';

export type PromptKind = 'plan' | 'prompts' | 'build' | 'revision';

const PREAMBLES: Record<PromptKind, string> = {
  plan: planPreamble,
  prompts: promptsPreamble,
  build: buildPreamble,
  revision: revisionPreamble,
};

/** 단계별 기본 참조 파일(프로젝트 루트 기준). 본문을 복사하지 않고 경로만 넘긴다(설계서 §3.4). */
const BASE_REFS: Record<PromptKind, string[]> = {
  plan: ['AGENTS.md', 'vanilla.json', 'DESIGN.md', 'brief/brief.md', 'brief/materials/'],
  prompts: ['AGENTS.md', 'vanilla.json', 'DESIGN.md', 'plan/plan.md', 'plan/plan.json'],
  build: ['AGENTS.md', 'DESIGN.md', 'plan/plan.json', 'prompts/00-master.md'],
  revision: ['AGENTS.md', 'DESIGN.md', 'plan/plan.json'],
};

const LANGUAGE_NAME: Record<Locale, string> = { ko: 'Korean', en: 'English' };

export interface AssembleInput {
  kind: PromptKind;
  /** 사용자 로케일. 에이전트가 쓰는 사람용 문장의 언어를 정한다. */
  locale: Locale;
  project?: Pick<ProjectManifest, 'outputType' | 'format'>;
  /** 기본 목록에 더할 참조 파일. */
  refs?: string[];
  /** build: 실행할 태스크. 그 프롬프트 파일이 참조 목록에 들어간다. */
  task?: Pick<Task, 'id' | 'kind' | 'target' | 'prompt' | 'dependsOn'>;
  /** revision: 수정 요청 파일 경로(예: reviews/R-001.md). */
  reviewFile?: string;
  /** 검증 실패 후 재요청할 때 붙일 오류 목록. */
  errors?: string[];
  /** 사용자가 직접 쓴 요청·코멘트. */
  userInput?: string;
}

function normalizePath(path: string): string {
  const p = path.replace(/\\/g, '/');
  if (/^([A-Za-z]:|\/)/.test(p) || p.split('/').includes('..') || p.trim() === '') {
    throw new Error(`Reference path must be relative and inside the project: ${path}`);
  }
  return p;
}

function tidy(text: string): string {
  return text.replace(/\r\n/g, '\n').trim();
}

function projectSummary(project: NonNullable<AssembleInput['project']>): string {
  const { width, height, fps, durationSec, slideCount, variants } = project.format;
  const parts = [`output type: ${project.outputType}`, `size: ${width}x${height}`];
  if (fps !== undefined) parts.push(`fps: ${fps}`);
  if (durationSec !== undefined) parts.push(`duration: ${durationSec}s`);
  if (slideCount !== undefined) parts.push(`slides: ${slideCount}`);
  if (variants?.length) {
    parts.push(`variants: ${variants.map((v) => `${v.width}x${v.height}`).join(', ')}`);
  }
  return parts.map((p) => `- ${p}`).join('\n');
}

/**
 * 에이전트에 보낼 프롬프트를 조립한다:
 * 프리앰블(영문) + 프로젝트 요약 + 참조 파일 경로 + 출력 언어 + (태스크·오류) + 사용자 입력.
 */
export function assemblePrompt(input: AssembleInput): string {
  if (input.kind === 'build' && !input.task) throw new Error('build prompt requires a task');
  if (input.kind === 'revision' && !input.reviewFile) {
    throw new Error('revision prompt requires a review file');
  }

  const refs: string[] = [];
  const push = (path: string | undefined) => {
    if (!path) return;
    const p = normalizePath(path);
    if (!refs.includes(p)) refs.push(p);
  };
  BASE_REFS[input.kind].forEach(push);
  push(input.task?.prompt);
  push(input.reviewFile);
  input.refs?.forEach(push);

  const sections: string[] = [tidy(PREAMBLES[input.kind])];

  if (input.project) sections.push(`## Project\n\n${projectSummary(input.project)}`);

  sections.push(
    `## Reference files\n\nRead these files yourself; paths are relative to the project root.\n\n${refs
      .map((r) => `- \`${r}\``)
      .join('\n')}`,
  );

  if (input.task) {
    const t = input.task;
    const lines = [
      `- id: ${t.id}`,
      `- kind: ${t.kind}`,
      t.target ? `- target: ${t.target}` : null,
      `- prompt file: \`${normalizePath(t.prompt)}\``,
      t.dependsOn.length > 0 ? `- depends on (already done): ${t.dependsOn.join(', ')}` : null,
    ].filter((l): l is string => l !== null);
    sections.push(`## Task\n\n${lines.join('\n')}`);
  }

  sections.push(
    `## Output language\n\nWrite all human-readable text in ${LANGUAGE_NAME[input.locale]}. Keep file names, ids, code and JSON keys in English.`,
  );

  if (input.errors && input.errors.length > 0) {
    sections.push(
      `## Validation errors to fix\n\nYour previous output failed validation. Fix every item below and rewrite the affected files.\n\n${input.errors
        .map((e) => `- ${e}`)
        .join('\n')}`,
    );
  }

  const user = input.userInput?.trim();
  if (user) sections.push(`## User request\n\n${user}`);

  return `${sections.join('\n\n')}\n`;
}
