// Apply a palette: replace only the front matter `colors` block (and, optionally, old hex values
// quoted in the prose). Every other byte of the file is preserved.
import { parseDocument, parse as parseYaml } from 'yaml';
import { splitFrontMatter } from './frontmatter';
import type { Colors } from './roles';

export interface RewriteResult {
  text: string;
  /** Prose occurrences of old color values that were updated. */
  bodyReplacements: number;
}

function colorsBlock(colors: Colors, eol: string): string {
  return ['colors:', ...Object.entries(colors).map(([k, v]) => `  ${k}: "${v}"`)].join(eol) + eol;
}

function replaceBlockLines(yaml: string, colors: Colors, eol: string): string | null {
  const lines = yaml.split(eol);
  const start = lines.findIndex((l) => /^colors:\s*$/.test(l));
  if (start < 0) return null;
  let end = start + 1;
  // Block ends at the next top-level key (non-indented, non-empty, non-comment line).
  while (end < lines.length && (lines[end] === '' || /^\s/.test(lines[end]))) end++;
  // Keep trailing blank lines that separated the block from the next key.
  while (end > start + 1 && lines[end - 1] === '') end--;
  const before = lines.slice(0, start).join(eol);
  const after = lines.slice(end).join(eol);
  return (before ? before + eol : '') + colorsBlock(colors, eol) + after;
}

export function replaceColors(text: string, colors: Colors, opts: { updateProse?: boolean } = {}): RewriteResult {
  const split = splitFrontMatter(text);
  if (!split.hasFrontMatter) {
    // Prose-only DESIGN.md: prepend a front matter block; the original text becomes the body verbatim.
    return { text: `---${split.eol}${colorsBlock(colors, split.eol)}---${split.eol}${text}`, bodyReplacements: 0 };
  }
  const old = ((parseYaml(split.yaml) ?? {}) as { colors?: Colors }).colors ?? {};
  let yaml = replaceBlockLines(split.yaml, colors, split.eol);
  if (yaml === null) {
    // Flow style (`colors: {…}`) or missing block: fall back to the YAML document API.
    const doc = parseDocument(split.yaml);
    doc.set('colors', colors);
    yaml = doc.toString();
  }
  let body = split.body;
  let bodyReplacements = 0;
  if (opts.updateProse) {
    for (const [role, prev] of Object.entries(old)) {
      const next = colors[role];
      if (!next || !/^#[0-9a-f]{3,8}$/i.test(prev) || prev.toLowerCase() === next.toLowerCase()) continue;
      const re = new RegExp(`${prev}(?![0-9a-f])`, 'gi');
      body = body.replace(re, () => {
        bodyReplacements++;
        return next;
      });
    }
  }
  return { text: text.slice(0, split.yamlStart) + yaml + text.slice(split.yamlEnd, split.bodyStart) + body, bodyReplacements };
}
