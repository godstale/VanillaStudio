import { describe, expect, it } from 'vitest';
import { collectTags, kindFromExportFormat, resolvePlayable, searchItems, titleFromDir } from './store';
import type { PlaygroundItem } from './types';

const item = (over: Partial<PlaygroundItem> = {}): PlaygroundItem => ({
  id: 'pg-1',
  title: 'Intro video',
  kind: 'video',
  dirPath: 'C:/p/exports/v1',
  sourceProject: 'C:/p',
  tags: ['hero', 'dark'],
  createdAt: 't',
  updatedAt: 't',
  ...over,
});

describe('resolvePlayable', () => {
  it('prefers video over images', () => {
    expect(resolvePlayable(['a.mp4', 's1.png'])).toEqual({ player: 'video', entries: ['a.mp4'] });
  });

  it('picks pdf before images', () => {
    expect(resolvePlayable(['slides.pdf', 's1.png', 's2.png'])).toEqual({ player: 'pdf', entries: ['slides.pdf'] });
  });

  it('uses a slideshow for several images', () => {
    expect(resolvePlayable(['s2.png', 's1.png'])).toEqual({ player: 'slideshow', entries: ['s1.png', 's2.png'] });
  });

  it('prefers index.html for web folders', () => {
    expect(resolvePlayable(['about.html', 'index.html'])).toEqual({ player: 'web', entries: ['index.html'] });
  });

  it('falls back to none for zips and pptx only', () => {
    expect(resolvePlayable(['site.zip', 'slides-editable.pptx'])).toEqual({ player: 'none', entries: [] });
  });
});

describe('searchItems', () => {
  const items = [
    item({ id: 'a', title: 'Intro video', kind: 'video', tags: ['hero'] }),
    item({ id: 'b', title: 'Cover', kind: 'image', tags: ['Dark'] }),
  ];

  it('matches titles and tags case-insensitively', () => {
    expect(searchItems(items, 'intro').map((i) => i.id)).toEqual(['a']);
    expect(searchItems(items, 'dark').map((i) => i.id)).toEqual(['b']);
  });

  it('filters by kind and exact tag', () => {
    expect(searchItems(items, '', { kind: 'image' }).map((i) => i.id)).toEqual(['b']);
    expect(searchItems(items, '', { tag: 'HERO' }).map((i) => i.id)).toEqual(['a']);
  });
});

describe('collectTags', () => {
  it('dedupes case-insensitively, most frequent first', () => {
    const items = [item({ tags: ['Dark', 'hero'] }), item({ tags: ['dark'] })];
    expect(collectTags(items)).toEqual(['Dark', 'hero']);
  });
});

describe('titleFromDir / kindFromExportFormat', () => {
  it('uses the folder base name', () => {
    expect(titleFromDir('C:\\p\\exports\\v1\\')).toBe('v1');
  });

  it('maps export formats to kinds', () => {
    expect(kindFromExportFormat('slides')).toBe('slides');
    expect(kindFromExportFormat('zip')).toBeNull();
  });
});
