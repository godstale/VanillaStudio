// 사용자가 조절한 파라미터 값 파일(`*.values.json`)을 고른다. v2는 신마다 `scenes/<slug>/params/`를 쓰고, 신 폴더 밖(루트 `params/`)은 v1 호환이다.
// 신 iframe은 `/scenes/<slug>/src/index.html`로 열리므로 그 slug의 파일만 쓴다(다른 신의 같은 이름 파일과 섞이지 않게).
import type { ParamsBySceneId } from './composition';

const stem = (path: string): string => /([^/]+)\.values\.json$/.exec(path)?.[1] ?? path;

/** `files`: `import.meta.glob`이 돌려준 경로 → 값. 루트 `params/`가 먼저, 같은 이름이면 신 폴더 값이 덮어쓴다. */
export function paramsForPath(files: Record<string, Record<string, unknown>>, pathname: string): ParamsBySceneId {
  const slug = /^\/scenes\/([^/]+)\//.exec(pathname)?.[1] ?? null;
  const out: Record<string, Record<string, unknown>> = {};
  const entries = Object.entries(files);
  for (const [path, values] of entries) if (/^\/params\//.test(path)) out[stem(path)] = values;
  if (slug) for (const [path, values] of entries) if (path.startsWith(`/scenes/${slug}/params/`)) out[stem(path)] = values;
  return out;
}
