import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import * as settingsRepo from '@/lib/db/repositories/settingsRepo';
import { loadCatalog } from '@/lib/guides/catalog';
import type { Catalog } from '@/lib/guides/resolve';
import { builtinOnly, TemplatesContext, type TemplatesValue } from './templatesContextValue';

/** 워크스페이스의 템플릿 카탈로그(내장 + templatesDir + guide-templates/)를 한 번 읽어 하위에 제공한다. */
export function TemplatesProvider({ root, children }: { root: string; children: ReactNode }) {
  const [catalog, setCatalog] = useState<Catalog>(builtinOnly);

  const reload = useCallback(async () => {
    const settings = await settingsRepo.getSettings().catch(() => null);
    const next = await loadCatalog(root, settings?.templatesDir ?? null);
    setCatalog(next);
    return next;
  }, [root]);

  useEffect(() => {
    let cancelled = false;
    settingsRepo
      .getSettings()
      .catch(() => null)
      .then((s) => loadCatalog(root, s?.templatesDir ?? null))
      .then((c) => !cancelled && setCatalog(c))
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [root]);

  const value = useMemo<TemplatesValue>(
    () => ({ catalog, reload, resolve: (scene) => catalog.get(scene.template)?.template ?? null }),
    [catalog, reload],
  );
  return <TemplatesContext.Provider value={value}>{children}</TemplatesContext.Provider>;
}
