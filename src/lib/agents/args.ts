// 설정 화면의 "추가 인자" 입력 한 줄 ↔ argv 배열. 셸이 아니므로 변수·파이프·리다이렉션은 해석하지 않는다.
// 공백으로 나누되 큰따옴표 안의 공백은 유지한다. 닫히지 않은 따옴표는 오류다.

export function parseArgs(text: string): { ok: true; args: string[] } | { ok: false; error: string } {
  const args: string[] = [];
  let cur = '';
  let inQuote = false;
  let has = false; // 빈 따옴표 ""도 하나의 인자
  for (const ch of text) {
    if (ch === '"') {
      inQuote = !inQuote;
      has = true;
    } else if (/\s/.test(ch) && !inQuote) {
      if (has) args.push(cur);
      cur = '';
      has = false;
    } else {
      cur += ch;
      has = true;
    }
  }
  if (inQuote) return { ok: false, error: 'unclosed quote' };
  if (has) args.push(cur);
  return { ok: true, args };
}

/** 공백·따옴표가 든 인자는 큰따옴표로 감싸 parseArgs와 왕복이 되게 한다. */
export function formatArgs(args: readonly string[]): string {
  return args.map((a) => (a === '' || /[\s"]/.test(a) ? `"${a.replace(/"/g, '')}"` : a)).join(' ');
}
