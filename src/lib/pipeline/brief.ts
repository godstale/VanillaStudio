import { isColor } from '@/lib/design/color';

/** brief/brief.md 형식 버전(머리 주석에 기록). 형식을 바꾸면 파서와 함께 올린다. */
export const BRIEF_FORMAT_VERSION = 1;

export interface BriefMaterial {
  /** brief/materials/ 안의 파일 이름 */
  file: string;
  license: string;
  source: string;
}

export interface Brief {
  purpose: string;
  audience: string;
  keyMessage: string;
  tone: string[];
  brandColors: string[];
  brandFonts: string[];
  mustInclude: string[];
  mustAvoid: string[];
  references: string[];
  materials: BriefMaterial[];
  notes: string;
}

export const BRIEF_PATH = 'brief/brief.md';
export const MATERIALS_DIR = 'brief/materials';

export function emptyBrief(): Brief {
  return {
    purpose: '',
    audience: '',
    keyMessage: '',
    tone: [],
    brandColors: [],
    brandFonts: [],
    mustInclude: [],
    mustAvoid: [],
    references: [],
    materials: [],
    notes: '',
  };
}

// Section headings are fixed English so the file parses the same in every UI language.
const TEXT_SECTIONS = [
  ['Purpose', 'purpose'],
  ['Audience', 'audience'],
  ['Key message', 'keyMessage'],
  ['Notes', 'notes'],
] as const;

const LIST_SECTIONS = [
  ['Tone', 'tone'],
  ['Brand colors', 'brandColors'],
  ['Brand fonts', 'brandFonts'],
  ['Must include', 'mustInclude'],
  ['Must avoid', 'mustAvoid'],
  ['References', 'references'],
] as const;

const oneLine = (s: string) => s.replace(/\s*[\r\n]+\s*/g, ' ').trim();
const cell = (s: string) => oneLine(s).replace(/\|/g, '/');

// A body line that starts with "#" would look like a heading, so it is escaped with a backslash.
const escapeBody = (s: string) => s.replace(/^(\\*#)/gm, '\\$1');
const unescapeBody = (s: string) => s.replace(/^\\(\\*#)/gm, '$1');

export function serializeBrief(brief: Brief): string {
  const out: string[] = [`<!-- vanilla-brief v${BRIEF_FORMAT_VERSION} -->`, '', '# Brief', ''];
  const text = (title: string, value: string) => {
    out.push(`## ${title}`, '');
    if (value.trim()) out.push(escapeBody(value.trim()), '');
  };
  for (const [title, key] of TEXT_SECTIONS.slice(0, 3)) text(title, brief[key]);
  for (const [title, key] of LIST_SECTIONS) {
    out.push(`## ${title}`, '');
    for (const item of brief[key]) if (oneLine(item)) out.push(`- ${oneLine(item)}`);
    out.push('');
  }
  out.push('## Materials', '');
  for (const m of brief.materials) {
    out.push(`- ${cell(m.file)} | license: ${cell(m.license)} | source: ${cell(m.source)}`);
  }
  out.push('');
  text('Notes', brief.notes);
  return `${out.join('\n').trimEnd()}\n`;
}

function splitSections(text: string): Map<string, string> {
  const sections = new Map<string, string>();
  let title: string | null = null;
  let body: string[] = [];
  const flush = () => {
    if (title !== null) sections.set(title, body.join('\n').trim());
  };
  for (const line of text.replace(/\r\n/g, '\n').split('\n')) {
    const m = /^## (.+?)\s*$/.exec(line);
    if (m) {
      flush();
      title = m[1];
      body = [];
    } else if (title !== null) {
      body.push(line);
    }
  }
  flush();
  return sections;
}

function parseList(body: string | undefined): string[] {
  if (!body) return [];
  return body
    .split('\n')
    .map((l) => /^- (.*)$/.exec(l.trim())?.[1]?.trim() ?? '')
    .filter((l) => l.length > 0);
}

function parseMaterials(body: string | undefined): BriefMaterial[] {
  return parseList(body).map((line) => {
    const [file, ...rest] = line.split(' | ');
    const field = (name: string) =>
      rest.find((r) => r.startsWith(`${name}: `))?.slice(name.length + 2) ?? '';
    return { file: file.trim(), license: field('license'), source: field('source') };
  });
}

/** 사람이 손으로 고친 brief.md도 읽을 수 있게, 모르는 섹션은 무시하고 빠진 섹션은 빈 값으로 둔다. */
export function parseBrief(text: string): Brief {
  const sections = splitSections(text);
  const brief = emptyBrief();
  for (const [title, key] of TEXT_SECTIONS) {
    brief[key] = unescapeBody(sections.get(title) ?? '');
  }
  for (const [title, key] of LIST_SECTIONS) {
    brief[key] = parseList(sections.get(title));
  }
  brief.materials = parseMaterials(sections.get('Materials'));
  return brief;
}

export interface BriefIssue {
  field: 'purpose' | 'brandColors';
  /** 잘못된 항목(있다면) */
  value?: string;
}

/** 저장은 막지 않지만 화면에서 경고할 문제. 브랜드 색은 hex만 받는다(DESIGN.md로 이어지므로). */
export function validateBrief(brief: Brief): BriefIssue[] {
  const issues: BriefIssue[] = [];
  if (!brief.purpose.trim()) issues.push({ field: 'purpose' });
  for (const c of brief.brandColors) {
    if (!/^#[0-9a-fA-F]{3,8}$/.test(c) || !isColor(c)) issues.push({ field: 'brandColors', value: c });
  }
  return issues;
}

/** 목록 입력칸(줄마다 한 항목) ↔ 배열 변환. */
export const linesToList = (text: string): string[] =>
  text.split('\n').map((l) => l.trim()).filter(Boolean);
export const listToLines = (list: string[]): string => list.join('\n');

/** 같은 이름이 있으면 `name-2.ext`처럼 번호를 붙인다. */
export function uniqueFileName(name: string, existing: readonly string[]): string {
  const taken = new Set(existing.map((n) => n.toLowerCase()));
  if (!taken.has(name.toLowerCase())) return name;
  const dot = name.lastIndexOf('.');
  const base = dot > 0 ? name.slice(0, dot) : name;
  const ext = dot > 0 ? name.slice(dot) : '';
  for (let i = 2; ; i += 1) {
    const candidate = `${base}-${i}${ext}`;
    if (!taken.has(candidate.toLowerCase())) return candidate;
  }
}
