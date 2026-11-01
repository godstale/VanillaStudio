import { X } from 'lucide-react';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import type { Scene } from '@/lib/scene/schema';
import { getStyle, removeSceneStyle } from '@/lib/styles/library';

/** 이 신에 붙은 스타일 칩. 추가는 사이드바 템플릿 화면에서 한다. */
export function SceneStyles({ scene, onChange }: { scene: Scene; onChange: (next: Scene) => void }) {
  const { t, locale } = useLanguage();
  const lang = locale === 'en' ? 'en' : 'ko';
  const styles = scene.styles ?? [];
  return (
    <div className="flex flex-col gap-1 text-xs" data-testid="scene-styles">
      <span className="text-muted-foreground">{t('inspector.styles')}</span>
      {styles.length === 0 ? (
        <p className="text-[11px] text-muted-foreground">{t('inspector.stylesEmpty')}</p>
      ) : (
        <ul className="flex flex-wrap gap-1">
          {styles.map((s) => {
            const name = getStyle(s.id)?.label[lang] ?? s.id;
            return (
              <li key={s.id} className="flex items-center gap-1 rounded bg-muted px-1.5 py-0.5">
                <span>{name}</span>
                <span className="text-[10px] text-muted-foreground">{t(`tpl.style.scope.${s.scope}`)}</span>
                <button type="button" aria-label={t('inspector.styleRemove', { name })} onClick={() => onChange(removeSceneStyle(scene, s.id))} className="rounded hover:bg-accent">
                  <X className="h-3 w-3" />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
