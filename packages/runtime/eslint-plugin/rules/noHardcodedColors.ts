import type { Rule } from 'eslint';
import { IGNORE_MARKER, colorLiterals } from '../colors';

/** Colors belong in DESIGN.md. `// ds-ignore` on the same or previous line exempts shader constants, alpha overlays, etc. */
export const noHardcodedColors: Rule.RuleModule = {
  meta: {
    type: 'suggestion',
    docs: { description: 'Disallow hex / rgb / hsl color literals that are not design tokens' },
    schema: [],
    messages: { hardcoded: 'Hard-coded color {{value}}. Use var(--color-*) or useDesign() (add `// ds-ignore` if this is deliberate).' },
  },
  create(context) {
    const ignoredLines = new Set<number>();
    for (const c of context.sourceCode.getAllComments()) {
      if (c.value.includes(IGNORE_MARKER) && c.loc) for (let l = c.loc.start.line; l <= c.loc.end.line; l++) ignoredLines.add(l);
    }
    const exempt = (line: number) => ignoredLines.has(line) || ignoredLines.has(line - 1);

    const check = (node: Rule.Node, text: string) => {
      if (!node.loc || exempt(node.loc.start.line) || exempt(node.loc.end.line)) return;
      for (const m of colorLiterals(text)) context.report({ node, messageId: 'hardcoded', data: { value: m.value } });
    };

    return {
      Literal(node) {
        if (typeof node.value !== 'string') return;
        const parent = node.parent as { type: string } | undefined;
        // Module specifiers are not colors.
        if (parent && /^(Import|Export)/.test(parent.type)) return;
        check(node, node.value);
      },
      TemplateElement(node) {
        check(node, node.value.cooked ?? node.value.raw);
      },
    };
  },
};
