import { describe, expect, it } from 'vitest';
import { newScene } from '@/lib/scene/schema';
import {
  applyDecomposedPreset,
  applyOpusRecipeToScene,
  getOpusCatalog,
  listDecomposedPresets,
  listOpusRecipes,
} from './opusCatalog';
import { inferMediaIntent, recommendForPrompt } from './recommend';
import { listBuiltinTemplates } from './template';

describe('Opus 5.5 templates, decomposed presets, and recommendation engine', () => {
  it('ensures every built-in template has previewUrl, actionUrl, and mediaIntents', () => {
    const templates = listBuiltinTemplates();
    expect(templates.length).toBeGreaterThanOrEqual(15);
    for (const t of templates) {
      expect(t.meta.previewUrl, `${t.ref} previewUrl`).toMatch(/^https:\/\/media\.skillry\.dev\//);
      expect(t.meta.actionUrl, `${t.ref} actionUrl`).toMatch(/^https:\/\/(skillry\.dev|x\.com)\//);
      expect(t.meta.mediaIntents?.length, `${t.ref} mediaIntents`).toBeGreaterThan(0);
    }
  });

  it('validates opus-catalog.json recipes and decomposed presets with preview & action links', () => {
    const catalog = getOpusCatalog();
    expect(catalog.recipes.length).toBeGreaterThanOrEqual(20);
    expect(catalog.decomposedPresets.length).toBeGreaterThanOrEqual(12);

    for (const r of catalog.recipes) {
      expect(r.previewUrl).toMatch(/^https:\/\/media\.skillry\.dev\//);
      expect(r.actionUrl).toMatch(/^https:\/\/(skillry\.dev|x\.com)\//);
      const dummy = newScene({ id: 'scn_TEST01', name: 'Test', type: r.sceneType, template: 'commercial@1' });
      const applied = applyOpusRecipeToScene(dummy, r);
      expect(applied.template).toBe(r.templateRef);
      expect(applied.brief.mediaIntent).toBe(r.mediaIntent);
    }

    for (const preset of catalog.decomposedPresets) {
      expect(preset.previewUrl).toMatch(/^https:\/\/media\.skillry\.dev\//);
      expect(preset.actionUrl).toMatch(/^https:\/\/(skillry\.dev|x\.com)\//);
      for (const targetType of preset.targetTypes) {
        const baseTpl =
          targetType === 'static' ? 'web-page@1' : targetType === 'motion' ? 'commercial@1' : 'three-scene@1';
        const dummy = newScene({ id: 'scn_TEST02', name: 'Test', type: targetType, template: baseTpl });
        const patched = applyDecomposedPreset(dummy, preset);
        expect(patched.type).toBe(targetType);
      }
    }
  });

  it('infers mediaIntent from Korean and English user prompts', () => {
    expect(inferMediaIntent('SaaS 랜딩 페이지와 벤토 그리드 히어로 만들어줘')).toBe('web');
    expect(inferMediaIntent('스포티파이 스타일 무빙 포스터랑 썸네일 이미지')).toBe('image');
    expect(inferMediaIntent('투자자 발표용 키노트 피치 덱 슬라이드')).toBe('slide');
    expect(inferMediaIntent('120BPM 비트에 맞춰 하나의 도형이 8개 UI로 모핑되는 루프')).toBe('motion');
  });

  it('recommends matching Opus templates and decomposed presets across all 4 media intents', () => {
    const morph = recommendForPrompt({ promptText: '120BPM UI state morph loop with spring physics' });
    expect(morph.templates[0]?.template.ref).toBe('opus-ui-morph-loop@1');
    expect(morph.decomposedPresets.some((p) => p.id === 'beats-120bpm-ui-morph-6s')).toBe(true);

    const keynote = recommendForPrompt({ mediaIntent: 'motion', promptText: '애플 키노트 스타일 SaaS 제품 출시 데모와 커서 줌' });
    expect(keynote.templates[0]?.template.ref).toBe('opus-keynote-launch@1');

    const poster = recommendForPrompt({ mediaIntent: 'image', promptText: '픽셀 아트 레트로 디오라마 일러스트' });
    expect(poster.templates[0]?.template.ref).toBe('opus-pixel-illustration@1');

    const slide = recommendForPrompt({ mediaIntent: 'slide', promptText: '키노트 발표용 내러티브 슬라이드 덱' });
    expect(slide.templates[0]?.template.ref).toBe('opus-narrative-deck@1');

    const simulator = recommendForPrompt({ mediaIntent: 'web', promptText: '슬라이더로 조작하는 물리 시뮬레이터 샌드박스 웹' });
    expect(simulator.templates[0]?.template.ref).toBe('opus-simulator-canvas@1');

    const shader = recommendForPrompt({ sceneType: '3d', promptText: '프리즘 빛 분산 GLSL 셰이더 시네마틱 아트' });
    expect(shader.templates[0]?.template.ref).toBe('opus-shader-cinematic@1');
  });

  it('filters recipes and decomposed presets by category and mediaIntent', () => {
    expect(listOpusRecipes({ mediaIntent: 'slide' }).length).toBeGreaterThan(0);
    expect(listDecomposedPresets({ category: 'typography-style' }).length).toBeGreaterThan(0);
    expect(listDecomposedPresets({ category: 'motion-effects' }).length).toBeGreaterThan(0);
    expect(listDecomposedPresets({ category: 'scene-beats' }).length).toBeGreaterThan(0);
    expect(listDecomposedPresets({ category: '3d-stage' }).length).toBeGreaterThan(0);
  });
});
