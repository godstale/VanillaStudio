import { useCallback, useEffect, useState } from 'react';
import { open } from '@tauri-apps/plugin-dialog';
import { FileImage, FileVideo, Film, Link2, Loader2, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import { addFileReference, addUrlReference, REFERENCE_FILE_EXTENSIONS, removeReference, updateReferenceNote, type Reference, type ReferenceKind } from '@/lib/scene/references';
import { extractErrorKey, extractReferenceFrames, readExtractedInfo, type ExtractedInfo } from '@/lib/scene/referenceFrames';
import type { Scene } from '@/lib/scene/schema';

export interface ReferencesProps {
  root: string;
  slug: string;
  scene: Scene;
  /** 새 scene 값을 넘긴다(자동 저장). */
  onChange: (next: Scene) => void;
}

const KIND_ICON: Record<ReferenceKind, typeof Link2> = { image: FileImage, video: FileVideo, url: Link2 };

/** 영상 레퍼런스의 키프레임 추출 버튼과 결과 요약. 추출은 앱이 FFmpeg로 하고, 분석은 에이전트가 한다(D-026). */
function FrameExtraction({ root, slug, reference }: { root: string; slug: string; reference: Reference }) {
  const { t } = useLanguage();
  const [info, setInfo] = useState<ExtractedInfo | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void readExtractedInfo(root, slug, reference.id).then((i) => !cancelled && setInfo(i));
    return () => {
      cancelled = true;
    };
  }, [root, slug, reference.id]);

  const run = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const report = await extractReferenceFrames(root, slug, reference);
      setInfo({ frames: report.frames.length, duration: report.meta.duration });
    } catch (e) {
      const message = typeof e === 'string' ? e : e instanceof Error ? e.message : String(e);
      const key = extractErrorKey(message);
      setError(key ? t(key) : t('references.extractFailed', { error: message }));
    } finally {
      setBusy(false);
    }
  }, [root, slug, reference, t]);

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2">
        <Button size="sm" variant="outline" disabled={busy} onClick={() => void run()}>
          {busy ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Film className="mr-1 h-3.5 w-3.5" />}
          {busy ? t('references.extracting') : info ? t('references.reextract') : t('references.extract')}
        </Button>
        {info && <span className="text-muted-foreground">{t('references.extracted', { frames: info.frames, seconds: info.duration.toFixed(1) })}</span>}
      </div>
      {error && (
        <p role="alert" className="text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

/** 레퍼런스 등록(F-REF-01): 이미지·영상 파일(복사)·URL(기록만, 앱은 내려받지 않는다)·메모. */
export function References({ root, slug, scene, onChange }: ReferencesProps) {
  const { t } = useLanguage();
  const [url, setUrl] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function pickFile() {
    setError(null);
    try {
      const picked = await open({
        multiple: false,
        filters: [{ name: t('references.files'), extensions: [...REFERENCE_FILE_EXTENSIONS.image, ...REFERENCE_FILE_EXTENSIONS.video] }],
      });
      if (typeof picked !== 'string') return;
      onChange(await addFileReference(root, slug, scene, picked));
    } catch (e) {
      setError(e instanceof Error && e.message === 'unsupported-file' ? t('references.unsupported') : t('references.addFailed', { error: e instanceof Error ? e.message : String(e) }));
    }
  }

  function addUrl() {
    setError(null);
    try {
      onChange(addUrlReference(scene, url));
      setUrl('');
    } catch {
      setError(t('references.invalidUrl'));
    }
  }

  return (
    <div className="flex flex-col gap-3 text-xs" data-testid="references">
      <p className="text-muted-foreground">{t('references.hint')}</p>

      {scene.references.length === 0 && <p className="text-muted-foreground">{t('references.empty')}</p>}
      <ul className="flex flex-col gap-2">
        {scene.references.map((r) => {
          const Icon = KIND_ICON[r.kind];
          return (
            <li key={r.id} className="flex flex-col gap-1 rounded border border-border p-2">
              <div className="flex items-center gap-2">
                <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-label={t(`references.kind.${r.kind}`)} />
                <span className="min-w-0 flex-1 truncate" title={r.url ?? r.path ?? ''}>
                  {r.url ?? r.path}
                </span>
                <Button size="sm" variant="ghost" aria-label={t('references.remove', { id: r.id })} onClick={() => onChange(removeReference(scene, r.id))}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
              <Input value={r.note} placeholder={t('references.notePlaceholder')} aria-label={t('references.note', { id: r.id })} onChange={(e) => onChange(updateReferenceNote(scene, r.id, e.target.value))} />
              {r.kind === 'video' && <FrameExtraction root={root} slug={slug} reference={r} />}
              {r.analysis && <span className="text-muted-foreground">{t('references.analysis', { path: r.analysis })}</span>}
            </li>
          );
        })}
      </ul>

      <div className="flex flex-col gap-2 border-t border-border pt-3">
        <Button size="sm" variant="outline" onClick={() => void pickFile()}>
          <Plus className="mr-1 h-3.5 w-3.5" />
          {t('references.addFile')}
        </Button>
        <div className="flex gap-2">
          <Input value={url} placeholder="https://" aria-label={t('references.url')} onChange={(e) => setUrl(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && url.trim() && addUrl()} />
          <Button size="sm" variant="outline" disabled={!url.trim()} onClick={addUrl}>
            {t('references.addUrl')}
          </Button>
        </div>
        <p className="text-muted-foreground">{t('references.urlPolicy')}</p>
        {error && (
          <p role="alert" className="text-destructive">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
