import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import AppLayout from 'components/layout/AppLayout';
import LoginPage from 'pages/LoginPage';
import DashboardPage from 'pages/DashboardPage';
import SquadPage from 'pages/SquadPage';
import TacticsPage from 'pages/TacticsPage';
import MatchPreviewPage from 'pages/MatchPreviewPage';
import MatchLivePage from 'pages/MatchLivePage';
import MatchResultPage from 'pages/MatchResultPage';
import LeagueTablePage from 'pages/LeagueTablePage';
import CalendarPage from 'pages/CalendarPage';

export default function App() {
  return (
    <Routes>
      {/* Public */}
      <Route path="/login" element={<LoginPage />} />

      {/* Protected */}
      <Route element={<AppLayout />}>
        <Route index element={<DashboardPage />} />
        <Route path="squad" element={<SquadPage />} />
        <Route path="tactics" element={<TacticsPage />} />
        <Route path="match/:id/preview" element={<MatchPreviewPage />} />
        <Route path="match/:id/live" element={<MatchLivePage />} />
        <Route path="match/:id/result" element={<MatchResultPage />} />
        <Route path="league" element={<LeagueTablePage />} />
        <Route path="calendar" element={<CalendarPage />} />
      </Route>

      {/* Catch-all */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
