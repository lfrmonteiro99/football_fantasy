import { Outlet, Navigate } from 'react-router-dom';
import MobileNav from './MobileNav';
import { useAppSelector } from '../../store';

export default function MobileLayout() {
  const { isAuthenticated } = useAppSelector((s) => s.auth);

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="h-full w-full flex flex-col bg-navy-950">
      <main className="flex-1 overflow-hidden">
        <Outlet />
      </main>
      <MobileNav />
    </div>
  );
}
