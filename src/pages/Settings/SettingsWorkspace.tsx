import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { BUILTIN_AGENTS } from '@/lib/agents/registry';
import { useWorkspace } from '@/lib/context/WorkspaceContext';
import * as settingsRepo from '@/lib/db/repositories/settingsRepo';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import { rerenderAllScenes } from '@/lib/scene/files';
import { readWorkspace, updateWorkspace } from '@/lib/workspace/file';
import { canvasFromPreset, CANVAS_PRESETS, type CanvasPreset, type Workspace } from '@/lib/workspace/schema';

const PRESETS: CanvasPreset[] = ['16:9', '9:16', '1:1', 'custom'];

function presetOf(ws: Workspace): CanvasPreset {
  const hit = (Object.keys(CANVAS_PRESETS) as (keyof typeof CANVAS_PRESETS)[]).find(
    (k) => ws.canvas.aspect === k && CANVAS_PRESETS[k].width === ws.canvas.width && CANVAS_PRESETS[k].height === ws.canvas.height,
  );
  return hit ?? 'custom';
}

const looksAbsolute = (p: string) => /^([a-zA-Z]:[\\/]|\/|\\\\)/.test(p);

/** 워크스페이스 설정(D-030·D-031): 캔버스 규격·기본 에이전트·사용자 템플릿 폴더. 캔버스·템플릿이 바뀌면 신 생성물을 다시 렌더한다. */
export function SettingsWorkspace() {
  const { t } = useLanguage();
  const { workspaceRoot } = useWorkspace();
  const [ws, setWs] = useState<Workspace | null>(null);
  const [preset, setPreset] = useState<CanvasPreset>('16:9');
  const [size, setSize] = useState({ width: 1920, height: 1080 });
  const [fps, setFps] = useState(30);
  const [agent, setAgent] = useState('');
  const [templatesDir, setTemplatesDir] = useState('');
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const settings = await settingsRepo.getSettings().catch(() => null);
      if (!cancelled && settings) setTemplatesDir(settings.templatesDir ?? '');
      if (!workspaceRoot) return;
      const w = await readWorkspace(workspaceRoot).catch(() => null);
      if (cancelled || !w) return;
      setWs(w);
      setPreset(presetOf(w));
      setSize({ width: w.canvas.width, height: w.canvas.height });
      setFps(w.canvas.fps);
      setAgent(w.defaultAgent ?? '');
    })();
    return () => {
      cancelled = true;
    };
  }, [workspaceRoot]);

  const sizeValid = preset !== 'custom' || (size.width >= 16 && size.height >= 16 && size.width <= 7680 && size.height <= 7680);
  const fpsValid = Number.isInteger(fps) && fps >= 1 && fps <= 120;
  const dirValid = templatesDir.trim() === '' || looksAbsolute(templatesDir.trim());

  async function save() {
    if (!workspaceRoot || !ws) return;
    setBusy(true);
    setMessage(null);
    try {
      const canvas = canvasFromPreset(preset, fps, preset === 'custom' ? size : undefined);
      const next = await updateWorkspace(workspaceRoot, { canvas, defaultAgent: agent || undefined });
      await settingsRepo.updateSettings({ templatesDir: templatesDir.trim() || null });
      const n = await rerenderAllScenes(workspaceRoot, { id: next.workspaceId, name: next.name });
      setWs(next);
      setMessage({ kind: 'ok', text: t('settingsWorkspace.saved', { count: n }) });
    } catch (e) {
      setMessage({ kind: 'error', text: e instanceof Error ? e.message : String(e) });
    } finally {
      setBusy(false);
    }
  }

  if (!workspaceRoot || !ws) {
    return <p className="text-sm text-muted-foreground">{t('settingsWorkspace.none')}</p>;
  }

  return (
    <form
      className="space-y-6"
      onSubmit={(e) => {
        e.preventDefault();
        if (sizeValid && fpsValid && dirValid && !busy) void save();
      }}
    >
      <div>
        <h2 className="text-lg font-bold">{t('settingsWorkspace.title')}</h2>
        <p className="mt-1 text-xs text-muted-foreground">{ws.name}</p>
      </div>

      <section className="space-y-3 rounded-xl border border-border bg-card/40 p-5">
        <h3 className="text-sm font-semibold">{t('settingsWorkspace.canvas')}</h3>
        <p className="text-xs text-muted-foreground">{t('settingsWorkspace.canvasDesc')}</p>
        <label className="flex flex-col gap-1 text-sm">
          {t('onboarding.canvas')}
          <select
            value={preset}
            onChange={(e) => {
              const p = e.target.value as CanvasPreset;
              setPreset(p);
              if (p !== 'custom') setSize({ ...CANVAS_PRESETS[p] });
            }}
            className="h-9 rounded-md border border-input bg-background px-2 text-sm"
          >
            {PRESETS.map((p) => (
              <option key={p} value={p}>
                {p === 'custom' ? t('onboarding.custom') : p}
              </option>
            ))}
          </select>
        </label>
        <div className="grid grid-cols-3 gap-2">
          <label className="flex flex-col gap-1 text-xs">
            {t('onboarding.width')}
            <Input type="number" disabled={preset !== 'custom'} value={size.width} onChange={(e) => setSize({ ...size, width: Number(e.target.value) })} />
          </label>
          <label className="flex flex-col gap-1 text-xs">
            {t('onboarding.height')}
            <Input type="number" disabled={preset !== 'custom'} value={size.height} onChange={(e) => setSize({ ...size, height: Number(e.target.value) })} />
          </label>
          <label className="flex flex-col gap-1 text-xs">
            {t('onboarding.fps')}
            <Input type="number" min={1} max={120} value={fps} onChange={(e) => setFps(Number(e.target.value))} />
          </label>
        </div>
      </section>

      <section className="space-y-3 rounded-xl border border-border bg-card/40 p-5">
        <h3 className="text-sm font-semibold">{t('settingsWorkspace.agent')}</h3>
        <select
          aria-label={t('settingsWorkspace.agent')}
          value={agent}
          onChange={(e) => setAgent(e.target.value)}
          className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
        >
          <option value="">{t('settingsWorkspace.agentNone')}</option>
          {BUILTIN_AGENTS.map((a) => (
            <option key={a.id} value={a.id}>
              {a.label}
            </option>
          ))}
        </select>
      </section>

      <section className="space-y-3 rounded-xl border border-border bg-card/40 p-5">
        <h3 className="text-sm font-semibold">{t('settingsWorkspace.templatesDir')}</h3>
        <p className="text-xs text-muted-foreground">{t('settingsWorkspace.templatesDirDesc')}</p>
        <Input aria-label={t('settingsWorkspace.templatesDir')} value={templatesDir} onChange={(e) => setTemplatesDir(e.target.value)} placeholder="C:\\Users\\me\\vanilla-templates" />
        {!dirValid && <p className="text-xs text-destructive">{t('settingsWorkspace.dirInvalid')}</p>}
      </section>

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={!sizeValid || !fpsValid || !dirValid || busy}>
          {t('settingsWorkspace.save')}
        </Button>
        {message && (
          <span role="status" className={message.kind === 'error' ? 'text-xs text-destructive' : 'text-xs text-muted-foreground'}>
            {message.text}
          </span>
        )}
      </div>
    </form>
  );
}

export default SettingsWorkspace;
