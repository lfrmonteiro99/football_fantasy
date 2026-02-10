import React, { useState, useEffect } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAppSelector, useAppDispatch } from 'store';
import { fetchProfile } from 'store/authSlice';
import Spinner from 'components/common/Spinner';
import Sidebar from './Sidebar';
import Header from './Header';

const AppLayout: React.FC = () => {
  const dispatch = useAppDispatch();
  const auth = useAppSelector((s) => s.auth);
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const isMatchRoute = /^\/match(es)?\/\d+\/(preview|live|result)$/.test(location.pathname);

  useEffect(() => {
    if (!auth.user && auth.token) {
      dispatch(fetchProfile());
    }
  }, []);

  if (!auth.isAuthenticated && !auth.token) {
    return <Navigate to="/login" replace />;
  }

  if (auth.loading === 'loading') {
    return (
      <div className="flex items-center justify-center h-screen bg-surface-secondary">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-surface-secondary">
      <Sidebar
        isOpen={sidebarOpen}
        onToggle={() => setSidebarOpen(!sidebarOpen)}
      />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header onMenuClick={() => setSidebarOpen(!sidebarOpen)} />
        <main className={`flex-1 overflow-y-auto ${isMatchRoute ? '' : 'px-6 py-5'}`}>
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default AppLayout;
