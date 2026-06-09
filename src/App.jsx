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
import EmailsPage from './pages/emails/EmailsPage';
import ImageQualityPage from './pages/image-quality/ImageQualityPage';
import RegistryMetricsPage from './pages/registry-metrics/RegistryMetricsPage';
import ScorecardPage from './pages/scorecard/ScorecardPage';
import LabelingPage from './pages/labeling/LabelingPage';
import EntityBrowserPage from './pages/entities/EntityBrowserPage';
import ErQueuePage from './pages/entities/ErQueuePage';
import TriagePage from './pages/triage/TriagePage';
import SearchQualityPage from './pages/search-quality/SearchQualityPage';

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
              <Route path="image-quality" element={<ImageQualityPage />} />
              <Route path="registry-metrics" element={<RegistryMetricsPage />} />
              <Route path="scorecard" element={<ScorecardPage />} />
              <Route path="labeling" element={<LabelingPage />} />
              <Route path="entities" element={<EntityBrowserPage />} />
              <Route path="er-queue" element={<ErQueuePage />} />
              <Route path="triage" element={<TriagePage />} />
              <Route path="search-quality" element={<SearchQualityPage />} />
              <Route path="pipeline" element={<PipelinePage />} />
              <Route path="apis" element={<ApisPage />} />
              <Route path="emails" element={<EmailsPage />} />
              <Route path="settings" element={<SettingsPage />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}
