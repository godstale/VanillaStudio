// 스타일 라이브러리 공용 렌더러. 앱(src/lib/styles)과 `pnpm vanilla` CLI가 같은 바이트를 내도록 이 파일 하나만 쓴다.
// 본문은 에이전트에게 보내는 규칙이라 번역하지 않는다(AGENTS.md §3).

export const STYLE_SCOPES = ['scene', 'image', 'motion'];

const SCOPE_TEXT = {
  scene: 'whole scene',
  image: 'still imagery and materials only',
  motion: 'movement and transitions only',
};

const INTRO = [
  'A style names a look. Build it with code; do not call generative image or video services, and do not treat the id as a magic prompt tag.',
  'Palette, type and spacing still come from `DESIGN.md` tokens. Timed scenes stay a pure function of `t`.',
];

function styleBlock(entry, library) {
  const style = library?.styles?.find((s) => s.id === entry.id);
  if (!style) return `- **${entry.id}** (${SCOPE_TEXT[entry.scope]}): not in \`../../STYLE_LIBRARY.json\`; ask the user what it means.`;
  const family = library.families[style.family];
  const lines = [
    `- **${style.id}** (${style.label.en}) — applies to: ${SCOPE_TEXT[entry.scope]}`,
    `  - look: ${style.description.en}`,
    `  - keywords: ${style.keywords.join(', ')}`,
    `  - example: ${style.example}`,
    `  - technique (${style.family}): ${family?.technique ?? ''}`,
  ];
  if (style.ipSensitive) {
    lines.push('  - rights: take only the general look. No existing characters, logos, product shapes or names.');
  }
  return lines.join('\n');
}

/** 신 AGENTS.md의 `styles` 마커 구간. 스타일을 지워도 낡은 내용이 남지 않도록 항상 낸다. */
export function renderStylesSection(styles, library) {
  const chosen = styles ?? [];
  if (chosen.length === 0) {
    return [
      '## Visual styles',
      '',
      'No style is selected. When the user names a look, search `../../STYLE_LIBRARY.json` (or run `pnpm vanilla styles --query <word>`) and record the id in `scene.json` `styles`.',
    ].join('\n');
  }
  return ['## Visual styles', '', ...INTRO, '', ...chosen.map((e) => styleBlock(e, library))].join('\n');
}

/** GUIDE.md의 스타일 절 본문. */
export function renderStylesGuide(styles) {
  return styles.map((e) => `- \`${e.id}\` (${SCOPE_TEXT[e.scope]})`).join('\n');
}

/** id·라벨·키워드·원본 태그에서 찾는다. 앱 검색과 CLI가 같은 결과를 낸다. */
export function matchesStyle(style, query) {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return [style.id, style.sourceTag, style.label.ko, style.label.en, style.description.ko, style.description.en, style.family, ...style.keywords]
    .some((v) => v.toLowerCase().includes(q));
}
