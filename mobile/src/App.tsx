import { Routes, Route, Navigate } from 'react-router-dom';
import MobileLayout from './components/layout/MobileLayout';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import SquadPage from './pages/SquadPage';
import TacticsPage from './pages/TacticsPage';
import MatchPreviewPage from './pages/MatchPreviewPage';
import MatchLivePage from './pages/MatchLivePage';
import MatchResultPage from './pages/MatchResultPage';
import LeagueTablePage from './pages/LeagueTablePage';
import CalendarPage from './pages/CalendarPage';

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<MobileLayout />}>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/squad" element={<SquadPage />} />
        <Route path="/tactics" element={<TacticsPage />} />
        <Route path="/calendar" element={<CalendarPage />} />
        <Route path="/league" element={<LeagueTablePage />} />
        <Route path="/matches/:id/preview" element={<MatchPreviewPage />} />
        <Route path="/matches/:id/live" element={<MatchLivePage />} />
        <Route path="/matches/:id/result" element={<MatchResultPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
