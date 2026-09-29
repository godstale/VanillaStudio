/** palette.json contract — canonical implementation lives in `@/lib/design/palettes`.
 * This module only re-exports the template-install-side aliases (T6.2 handoff:
 * `parsePalette` validates, `buildTemplateInstallPlan` in `./install` computes).
 * Contract changes go to `design/palettes.ts` (plus design docs and the
 * `vanilla-core` skill), never here.
 */
export {
  paletteFileSchema as paletteSchema,
  PALETTE_VERSION,
  parsePaletteFile as parsePalette,
  type PaletteFile as Palette,
  type PaletteParseResult,
} from '@/lib/design/palettes';
