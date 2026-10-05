import { useState } from 'react';
import { FolderOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useWorkspace } from '@/lib/context/WorkspaceContext';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import { touchWorkspace } from '@/lib/db/repositories/workspacesRepo';
import { tauriWorkspaceApi, type WorkspaceApi } from '@/lib/workspace/api';
import { canvasFromPreset, type CanvasPreset } from '@/lib/workspace/schema';

type Step =
  | { name: 'pick' }
  | { name: 'create'; path: string }
  | { name: 'installing'; line: string }
  | { name: 'error'; message: string };

const PRESETS: CanvasPreset[] = ['16:9', '9:16', '1:1', 'custom'];

const baseName = (p: string) => p.replace(/[\\/]+$/, '').split(/[\\/]/).pop() ?? '';

/** 폴더 선택 → 새 워크스페이스 생성 또는 기존 열기. 신뢰 확인은 기존 폴더 열기 시 TrustWorkspaceDialog가 맡는다. */
export function Onboarding({ api = tauriWorkspaceApi }: { api?: WorkspaceApi }) {
  const { t } = useLanguage();
  const { setWorkspaceRoot, trustWorkspace } = useWorkspace();
  const [step, setStep] = useState<Step>({ name: 'pick' });
  const [name, setName] = useState('');
  const [preset, setPreset] = useState<CanvasPreset>('16:9');
  const [custom, setCustom] = useState({ width: 1920, height: 1080 });
  const [fps, setFps] = useState(30);
  const [install, setInstall] = useState(true);
  const [busy, setBusy] = useState(false);

  const fail = (e: unknown) => setStep({ name: 'error', message: e instanceof Error ? e.message : String(e) });

  async function enter(path: string) {
    const kind = await api.openWorkspace(path);
    if (kind.kind === 'workspace') {
      await touchWorkspace({ workspaceId: kind.workspaceId, path, name: kind.name }).catch(() => undefined);
    }
    setWorkspaceRoot(path);
  }

  async function onPick() {
    setBusy(true);
    try {
      const path = await api.pickFolder();
      if (!path) return;
      const kind = await api.inspectFolder(path);
      if (kind.kind === 'workspace') {
        await enter(path);
      } else if (kind.kind === 'empty') {
        setName(baseName(path));
        setStep({ name: 'create', path });
      } else {
        setStep({ name: 'error', message: t('onboarding.notEmpty') });
      }
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  }

  async function onCreate(path: string) {
    setBusy(true);
    try {
      const canvas = canvasFromPreset(preset, fps, preset === 'custom' ? custom : undefined);
      await api.createWorkspace(path, name.trim(), canvas);
      trustWorkspace(path);
      if (install) {
        setStep({ name: 'installing', line: '' });
        // 설치 실패는 워크스페이스 생성을 되돌리지 않는다. 사용자가 나중에 다시 실행할 수 있다.
        await api.installDeps(path, (line) => setStep({ name: 'installing', line })).catch(() => null);
      }
      await enter(path);
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  }

  const customValid = preset !== 'custom' || (custom.width >= 16 && custom.height >= 16);
  const canCreate = name.trim().length > 0 && fps >= 1 && customValid && !busy;

  return (
    <div className="mx-auto flex h-full max-w-lg flex-col justify-center gap-4 p-8">
      <h1 className="text-lg font-semibold">{t('onboarding.title')}</h1>

      {step.name === 'pick' || step.name === 'error' ? (
        <>
          <p className="text-sm text-muted-foreground">{t('onboarding.desc')}</p>
          {step.name === 'error' && (
            <p role="alert" className="text-sm text-destructive">
              {step.message}
            </p>
          )}
          <Button onClick={() => void onPick()} disabled={busy} className="self-start">
            <FolderOpen className="mr-2 h-4 w-4" />
            {t('onboarding.pick')}
          </Button>
        </>
      ) : step.name === 'create' ? (
        <form
          className="flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (canCreate) void onCreate(step.path);
          }}
        >
          <p className="break-all text-xs text-muted-foreground">{step.path}</p>
          <label className="flex flex-col gap-1 text-sm">
            {t('onboarding.name')}
            <Input value={name} onChange={(e) => setName(e.target.value)} autoFocus />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            {t('onboarding.canvas')}
            <select
              value={preset}
              onChange={(e) => setPreset(e.target.value as CanvasPreset)}
              className="h-9 rounded-md border border-input bg-background px-2 text-sm"
            >
              {PRESETS.map((p) => (
                <option key={p} value={p}>
                  {p === 'custom' ? t('onboarding.custom') : p}
                </option>
              ))}
            </select>
          </label>
          {preset === 'custom' && (
            <div className="flex gap-2">
              <Input
                aria-label={t('onboarding.width')}
                type="number"
                value={custom.width}
                onChange={(e) => setCustom({ ...custom, width: Number(e.target.value) })}
              />
              <Input
                aria-label={t('onboarding.height')}
                type="number"
                value={custom.height}
                onChange={(e) => setCustom({ ...custom, height: Number(e.target.value) })}
              />
            </div>
          )}
          <label className="flex flex-col gap-1 text-sm">
            {t('onboarding.fps')}
            <Input type="number" min={1} max={120} value={fps} onChange={(e) => setFps(Number(e.target.value))} />
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={install} onChange={(e) => setInstall(e.target.checked)} />
            {t('onboarding.install')}
          </label>
          <div className="flex gap-2">
            <Button type="submit" disabled={!canCreate}>
              {t('onboarding.create')}
            </Button>
            <Button type="button" variant="ghost" disabled={busy} onClick={() => setStep({ name: 'pick' })}>
              {t('onboarding.back')}
            </Button>
          </div>
        </form>
      ) : (
        <p className="text-sm text-muted-foreground" role="status">
          {t('onboarding.installing')} {step.line}
        </p>
      )}
    </div>
  );
}
