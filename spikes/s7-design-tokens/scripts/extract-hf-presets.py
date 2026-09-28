"""Extract HyperFrames FRAME.MD presets and palettes from the site bundle (reference data only, D-017)."""
import json
import re
import sys

src = sys.argv[1]
s = open(src, encoding='utf-8', errors='replace').read()

palettes = []
pal_re = re.compile(
    r'\{id:"([a-z0-9-]+)",name:"([^"]+)",tokens:\{primary:"(#[0-9A-Fa-f]{6})",secondary:"(#[0-9A-Fa-f]{6})",'
    r'tertiary:"(#[0-9A-Fa-f]{6})",accent:"(#[0-9A-Fa-f]{6})"\}(?:,extras:\{([^}]*)\})?'
)
for m in pal_re.finditer(s):
    extras = dict(re.findall(r'"?([a-z0-9-]+)"?:"(#[0-9A-Fa-f]{6})"', m.group(7) or ''))
    palettes.append({
        'id': m.group(1), 'name': m.group(2),
        'tokens': dict(zip(['primary', 'secondary', 'tertiary', 'accent'], m.group(3, 4, 5, 6))),
        'extras': extras,
    })

presets = []
pre_re = re.compile(
    r'slug:"([a-z0-9-]+)",name:"([^"]+)",tagline:"([^"]*)",scheme:"(\w+)",density:"(\w+)".*?'
    r'defaultPalette:"([a-z0-9-]+)",defaultFontPairId:"([a-z0-9-]+)",supportedTones:\[([^\]]*)\],'
    r'fonts:\{headline:"([^"]+)",body:"([^"]+)"'
)
for m in pre_re.finditer(s):
    presets.append({
        'slug': m.group(1), 'name': m.group(2), 'tagline': m.group(3), 'scheme': m.group(4),
        'density': m.group(5), 'defaultPalette': m.group(6), 'fontPair': m.group(7),
        'tones': re.findall(r'"(\w+)"', m.group(8)),
        'fonts': {'headline': m.group(9), 'body': m.group(10)},
    })

out = {
    'source': 'https://www.hyperframes.dev/design site bundle, fetched 2026-09-29. Reference only; not redistributed (D-017).',
    'presets': presets,
    'palettes': palettes,
}
json.dump(out, open(sys.argv[2], 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print(f'{len(presets)} presets, {len(palettes)} palettes')
for p in presets:
    print(f"  {p['slug']:<18} {p['scheme']:<6} palette={p['defaultPalette']:<28} fonts={p['fonts']['headline']} / {p['fonts']['body']}")
