// 마커 렌더(Technical-Design §3.4): `<!-- vanilla:begin:<id> -->` ~ `<!-- vanilla:end:<id> -->` 안만 앱이 쓴다.
// 마커 밖(사용자·에이전트가 덧붙인 내용)은 바이트 그대로 보존한다.

export interface MarkerSection {
  id: string;
  body: string;
}

const ID = /^[a-z0-9][a-z0-9-]*$/;

export const beginMarker = (id: string) => `<!-- vanilla:begin:${id} -->`;
export const endMarker = (id: string) => `<!-- vanilla:end:${id} -->`;

function block(section: MarkerSection): string {
  if (!ID.test(section.id)) throw new Error(`Invalid marker id: ${section.id}`);
  if (section.body.includes('<!-- vanilla:')) throw new Error(`Section ${section.id} body must not contain markers`);
  return `${beginMarker(section.id)}\n${section.body.replace(/\n+$/, '')}\n${endMarker(section.id)}`;
}

/** 파일 전체를 앱이 소유할 때(마커 없이 본문만)도 같은 줄바꿈 규칙을 쓴다. */
export function normalizeEol(text: string): string {
  return text.replace(/\r\n/g, '\n');
}

/** 마커 구간의 시작·끝 위치를 찾는다. 짝이 맞지 않으면 던진다(파일을 망가뜨리지 않기 위해). */
function locate(text: string, id: string): { start: number; end: number } | null {
  const b = beginMarker(id);
  const e = endMarker(id);
  const start = text.indexOf(b);
  const endAt = text.indexOf(e);
  if (start === -1 && endAt === -1) return null;
  if (start === -1 || endAt === -1) throw new Error(`Unbalanced marker for ${id}`);
  if (endAt < start) throw new Error(`Marker end before begin for ${id}`);
  if (text.indexOf(b, start + 1) !== -1 || text.indexOf(e, endAt + 1) !== -1) {
    throw new Error(`Duplicate marker for ${id}`);
  }
  return { start, end: endAt + e.length };
}

/**
 * `existing`(없으면 null)에 섹션을 반영한 새 텍스트를 돌려준다.
 * - 이미 있는 구간: 그 안만 교체, 밖은 보존.
 * - 없는 구간: 파일 끝에 덧붙인다.
 * - existing이 null: 섹션들을 빈 줄로 이어 새로 만든다.
 */
export function applyMarkers(existing: string | null, sections: MarkerSection[]): string {
  const ids = sections.map((s) => s.id);
  if (new Set(ids).size !== ids.length) throw new Error('Duplicate section ids');
  if (existing === null) return `${sections.map(block).join('\n\n')}\n`;

  let text = normalizeEol(existing);
  const missing: MarkerSection[] = [];
  for (const section of sections) {
    const loc = locate(text, section.id);
    if (!loc) {
      missing.push(section);
      continue;
    }
    text = text.slice(0, loc.start) + block(section) + text.slice(loc.end);
  }
  if (missing.length > 0) {
    text = `${text.replace(/\n*$/, '\n')}\n${missing.map(block).join('\n\n')}\n`;
  }
  return text;
}

/** 마커 구간 안의 현재 본문. 구간이 없으면 null. */
export function readSection(text: string, id: string): string | null {
  const src = normalizeEol(text);
  const loc = locate(src, id);
  if (!loc) return null;
  const inner = src.slice(loc.start + beginMarker(id).length, loc.end - endMarker(id).length);
  return inner.replace(/^\n/, '').replace(/\n$/, '');
}

/** 마커 밖 텍스트(구간들을 지운 나머지). 보존 검증용. */
export function outsideMarkers(text: string): string {
  return normalizeEol(text).replace(/<!-- vanilla:begin:([a-z0-9-]+) -->[\s\S]*?<!-- vanilla:end:\1 -->/g, '');
}
