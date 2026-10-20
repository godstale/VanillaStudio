import { useEffect, useMemo, useState } from 'react';
import { Loader2, Lock, LockOpen } from 'lucide-react';
import { formatHex, oklch, parse } from 'culori';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useSafeWorkspace } from '@/lib/context/WorkspaceContext';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import type { WorkspaceTab } from '@/lib/types/workspaceTab';
import { isColor } from '@/lib/design/color';
import {
  BUILT_IN_PALETTES,
  getPalette,
  listProjectPalettes,
  paletteDesignColors,
  parsePaletteFile,
  saveProjectPalette,
  type PaletteFile,
} from '@/lib/design/palettes';
import { CORE_ROLES, DERIVED_ROLES, contrastReport, deriveRoles } from '@/lib/design/roles';
import { cn } from '@/lib/utils';

const errorMessage = (e: unknown) => (e instanceof Error ? e.message : String(e));

interface Oklch {
  l: number;
  c: number;
  h: number;
}

function toOklch(hex: string): Oklch | null {
  const parsed = parse(hex);
  if (!parsed) return null;
  const c = oklch(parsed);
  if (!c || c.l === undefined || c.c === undefined) return null;
  return { l: c.l, c: c.c, h: c.h ?? 0 };
}

function fromOklch(v: Oklch): string | null {
  try {
    return formatHex({ mode: 'oklch', l: v.l, c: v.c, h: v.h }) ?? null;
  } catch {
    return null;
  }
}

// One role row: native color picker plus a hex field. The hex field keeps a local draft
// so intermediate input ("#FAF6E") is not rejected while typing; it commits on blur.
function RoleRow({
  role,
  value,
  locked,
  selected,
  onPick,
  onCommit,
  onToggleLock,
  lockLabel,
  unlockLabel,
}: {
  role: string;
  value: string;
  locked: boolean;
  selected: boolean;
  onPick: () => void;
  onCommit: (hex: string) => void;
  onToggleLock: () => void;
  lockLabel: string;
  unlockLabel: string;
}) {
  const [draft, setDraft] = useState('');
  const [editing, setEditing] = useState(false);
  const commit = () => {
    setEditing(false);
    if (isColor(draft)) onCommit(draft);
  };
  return (
    <li
      data-testid={`palette-role-${role}`}
      className={cn('flex items-center gap-2 rounded-md border p-1.5', selected ? 'border-primary' : 'border-border')}
    >
      <button
        type="button"
        onClick={onPick}
        aria-label={role}
        title={role}
        className="h-7 w-9 shrink-0 cursor-pointer rounded border border-border p-0.5"
        style={{ backgroundColor: value }}
      />
      <button type="button" onClick={onPick} className="w-20 shrink-0 truncate text-left font-mono text-xs text-foreground">
        {role}
      </button>
      <Input
        value={editing ? draft : value}
        onFocus={() => {
          setDraft(value);
          setEditing(true);
        }}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
        }}
        aria-label={`${role} hex`}
        spellCheck={false}
        className="h-7 font-mono text-xs"
      />
      <input
        type="color"
        value={/^#[0-9a-fA-F]{6}$/.test(value) ? value : '#000000'}
        onChange={(e) => onCommit(e.target.value)}
        aria-label={`${role} picker`}
        className="h-7 w-8 shrink-0 cursor-pointer rounded border border-input bg-transparent p-0.5"
      />
      <Button
        type="button"
        size="icon"
        variant="ghost"
        className="h-7 w-7 shrink-0"
        aria-label={locked ? unlockLabel : lockLabel}
        aria-pressed={locked}
        title={locked ? unlockLabel : lockLabel}
        onClick={onToggleLock}
      >
        {locked ? <Lock className="h-3.5 w-3.5 text-warning" /> : <LockOpen className="h-3.5 w-3.5" />}
      </Button>
    </li>
  );
}

type SaveState = 'idle' | 'saving' | 'saved' | 'error';

/**
 * Palette editor tab (F-PAL-03): per-role colors, OKLCH sliders for the picked role,
 * locks that survive derived-role recomputation, and a contrast table. Saving writes
 * a project-local user palette (`palettes/<id>.json`), so the result
 * is reusable from the review panel and the templates sidepanel.
 */
export function PaletteEditor({ paletteId }: { paletteId: string }) {
  const { t } = useLanguage();
  const root = useSafeWorkspace()?.workspaceRoot ?? null;
  const [base, setBase] = useState<PaletteFile | null>(() => getPalette(BUILT_IN_PALETTES, paletteId));
  // The editor works on the resolved role set so derived roles are editable/lockable too.
  const [colors, setColors] = useState<Record<string, string>>(() => {
    const found = getPalette(BUILT_IN_PALETTES, paletteId);
    return found ? paletteDesignColors(found) : {};
  });
  const [name, setName] = useState(() => getPalette(BUILT_IN_PALETTES, paletteId)?.name ?? '');
  const [tags, setTags] = useState(() => getPalette(BUILT_IN_PALETTES, paletteId)?.tags.join(', ') ?? '');
  const [locked, setLocked] = useState<Set<string>>(new Set());
  const [picked, setPicked] = useState('primary');
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!root) return;
    let cancelled = false;
    listProjectPalettes(root).then((list) => {
      if (cancelled) return;
      const found = getPalette(list, paletteId) ?? getPalette(BUILT_IN_PALETTES, paletteId);
      if (found) {
        setBase(found);
        setColors(paletteDesignColors(found));
        setName(found.name);
        setTags(found.tags.join(', '));
      }
    });
    return () => {
      cancelled = true;
    };
  }, [root, paletteId]);

  const orderedRoles = useMemo(() => {
    const keys = Object.keys(colors);
    const rest = keys.filter((k) => !(CORE_ROLES as readonly string[]).includes(k) && !(DERIVED_ROLES as readonly string[]).includes(k));
    return [...CORE_ROLES.filter((r) => keys.includes(r)), ...DERIVED_ROLES.filter((r) => keys.includes(r)), ...rest];
  }, [colors]);

  const contrast = useMemo(() => {
    try {
      return contrastReport(paletteDesignColors({ ...(base as PaletteFile), colors }));
    } catch {
      return [];
    }
  }, [base, colors]);

  const pickedOklch = toOklch(colors[picked] ?? '');

  const adjustPicked = (patch: Partial<Oklch>) => {
    const current = toOklch(colors[picked] ?? '');
    if (!current) return;
    const hex = fromOklch({ ...current, ...patch });
    if (hex) setColors((c) => ({ ...c, [picked]: hex.toUpperCase() }));
  };

  // Locked derived roles survive recomputation; unlocked ones follow the core roles.
  const rederive = () => {
    const core = Object.fromEntries(CORE_ROLES.map((r) => [r, colors[r]]).filter(([, v]) => typeof v === 'string'));
    let fresh: Record<string, string>;
    try {
      fresh = deriveRoles(core);
    } catch {
      return;
    }
    const keep = Object.fromEntries(DERIVED_ROLES.filter((r) => !locked.has(r)).map((r) => [r, fresh[r]]));
    setColors((c) => ({ ...c, ...keep }));
  };

  const save = () => {
    if (!root || !base || saveState === 'saving') return;
    const candidate = {
      ...base,
      name: name.trim() || base.name,
      tags: tags
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
      colors,
      source: 'user' as const,
    };
    const parsed = parsePaletteFile(candidate);
    if (!parsed.ok) {
      setSaveState('error');
      setError(t('palette.editor.invalid', { error: parsed.error }));
      return;
    }
    setSaveState('saving');
    setError(null);
    void (async () => {
      try {
        await saveProjectPalette(root, parsed.palette);
        setSaveState('saved');
      } catch (e) {
        setSaveState('error');
        setError(t('palette.editor.saveFailed', { error: errorMessage(e) }));
      }
    })();
  };

  if (!base) {
    return (
      <div data-testid="palette-editor" className="p-6 text-sm text-muted-foreground">
        {t('palette.editor.notFound', { id: paletteId })}
      </div>
    );
  }

  return (
    <div data-testid="palette-editor" className="h-full overflow-y-auto">
      <div className="mx-auto max-w-3xl space-y-5 p-6">
        <h2 className="text-base font-semibold text-foreground">{t('palette.editor.title')}</h2>
        {error && (
          <p role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 p-2 text-sm text-destructive">
            {error}
          </p>
        )}

        <section className="grid gap-3 sm:grid-cols-2">
          <label className="space-y-1 text-xs">
            <span className="font-medium text-foreground">{t('palette.editor.name')}</span>
            <Input value={name} onChange={(e) => setName(e.target.value)} aria-label={t('palette.editor.name')} className="h-8" />
          </label>
          <label className="space-y-1 text-xs">
            <span className="font-medium text-foreground">{t('palette.editor.tags')}</span>
            <Input value={tags} onChange={(e) => setTags(e.target.value)} aria-label={t('palette.editor.tags')} className="h-8" />
          </label>
        </section>

        <section className="space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t('palette.editor.roles')}</h3>
          <ul className="space-y-1.5">
            {orderedRoles.map((role) => (
              <RoleRow
                key={role}
                role={role}
                value={colors[role] ?? '#000000'}
                locked={locked.has(role)}
                selected={picked === role}
                onPick={() => setPicked(role)}
                onCommit={(hex) => setColors((c) => ({ ...c, [role]: hex.toUpperCase() }))}
                onToggleLock={() =>
                  setLocked((prev) => {
                    const next = new Set(prev);
                    if (next.has(role)) next.delete(role);
                    else next.add(role);
                    return next;
                  })
                }
                lockLabel={t('palette.editor.lock')}
                unlockLabel={t('palette.editor.unlock')}
              />
            ))}
          </ul>
          <Button type="button" size="sm" variant="outline" onClick={rederive}>
            {t('palette.editor.rederive')}
          </Button>
        </section>

        <section className="space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {t('palette.editor.oklch', { role: picked })}
          </h3>
          {pickedOklch ? (
            <div className="space-y-2 rounded-md border border-border p-3">
              {(
                [
                  ['l', t('palette.editor.lightness'), 0, 1, 0.001],
                  ['c', t('palette.editor.chroma'), 0, 0.37, 0.001],
                  ['h', t('palette.editor.hue'), 0, 360, 1],
                ] as const
              ).map(([key, label, min, max, step]) => (
                <label key={key} className="flex items-center gap-2 text-xs">
                  <span className="w-16 shrink-0 text-muted-foreground">{label}</span>
                  <input
                    type="range"
                    aria-label={`${picked} ${label}`}
                    min={min}
                    max={max}
                    step={step}
                    value={pickedOklch[key]}
                    onChange={(e) => adjustPicked({ [key]: Number(e.target.value) } as Partial<Oklch>)}
                    className="min-w-0 flex-1"
                  />
                  <span className="w-14 shrink-0 text-right font-mono text-muted-foreground">{pickedOklch[key].toFixed(key === 'h' ? 0 : 3)}</span>
                </label>
              ))}
              <p className="font-mono text-xs text-muted-foreground">{colors[picked]}</p>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">{t('palette.editor.selectRole')}</p>
          )}
        </section>

        <section className="space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t('palette.editor.contrast')}</h3>
          {contrast.length > 0 ? (
            <table className="w-full text-left text-xs">
              <thead className="text-muted-foreground">
                <tr>
                  <th className="py-1 font-medium">{t('palette.contrast.pair')}</th>
                  <th className="py-1 font-medium">{t('palette.contrast.ratio')}</th>
                </tr>
              </thead>
              <tbody>
                {contrast.map((row) => (
                  <tr key={row.pair} data-testid={`contrast-${row.pair}`} data-ok={row.ok}>
                    <td className="py-1 font-mono">{row.pair}</td>
                    <td className={cn('py-1 font-mono', !row.ok && 'text-warning')}>
                      {row.ratio}:1 {!row.ok && t('palette.contrast.fail')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="text-xs text-muted-foreground">{t('palette.contrast.unavailable')}</p>
          )}
        </section>

        <div className="flex items-center gap-2">
          {!root ? (
            <p className="text-xs text-muted-foreground">{t('palette.editor.noProject')}</p>
          ) : (
            <Button type="button" disabled={saveState === 'saving'} onClick={save}>
              {saveState === 'saving' ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                  {t('palette.editor.saving')}
                </>
              ) : (
                t('palette.editor.save')
              )}
            </Button>
          )}
          <span data-testid="palette-save-state" role="status" className="text-xs text-muted-foreground">
            {saveState === 'saved' && t('palette.editor.saved')}
          </span>
        </div>
      </div>
    </div>
  );
}

/** Workspace tab `palette:<id>`: reads a serializable `{ paletteId }` from tab meta. */
export function PaletteEditorTab({ tab }: { tab: WorkspaceTab }) {
  const { t } = useLanguage();
  const meta = tab.meta as { paletteId?: unknown } | undefined;
  const paletteId = typeof meta?.paletteId === 'string' ? meta.paletteId : null;
  if (!paletteId) {
    return (
      <div data-testid="palette-editor" className="p-6 text-sm text-muted-foreground">
        {t('palette.editor.notFound', { id: '?' })}
      </div>
    );
  }
  return <PaletteEditor paletteId={paletteId} />;
}

export default PaletteEditor;
