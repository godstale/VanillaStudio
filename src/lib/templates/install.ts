// Template skill installation plan (D-008, Product-Spec §6·§8.3).
//
// A template is an Agent Skill folder: SKILL.md + template.json + DESIGN.md are
// required, the rest (frame.md, palettes/, references/, examples/, preview/,
// CREDITS.md) is optional. On project creation the chosen template skill plus
// the always-included `vanilla-core` skill are copied under both
// `.claude/skills/<id>/` and `.agents/skills/<id>/` so every agent reads the
// same files regardless of vendor.
//
// This module is pure and OS-agnostic (posix `/` paths, like T1.13's file
// list): it validates the layout and computes the install tree. The actual
// byte copy stays on the Rust side (workspace scope + symlink checks, T1.13
// pattern); a future Tauri command resolves `source: 'template' | 'core'`
// against the bundled resources and writes `targets`.

export const CORE_SKILL_ID = 'vanilla-core';

/** Agent skill roots inside a project (D-008). Both are always written. */
export const SKILL_ROOTS = ['.claude/skills', '.agents/skills'] as const;

/** Files every template folder must contain (D-008, D-015). */
export const TEMPLATE_REQUIRED_FILES = ['SKILL.md', 'template.json', 'DESIGN.md'] as const;

export interface InstallEntry {
  /** Which bundled source the file comes from. */
  source: 'template' | 'core';
  /** Path inside the source skill folder (posix, `/`-separated). */
  file: string;
  /** Project-relative destinations (one per agent skill root). */
  targets: string[];
}

export interface TemplateInstallPlan {
  templateId: string;
  /** Installed skill ids: always `[vanilla-core, templateId]`. */
  skillIds: string[];
  entries: InstallEntry[];
}

const SLUG = /^[a-z0-9][a-z0-9-]*$/;

/** Reject absolute paths, `..` escapes and backslashes (bundle layout is posix). */
export function assertSafeSkillPath(file: string): void {
  if (!file || file !== file.trim() || file.startsWith('/') || /^[A-Za-z]:/.test(file)) {
    throw new Error(`unsafe skill path: ${JSON.stringify(file)}`);
  }
  const parts = file.split('/');
  if (parts.some((p) => p === '' || p === '.' || p === '..') || file.includes('\\')) {
    throw new Error(`unsafe skill path: ${JSON.stringify(file)}`);
  }
}

function assertSkillId(id: string): void {
  if (!SLUG.test(id)) throw new Error(`invalid skill id: ${JSON.stringify(id)}`);
}

/** Destinations for one skill file under every agent skill root. */
export function skillTargets(skillId: string, file: string): string[] {
  assertSkillId(skillId);
  assertSafeSkillPath(file);
  return SKILL_ROOTS.map((root) => `${root}/${skillId}/${file}`);
}

function entriesFor(source: InstallEntry['source'], skillId: string, files: string[]): InstallEntry[] {
  const seen = new Set<string>();
  const out: InstallEntry[] = [];
  for (const file of files) {
    assertSafeSkillPath(file);
    if (seen.has(file)) continue;
    seen.add(file);
    out.push({ source, file, targets: skillTargets(skillId, file) });
  }
  return out;
}

/**
 * Compute the full install tree for a new project using `templateId`.
 * `templateFiles`/`coreFiles` are the skill-folder-relative file lists
 * (from a resource scan). Throws when required template files are missing
 * or any path could escape its skill folder.
 */
export function buildTemplateInstallPlan(
  templateId: string,
  templateFiles: string[],
  coreFiles: string[],
): TemplateInstallPlan {
  assertSkillId(templateId);
  for (const required of TEMPLATE_REQUIRED_FILES) {
    if (!templateFiles.includes(required)) {
      throw new Error(`template "${templateId}" is missing required file: ${required}`);
    }
  }
  if (!coreFiles.includes('SKILL.md')) {
    throw new Error('vanilla-core skill is missing required file: SKILL.md');
  }
  return {
    templateId,
    skillIds: [CORE_SKILL_ID, templateId],
    entries: [
      ...entriesFor('core', CORE_SKILL_ID, coreFiles),
      ...entriesFor('template', templateId, templateFiles),
    ],
  };
}
