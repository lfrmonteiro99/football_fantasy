import React, { useState, useEffect } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAppSelector, useAppDispatch } from 'store';
import { fetchProfile } from 'store/authSlice';
import Spinner from 'components/common/Spinner';
import Sidebar from './Sidebar';
import Header from './Header';

const AppLayout: React.FC = () => {
  const dispatch = useAppDispatch();
  const auth = useAppSelector((s) => s.auth);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  useEffect(() => {
    // On mount, if we have a token but no user, fetch profile
    if (!auth.user && auth.token) {
      dispatch(fetchProfile());
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (!auth.isAuthenticated && !auth.token) {
    return <Navigate to="/login" replace />;
  }

  if (auth.loading === 'loading') {
    return (
      <div className="flex items-center justify-center h-screen">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar
        isOpen={sidebarOpen}
        onToggle={() => setSidebarOpen(!sidebarOpen)}
      />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header onMenuClick={() => setSidebarOpen(!sidebarOpen)} />
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default AppLayout;
