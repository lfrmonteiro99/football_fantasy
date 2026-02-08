import React from 'react';
import { Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { useAuth } from 'hooks/useAuth';
import LoginPage from 'pages/LoginPage';

// ---------------------------------------------------------------------------
// Placeholder component for pages other engineers will build
// ---------------------------------------------------------------------------

const Placeholder = ({ name }: { name: string }) => (
  <div className="p-8 text-gray-500">Loading {name}...</div>
);

// ---------------------------------------------------------------------------
// Protected layout shell — Engineer #4 will replace this with full navigation
// ---------------------------------------------------------------------------

const AppLayout = () => {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) return <Navigate to="/login" />;
  return (
    <div className="min-h-screen bg-gray-50">
      <Outlet />
    </div>
  );
};

// ---------------------------------------------------------------------------
// Route table
// ---------------------------------------------------------------------------

export default function App() {
  return (
    <Routes>
      {/* Public */}
      <Route path="/login" element={<LoginPage />} />

      {/* Protected */}
      <Route element={<AppLayout />}>
        <Route index element={<Placeholder name="Dashboard" />} />
        <Route path="squad" element={<Placeholder name="Squad" />} />
        <Route path="tactics" element={<Placeholder name="Tactics" />} />
        <Route
          path="match/:id/preview"
          element={<Placeholder name="Match Preview" />}
        />
        <Route
          path="match/:id/live"
          element={<Placeholder name="Match Live" />}
        />
        <Route
          path="match/:id/result"
          element={<Placeholder name="Match Result" />}
        />
        <Route path="league" element={<Placeholder name="League Table" />} />
        <Route path="calendar" element={<Placeholder name="Calendar" />} />
      </Route>

      {/* Catch-all */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
