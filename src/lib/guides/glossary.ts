import type { Glossary, Term } from './template';

// 용어집 조회 도우미. 스키마·로딩은 template.ts(템플릿의 glossary.json).

export type Locale = 'ko' | 'en';

export function categories(g: Glossary): string[] {
  return [...new Set(g.terms.map((t) => t.category))];
}

export function termsIn(g: Glossary, category: string): Term[] {
  return g.terms.filter((t) => t.category === category);
}

export function findTerm(g: Glossary, category: string, id: string): Term | undefined {
  return g.terms.find((t) => t.category === category && t.id === id);
}

/** 저장된 값(ID 또는 자유 입력)을 표시 문자열로. 용어집에 없으면 입력 그대로다. */
export function termLabel(g: Glossary, category: string, value: string, locale: Locale): string {
  return findTerm(g, category, value)?.label[locale] ?? value;
}

/** 검색: 라벨(ko·en)·id·태그에 부분 일치(대소문자 무시). 빈 검색어는 전체. */
export function searchTerms(g: Glossary, category: string, query: string): Term[] {
  const q = query.trim().toLowerCase();
  const all = termsIn(g, category);
  if (!q) return all;
  return all.filter((t) => [t.id, t.label.ko, t.label.en, ...t.tags].some((x) => x.toLowerCase().includes(q)));
}

/** 값 중 용어집에 없는 것(자유 입력)과 있는 것을 가른다. */
export function splitValues(g: Glossary, category: string, values: readonly string[]): { known: string[]; custom: string[] } {
  const known: string[] = [];
  const custom: string[] = [];
  for (const v of values) (findTerm(g, category, v) ? known : custom).push(v);
  return { known, custom };
}
