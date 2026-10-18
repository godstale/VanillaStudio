import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { DesignSummary } from '@/components/design/DesignSummary';
import { checkDesign } from '@/components/design/designChecks';
import { PaletteLibrary } from '@/components/design/PaletteLibrary';
import { StringList } from '@/components/guides/StringList';
import { BUILT_IN_PALETTES, listProjectPalettes, type PaletteFile } from '@/lib/design/palettes';
import { readMood, writeMood } from '@/lib/design/mood';
import { applyPalette, createSceneOverride, hasSceneOverride, readDesign, sceneDesignPath, writeDesign } from '@/lib/design/workspaceDesign';
import { recordStudioChange } from '@/lib/workspace/workOrder';
import { useLanguage } from '@/lib/i18n/LanguageContext';

export interface DesignSectionProps {
  root: string;
  /** 선택한 신의 폴더 이름(오버라이드 파일 위치). */
  slug: string;
}

/** 인스펙터 DESIGN 섹션: 토큰 요약·대비 경고, 팔레트 적용(colors만 교체), 분위기 키워드, 신 오버라이드(extends). */
export function DesignSection({ root, slug }: DesignSectionProps) {
  const { t } = useLanguage();
  const [text, setText] = useState<string | null | undefined>(undefined); // undefined = 읽는 중
  const [palettes, setPalettes] = useState<PaletteFile[]>(BUILT_IN_PALETTES);
  const [override, setOverride] = useState(false);
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const [design, mine, hasOverride] = await Promise.all([
        readDesign(root).catch(() => null),
        listProjectPalettes(root).catch(() => []),
        hasSceneOverride(root, slug).catch(() => false),
      ]);
      if (cancelled) return;
      setText(design);
      setPalettes([...BUILT_IN_PALETTES, ...mine]);
      setOverride(hasOverride);
    })();
    return () => {
      cancelled = true;
    };
  }, [root, slug]);

  const write = useCallback(
    async (next: string) => {
      try {
        await writeDesign(root, next);
        setText(next);
        return true;
      } catch (e) {
        setMessage({ kind: 'error', text: e instanceof Error ? e.message : String(e) });
        return false;
      }
    },
    [root],
  );

  async function apply(p: PaletteFile) {
    if (text == null) return;
    const result = applyPalette(text, p);
    if (await write(result.text)) {
      setMessage({ kind: 'ok', text: t('design.section.applied', { name: p.name, count: result.bodyReplacements }) });
      void recordStudioChange(root, {
        scope: 'design',
        targetId: 'DESIGN.md',
        targetName: 'DESIGN.md',
        summary: `컬러 팔레트 "${p.name}"(${p.id}) 적용`,
        fields: ['colors'],
      });
    }
  }

  async function setMood(keywords: string[]) {
    if (text == null) return;
    if (await write(writeMood(text, keywords))) {
      void recordStudioChange(root, {
        scope: 'design',
        targetId: 'DESIGN.md',
        targetName: 'DESIGN.md',
        summary: `디자인 분위기(mood) 키워드 변경: ${keywords.join(', ') || '(없음)'}`,
        fields: ['mood'],
      });
    }
  }

  async function makeOverride() {
    try {
      await createSceneOverride(root, slug);
      setOverride(true);
      void recordStudioChange(root, {
        scope: 'design',
        targetId: sceneDesignPath(slug),
        targetName: sceneDesignPath(slug),
        summary: `신 전용 디자인 오버라이드 파일 생성 (${sceneDesignPath(slug)})`,
      });
    } catch (e) {
      setMessage({ kind: 'error', text: e instanceof Error ? e.message : String(e) });
    }
  }

  if (text === undefined) return null;
  if (text === null) return <p className="text-xs text-muted-foreground">{t('design.section.missing')}</p>;

  const check = checkDesign(text);

  return (
    <div className="flex flex-col gap-4" data-testid="design-section">
      <section className="space-y-2">
        <h3 className="text-xs font-semibold">{t('design.section.tokens')}</h3>
        <DesignSummary text={text} />
        {check.contrastFailures > 0 && (
          <ul role="alert" className="space-y-0.5 text-xs text-warning" data-testid="contrast-warnings">
            {check.contrast
              .filter((r) => !r.ok)
              .map((r) => (
                <li key={r.pair}>{t('design.section.contrast', { pair: r.pair, ratio: r.ratio.toFixed(2), min: r.min })}</li>
              ))}
          </ul>
        )}
      </section>

      <section className="space-y-2">
        <h3 className="text-xs font-semibold">{t('design.section.mood')}</h3>
        <StringList label={t('design.section.mood')} value={readMood(text)} onChange={(v) => void setMood(v)} />
      </section>

      <section className="space-y-2">
        <h3 className="text-xs font-semibold">{t('design.section.palette')}</h3>
        <p className="text-[11px] text-muted-foreground">{t('design.section.paletteDesc')}</p>
        <PaletteLibrary
          palettes={palettes}
          actions={(p) => (
            <Button size="sm" variant="outline" className="h-6 px-2 text-xs" onClick={() => void apply(p)}>
              {t('design.section.apply')}
            </Button>
          )}
        />
      </section>

      <section className="space-y-2">
        <h3 className="text-xs font-semibold">{t('design.section.override')}</h3>
        <p className="text-[11px] text-muted-foreground">{t('design.section.overrideDesc', { path: sceneDesignPath(slug) })}</p>
        {override ? (
          <p className="text-xs text-muted-foreground">{t('design.section.overrideOn')}</p>
        ) : (
          <Button size="sm" variant="outline" onClick={() => void makeOverride()}>
            {t('design.section.overrideCreate')}
          </Button>
        )}
      </section>

      {message && (
        <p role="status" className={message.kind === 'error' ? 'text-xs text-destructive' : 'text-xs text-muted-foreground'}>
          {message.text}
        </p>
      )}
    </div>
  );
}
