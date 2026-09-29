import type { Rule } from 'eslint';
import type { Expression, MemberExpression, Super } from 'estree';
import { isClockContract } from '../settings';

const GLOBAL_ROOTS = new Set(['window', 'globalThis', 'self']);

/** `a.b.c` for a non-computed member chain / identifier, without a leading window/globalThis/self. */
function pathOf(node: Expression | Super): string | null {
  const parts: string[] = [];
  let cur: Expression | Super = node;
  while (cur.type === 'MemberExpression') {
    const m: MemberExpression = cur;
    if (m.computed || m.property.type !== 'Identifier') return null;
    parts.unshift(m.property.name);
    cur = m.object;
  }
  if (cur.type !== 'Identifier') return null;
  parts.unshift(cur.name);
  if (parts.length > 1 && GLOBAL_ROOTS.has(parts[0])) parts.shift();
  return parts.join('.');
}

const FORBIDDEN_MEMBERS: Record<string, string> = {
  'Date.now': 'Date.now() differs on every render. Use useTime().',
  'performance.now': 'performance.now() differs on every render. Use useTime().',
  'Math.random': 'Math.random() is not repeatable. Use useSeededRandom(seed) or noise2D/noise3D.',
};
const FORBIDDEN_CALLS: Record<string, string> = {
  requestAnimationFrame: 'Own requestAnimationFrame loops are not driven by the Vanilla clock. Derive animation from useTime().',
  setInterval: 'setInterval is not driven by the Vanilla clock. Derive animation from useTime().',
};

/** Clock-contract scenes (video, image, slides) must be pure functions of `t`. */
export const noForbiddenTimeApi: Rule.RuleModule = {
  meta: {
    type: 'problem',
    docs: { description: 'Disallow wall-clock, unseeded random and self-driven loops in clock-contract scenes' },
    schema: [],
    messages: { forbidden: '{{detail}}', bareDate: 'new Date() without arguments reads the wall clock. Pass an explicit timestamp.' },
  },
  create(context) {
    if (!isClockContract(context)) return {};
    return {
      MemberExpression(node) {
        const path = pathOf(node);
        const detail = path ? FORBIDDEN_MEMBERS[path] : undefined;
        if (detail) context.report({ node, messageId: 'forbidden', data: { detail } });
      },
      CallExpression(node) {
        const path = pathOf(node.callee);
        const detail = path ? FORBIDDEN_CALLS[path] : undefined;
        if (detail) context.report({ node, messageId: 'forbidden', data: { detail } });
        else if (path === 'Date') context.report({ node, messageId: 'bareDate' });
      },
      NewExpression(node) {
        if (pathOf(node.callee) === 'Date' && node.arguments.length === 0) context.report({ node, messageId: 'bareDate' });
      },
    };
  },
};
