import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from './auth/AuthContext';
import RequireAuth from './auth/RequireAuth';
import LoginPage from './auth/LoginPage';
import AppShell from './components/AppShell';
import DashboardPage from './pages/dashboard/DashboardPage';
import SeedingPage from './pages/seeding/SeedingPage';
import WorkerPage from './pages/worker/WorkerPage';
import ModerationPage from './pages/moderation/ModerationPage';
import QualityPage from './pages/quality/QualityPage';
import PipelinePage from './pages/pipeline/PipelinePage';
import SettingsPage from './pages/settings/SettingsPage';
import ApisPage from './pages/apis/ApisPage';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route
              element={
                <RequireAuth>
                  <AppShell />
                </RequireAuth>
              }
            >
              <Route index element={<DashboardPage />} />
              <Route path="seeding" element={<SeedingPage />} />
              <Route path="worker" element={<WorkerPage />} />
              <Route path="moderation" element={<ModerationPage />} />
              <Route path="quality" element={<QualityPage />} />
              <Route path="pipeline" element={<PipelinePage />} />
              <Route path="apis" element={<ApisPage />} />
              <Route path="settings" element={<SettingsPage />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}
