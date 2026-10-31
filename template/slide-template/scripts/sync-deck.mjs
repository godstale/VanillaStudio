#!/usr/bin/env node
// Derives every scene from storyboard/data/content.json: thin src/ files, scene.json brief/steps,
// shared/deck/scene-ids.json and the linear sequence edges. Run after editing content.json:
//   node scripts/sync-deck.mjs && pnpm vanilla sync-guides
// A scene with `"hidden": true` in content.json stays editable but is left out of the sequence.
// scene.json steps must mirror shared/deck/content.ts `stepsOf` (same ids, order and advance rule).
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
const ADVANCE = 'key:ArrowRight';
const read = (p) => JSON.parse(fs.readFileSync(path.join(ROOT, p), 'utf8'));
const write = (p, data) => fs.writeFileSync(path.join(ROOT, p), typeof data === 'string' ? data : JSON.stringify(data, null, 2) + '\n');

const content = read('storyboard/data/content.json');
const plain = (s) => (s ?? '').replaceAll('**', '').trim();

function stepsOf(scene) {
  return scene.screens.flatMap((screen) => {
    const head = plain(screen.title ?? scene.title);
    const copy = [screen.sub, screen.kicker, screen.heading, screen.classic, screen.quote, screen.value, screen.lead, screen.text, ...(screen.bullets ?? []), ...(screen.lines ?? []), screen.note]
      .map(plain)
      .filter(Boolean);
    const items = (screen.items ?? []).map((it) => plain([it.date, it.title, it.value, it.unit, it.label, it.text].filter((x) => x !== undefined && x !== '').join(' ')));
    if (!screen.build) {
      return [{ id: screen.id, title: head, copy: [...copy, ...items].join('\n'), layout: screen.layout, enter: 'fade', advance: ADVANCE }];
    }
    return items.map((item, k) => ({
      id: `${screen.id}-${k + 1}`,
      title: `${head} (${k + 1}/${items.length})`,
      copy: (k === 0 ? [...copy, item] : [item]).join('\n'),
      layout: screen.layout,
      enter: k === 0 ? 'fade' : 'reveal',
      advance: ADVANCE,
    }));
  });
}

const sceneDirs = fs.readdirSync(path.join(ROOT, 'scenes')).filter((d) => fs.existsSync(path.join(ROOT, 'scenes', d, 'scene.json')));
const ids = {};
const ordered = [];

for (const scene of content.scenes) {
  const slug = sceneDirs.find((d) => d.startsWith(`${scene.key}-`));
  if (!slug) throw new Error(`No scene folder for ${scene.key}`);
  const dir = `scenes/${slug}`;
  const json = read(`${dir}/scene.json`);
  const chapter = content.chapters.find((c) => c.id === scene.chapter);
  ids[scene.key] = json.id;
  ordered.push(json.id);

  const first = scene.screens.find((s) => s.heading || s.lead || s.note) ?? scene.screens[0];
  Object.assign(json, {
    brief: {
      subject: scene.title,
      goal: `${chapter.no} ${chapter.label} — ${scene.key.toUpperCase()}`,
      audience: content.deck.audience ?? '일반 청중',
      message: plain(first.note ?? first.lead ?? first.heading ?? scene.title).replaceAll('\n', ' '),
      language: 'ko',
      mediaIntent: 'slide',
    },
    type: 'static',
    mode: 'steps',
    steps: stepsOf(scene),
    sections: [...new Set(scene.screens.map((s) => s.layout))],
    layout: 'keynote-16x9',
    breakpoints: ['1920x1080'],
    accessibility: ['wcag-aa-contrast', 'keyboard-nav'],
    custom: { contentRef: `storyboard/data/content.json#${scene.key}`, chapter: scene.chapter, shell: 'shared/deck/DeckShell.tsx' },
    status: 'generated',
  });
  write(`${dir}/scene.json`, json);

  write(
    `${dir}/src/Scene.tsx`,
    `import { defineScene } from '@vanilla/runtime';
import { DeckShell } from '../../../shared/deck/DeckShell';
import { sceneJsonId } from '../../../shared/deck/content';

// Copy and screens live in storyboard/data/content.json (${scene.key}); layouts in shared/deck.
const KEY = '${scene.key}';

function Slide() {
  return <DeckShell sceneKey={KEY} />;
}

export default defineScene({ id: sceneJsonId(KEY), Component: Slide });
`,
  );
  write(
    `${dir}/src/composition.tsx`,
    `import { defineComposition } from '@vanilla/runtime';
import scene from './Scene';

// Slides: no duration, the scene advances on user input only (D-032).
export default defineComposition({ scenes: [scene] });
`,
  );
  write(
    `${dir}/src/index.html`,
    `<!doctype html>
<html lang="ko">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${json.name}</title>
    <style>
      html, body, #root { margin: 0; width: 100%; height: 100%; overflow: hidden; background: var(--color-canvas-deep); }
      * { box-sizing: border-box; }
    </style>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="./main.tsx"></script>
  </body>
</html>
`,
  );
}

write('shared/deck/scene-ids.json', ids);

// Motion scenes that are not slides: the intro opens the deck, and a chapter bumper
// (scene.json custom.bumperBefore = chapter id) plays right before the first slide of its chapter.
const motionScenes = sceneDirs.map((d) => ({ slug: d, json: read(`scenes/${d}/scene.json`) })).filter(({ json }) => json.type === 'motion');
const intro = motionScenes.find(({ slug }) => slug.startsWith('s00-'));
const bumpers = new Map(motionScenes.filter(({ json }) => json.custom?.bumperBefore).map(({ json }) => [json.custom.bumperBefore, json.id]));
const motionIds = new Set(motionScenes.map(({ json }) => json.id));
const playlist = intro ? [intro.json.id] : [];
const seen = new Set();
content.scenes.forEach((scene, i) => {
  // `hidden` scenes keep their folder and ids but are unlinked from the sequence.
  if (scene.hidden) return;
  if (!seen.has(scene.chapter) && bumpers.has(scene.chapter)) playlist.push(bumpers.get(scene.chapter));
  seen.add(scene.chapter);
  playlist.push(ordered[i]);
});

const seq = read('sequence.json');
const PER_ROW = 7;
const prevEdge = new Map(seq.edges.map((e) => [`${e.from}>${e.to}`, e]));
seq.mode = 'linear';
seq.nodes = playlist.map((sceneId, i) => ({ sceneId, pos: { x: (i % PER_ROW) * 320, y: Math.floor(i / PER_ROW) * 220 } }));
seq.edges = playlist.slice(1).map((to, i) => {
  const from = playlist[i];
  // Bumpers hand over on their own; the intro and slides wait for the presenter (static: D-032).
  const auto = motionIds.has(from) && from !== intro?.json.id;
  return {
    from,
    to,
    trigger: auto ? 'end' : ADVANCE,
    transition: prevEdge.get(`${from}>${to}`)?.transition ?? { type: 'crossfade', durationMs: 500, easing: 'ease-in-out', params: {} },
  };
});
seq.start = playlist[0];
write('sequence.json', seq);

console.log(`Synced ${ordered.length} scenes, ${seq.edges.length} edges.`);
