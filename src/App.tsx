import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import Workspace from '@/pages/Workspace';
import Scenes from '@/pages/Scenes';
import Playground from '@/pages/Playground';
import SettingsLayout from '@/pages/Settings/SettingsLayout';
import SettingsGeneral from '@/pages/Settings/SettingsGeneral';
import SettingsApp from '@/pages/Settings/SettingsApp';
import SettingsWorkspace from '@/pages/Settings/SettingsWorkspace';
import SettingsDoctor from '@/pages/Settings/SettingsDoctor';
import { AppShell } from '@/components/layout/AppShell';
import { TrustWorkspaceDialog } from '@/components/workspace/TrustWorkspaceDialog';

import { ThemeProvider } from '@/lib/context/ThemeContext';
import { SettingsProvider } from '@/lib/context/SettingsContext';
import { WorkspaceProvider } from '@/lib/context/WorkspaceContext';
import { LanguageProvider } from '@/lib/i18n/LanguageContext';
import { LanguageSelectDialog } from '@/components/language/LanguageSelectDialog';

export default function App() {
  return (
    <ThemeProvider>
      <LanguageProvider>
        <SettingsProvider>
          <HashRouter>
            <WorkspaceProvider>
              <Routes>
                <Route path="/" element={<Navigate to="/workspace" replace />} />
                <Route element={<AppShell />}>
                  <Route path="/workspace" element={<Workspace />} />
                  <Route path="/scenes" element={<Scenes />} />
                  <Route path="/playground" element={<Playground />} />
                </Route>
                <Route path="/settings" element={<SettingsLayout />}>
                  <Route index element={<SettingsGeneral />} />
                  <Route path="general" element={<SettingsGeneral />} />
                  <Route path="workspace" element={<SettingsWorkspace />} />
                  <Route path="app" element={<SettingsApp />} />
                  <Route path="doctor" element={<SettingsDoctor />} />
                </Route>
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
              <TrustWorkspaceDialog />
            </WorkspaceProvider>
            <LanguageSelectDialog />
          </HashRouter>
        </SettingsProvider>
      </LanguageProvider>
    </ThemeProvider>
  );
}
