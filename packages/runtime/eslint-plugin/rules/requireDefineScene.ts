import type { Rule } from 'eslint';
import type { CallExpression, ExportDefaultDeclaration, Node } from 'estree';

const isDefineSceneCall = (node: Node | ExportDefaultDeclaration['declaration'] | null | undefined): node is CallExpression =>
  !!node && node.type === 'CallExpression' && node.callee.type === 'Identifier' && node.callee.name === 'defineScene';

/** A scene module must default-export `defineScene({...})` so the runtime can register and list it. */
export const requireDefineScene: Rule.RuleModule = {
  meta: {
    type: 'problem',
    docs: { description: 'Require scene modules to default-export defineScene(...)' },
    schema: [],
    messages: {
      missing: 'Scene module has no defineScene(...) call.',
      notDefault: 'defineScene(...) must be the default export of the scene module.',
    },
  },
  create(context) {
    let called = false;
    let defaultExport: ExportDefaultDeclaration['declaration'] | null = null;
    const declared = new Map<string, boolean>(); // variable name -> initialised with defineScene(...)

    return {
      CallExpression(node) {
        if (isDefineSceneCall(node)) called = true;
      },
      VariableDeclarator(node) {
        if (node.id.type === 'Identifier') declared.set(node.id.name, isDefineSceneCall(node.init));
      },
      ExportDefaultDeclaration(node) {
        defaultExport = node.declaration;
      },
      'Program:exit'(program) {
        if (!called) return context.report({ node: program, messageId: 'missing', loc: { line: 1, column: 0 } });
        const d = defaultExport;
        const ok = !!d && (isDefineSceneCall(d) || (d.type === 'Identifier' && declared.get(d.name) === true));
        if (!ok) context.report({ node: program, messageId: 'notDefault', loc: { line: 1, column: 0 } });
      },
    };
  },
};
