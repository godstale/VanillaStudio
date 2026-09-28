import { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Puzzle, Package } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { WorkspaceTab } from '@/lib/types/workspaceTab';
import { useWorkspace } from '@/lib/context/WorkspaceContext';
import { useSettings } from '@/lib/context/SettingsContext';
import {
  scanWorkspaceExtensions,
  readExtensionReadme,
} from '@/lib/extensions/scanner';
import type { ExtensionManifest } from '@/lib/types/extension';
import { useLanguage } from '@/lib/i18n/LanguageContext';

export interface ExtensionViewerTabProps {
  tab: WorkspaceTab;
}

// Example manifest viewer tab: shows status toggle, manifest JSON,
// and the extension README rendered as markdown.
export function ExtensionViewerTab({ tab }: ExtensionViewerTabProps) {
  const { t } = useLanguage();
  const { workspaceRoot } = useWorkspace();
  const { settings, updateSettings } = useSettings();
  const name = tab.meta?.extensionName as string | undefined;
  const [manifest, setManifest] = useState<ExtensionManifest | null>(null);
  const [readme, setReadme] = useState('');
  const [status, setStatus] = useState<'loading' | 'ready' | 'missing'>(
    'loading',
  );

  useEffect(() => {
    let active = true;
    void (async () => {
      if (!name || !workspaceRoot) {
        if (active) setStatus('missing');
        return;
      }
      if (active) setStatus('loading');
      try {
        const all = await scanWorkspaceExtensions(workspaceRoot);
        if (!active) return;
        const found = all.find((m) => m.name === name) ?? null;
        setManifest(found);
        if (found) {
          setReadme(await readExtensionReadme(found));
          if (active) setStatus('ready');
        } else if (active) {
          setStatus('missing');
        }
      } catch {
        if (active) setStatus('missing');
      }
    })();
    return () => {
      active = false;
    };
  }, [name, workspaceRoot]);

  if (status === 'missing' || !manifest) {
    return (
      <div className="flex items-center justify-center h-full text-xs text-muted-foreground">
        {status === 'loading'
          ? t('extensionViewer.loading')
          : t('extensionViewer.notFound')}
      </div>
    );
  }

  const enabled = settings.enabledExtensions.includes(manifest.name);

  return (
    <div className="h-full min-h-0 overflow-y-auto p-5 space-y-5 max-w-3xl">
      <div className="flex items-center gap-3">
        {enabled ? (
          <Puzzle className="h-6 w-6 text-success" />
        ) : (
          <Package className="h-6 w-6 text-muted-foreground" />
        )}
        <div className="flex-1 min-w-0">
          <h2 className="text-base font-bold font-mono truncate">
            {manifest.name}
          </h2>
          <p className="text-xs text-muted-foreground">
            {manifest.description}
          </p>
        </div>
        <Button
          variant={enabled ? 'default' : 'outline'}
          size="sm"
          onClick={() =>
            void updateSettings({
              enabledExtensions: enabled
                ? settings.enabledExtensions.filter((n) => n !== manifest.name)
                : [...settings.enabledExtensions, manifest.name],
            })
          }
        >
          {enabled ? t('extensions.disable') : t('extensions.enable')}
        </Button>
      </div>

      <section className="space-y-2">
        <h3 className="text-xs font-semibold text-muted-foreground">
          {t('extensionViewer.manifest')}
        </h3>
        <pre className="rounded-lg border border-border bg-code text-code-foreground p-3 text-xs font-mono overflow-x-auto">
          {JSON.stringify(
            {
              name: manifest.name,
              description: manifest.description,
              ...(manifest.version ? { version: manifest.version } : {}),
              status: enabled ? 'enabled' : 'disabled',
            },
            null,
            2,
          )}
        </pre>
      </section>

      <section className="space-y-2">
        <h3 className="text-xs font-semibold text-muted-foreground">
          {t('extensionViewer.readme')}
        </h3>
        {readme ? (
          <div className="prose prose-sm dark:prose-invert max-w-none text-sm">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{readme}</ReactMarkdown>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">
            {t('extensions.noReadme')}
          </p>
        )}
      </section>
    </div>
  );
}
