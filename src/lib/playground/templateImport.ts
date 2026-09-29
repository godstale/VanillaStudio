// Template folder import validation (T6.10, F-TPL-03, S).
// A template skill folder must contain SKILL.md + template.json + DESIGN.md
// (D-008, `src/lib/templates/install.ts`). This module validates a picked
// folder *before* anything is copied: the actual install copy stays a
// follow-up (workspace-scoped Rust copy, like the playground reference model).
import { TEMPLATE_REQUIRED_FILES } from '@/lib/templates/install';
import { parseTemplateManifest, type TemplateManifest } from '@/lib/templates/template';

export interface TemplateFolderReport {
  files: string[];
  missing: string[];
  manifest: TemplateManifest | null;
  manifestError: string | null;
}

/** Top-level file names only (nested references/ need no check). */
export function validateTemplateFileList(names: string[]): { ok: boolean; missing: string[] } {
  const missing = TEMPLATE_REQUIRED_FILES.filter((required) => !names.includes(required));
  return { ok: missing.length === 0, missing: [...missing] };
}

export function validateTemplateFolder(names: string[], manifestText: string | null): TemplateFolderReport {
  const { missing } = validateTemplateFileList(names);
  if (manifestText === null) {
    return { files: [...names], missing, manifest: null, manifestError: 'missing template.json' };
  }
  const parsed = parseTemplateManifest(manifestText);
  return {
    files: [...names],
    missing,
    manifest: parsed.ok ? parsed.manifest : null,
    manifestError: parsed.ok ? null : parsed.error,
  };
}

export function isImportableFolder(report: TemplateFolderReport): boolean {
  return report.missing.length === 0 && report.manifest !== null;
}
