import { createContext, useContext, useMemo } from 'react';
import { buildCatalog, type Catalog } from '@/lib/guides/resolve';
import { listBuiltinTemplates, type GuideTemplate } from '@/lib/guides/template';
import type { Scene } from '@/lib/scene/schema';

export interface TemplatesValue {
  catalog: Catalog;
  /** 디스크에서 다시 읽는다(템플릿을 저장한 뒤 호출). */
  reload: () => Promise<void>;
  /** 신이 쓰는 템플릿. 없거나 사용을 거부하면 null. */
  resolve: (scene: Scene) => GuideTemplate | null;
}

export const TemplatesContext = createContext<TemplatesValue | null>(null);

export const builtinOnly = (): Catalog => buildCatalog(listBuiltinTemplates());

/** Provider 밖(테스트·단독 사용)에서는 내장 템플릿만 쓴다. */
export function useTemplates(): TemplatesValue {
  const ctx = useContext(TemplatesContext);
  return useMemo(() => {
    if (ctx) return ctx;
    const catalog = builtinOnly();
    return { catalog, reload: async () => undefined, resolve: (scene: Scene) => catalog.get(scene.template)?.template ?? null };
  }, [ctx]);
}
