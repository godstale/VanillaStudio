// Post-process a dom-to-pptx deck: text boxes sized to one line per paragraph get wrap="none",
// so slightly wider PowerPoint text metrics overflow sideways instead of wrapping into other shapes.
import { readFileSync, writeFileSync } from 'node:fs';
import JSZip from 'jszip';

const [input, output] = process.argv.slice(2);
const zip = await JSZip.loadAsync(readFileSync(input));
let changed = 0;
let kept = 0;
for (const name of Object.keys(zip.files).filter((n) => /^ppt\/slides\/slide\d+\.xml$/.test(n))) {
  let xml = await zip.file(name).async('string');
  xml = xml.replace(/<p:sp>[\s\S]*?<\/p:sp>/g, (sp) => {
    if (!sp.includes('<p:txBody>')) return sp;
    const cy = Number(/<a:ext cx="\d+" cy="(\d+)"/.exec(sp)?.[1] ?? 0); // EMU, 12700 per pt
    const sizes = [...sp.matchAll(/<a:rPr[^>]*\bsz="(\d+)"/g)].map((m) => Number(m[1]) / 100); // pt
    const paragraphs = (sp.match(/<a:p>|<a:p /g) ?? []).length || 1;
    if (!sizes.length || !cy) return sp;
    const oneLinePerParagraph = cy / 12700 <= paragraphs * Math.max(...sizes) * 1.6;
    if (!oneLinePerParagraph) {
      kept++;
      return sp;
    }
    changed++;
    return sp.replace(/<a:bodyPr([^>]*?)(\/?)>/, (m, attrs, selfClose) =>
      `<a:bodyPr${attrs.replace(/\swrap="[^"]*"/, '')} wrap="none"${selfClose}>`,
    );
  });
  zip.file(name, xml);
}
writeFileSync(output, await zip.generateAsync({ type: 'nodebuffer' }));
console.log(JSON.stringify({ input, output, wrapNone: changed, wrapKept: kept }));
