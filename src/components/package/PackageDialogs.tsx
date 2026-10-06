import { useState } from 'react';
import { open, save } from '@tauri-apps/plugin-dialog';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import { createPackage, inspectPackage, packageErrorKey } from '@/lib/package/api';
import { createImportDeps, importScenes, scenesInPackage, type ImportResult } from '@/lib/package/import';
import { PACKAGE_EXTENSION, schemaCompatibility, type PackageInfo, type PackReport } from '@/lib/package/manifest';
import type { TemplateResolver, WorkspaceRef } from '@/lib/scene/files';

const messageOf = (e: unknown): string => (typeof e === 'string' ? e : e instanceof Error ? e.message : String(e));

function useErrorText() {
  const { t } = useLanguage();
  return (e: unknown): string => {
    const message = messageOf(e);
    const key = packageErrorKey(message);
    return key ? t(key) : t('package.err.other', { error: message });
  };
}

const fmtBytes = (n: number): string => (n < 1024 ? `${n} B` : n < 1024 * 1024 ? `${(n / 1024).toFixed(1)} KB` : `${(n / 1024 / 1024).toFixed(1)} MB`);

// ---- 내보내기 --------------------------------------------------------------------------------

export interface ExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  root: string;
  workspaceName: string;
  /** 지금 고른 신(없으면 null). */
  selected: { slug: string; name: string } | null;
  /** 사용자 정의 템플릿 중 패키지에 동봉할 폴더와, 워크스페이스에 없어 못 담는 템플릿(전역 폴더). */
  templates: (scope: 'sequence' | 'scene') => { dirs: string[]; missing: string[] };
}

export function ExportDialog({ open: isOpen, onOpenChange, root, workspaceName, selected, templates }: ExportDialogProps) {
  const { t } = useLanguage();
  const errorText = useErrorText();
  const [scope, setScope] = useState<'sequence' | 'scene'>('sequence');
  const [media, setMedia] = useState(false);
  const [busy, setBusy] = useState(false);
  const [report, setReport] = useState<PackReport | null>(null);
  const [error, setError] = useState<string | null>(null);

  const effectiveScope = scope === 'scene' && selected ? 'scene' : 'sequence';
  const tpl = templates(effectiveScope);

  async function run() {
    setError(null);
    setReport(null);
    const base = effectiveScope === 'scene' && selected ? selected.slug : workspaceName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'sequence';
    const out = await save({ defaultPath: `${base}.${PACKAGE_EXTENSION}`, filters: [{ name: t('package.filter'), extensions: [PACKAGE_EXTENSION] }] });
    if (!out) return;
    setBusy(true);
    try {
      setReport(await createPackage(root, out, { scene: effectiveScope === 'scene' ? selected?.slug : undefined, includeReferenceMedia: media, templateDirs: tpl.dirs }));
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" data-testid="export-dialog">
        <DialogHeader>
          <DialogTitle>{t('package.export.title')}</DialogTitle>
          <DialogDescription>{t('package.export.desc')}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 text-xs">
          <fieldset className="space-y-1">
            <label className="flex items-center gap-2">
              <input type="radio" name="scope" checked={effectiveScope === 'sequence'} onChange={() => setScope('sequence')} />
              {t('package.export.sequence')}
            </label>
            <label className="flex items-center gap-2">
              <input type="radio" name="scope" disabled={!selected} checked={effectiveScope === 'scene'} onChange={() => setScope('scene')} />
              {selected ? t('package.export.scene', { name: selected.name }) : t('package.export.sceneNone')}
            </label>
          </fieldset>
          <label className="flex items-start gap-2">
            <input type="checkbox" className="mt-0.5" checked={media} onChange={(e) => setMedia(e.target.checked)} />
            <span>
              {t('package.export.media')}
              <span className="block text-muted-foreground">{t('package.export.mediaHint')}</span>
            </span>
          </label>
          {tpl.dirs.length > 0 && <p className="text-muted-foreground">{t('package.export.templates', { list: tpl.dirs.map((d) => d.split('/')[1]).join(', ') })}</p>}
          {tpl.missing.length > 0 && (
            <p role="alert" className="flex items-start gap-1 text-warning">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              {t('package.export.templatesMissing', { list: tpl.missing.map((d) => d.split('/')[1]).join(', ') })}
            </p>
          )}
          {report && (
            <p role="status" className="text-success" data-testid="export-result">
              {t('package.export.done', { files: report.files, size: fmtBytes(report.bytes) })}
            </p>
          )}
          {error && (
            <p role="alert" className="text-destructive">
              {error}
            </p>
          )}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            {t('package.close')}
          </Button>
          <Button disabled={busy} onClick={() => void run()}>
            {busy && <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />}
            {t('package.export.run')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---- 가져오기 --------------------------------------------------------------------------------

export interface ImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  root: string;
  workspace: WorkspaceRef;
  /** 템플릿을 푼 뒤 카탈로그를 다시 읽어 얻는 신 해석기. */
  resolverAfterTemplates: () => Promise<TemplateResolver>;
  /** 가져오기가 끝나 목록을 다시 읽어야 할 때. */
  onImported: () => void;
}

export function ImportDialog({ open: isOpen, onOpenChange, root, workspace, resolverAfterTemplates, onImported }: ImportDialogProps) {
  const { t } = useLanguage();
  const errorText = useErrorText();
  const [file, setFile] = useState<string | null>(null);
  const [info, setInfo] = useState<PackageInfo | null>(null);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [trusted, setTrusted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setFile(null);
    setInfo(null);
    setPicked(new Set());
    setTrusted(false);
    setResult(null);
    setError(null);
  }

  async function choose() {
    setError(null);
    setResult(null);
    const path = await open({ multiple: false, filters: [{ name: t('package.filter'), extensions: [PACKAGE_EXTENSION] }] });
    if (typeof path !== 'string') return;
    setBusy(true);
    try {
      // 열기 전 검사: 이 단계에서 어떤 파일도 쓰지 않는다.
      const checked = await inspectPackage(path);
      setFile(path);
      setInfo(checked);
      setPicked(new Set(scenesInPackage(checked)));
      setTrusted(false);
    } catch (e) {
      setFile(null);
      setInfo(null);
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  const compat = info ? schemaCompatibility(info.manifest) : null;
  const scenes = info ? scenesInPackage(info) : [];
  const canImport = Boolean(info && file && compat?.ok && picked.size > 0 && trusted && !busy);

  async function run() {
    if (!info || !file) return;
    setBusy(true);
    setError(null);
    try {
      const r = await importScenes(root, workspace, file, info, scenes.filter((s) => picked.has(s)), createImportDeps(resolverAfterTemplates));
      setResult(r);
      onImported();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(o) => {
        if (!o) reset();
        onOpenChange(o);
      }}
    >
      <DialogContent className="sm:max-w-lg" data-testid="import-dialog">
        <DialogHeader>
          <DialogTitle>{t('package.import.title')}</DialogTitle>
          <DialogDescription>{t('package.import.desc')}</DialogDescription>
        </DialogHeader>

        <div className="space-y-3 text-xs">
          <Button variant="outline" size="sm" disabled={busy} onClick={() => void choose()}>
            {busy && !info && <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />}
            {t('package.import.choose')}
          </Button>

          {info && (
            <>
              <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
                <dt className="text-muted-foreground">{t('package.import.kind')}</dt>
                <dd>{t(`package.kind.${info.manifest.kind}`)}</dd>
                <dt className="text-muted-foreground">{t('package.import.from')}</dt>
                <dd className="break-all">{info.manifest.workspace.name}</dd>
                <dt className="text-muted-foreground">{t('package.import.app')}</dt>
                <dd>
                  {info.manifest.app.name} {info.manifest.app.version}
                </dd>
                <dt className="text-muted-foreground">{t('package.import.size')}</dt>
                <dd>{t('package.import.sizeValue', { files: info.manifest.files.length, size: fmtBytes(info.totalBytes) })}</dd>
              </dl>

              {compat && !compat.ok && (
                <p role="alert" className="flex items-start gap-1 text-destructive">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  {t('package.import.incompatible', { reason: compat.reason })}
                </p>
              )}

              <fieldset className="space-y-1">
                <legend className="font-medium">{t('package.import.scenes')}</legend>
                {scenes.map((s) => (
                  <label key={s} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={picked.has(s)}
                      onChange={(e) =>
                        setPicked((cur) => {
                          const next = new Set(cur);
                          if (e.target.checked) next.add(s);
                          else next.delete(s);
                          return next;
                        })
                      }
                    />
                    {s}
                  </label>
                ))}
              </fieldset>

              <section className="space-y-1 rounded border border-warning/50 bg-warning/10 p-2" data-testid="import-review">
                <p className="flex items-start gap-1 font-medium text-warning">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  {t('package.import.review')}
                </p>
                <ul className="max-h-28 list-disc space-y-0.5 overflow-auto pl-5 break-all">
                  {info.reviewFiles.length === 0 ? <li className="list-none text-muted-foreground">{t('package.import.reviewNone')}</li> : info.reviewFiles.map((f) => <li key={f}>{f}</li>)}
                </ul>
                {info.manifest.templates.length > 0 && <p>{t('package.import.templates', { list: info.manifest.templates.map((d) => d.split('/')[1]).join(', ') })}</p>}
                <label className="flex items-start gap-2 pt-1">
                  <input type="checkbox" className="mt-0.5" checked={trusted} onChange={(e) => setTrusted(e.target.checked)} />
                  {t('package.import.trust')}
                </label>
              </section>
            </>
          )}

          {result && (
            <div role="status" data-testid="import-result" className="space-y-1">
              <p className="text-success">{t('package.import.done', { count: result.imported.length })}</p>
              {result.edgesAdded > 0 && <p>{t('package.import.edges', { count: result.edgesAdded })}</p>}
              {result.templates.imported.length > 0 && <p>{t('package.import.templatesImported', { list: result.templates.imported.map((d) => d.split('/')[1]).join(', ') })}</p>}
              {result.templates.skipped.length > 0 && <p className="text-muted-foreground">{t('package.import.templatesSkipped', { list: result.templates.skipped.map((d) => d.split('/')[1]).join(', ') })}</p>}
              {result.imported.some((i) => i.templateUnavailable) && <p className="text-warning">{t('package.import.templateUnavailable')}</p>}
              {result.failed.map((f) => (
                <p key={f.sourceSlug} role="alert" className="text-destructive">
                  {t('package.import.failed', { name: f.sourceSlug, error: (packageErrorKey(f.error) ? t(packageErrorKey(f.error) as string) : f.error) })}
                </p>
              ))}
            </div>
          )}
          {error && (
            <p role="alert" className="text-destructive">
              {error}
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            {t('package.close')}
          </Button>
          <Button disabled={!canImport} onClick={() => void run()}>
            {busy && info && <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />}
            {t('package.import.run')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
