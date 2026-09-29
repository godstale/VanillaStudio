// Scene type comes from the project's vanilla.json; check_scene passes it as ESLint
// `settings: { vanilla: { sceneType } }`. Time rules only apply to clock-contract types (D-011).
import type { Rule } from 'eslint';

export type SceneType = 'web' | 'interactive' | 'video' | 'image' | 'slides';
const FREE_MODE: readonly string[] = ['web', 'interactive'];

/** Unknown / missing type is treated as clock contract: the strict side. */
export function isClockContract(context: Rule.RuleContext): boolean {
  const vanilla = (context.settings as { vanilla?: { sceneType?: unknown } }).vanilla;
  const type = vanilla?.sceneType;
  return !(typeof type === 'string' && FREE_MODE.includes(type));
}
