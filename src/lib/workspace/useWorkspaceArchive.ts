import { useState } from 'react';
import { open, save } from '@tauri-apps/plugin-dialog';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import { ARCHIVE_EXTENSION, archiveErrorKey, packWorkspaceZip, unpackWorkspaceZip } from './archive';

const messageOf = (e: unknown): string => (typeof e === 'string' ? e : e instanceof Error ? e.message : String(e));
const baseName = (p: string) => p.replace(/[\\/]+$/, '').split(/[\\/]/).pop() ?? '';

const fmtBytes = (n: number): string => (n < 1024 ? `${n} B` : n < 1024 * 1024 ? `${(n / 1024).toFixed(1)} KB` : `${(n / 1024 / 1024).toFixed(1)} MB`);

/** 워크스페이스 압축(.zip)·불러오기. 불러온 폴더를 여는 일은 `onImported`가 맡는다(신뢰 확인은 열 때 받는다). */
export function useWorkspaceArchive(workspaceRoot: string | null, onImported: (dest: string) => Promise<void>) {
  const { t } = useLanguage();
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const errorText = (e: unknown): string => {
    const message = messageOf(e);
    const key = archiveErrorKey(message);
    return key ? t(key) : t('package.err.other', { error: message });
  };

  async function pack() {
    if (!workspaceRoot) return;
    setError(null);
    setNotice(null);
    const out = await save({
      defaultPath: `${baseName(workspaceRoot) || 'workspace'}.${ARCHIVE_EXTENSION}`,
      filters: [{ name: 'ZIP', extensions: [ARCHIVE_EXTENSION] }],
    });
    if (!out) return;
    setBusy(true);
    try {
      const r = await packWorkspaceZip(workspaceRoot, out);
      setNotice(t('archive.packDone', { files: r.files, size: fmtBytes(r.bytes), name: baseName(r.path), path: r.path }));
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  async function importZip() {
    setError(null);
    setNotice(null);
    const zip = await open({ multiple: false, filters: [{ name: 'ZIP', extensions: [ARCHIVE_EXTENSION] }] });
    if (typeof zip !== 'string') return;
    setBusy(true);
    try {
      const { path: dest } = await unpackWorkspaceZip(zip);
      setNotice(t('archive.importDone'));
      await onImported(dest);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  return { busy, notice, error, pack, importZip };
}
