// Split a DESIGN.md into YAML front matter and markdown body without touching either's bytes.
export interface FrontMatterSplit {
  hasFrontMatter: boolean;
  /** YAML text between the delimiters (no delimiter lines). */
  yaml: string;
  /** Offset of the first YAML character in the original text. */
  yamlStart: number;
  /** Offset just past the YAML text (start of the closing `---` line). */
  yamlEnd: number;
  /** Everything after the closing delimiter line. */
  body: string;
  bodyStart: number;
  eol: '\n' | '\r\n';
}

export function splitFrontMatter(text: string): FrontMatterSplit {
  const eol = text.includes('\r\n') ? '\r\n' : '\n';
  const open = `---${eol}`;
  if (!text.startsWith(open)) {
    return { hasFrontMatter: false, yaml: '', yamlStart: 0, yamlEnd: 0, body: text, bodyStart: 0, eol };
  }
  const yamlStart = open.length;
  // The closing delimiter is a line containing exactly `---`.
  const closeRe = eol === '\r\n' ? /\r\n---(\r\n|$)/g : /\n---(\n|$)/g;
  closeRe.lastIndex = yamlStart - eol.length;
  const m = closeRe.exec(text);
  if (!m) return { hasFrontMatter: false, yaml: '', yamlStart: 0, yamlEnd: 0, body: text, bodyStart: 0, eol };
  const yamlEnd = m.index + eol.length;
  const bodyStart = m.index + m[0].length;
  return { hasFrontMatter: true, yaml: text.slice(yamlStart, yamlEnd), yamlStart, yamlEnd, body: text.slice(bodyStart), bodyStart, eol };
}
