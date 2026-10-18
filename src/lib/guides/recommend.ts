import { BUILT_IN_PALETTES, type PaletteFile } from '@/lib/design/palettes';
import type { SceneType } from '@/lib/scene/schema';
import {
  listDecomposedPresets,
  listOpusRecipes,
  type DecomposedPreset,
  type OpusRecipe,
} from './opusCatalog';
import { listBuiltinTemplates, type GuideTemplate, type MediaIntent } from './template';

// 매체 의도(웹/이미지/슬라이드/모션그래픽) + 한·영 프롬프트 키워드 기반 결정론적 추천 엔진.
// 네트워크/LLM 호출 없이 로컬에서 즉시 동작하며, 전체 템플릿뿐 아니라 분해된 프리셋(비트·타이포·모션·컬러·3D)도 함께 추천한다.

export interface RecommendInput {
  mediaIntent?: MediaIntent;
  promptText?: string;
  sceneType?: SceneType;
  templates?: GuideTemplate[];
  limit?: number;
}

export interface TemplateRecommendation {
  template: GuideTemplate;
  score: number;
  matchedKeywords: string[];
  recommendedIntent: MediaIntent;
}

export interface FullRecommendationResult {
  inferredIntent: MediaIntent;
  recommendedSceneType: SceneType;
  templates: TemplateRecommendation[];
  decomposedPresets: DecomposedPreset[];
  recipes: OpusRecipe[];
  palettes: PaletteFile[];
}

interface KeywordRule {
  pattern: RegExp;
  label: string;
  intents: MediaIntent[];
  sceneTypes: SceneType[];
  templateRefs: string[];
  presetIds: string[];
  paletteIds: string[];
}

const KEYWORD_RULES: KeywordRule[] = [
  {
    pattern: /모프|모핑|루프|알약|상태\s*전환|120\s*bpm|morph|loop|pill|ui\s*state|spring/i,
    label: 'UI Morph / 120BPM Loop',
    intents: ['motion'],
    sceneTypes: ['motion'],
    templateRefs: ['opus-ui-morph-loop@1'],
    presetIds: ['beats-120bpm-ui-morph-6s', 'motion-kit-spring-ui-morph', 'typo-monumental-keynote-sans'],
    paletteIds: ['opus-cobalt-cyan', 'opus-studio-mint'],
  },
  {
    pattern: /키노트|런치|출시|제품\s*소개|프로덕트|데모|커서|애플|keynote|launch|product\s*demo|cursor|screen\s*studio|saas/i,
    label: 'Keynote Product Launch',
    intents: ['motion', 'slide'],
    sceneTypes: ['motion', 'static'],
    templateRefs: ['opus-keynote-launch@1', 'opus-narrative-deck@1', 'opus-interactive-hero@1'],
    presetIds: ['beats-keynote-4phase-launch-9s', 'motion-kit-cursor-zoom-keynote', 'typo-monumental-keynote-sans'],
    paletteIds: ['opus-keynote-lime', 'opus-studio-mint'],
  },
  {
    pattern: /타이포|매니페스토|연설|인용|명언|슬로건|세리프|쇼릴|kinetic|typography|manifesto|quote|speech|serif|showreel/i,
    label: 'Kinetic Typography Manifesto',
    intents: ['motion', 'image'],
    sceneTypes: ['motion'],
    templateRefs: ['opus-kinetic-manifesto@1', 'opus-kinetic-poster@1'],
    presetIds: ['beats-kinetic-manifesto-8s', 'typo-editorial-serif-grotesque', 'motion-kit-kinetic-manifesto-pulse'],
    paletteIds: ['opus-botanical-parchment', 'opus-cyber-magenta'],
  },
  {
    pattern: /수식|수학|과학|물리|알고리즘|푸리에|그래프|파형|해설|교육|다이어그램|math|science|fourier|physics|algorithm|explainer|formula|diagram/i,
    label: 'Math & Science Explainer',
    intents: ['motion', 'slide', 'web'],
    sceneTypes: ['motion', 'static'],
    templateRefs: ['opus-science-explainer@1', 'opus-simulator-canvas@1', 'opus-data-explainer-deck@1'],
    presetIds: ['beats-science-derivation-10s', 'typo-scientific-hud-telemetry', 'motion-kit-interactive-sandbox-dock'],
    paletteIds: ['opus-cobalt-cyan', 'opus-orbital-coral'],
  },
  {
    pattern: /포스터|배너|썸네일|소셜|카드뉴스|스포티파이|인스타|이미지|그래픽|poster|banner|thumbnail|social\s*card|spotify|graphic|cover/i,
    label: 'Kinetic Poster & Social Visual',
    intents: ['image', 'motion'],
    sceneTypes: ['motion'],
    templateRefs: ['opus-kinetic-poster@1', 'opus-kinetic-manifesto@1'],
    presetIds: ['typo-swiss-poster-grid', 'motion-kit-spring-ui-morph'],
    paletteIds: ['opus-spotify-editorial', 'opus-cyber-magenta'],
  },
  {
    pattern: /픽셀|도트|레트로|8비트|16비트|일러스트|디오라마|아케이드|pixel|retro|8-bit|16-bit|illustration|diorama|sprite/i,
    label: 'Pixel & Procedural Illustration',
    intents: ['image', 'motion'],
    sceneTypes: ['motion'],
    templateRefs: ['opus-pixel-illustration@1', 'opus-kinetic-poster@1'],
    presetIds: ['beats-120bpm-ui-morph-6s'],
    paletteIds: ['opus-orbital-coral', 'opus-cyber-magenta'],
  },
  {
    pattern: /웹|랜딩|홈페이지|사이트|히어로|벤토|가격표|기능\s*소개|web|landing|homepage|hero|bento|website/i,
    label: 'Interactive Web & Landing Hero',
    intents: ['web'],
    sceneTypes: ['static'],
    templateRefs: ['opus-interactive-hero@1', 'web-page@1'],
    presetIds: ['typo-monumental-keynote-sans', 'motion-kit-interactive-sandbox-dock'],
    paletteIds: ['opus-keynote-lime', 'opus-magnetic-monument'],
  },
  {
    pattern: /시뮬레이터|시뮬레이션|샌드박스|슬라이더|대시보드|조작|컨트롤|인터랙티브|simulator|sandbox|slider|dashboard|control|interactive/i,
    label: 'Interactive Simulator & Sandbox',
    intents: ['web', 'slide'],
    sceneTypes: ['static'],
    templateRefs: ['opus-simulator-canvas@1', 'opus-data-explainer-deck@1'],
    presetIds: ['motion-kit-interactive-sandbox-dock', 'typo-scientific-hud-telemetry'],
    paletteIds: ['opus-studio-mint', 'opus-cobalt-cyan'],
  },
  {
    pattern: /슬라이드|발표|프레젠테이션|피치\s*덱|덱|브리핑|장표|ppt|slide|deck|presentation|pitch/i,
    label: 'Keynote Slide Deck',
    intents: ['slide'],
    sceneTypes: ['static'],
    templateRefs: ['opus-narrative-deck@1', 'opus-data-explainer-deck@1'],
    presetIds: ['steps-keynote-4slide-deck', 'typo-monumental-keynote-sans'],
    paletteIds: ['opus-magnetic-monument', 'opus-botanical-parchment'],
  },
  {
    pattern: /데이터|차트|통계|비교|스케일|지표|벤치마크|data|chart|metric|comparison|scale|benchmark/i,
    label: 'Data & Multiscale Explainer',
    intents: ['slide', 'web', 'motion'],
    sceneTypes: ['static', 'motion'],
    templateRefs: ['opus-data-explainer-deck@1', 'opus-science-explainer@1'],
    presetIds: ['steps-keynote-4slide-deck', 'typo-scientific-hud-telemetry'],
    paletteIds: ['opus-cobalt-cyan', 'opus-keynote-lime'],
  },
  {
    pattern: /3d|입체|분해|컷어웨이|하드웨어|턴테이블|궤도|우주|행성|three\.?js|webgl|exploded|cutaway|orbit/i,
    label: '3D Explorer & Cutaway',
    intents: ['web', 'motion'],
    sceneTypes: ['3d'],
    templateRefs: ['opus-3d-explorer@1', 'three-scene@1'],
    presetIds: ['3d-kit-exploded-pbr-cutaway', 'typo-scientific-hud-telemetry'],
    paletteIds: ['opus-magnetic-monument', 'opus-cobalt-cyan'],
  },
  {
    pattern: /셰이더|프리즘|굴절|분산|파티클|네온|아트|시네마틱|shader|glsl|prism|dispersion|particle|cinematic/i,
    label: '3D Shader & Prismatic Art',
    intents: ['motion', 'image'],
    sceneTypes: ['3d'],
    templateRefs: ['opus-shader-cinematic@1', 'opus-3d-explorer@1'],
    presetIds: ['3d-kit-stained-glass-shader-dolly'],
    paletteIds: ['opus-cyber-magenta', 'opus-orbital-coral'],
  },
];

const DEFAULT_TEMPLATE_BY_INTENT: Record<MediaIntent, string> = {
  web: 'opus-interactive-hero@1',
  image: 'opus-kinetic-poster@1',
  slide: 'opus-narrative-deck@1',
  motion: 'opus-keynote-launch@1',
};

const DEFAULT_SCENE_TYPE_BY_INTENT: Record<MediaIntent, SceneType> = {
  web: 'static',
  image: 'motion',
  slide: 'static',
  motion: 'motion',
};

/** 프롬프트 문구에서 가장 가능성 높은 매체 의도를 추론한다. */
export function inferMediaIntent(promptText: string, fallback: MediaIntent = 'motion'): MediaIntent {
  const text = promptText.trim();
  if (!text) return fallback;
  const scores: Record<MediaIntent, number> = { web: 0, image: 0, slide: 0, motion: 0 };
  for (const rule of KEYWORD_RULES) {
    if (rule.pattern.test(text)) {
      rule.intents.forEach((intent, idx) => {
        scores[intent] += idx === 0 ? 3 : 1;
      });
    }
  }
  let best: MediaIntent = fallback;
  let bestScore = 0;
  for (const intent of ['web', 'image', 'slide', 'motion'] as const) {
    if (scores[intent] > bestScore) {
      bestScore = scores[intent];
      best = intent;
    }
  }
  return best;
}

/** 사용자의 매체 의도(웹/이미지/슬라이드/모션)와 한 줄 프롬프트를 분석해 최적의 템플릿과 분해된 세부 프리셋을 추천한다. */
export function recommendForPrompt(input: RecommendInput): FullRecommendationResult {
  const prompt = (input.promptText ?? '').trim();
  const inferredIntent = input.mediaIntent ?? inferMediaIntent(prompt, 'motion');
  const allTemplates = input.templates ?? listBuiltinTemplates();
  const limit = input.limit ?? 4;

  const activeRules = KEYWORD_RULES.filter((r) => prompt.length > 0 && r.pattern.test(prompt));

  const scored: TemplateRecommendation[] = allTemplates
    .filter((t) => !input.sceneType || t.meta.type === input.sceneType)
    .map((template) => {
      let score = 0;
      const matchedKeywords: string[] = [];

      // 1. 매체 의도 일치 점수
      const intents = template.meta.mediaIntents ?? [];
      if (intents[0] === inferredIntent) score += 25;
      else if (intents.includes(inferredIntent)) score += 15;

      // 2. 기본 대표 템플릿 가산점
      if (DEFAULT_TEMPLATE_BY_INTENT[inferredIntent] === template.ref) {
        score += 12;
      }

      // 3. Opus 특화 템플릿 가산점 (구체적 아키텍처 보유)
      if (template.ref.startsWith('opus-')) {
        score += 6;
      }

      // 4. 키워드 룰 매칭
      for (const rule of activeRules) {
        const refIdx = rule.templateRefs.indexOf(template.ref);
        if (refIdx !== -1) {
          score += refIdx === 0 ? 35 : 20;
          matchedKeywords.push(rule.label);
        }
      }

      // 5. 템플릿 태그·라벨·설명 직접 매칭
      if (prompt.length >= 2) {
        const lower = prompt.toLowerCase();
        for (const tag of template.meta.tags ?? []) {
          if (lower.includes(tag.toLowerCase())) {
            score += 10;
            if (!matchedKeywords.includes(tag)) matchedKeywords.push(tag);
          }
        }
        if (
          template.meta.label.ko.toLowerCase().includes(lower) ||
          template.meta.label.en.toLowerCase().includes(lower)
        ) {
          score += 15;
        }
      }

      return {
        template,
        score,
        matchedKeywords,
        recommendedIntent: intents[0] ?? inferredIntent,
      };
    })
    .sort((a, b) => b.score - a.score || a.template.ref.localeCompare(b.template.ref));

  const topTemplate = scored[0]?.template;
  const recommendedSceneType = input.sceneType ?? topTemplate?.meta.type ?? DEFAULT_SCENE_TYPE_BY_INTENT[inferredIntent];

  // 분해된 프리셋 추천
  const boostedPresetIds = new Set(activeRules.flatMap((r) => r.presetIds));
  const candidatePresets = listDecomposedPresets({
    targetType: input.sceneType,
  });
  const decomposedPresets = [...candidatePresets]
    .sort((a, b) => {
      const scoreA = (boostedPresetIds.has(a.id) ? 20 : 0) + (a.mediaIntents.includes(inferredIntent) ? 10 : 0);
      const scoreB = (boostedPresetIds.has(b.id) ? 20 : 0) + (b.mediaIntents.includes(inferredIntent) ? 10 : 0);
      return scoreB - scoreA;
    })
    .slice(0, 6);

  // 큐레이션 레시피 추천
  const topRefs = new Set(scored.slice(0, 2).map((s) => s.template.ref));
  const allRecipes = listOpusRecipes({ sceneType: input.sceneType });
  const recipes = [...allRecipes]
    .sort((a, b) => {
      const scoreA = (a.mediaIntent === inferredIntent ? 15 : 0) + (topRefs.has(a.templateRef) ? 20 : 0);
      const scoreB = (b.mediaIntent === inferredIntent ? 15 : 0) + (topRefs.has(b.templateRef) ? 20 : 0);
      return scoreB - scoreA;
    })
    .slice(0, 4);

  // 팔레트 추천
  const boostedPaletteIds = new Set([
    ...activeRules.flatMap((r) => r.paletteIds),
    ...recipes.map((r) => r.recommendedPaletteId),
  ]);
  const palettes = [...BUILT_IN_PALETTES]
    .sort((a, b) => {
      const scoreA = (boostedPaletteIds.has(a.id) ? 20 : 0) + (a.id.startsWith('opus-') ? 5 : 0);
      const scoreB = (boostedPaletteIds.has(b.id) ? 20 : 0) + (b.id.startsWith('opus-') ? 5 : 0);
      return scoreB - scoreA;
    })
    .slice(0, 4);

  return {
    inferredIntent,
    recommendedSceneType,
    templates: scored.slice(0, limit),
    decomposedPresets,
    recipes,
    palettes,
  };
}
