import { useState } from 'react';
import { Copy, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { TemplateEditor } from '@/components/guides/TemplateEditor';
import { TemplatesProvider } from '@/components/guides/TemplatesContext';
import { useTemplates } from '@/components/guides/templatesContextValue';
import { useWorkspace } from '@/lib/context/WorkspaceContext';
import type { CatalogEntry } from '@/lib/guides/resolve';
import { draftFromTemplate, duplicateDraft, saveDraft, type TemplateDraft } from '@/lib/guides/templateEditor';
import { useLanguage } from '@/lib/i18n/LanguageContext';

type Editing = { draft: TemplateDraft; parent: NonNullable<CatalogEntry['template']>; isNew: boolean };

function Inner({ root }: { root: string }) {
  const { t, locale } = useLanguage();
  const lang = locale === 'en' ? 'en' : 'ko';
  const { catalog, reload } = useTemplates();
  const [editing, setEditing] = useState<Editing | null>(null);
  const [dup, setDup] = useState<{ parent: NonNullable<CatalogEntry['template']>; id: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const entries = [...catalog.entries].sort((a, b) => a.ref.localeCompare(b.ref) || a.source.localeCompare(b.source));

  async function save(d: TemplateDraft) {
    await saveDraft(root, d);
    await reload();
    setEditing(null);
  }

  function startEdit(e: CatalogEntry) {
    if (!e.raw) return;
    const parentRef = e.raw.meta.extends;
    // 부모: 같은 ref를 확장하면 더 낮은 출처의 항목, 아니면 그 ref의 최상위 항목
    const parent = catalog.entries.find((x) => x.ref === parentRef && x.template && (parentRef !== e.ref || x.source !== e.source))?.template;
    if (!parent) {
      setError(t('templates.parentMissing', { parent: parentRef ?? '' }));
      return;
    }
    setError(null);
    setEditing({ draft: draftFromTemplate(e.raw), parent, isNew: false });
  }

  if (editing) {
    return (
      <div className="space-y-4">
        <h2 className="text-lg font-bold">{editing.isNew ? t('templates.newTitle') : t('templates.editTitle', { ref: `${editing.draft.id}@${editing.draft.version}` })}</h2>
        <TemplateEditor draft={editing.draft} parent={editing.parent} isNew={editing.isNew} onSave={save} onCancel={() => setEditing(null)} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold">{t('templates.title')}</h2>
        <p className="mt-1 text-xs text-muted-foreground">{t('templates.desc')}</p>
      </div>
      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
      <ul className="space-y-2" data-testid="template-list">
        {entries.map((e) => (
          <li key={`${e.source}:${e.ref}`} className="flex items-start gap-3 rounded-md border border-border p-3 text-xs">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <b className="text-sm">{e.raw?.meta.label[lang] ?? e.ref}</b>
                <span className="font-mono text-muted-foreground">{e.ref}</span>
                <span className="rounded bg-muted px-1.5 py-0.5">{t(`templates.source.${e.source}`)}</span>
                {e.type && <span className="rounded bg-muted px-1.5 py-0.5">{t(`scene.type.${e.type}`)}</span>}
              </div>
              {e.error ? (
                <p role="alert" className="mt-1 text-destructive">
                  {t('templates.refused', { reason: e.error })}
                </p>
              ) : (
                <p className="mt-1 text-muted-foreground">{t('templates.ok')}</p>
              )}
              {e.skipped.length > 0 && <p className="mt-1 text-warning">{t('templates.skipped', { list: e.skipped.join(', ') })}</p>}
            </div>
            {e.template && (
              <Button size="sm" variant="outline" onClick={() => setDup({ parent: e.template!, id: '' })}>
                <Copy className="mr-1 h-3 w-3" />
                {t('templates.duplicate')}
              </Button>
            )}
            {e.source === 'workspace' && e.raw?.meta.extends && (
              <Button size="sm" variant="outline" onClick={() => startEdit(e)}>
                <Pencil className="mr-1 h-3 w-3" />
                {t('templates.edit')}
              </Button>
            )}
          </li>
        ))}
      </ul>

      {dup && (
        <form
          className="flex items-end gap-2 rounded-md border border-border p-3"
          onSubmit={(ev) => {
            ev.preventDefault();
            if (!/^[a-z0-9][a-z0-9-]*$/.test(dup.id)) return;
            setEditing({ draft: duplicateDraft(dup.parent, dup.id, { ko: dup.parent.meta.label.ko, en: dup.parent.meta.label.en }), parent: dup.parent, isNew: true });
            setDup(null);
          }}
        >
          <label className="flex flex-1 flex-col gap-1 text-xs">
            {t('templates.newId', { parent: dup.parent.ref })}
            <Input value={dup.id} autoFocus onChange={(e) => setDup({ ...dup, id: e.target.value })} placeholder="my-template" />
          </label>
          <Button type="submit" disabled={!/^[a-z0-9][a-z0-9-]*$/.test(dup.id)}>
            {t('templates.create')}
          </Button>
          <Button type="button" variant="ghost" onClick={() => setDup(null)}>
            {t('templates.cancel')}
          </Button>
        </form>
      )}
    </div>
  );
}

/** 설정 › 가이드 템플릿: 내장·사용자 템플릿 목록, 복제, 편집. 검증에 실패한 템플릿은 이유와 함께 "사용 거부"로 표시한다. */
export function SettingsTemplates() {
  const { t } = useLanguage();
  const { workspaceRoot } = useWorkspace();
  if (!workspaceRoot) return <p className="text-sm text-muted-foreground">{t('settingsWorkspace.none')}</p>;
  return (
    <TemplatesProvider root={workspaceRoot}>
      <Inner root={workspaceRoot} />
    </TemplatesProvider>
  );
}

export default SettingsTemplates;
