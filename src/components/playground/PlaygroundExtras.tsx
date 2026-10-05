// Import/export extras (T6.10, S): template folder validation (F-TPL-03),
// frame.md editing (F-DSN-06), DESIGN.md import/export (F-DSN-07), and user
// palette save/import/export (F-PAL-08). Rendered inside the playground side
// panel; every section degrades to a "no project" hint without a folder.
import { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import { useSafeWorkspace } from '@/lib/context/WorkspaceContext';
import { projectPath } from '@/lib/workspace/files';
import { listProjectPalettes, saveProjectPalette, type PaletteFile } from '@/lib/design/palettes';
import { parseDesign } from '@/lib/design/parse';
import { designToDtcgJson, designToTailwindCss, downloadTextFile, validateDesignImport } from '@/lib/playground/designIo';
import { isImportableFolder, validateTemplateFolder } from '@/lib/playground/templateImport';
import { loadFrameMd, saveFrameMd, starterFrameMd, validateFrameMd } from '@/lib/playground/frameMd';
import { designTextToColors, exportPaletteFile, importPaletteText, paletteFromDesignColors, slugifyPaletteName } from '@/lib/playground/paletteIo';

const errorMessage = (e: unknown) => (e instanceof Error ? e.message : String(e));

function Section({ title, desc, children }: { title: string; desc: string; children: React.ReactNode }) {
  return (
    <section className="border-b border-border p-3 last:border-b-0">
      <h3 className="text-[11px] font-semibold text-foreground">{title}</h3>
      <p className="mt-0.5 text-[11px] text-muted-foreground">{desc}</p>
      <div className="mt-2 space-y-2">{children}</div>
    </section>
  );
}

function TemplateImportSection() {
  const { t } = useLanguage();
  const [folder, setFolder] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [failed, setFailed] = useState<string | null>(null);

  const onValidate = () => {
    const dir = folder.trim();
    if (!dir) return;
    setBusy(true);
    setResult(null);
    setFailed(null);
    invoke<{ name: string; is_dir: boolean }[]>('list_dir', { path: dir, workspaceRoot: dir }).then(
      (entries) => {
        const names = entries.filter((e) => !e.is_dir).map((e) => e.name);
        const readManifest = names.includes('template.json')
          ? invoke<string>('read_text_file', { path: `${dir.replace(/[\\/]+$/, '')}/template.json`, workspaceRoot: dir }).catch(() => null)
          : Promise.resolve(null);
        readManifest.then(
          (text) => {
            setBusy(false);
            const report = validateTemplateFolder(names, text);
            if (isImportableFolder(report)) {
              setResult(t('playground.template.valid', { name: report.manifest?.name ?? report.manifest?.id ?? dir }));
            } else {
              const reason = report.manifestError ?? `missing: ${report.missing.join(', ')}`;
              setFailed(t('playground.template.invalid', { error: reason }));
            }
          },
          (e: unknown) => {
            setBusy(false);
            setFailed(t('playground.template.invalid', { error: errorMessage(e) }));
          },
        );
      },
      (e: unknown) => {
        setBusy(false);
        setFailed(t('playground.template.invalid', { error: errorMessage(e) }));
      },
    );
  };

  return (
    <Section title={t('playground.template.title')} desc={t('playground.template.desc')}>
      <label className="block text-[11px] text-muted-foreground">
        {t('playground.template.folderLabel')}
        <input
          value={folder}
          onChange={(e) => setFolder(e.target.value)}
          placeholder={t('playground.template.folderPlaceholder')}
          className="mt-1 h-7 w-full rounded-md border border-input bg-background px-2 text-xs text-foreground placeholder:text-muted-foreground"
        />
      </label>
      <Button size="sm" variant="outline" disabled={busy || !folder.trim()} onClick={onValidate}>
        {busy && <Loader2 className="h-3 w-3 animate-spin" aria-hidden />}
        {t('playground.template.validate')}
      </Button>
      {result && <p role="status" className="text-[11px] text-foreground">{result}</p>}
      {failed && <p role="alert" className="text-[11px] text-destructive">{failed}</p>}
    </Section>
  );
}

function FrameMdSection({ root }: { root: string | null }) {
  const { t } = useLanguage();
  const [cached, setCached] = useState<{ root: string; text: string } | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!root) return;
    let cancelled = false;
    loadFrameMd(root).then(
      (loaded) => {
        if (cancelled) return;
        setCached({ root, text: loaded.exists ? loaded.text : starterFrameMd(root.split(/[\\/]/).pop() ?? root) });
        if (!loaded.exists) setNotice(null);
      },
      (e: unknown) => {
        if (cancelled) return;
        setFailed(t('playground.frame.loadFailed', { error: errorMessage(e) }));
      },
    );
    return () => {
      cancelled = true;
    };
  }, [root, t]);

  if (!root) {
    return (
      <Section title={t('playground.frame.title')} desc={t('playground.frame.desc')}>
        <p className="text-[11px] text-muted-foreground">{t('playground.frame.noProject')}</p>
      </Section>
    );
  }
  const text = cached && cached.root === root ? cached.text : null;

  const onSave = () => {
    if (text === null) return;
    setSaving(true);
    setNotice(null);
    setFailed(null);
    saveFrameMd(root, text).then(
      () => {
        setSaving(false);
        setNotice(t('playground.frame.saved'));
      },
      (e: unknown) => {
        setSaving(false);
        setFailed(t('playground.frame.saveFailed', { error: errorMessage(e) }));
      },
    );
  };

  return (
    <Section title={t('playground.frame.title')} desc={t('playground.frame.desc')}>
      {text === null ? (
        <p className="flex items-center gap-2 text-[11px] text-muted-foreground">
          <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
          {t('playground.panel.loading')}
        </p>
      ) : (
        <>
          <textarea
            aria-label={t('playground.frame.title')}
            value={text}
            onChange={(e) => setCached({ root, text: e.target.value })}
            rows={8}
            className="w-full rounded-md border border-input bg-background p-2 font-mono text-[11px] text-foreground"
          />
          <div className="flex items-center gap-1.5">
            <Button size="sm" onClick={onSave} disabled={saving || !validateFrameMd(text).ok}>
              {saving ? t('playground.frame.saving') : t('playground.frame.save')}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setCached({ root, text: starterFrameMd(root.split(/[\\/]/).pop() ?? root) })}>
              {t('playground.frame.starter')}
            </Button>
          </div>
        </>
      )}
      {notice && <p role="status" className="text-[11px] text-muted-foreground">{notice}</p>}
      {failed && <p role="alert" className="text-[11px] text-destructive">{failed}</p>}
    </Section>
  );
}

function DesignIoSection({ root }: { root: string | null }) {
  const { t } = useLanguage();
  const [cached, setCached] = useState<{ root: string; text: string } | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [pasted, setPasted] = useState('');
  const [importResult, setImportResult] = useState<string | null>(null);

  useEffect(() => {
    if (!root) return;
    let cancelled = false;
    invoke<string>('read_text_file', { path: projectPath(root, 'DESIGN.md'), workspaceRoot: root }).then(
      (text) => {
        if (!cancelled) setCached({ root, text });
      },
      (e: unknown) => {
        if (!cancelled) setFailed(t('playground.design.exportFailed', { error: errorMessage(e) }));
      },
    );
    return () => {
      cancelled = true;
    };
  }, [root, t]);

  const text = cached && cached.root === (root ?? '') ? cached.text : null;
  const colors = text === null ? null : parseDesign(text).colors;

  const onImport = () => {
    const r = validateDesignImport(pasted);
    setImportResult(r.ok ? t('playground.design.importValid') : t('playground.design.importInvalid', { error: r.error ?? '' }));
  };

  return (
    <Section title={t('playground.design.title')} desc={t('playground.design.desc')}>
      {!root ? (
        <p className="text-[11px] text-muted-foreground">{t('playground.design.noProject')}</p>
      ) : text === null || colors === null ? (
        <p className="text-[11px] text-muted-foreground">{failed ?? t('playground.panel.loading')}</p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          <Button size="sm" variant="outline" onClick={() => downloadTextFile('DESIGN.md', text, 'text/markdown')}>
            {t('playground.design.exportMd')}
          </Button>
          <Button size="sm" variant="outline" onClick={() => downloadTextFile('tokens.css', designToTailwindCss(colors), 'text/css')}>
            {t('playground.design.exportCss')}
          </Button>
          <Button size="sm" variant="outline" onClick={() => downloadTextFile('tokens.dtcg.json', designToDtcgJson(colors), 'application/json')}>
            {t('playground.design.exportDtcg')}
          </Button>
        </div>
      )}
      {failed && <p role="alert" className="text-[11px] text-destructive">{failed}</p>}
      <label className="block text-[11px] text-muted-foreground">
        {t('playground.design.importLabel')}
        <textarea
          value={pasted}
          onChange={(e) => setPasted(e.target.value)}
          placeholder={t('playground.design.importPlaceholder')}
          rows={4}
          className="mt-1 w-full rounded-md border border-input bg-background p-2 font-mono text-[11px] text-foreground placeholder:text-muted-foreground"
        />
      </label>
      <Button size="sm" variant="outline" disabled={!pasted.trim()} onClick={onImport}>
        {t('playground.design.import')}
      </Button>
      {importResult && <p role="status" className="text-[11px] text-muted-foreground">{importResult}</p>}
    </Section>
  );
}

function PaletteIoSection({ root }: { root: string | null }) {
  const { t } = useLanguage();
  const [palettes, setPalettes] = useState<{ root: string; list: PaletteFile[] } | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pasted, setPasted] = useState('');
  const [name, setName] = useState('');

  const reload = (scope: string) => {
    listProjectPalettes(scope).then(
      (list) => setPalettes({ root: scope, list }),
      (e: unknown) => setFailed(t('playground.palette.fromDesignFailed', { error: errorMessage(e) })),
    );
  };

  useEffect(() => {
    if (!root) return;
    let cancelled = false;
    listProjectPalettes(root).then(
      (list) => {
        if (!cancelled) setPalettes({ root, list });
      },
      (e: unknown) => {
        if (!cancelled) setFailed(t('playground.palette.fromDesignFailed', { error: errorMessage(e) }));
      },
    );
    return () => {
      cancelled = true;
    };
  }, [root, t]);

  if (!root) {
    return (
      <Section title={t('playground.palette.title')} desc={t('playground.palette.desc')}>
        <p className="text-[11px] text-muted-foreground">{t('playground.palette.noProject')}</p>
      </Section>
    );
  }
  const list = palettes && palettes.root === root ? palettes.list : null;

  const onImport = () => {
    setFailed(null);
    setNotice(null);
    const parsed = importPaletteText(pasted);
    if (!parsed.ok) {
      setFailed(t('playground.palette.importInvalid', { error: parsed.error }));
      return;
    }
    saveProjectPalette(root, parsed.palette).then(
      () => {
        setNotice(t('playground.palette.imported', { name: parsed.palette.name }));
        setPasted('');
        reload(root);
      },
      (e: unknown) => setFailed(t('playground.palette.importInvalid', { error: errorMessage(e) })),
    );
  };

  const onFromDesign = () => {
    setFailed(null);
    setNotice(null);
    invoke<string>('read_text_file', { path: projectPath(root, 'DESIGN.md'), workspaceRoot: root }).then(
      (text) => {
        try {
          const colors = designTextToColors(text);
          const label = name.trim() || 'From DESIGN.md';
          const palette = paletteFromDesignColors(colors, {
            id: slugifyPaletteName(label, `user-${Date.now()}`),
            name: label,
            scheme: 'light',
          });
          saveProjectPalette(root, palette).then(
            () => {
              setNotice(t('playground.palette.fromDesignSaved'));
              reload(root);
            },
            (e: unknown) => setFailed(t('playground.palette.fromDesignFailed', { error: errorMessage(e) })),
          );
        } catch (e) {
          setFailed(t('playground.palette.fromDesignFailed', { error: errorMessage(e) }));
        }
      },
      (e: unknown) => setFailed(t('playground.palette.fromDesignFailed', { error: errorMessage(e) })),
    );
  };

  return (
    <Section title={t('playground.palette.title')} desc={t('playground.palette.desc')}>
      {list === null ? (
        <p className="flex items-center gap-2 text-[11px] text-muted-foreground">
          <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
          {t('playground.panel.loading')}
        </p>
      ) : list.length === 0 ? (
        <p className="text-[11px] text-muted-foreground">{t('playground.palette.empty')}</p>
      ) : (
        <ul className="flex flex-col gap-1">
          {list.map((p) => (
            <li key={p.id} className="flex items-center gap-1.5 rounded border border-border p-1.5">
              <span className="min-w-0 flex-1 truncate text-[11px] text-foreground" title={p.name}>{p.name}</span>
              <Button size="sm" variant="outline" className="h-6 px-2 text-[11px]" onClick={() => downloadTextFile(`${p.id}.palette.json`, exportPaletteFile(p), 'application/json')}>
                {t('playground.palette.export')}
              </Button>
            </li>
          ))}
        </ul>
      )}
      <label className="block text-[11px] text-muted-foreground">
        {t('playground.palette.importLabel')}
        <textarea
          value={pasted}
          onChange={(e) => setPasted(e.target.value)}
          placeholder={t('playground.palette.importPlaceholder')}
          rows={3}
          className="mt-1 w-full rounded-md border border-input bg-background p-2 font-mono text-[11px] text-foreground placeholder:text-muted-foreground"
        />
      </label>
      <div className="flex flex-wrap items-center gap-1.5">
        <Button size="sm" variant="outline" disabled={!pasted.trim()} onClick={onImport}>
          {t('playground.palette.import')}
        </Button>
        <input
          aria-label={t('palette.editor.name')}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t('palette.editor.name')}
          className="h-7 w-32 rounded-md border border-input bg-background px-2 text-xs text-foreground placeholder:text-muted-foreground"
        />
        <Button size="sm" variant="outline" onClick={onFromDesign}>
          {t('playground.palette.fromDesign')}
        </Button>
      </div>
      {notice && <p role="status" className="text-[11px] text-muted-foreground">{notice}</p>}
      {failed && <p role="alert" className="text-[11px] text-destructive">{failed}</p>}
    </Section>
  );
}

export function PlaygroundExtras() {
  const root = useSafeWorkspace()?.workspaceRoot ?? null;
  return (
    <div data-testid="playground-extras" className="flex flex-col">
      <TemplateImportSection />
      <FrameMdSection root={root} />
      <DesignIoSection root={root} />
      <PaletteIoSection root={root} />
    </div>
  );
}

export default PlaygroundExtras;
