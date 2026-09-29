import { useProjectInstall } from './projectInstallContext';
import { useState } from 'react';
import { open as openDialog } from '@tauri-apps/plugin-dialog';
import { FolderOpen, Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useWorkspace } from '@/lib/context/WorkspaceContext';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import { seedOpenTabs } from '@/lib/project/openProject';
import {
  DEFAULT_DURATION_SEC,
  FORMAT_PRESETS,
  FPS_OPTIONS,
  defaultWizardValues,
  scaffoldProject,
  validateWizard,
  withOutputType,
  type WizardValues,
} from '@/lib/project/wizard';
import { AGENT_IDS, OUTPUT_TYPES, type ProjectManifest } from '@/lib/types/project';
import { cn } from '@/lib/utils';

export interface CreatedProject {
  path: string;
  manifest: ProjectManifest;
}

export interface NewProjectWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /**
   * 폴더 생성 직후, 프로젝트를 열기 전에 호출되는 단계 훅. 의존성 설치(T1.15)가 여기에 붙는다.
   * reject하면 마법사에 오류가 표시되고 프로젝트는 열리지 않는다(폴더는 남는다).
   */
  onCreated?: (project: CreatedProject) => Promise<void> | void;
}

function Choice({
  selected,
  disabled,
  onClick,
  children,
}: {
  selected: boolean;
  disabled?: boolean;
  onClick?: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      aria-pressed={selected}
      onClick={onClick}
      className={cn(
        'px-2.5 py-1.5 rounded-md border text-xs transition-colors disabled:opacity-60 disabled:cursor-not-allowed',
        selected
          ? 'border-primary bg-primary/10 text-foreground'
          : 'border-border bg-card text-muted-foreground hover:bg-muted/60',
      )}
    >
      {children}
    </button>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <div className="text-[11px] font-medium text-muted-foreground">{label}</div>
      {children}
    </div>
  );
}

export function NewProjectWizard({ open, onOpenChange, onCreated }: NewProjectWizardProps) {
  const requestInstall = useProjectInstall();
  const { t } = useLanguage();
  const { setWorkspaceRoot } = useWorkspace();
  const [values, setValues] = useState<WizardValues>(defaultWizardValues);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const patch = (p: Partial<WizardValues>) => setValues((v) => ({ ...v, ...p }));

  const handleOpenChange = (next: boolean) => {
    if (busy) return;
    if (!next) setError(null);
    onOpenChange(next);
  };

  const pickParent = async () => {
    try {
      const picked = await openDialog({ directory: true, multiple: false });
      if (typeof picked === 'string') patch({ parentDir: picked });
    } catch (err) {
      console.error('Failed to pick parent folder:', err);
    }
  };

  const submit = async () => {
    const result = validateWizard(values);
    if (!result.ok) {
      setError(
        result.detail ? `${t(result.errorKey)} (${result.detail})` : t(result.errorKey),
      );
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const created = await scaffoldProject(
        values.parentDir,
        result.folderName,
        result.manifest.name,
        result.manifestJson,
      );
      await onCreated?.({ path: created.path, manifest: result.manifest });
      requestInstall?.(created.path);
      await seedOpenTabs([
        { id: 'brief:main', type: 'brief', title: t('shell.tab.brief'), pane: 'primary' },
      ]);
      setWorkspaceRoot(created.path);
      setValues(defaultWizardValues());
      onOpenChange(false);
    } catch (err) {
      setError(`${t('project.error.createFailed')}: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setBusy(false);
    }
  };

  const presets = FORMAT_PRESETS[values.outputType];

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base font-semibold">{t('project.wizard.title')}</DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            {t('project.wizard.desc')}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Field label={t('project.field.name')}>
            <Input
              value={values.name}
              onChange={(e) => patch({ name: e.target.value })}
              placeholder={t('project.field.namePlaceholder')}
              maxLength={100}
              autoFocus
            />
          </Field>

          <Field label={t('project.field.type')}>
            <div className="flex flex-wrap gap-1.5">
              {OUTPUT_TYPES.map((type) => (
                <Choice
                  key={type}
                  selected={values.outputType === type}
                  onClick={() => setValues((v) => withOutputType(v, type))}
                >
                  {t(`project.type.${type}`)}
                </Choice>
              ))}
            </div>
          </Field>

          <Field label={t('project.field.format')}>
            <div className="flex flex-wrap gap-1.5">
              {presets.map((p) => (
                <Choice
                  key={p.id}
                  selected={values.presetId === p.id}
                  onClick={() => patch({ presetId: p.id })}
                >
                  {t(p.labelKey)} · {p.width}×{p.height}
                </Choice>
              ))}
            </div>
            {values.outputType === 'video' && (
              <div className="flex items-center gap-3 pt-1">
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] text-muted-foreground">{t('project.field.fps')}</span>
                  {FPS_OPTIONS.map((fps) => (
                    <Choice key={fps} selected={values.fps === fps} onClick={() => patch({ fps })}>
                      {fps}
                    </Choice>
                  ))}
                </div>
                <label className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  {t('project.field.duration')}
                  <Input
                    type="number"
                    min={1}
                    max={3600}
                    value={values.durationSec}
                    onChange={(e) =>
                      patch({ durationSec: Number(e.target.value) || DEFAULT_DURATION_SEC })
                    }
                    className="h-8 w-20 text-xs"
                  />
                </label>
              </div>
            )}
            {values.outputType === 'slides' && (
              <label className="flex items-center gap-1.5 pt-1 text-[11px] text-muted-foreground">
                {t('project.field.slideCount')}
                <Input
                  type="number"
                  min={1}
                  max={500}
                  value={values.slideCount}
                  onChange={(e) => patch({ slideCount: Math.round(Number(e.target.value)) || 1 })}
                  className="h-8 w-20 text-xs"
                />
              </label>
            )}
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label={t('project.field.template')}>
              <Choice selected disabled>
                {t('project.template.none')}
              </Choice>
            </Field>
            <Field label={t('project.field.palette')}>
              <Choice selected disabled>
                {t('project.palette.default')}
              </Choice>
            </Field>
          </div>

          <Field label={t('project.field.agent')}>
            <div className="flex flex-wrap gap-1.5">
              {AGENT_IDS.map((id) => (
                <Choice key={id} selected={values.agent === id} onClick={() => patch({ agent: id })}>
                  {t(`project.agent.${id}`)}
                </Choice>
              ))}
            </div>
          </Field>

          <Field label={t('project.field.location')}>
            <div className="flex gap-2">
              <Input
                readOnly
                value={values.parentDir}
                placeholder={t('project.field.locationPlaceholder')}
                className="text-xs font-mono"
              />
              <Button type="button" variant="outline" size="sm" onClick={() => void pickParent()} className="gap-1.5 shrink-0">
                <FolderOpen className="h-3.5 w-3.5" />
                {t('project.field.browse')}
              </Button>
            </div>
          </Field>

          {error && (
            <div role="alert" className="text-xs text-destructive break-words">
              {error}
            </div>
          )}
        </div>

        <DialogFooter className="flex flex-row justify-end gap-2 sm:justify-end pt-2">
          <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => handleOpenChange(false)}>
            {t('project.wizard.cancel')}
          </Button>
          <Button type="button" size="sm" disabled={busy} onClick={() => void submit()} className="gap-1.5">
            {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {busy ? t('project.wizard.creating') : t('project.wizard.create')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
