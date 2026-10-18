import { NavLink, Outlet } from 'react-router-dom';
import { useEffect } from 'react';
import { Boxes, ClipboardList, FlaskConical, LayoutTemplate, Settings, Workflow, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import { Switcher } from '@/components/workspace/Switcher';
import { TitleBar } from './TitleBar';

interface NavItem {
  to: string;
  icon: LucideIcon;
  labelKey: string;
}

// 화면 추가: 항목 하나 + App.tsx 라우트 하나(Docs/Extension-Guide.md).
// 제작 흐름 순서: 스토리보드(기획·재료·조립) → 시퀀스(기존 워크스페이스 캔버스) → 신 → 템플릿 → 플레이그라운드. 설정은 가장 하단에 둔다.
const NAV_ITEMS: NavItem[] = [
  { to: '/storyboard', icon: ClipboardList, labelKey: 'shell.nav.storyboard' },
  { to: '/workspace', icon: Workflow, labelKey: 'shell.nav.sequence' },
  { to: '/scenes', icon: Boxes, labelKey: 'shell.nav.scenes' },
  { to: '/templates', icon: LayoutTemplate, labelKey: 'shell.nav.templates' },
  { to: '/playground', icon: FlaskConical, labelKey: 'shell.nav.playground' },
];

const SETTINGS_ITEM: NavItem = { to: '/settings', icon: Settings, labelKey: 'shell.nav.settings' };

function NavButton({ to, icon: Icon, labelKey }: NavItem) {
  const { t } = useLanguage();
  return (
    <NavLink
      key={to}
      to={to}
      title={t(labelKey)}
      aria-label={t(labelKey)}
      className={({ isActive }) =>
        cn(
          'flex h-10 w-10 items-center justify-center rounded-md transition-colors',
          isActive ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent hover:text-foreground',
        )
      }
    >
      <Icon className="h-5 w-5" />
    </NavLink>
  );
}

/** 앱 셸: 좌측 사이드바 + 메인 화면. 우측 인스펙서·하단 도크는 두지 않는다(인스펙터는 신 화면의 플로팅 박스). */
export function AppShell() {
  const { t } = useLanguage();
  // 지정된 곳(`data-allow-context`)·텍스트 입력 계열 외에서는 우클릭 메뉴를 모두 막는다.
  useEffect(() => {
    const onContextMenu = (e: MouseEvent) => {
      const el = e.target instanceof Element ? e.target : null;
      if (el?.closest('[data-allow-context]')) return;
      if (el?.closest('input, textarea, select, [contenteditable="true"], .xterm')) return;
      e.preventDefault();
    };
    window.addEventListener('contextmenu', onContextMenu);
    return () => window.removeEventListener('contextmenu', onContextMenu);
  }, []);
  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-background text-foreground">
      <TitleBar />
      <div className="flex min-h-0 flex-1">
        <nav aria-label={t('shell.nav.label')} className="flex w-14 shrink-0 flex-col items-center gap-1 border-r border-border bg-sidebar py-2">
          <Switcher />
          {NAV_ITEMS.map((item) => (
            <NavButton key={item.to} {...item} />
          ))}
          <div className="mt-auto flex flex-col items-center gap-1">
            <NavButton {...SETTINGS_ITEM} />
          </div>
        </nav>
        <main className="h-full min-w-0 flex-1 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
