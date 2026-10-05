import type { ReactNode } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { Boxes, FlaskConical, Folder, Settings, type LucideIcon } from 'lucide-react';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import { Switcher } from '@/components/workspace/Switcher';

interface NavItem {
  to: string;
  icon: LucideIcon;
  labelKey: string;
}

// 화면 추가: 항목 하나 + App.tsx 라우트 하나(Docs/Extension-Guide.md).
const NAV_ITEMS: NavItem[] = [
  { to: '/workspace', icon: Folder, labelKey: 'shell.nav.workspace' },
  { to: '/scenes', icon: Boxes, labelKey: 'shell.nav.scenes' },
  { to: '/playground', icon: FlaskConical, labelKey: 'shell.nav.playground' },
  { to: '/settings', icon: Settings, labelKey: 'shell.nav.settings' },
];

const handleClass =
  'z-10 bg-border/40 transition-colors hover:bg-primary/80 data-[resize-handle-active]:bg-primary';

function Slot({ name, children }: { name: 'inspector' | 'dock'; children?: ReactNode }) {
  const { t } = useLanguage();
  return (
    <section
      aria-label={t(`shell.${name}`)}
      data-slot={name}
      className="flex h-full w-full flex-col overflow-hidden bg-card/40"
    >
      <h2 className="border-b border-border px-3 py-2 text-xs font-semibold text-muted-foreground">
        {t(`shell.${name}`)}
      </h2>
      <div className="min-h-0 flex-1 overflow-auto p-3 text-xs text-muted-foreground">
        {children ?? t('shell.slotEmpty')}
      </div>
    </section>
  );
}

export function AppShell() {
  const { t } = useLanguage();
  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background text-foreground">
      <nav
        aria-label={t('shell.nav.label')}
        className="flex w-14 shrink-0 flex-col items-center gap-1 border-r border-border bg-sidebar py-2"
      >
        <Switcher />
        {NAV_ITEMS.map(({ to, icon: Icon, labelKey }) => (
          <NavLink
            key={to}
            to={to}
            title={t(labelKey)}
            aria-label={t(labelKey)}
            className={({ isActive }) =>
              cn(
                'flex h-10 w-10 items-center justify-center rounded-md transition-colors',
                isActive
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-accent hover:text-foreground',
              )
            }
          >
            <Icon className="h-5 w-5" />
          </NavLink>
        ))}
      </nav>
      <PanelGroup direction="horizontal" autoSaveId="vs-shell-h" className="min-w-0 flex-1">
        <Panel id="vs-main" order={1} minSize={40} className="min-w-0">
          <PanelGroup direction="vertical" autoSaveId="vs-shell-v">
            <Panel id="vs-content" order={1} minSize={30}>
              <main className="h-full overflow-auto">
                <Outlet />
              </main>
            </Panel>
            <PanelResizeHandle className={cn('h-1', handleClass)} />
            <Panel id="vs-dock" order={2} defaultSize={22} minSize={8} collapsible collapsedSize={0}>
              <Slot name="dock" />
            </Panel>
          </PanelGroup>
        </Panel>
        <PanelResizeHandle className={cn('w-1', handleClass)} />
        <Panel id="vs-inspector" order={2} defaultSize={24} minSize={16} collapsible collapsedSize={0}>
          <Slot name="inspector" />
        </Panel>
      </PanelGroup>
    </div>
  );
}
