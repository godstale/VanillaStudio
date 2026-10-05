import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FolderPlus, Folders } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useWorkspace } from '@/lib/context/WorkspaceContext';
import { listRecentWorkspaces, removeWorkspace, type WorkspaceRecord } from '@/lib/db/repositories/workspacesRepo';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import { tauriWorkspaceApi, type WorkspaceApi } from '@/lib/workspace/api';
import { listBusy, stopAllBusy } from '@/lib/workspace/switchGuard';

type Target = { kind: 'open'; path: string } | { kind: 'new' };

/** 사이드바 상단 스위처: 최근 워크스페이스 열기·새로 만들기. 실행 중인 프로세스가 있으면 정리 확인을 받는다. */
export function Switcher({ api = tauriWorkspaceApi }: { api?: WorkspaceApi }) {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const { workspaceRoot, setWorkspaceRoot } = useWorkspace();
  const [recent, setRecent] = useState<WorkspaceRecord[]>([]);
  const [pending, setPending] = useState<{ target: Target; busy: string[] } | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    try {
      setRecent(await listRecentWorkspaces(10));
    } catch {
      setRecent([]);
    }
  }

  async function perform(target: Target) {
    setError(null);
    try {
      if (target.kind === 'new') {
        setWorkspaceRoot(null);
      } else {
        await api.openWorkspace(target.path);
        setWorkspaceRoot(target.path);
      }
      void navigate('/workspace');
    } catch {
      // 폴더가 사라졌거나 더 이상 워크스페이스가 아니면 목록에서 치운다.
      if (target.kind === 'open') {
        const stale = recent.find((r) => r.path === target.path);
        if (stale) await removeWorkspace(stale.workspaceId).catch(() => undefined);
      }
      setError(t('switcher.openFailed'));
    }
  }

  function request(target: Target) {
    if (target.kind === 'open' && target.path === workspaceRoot) return;
    const busy = listBusy();
    if (busy.length > 0) setPending({ target, busy });
    else void perform(target);
  }

  async function confirm() {
    if (!pending) return;
    const { target } = pending;
    setPending(null);
    await stopAllBusy();
    await perform(target);
  }

  return (
    <>
      <DropdownMenu onOpenChange={(open) => open && void load()}>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-10 w-10" aria-label={t('switcher.title')} title={t('switcher.title')}>
            <Folders className="h-5 w-5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent side="right" align="start" className="w-72">
          <DropdownMenuLabel>{t('switcher.recent')}</DropdownMenuLabel>
          {recent.length === 0 && <div className="px-2 py-1.5 text-xs text-muted-foreground">{t('switcher.none')}</div>}
          {recent.map((w) => (
            <DropdownMenuItem key={w.workspaceId} onSelect={() => request({ kind: 'open', path: w.path })}>
              <div className="min-w-0">
                <div className="truncate text-sm">{w.name}</div>
                <div className="truncate text-[11px] text-muted-foreground">{w.path}</div>
              </div>
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => request({ kind: 'new' })}>
            <FolderPlus className="mr-2 h-4 w-4" />
            {t('switcher.new')}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      {error && (
        <p role="alert" className="sr-only">
          {error}
        </p>
      )}
      <Dialog open={pending !== null} onOpenChange={(open) => !open && setPending(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('switcher.confirmTitle')}</DialogTitle>
            <DialogDescription>{t('switcher.confirmDesc')}</DialogDescription>
          </DialogHeader>
          <ul className="list-disc pl-5 text-sm">
            {pending?.busy.map((label, i) => (
              <li key={`${label}-${i}`}>{label}</li>
            ))}
          </ul>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setPending(null)}>
              {t('switcher.cancel')}
            </Button>
            <Button onClick={() => void confirm()}>{t('switcher.stopAndSwitch')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
