// @vanilla/runtime/eslint-plugin: static checks behind `check_scene` (Technical-Design §4.3).
// Usage (flat config): `import vanilla from '@vanilla/runtime/eslint-plugin'; export default [...vanilla.configs.recommended]`
// and pass `settings: { vanilla: { sceneType } }` from vanilla.json so time rules skip free-mode types.
import type { ESLint, Linter } from 'eslint';
import { noForbiddenTimeApi } from './rules/noForbiddenTimeApi';
import { noHardcodedColors } from './rules/noHardcodedColors';
import { requireDefineScene } from './rules/requireDefineScene';

export { colorLiterals, findHardcodedColors } from './colors';
export type { SceneType } from './settings';

const plugin: ESLint.Plugin & { configs: { recommended: Linter.Config[] } } = {
  meta: { name: '@vanilla/eslint-plugin' },
  rules: {
    'no-forbidden-time-api': noForbiddenTimeApi,
    'no-hardcoded-colors': noHardcodedColors,
    'require-define-scene': requireDefineScene,
  },
  configs: { recommended: [] },
};

plugin.configs.recommended = [
  {
    plugins: { vanilla: plugin },
    rules: {
      'vanilla/no-forbidden-time-api': 'error',
      'vanilla/no-hardcoded-colors': 'warn',
      'vanilla/require-define-scene': 'error',
    },
  },
];

export default plugin;
