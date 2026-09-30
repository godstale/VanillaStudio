// Playground player tab (T6.8, F-PLY-01): plays one saved export result.
// Players by file type: <video>, image/slideshow, PDF iframe, web iframe.
// The web iframe uses `sandbox="allow-scripts"` with NO `allow-same-origin`,
// so it is an opaque origin — strictly more isolated than the review preview
// (Technical-Design §10, AGENTS.md §7). Tauri IPC stays unreachable.
import { useEffect, useState } from 'react';
import { convertFileSrc } from '@tauri-apps/api/core';
import { ChevronLeft, ChevronRight, FolderOpen, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import type { WorkspaceTab } from '@/lib/types/workspaceTab';
import { listPlaygroundItems } from '@/lib/playground/playgroundRepo';
import { joinPath, listPlaygroundFiles, revealPlaygroundPath } from '@/lib/playground/playgroundApi';
import { resolvePlayable } from '@/lib/playground/store';
import type { PlaygroundItem } from '@/lib/playground/types';

const errorMessage = (e: unknown) => (e instanceof Error ? e.message : String(e));

function srcFor(dir: string, entry: string): string {
  return convertFileSrc(joinPath(dir, entry));
}

function VideoPlayer({ dir, entry }: { dir: string; entry: string }) {
  return (
    <video
      data-testid="playground-video"
      controls
      preload="metadata"
      src={srcFor(dir, entry)}
      className="max-h-full max-w-full"
    />
  );
}

function ImagePlayer({ dir, entry, alt }: { dir: string; entry: string; alt: string }) {
  return <img data-testid="playground-image" src={srcFor(dir, entry)} alt={alt} className="max-h-full max-w-full object-contain" />;
}

function SlideshowPlayer({ dir, entries }: { dir: string; entries: string[] }) {
  const { t } = useLanguage();
  const [index, setIndex] = useState(0);
  const current = entries[Math.min(index, entries.length - 1)];
  return (
    <div className="flex h-full min-h-0 flex-col items-center gap-2">
      <div className="flex min-h-0 flex-1 items-center justify-center overflow-auto">
        <ImagePlayer dir={dir} entry={current} alt={current} />
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <Button size="sm" variant="outline" onClick={() => setIndex((i) => (i - 1 + entries.length) % entries.length)} aria-label={t('playground.player.prev')}>
          <ChevronLeft className="h-3.5 w-3.5" />
        </Button>
        <span className="text-[11px] text-muted-foreground" role="status">
          {t('playground.player.counter', { current: Math.min(index, entries.length - 1) + 1, total: entries.length })}
        </span>
        <Button size="sm" variant="outline" onClick={() => setIndex((i) => (i + 1) % entries.length)} aria-label={t('playground.player.next')}>
          <ChevronRight className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

function WebPlayer({ dir, entry, title }: { dir: string; entry: string; title: string }) {
  return (
    <iframe
      data-testid="playground-web"
      title={title}
      src={srcFor(dir, entry)}
      sandbox="allow-scripts"
      referrerPolicy="no-referrer"
      className="h-full w-full border-0 bg-background"
    />
  );
}

function PdfPlayer({ dir, entry, title }: { dir: string; entry: string; title: string }) {
  return (
    <iframe
      data-testid="playground-pdf"
      title={title}
      src={srcFor(dir, entry)}
      sandbox="allow-scripts"
      referrerPolicy="no-referrer"
      className="h-full w-full border-0 bg-background"
    />
  );
}

export function PlayerTab({ tab }: { tab: WorkspaceTab }) {
  const { t } = useLanguage();
  const itemId = typeof tab.meta?.itemId === 'string' ? tab.meta.itemId : tab.id.replace(/^playground-item:/, '');
  const [cached, setCached] = useState<{ itemId: string; item: PlaygroundItem | null; files: string[] | null; failed: string | null } | null>(null);

  useEffect(() => {
    let cancelled = false;
    listPlaygroundItems().then(
      (items) => {
        if (cancelled) return;
        const found = items.find((i) => i.id === itemId) ?? null;
        if (!found) {
          setCached({ itemId, item: null, files: null, failed: t('playground.player.missing') });
          return;
        }
        listPlaygroundFiles(found.dirPath, found.sourceProject ?? found.dirPath).then(
          (names) => {
            if (!cancelled) setCached({ itemId, item: found, files: names, failed: null });
          },
          () => {
            if (!cancelled) setCached({ itemId, item: found, files: null, failed: t('playground.player.missing') });
          },
        );
      },
      (e: unknown) => {
        if (!cancelled) setCached({ itemId, item: null, files: null, failed: t('playground.panel.loadFailed', { error: errorMessage(e) }) });
      },
    );
    return () => {
      cancelled = true;
    };
  }, [itemId, t]);

  const state = cached && cached.itemId === itemId ? cached : null;
  const item = state?.item ?? null;
  const files = state?.files ?? null;
  const failed = state?.failed ?? null;

  const [failedNote, setFailedNote] = useState<string | null>(null);
  const openFolder = () => {
    if (!item) return;
    revealPlaygroundPath(item.dirPath, item.sourceProject ?? item.dirPath).catch((e: unknown) =>
      setFailedNote(errorMessage(e)),
    );
  };

  return (
    <div data-testid="playground-player" className="flex h-full min-h-0 flex-col bg-background">
      <div className="flex shrink-0 items-center gap-2 border-b border-border px-3 py-2">
        <h2 className="min-w-0 flex-1 truncate text-xs font-semibold text-foreground">{item?.title ?? tab.title}</h2>
        {item && (
          <Button size="sm" variant="outline" onClick={openFolder}>
            <FolderOpen className="h-3.5 w-3.5" aria-hidden />
            {t('playground.player.openFolder')}
          </Button>
        )}
      </div>
      <div className="flex min-h-0 flex-1 items-center justify-center overflow-auto p-4">
        {failed ?? failedNote ? (
          <p role="alert" className="max-w-md text-center text-xs text-destructive">{failed ?? failedNote}</p>
        ) : !item || files === null ? (
          <p className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
            {t('playground.player.loading')}
          </p>
        ) : (
          <PlayerBody item={item} files={files} onOpenFolder={openFolder} />
        )}
      </div>
    </div>
  );
}

function PlayerBody({ item, files, onOpenFolder }: { item: PlaygroundItem; files: string[]; onOpenFolder: () => void }) {
  const { t } = useLanguage();
  const playable = resolvePlayable(files);
  if (playable.player === 'video') {
    return <VideoPlayer dir={item.dirPath} entry={playable.entries[0]} />;
  }
  if (playable.player === 'image') {
    return <ImagePlayer dir={item.dirPath} entry={playable.entries[0]} alt={playable.entries[0]} />;
  }
  if (playable.player === 'slideshow') {
    return <SlideshowPlayer dir={item.dirPath} entries={playable.entries} />;
  }
  if (playable.player === 'pdf') {
    return <PdfPlayer dir={item.dirPath} entry={playable.entries[0]} title={item.title} />;
  }
  if (playable.player === 'web') {
    return <WebPlayer dir={item.dirPath} entry={playable.entries[0]} title={item.title} />;
  }
  return (
    <div className="flex max-w-md flex-col items-center gap-2 text-center">
      <p className="text-xs text-muted-foreground">{t('playground.player.unsupported')}</p>
      <ul className="flex w-full flex-col gap-1">
        {files.map((f) => (
          <li key={f} className="truncate text-[11px] text-foreground" title={f}>
            <a href={srcFor(item.dirPath, f)} download={f} className="underline-offset-2 hover:underline">
              {f}
            </a>
          </li>
        ))}
      </ul>
      <Button size="sm" variant="outline" onClick={onOpenFolder}>
        <FolderOpen className="h-3.5 w-3.5" aria-hidden />
        {t('playground.player.openFolder')}
      </Button>
    </div>
  );
}

export default PlayerTab;
