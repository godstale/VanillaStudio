import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { invoke } from '@tauri-apps/api/core';
import { Archive, ExternalLink, FolderClock, FolderOpen, PackageOpen, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EmptyScreen } from '@/components/layout/EmptyScreen';
import { useWorkspace } from '@/lib/context/WorkspaceContext';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import { listRecentWorkspaces, removeWorkspace, type WorkspaceRecord } from '@/lib/db/repositories/workspacesRepo';
import { tauriWorkspaceApi } from '@/lib/workspace/api';
import { useWorkspaceArchive } from '@/lib/workspace/useWorkspaceArchive';
import { listScenes } from '@/lib/scene/files';
import { loadSceneThumbnail } from '@/lib/scene/thumbnail';

/** 워크스페이스 목록 화면: 전환 팝업 대신 전체 화면에서 history 카드를 보여준다. */
export function Workspaces() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const { workspaceRoot, setWorkspaceRoot } = useWorkspace();
  const [recent, setRecent] = useState<WorkspaceRecord[]>([]);
  const [thumbs, setThumbs] = useState<Record<string, string>>({});
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    listRecentWorkspaces(20)
      .then((rows) => !cancelled && setRecent(rows))
      .catch(() => !cancelled && setRecent([]));
    return () => {
      cancelled = true;
    };
  }, []);

  // 카드 썸네일: 각 워크스페이스의 첫 번째 신 썸네일을 가볍게 읽는다.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      for (const w of recent) {
        if (thumbs[w.workspaceId]) continue;
        try {
          const entries = await listScenes(w.path);
          const first = entries.find((e) => e.scene);
          setCounts((m) => ({ ...m, [w.workspaceId]: entries.filter((e) => e.scene).length }));
          if (first) {
            const url = await loadSceneThumbnail(w.path, first.slug).catch(() => null);
            if (url && !cancelled) setThumbs((m) => (m[w.workspaceId] ? m : { ...m, [w.workspaceId]: url }));
          }
        } catch {
          // 읽지 못하면 카드는 이름·경로만 보여준다.
        }
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recent]);

  const openPath = async (path: string) => {
    setError(null);
    try {
      await tauriWorkspaceApi.openWorkspace(path);
      setWorkspaceRoot(path);
      navigate('/workspace');
    } catch {
      setError(t('switcher.openFailed'));
    }
  };

  const archive = useWorkspaceArchive(workspaceRoot, openPath);

  const pickFolder = async () => {
    setError(null);
    try {
      const path = await tauriWorkspaceApi.pickFolder();
      if (!path) return;
      await openPath(path);
    } catch {
      setError(t('switcher.openFailed'));
    }
  };

  const revealCurrent = async () => {
    if (!workspaceRoot) return;
    setError(null);
    try {
      await invoke('reveal_in_explorer', { path: workspaceRoot, workspaceRoot });
    } catch {
      setError(t('workspaces.revealFailed'));
    }
  };

  const handleDelete = async (w: WorkspaceRecord) => {
    try {
      await removeWorkspace(w.workspaceId);
    } catch {
      // 목록에서만 치운다(Switcher와 동일).
    }
    setRecent((prev) => prev.filter((r) => r.workspaceId !== w.workspaceId));
  };

  if (!recent) return null;

  return (
    <div className="flex h-full flex-col gap-4 overflow-auto p-6">
      <div className="flex items-center gap-3">
        <FolderClock className="h-5 w-5 text-muted-foreground" />
        <h1 className="text-base font-semibold">{t('workspaces.title')}</h1>
        <span className="text-xs text-muted-foreground">{t('workspaces.count', { count: recent.length })}</span>
        <div className="ml-auto flex items-center gap-2">
          <Button size="sm" variant="outline" disabled={!workspaceRoot || archive.busy} onClick={() => void archive.pack()}>
            <Archive className="mr-1 h-3.5 w-3.5" />
            {t('archive.pack')}
          </Button>
          <Button size="sm" variant="outline" disabled={archive.busy} onClick={() => void archive.importZip()}>
            <PackageOpen className="mr-1 h-3.5 w-3.5" />
            {t('archive.import')}
          </Button>
          <Button size="sm" onClick={() => void pickFolder()}>
            <FolderOpen className="mr-1 h-3.5 w-3.5" />
            {t('workspaces.openFolder')}
          </Button>
        </div>
      </div>
      {(error || archive.error) && (
        <p role="alert" className="text-xs text-destructive">
          {error ?? archive.error}
        </p>
      )}
      {archive.notice && (
        <p role="status" className="text-xs text-success">
          {archive.notice}
        </p>
      )}
      {workspaceRoot && (
        <div className="flex items-center gap-2">
          <p className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
            {t('workspaces.current')}: {workspaceRoot}
          </p>
          <Button size="sm" variant="outline" onClick={() => void revealCurrent()}>
            <ExternalLink className="mr-1 h-3.5 w-3.5" />
            {t('workspaces.reveal')}
          </Button>
        </div>
      )}
      {recent.length === 0 ? (
        <EmptyScreen title={t('switcher.none')}>
          <Button size="sm" variant="outline" onClick={() => void pickFolder()}>
            <FolderOpen className="mr-1 h-3.5 w-3.5" />
            {t('workspaces.openFolder')}
          </Button>
        </EmptyScreen>
      ) : (
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5" data-testid="workspace-cards">
          {recent.map((w) => (
            <li key={w.workspaceId} className="relative">
              <button
                type="button"
                onClick={() => void openPath(w.path)}
                aria-label={t('workspaces.open', { name: w.name })}
                className="flex w-full flex-col gap-2 rounded-lg border border-border bg-card p-2.5 text-left shadow-sm hover:bg-accent"
              >
                {/* 썸네일은 16:9(workspace canvas·poster.svg 기준)이라 aspect-video로 잘림 없이 보여준다. */}
                <span className="flex aspect-video items-center justify-center overflow-hidden rounded bg-muted text-muted-foreground">
                  {thumbs[w.workspaceId] ? (
                    <img src={thumbs[w.workspaceId]} alt="" className="h-full w-full object-cover" />
                  ) : (
                    t('scene.noThumbnail')
                  )}
                </span>
                <span className="flex min-w-0 items-center gap-1.5">
                  <b className="truncate text-sm">{w.name}</b>
                  {w.path === workspaceRoot && (
                    <span
                      data-testid="workspace-current-badge"
                      className="shrink-0 rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-medium text-primary-foreground"
                    >
                      {t('workspaces.currentBadge')}
                    </span>
                  )}
                </span>
                <span className="truncate text-[11px] text-muted-foreground" title={w.path}>
                  {w.path}
                </span>
                <span className="text-[11px] text-muted-foreground">
                  {t('gallery.sceneCount', { count: counts[w.workspaceId] ?? 0 })} · {w.lastOpenedAt.slice(0, 10)}
                </span>
              </button>
              <button
                type="button"
                onClick={() => void handleDelete(w)}
                aria-label={`${t('switcher.remove')}: ${w.name}`}
                title={`${t('switcher.remove')}: ${w.name}`}
                className="absolute right-4 top-4 rounded-md border border-border bg-card/90 p-1.5 text-muted-foreground shadow-sm hover:bg-accent hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default Workspaces;
