import React, { useState, useRef, useEffect } from 'react';
import { useLocation, Link } from 'react-router-dom';
import { useAppSelector, useAppDispatch } from 'store';
import { logoutThunk } from 'store/authSlice';
import Badge from 'components/common/Badge';

interface HeaderProps {
  onMenuClick: () => void;
}

const routeTitleMap: Record<string, string> = {
  '/': 'Dashboard',
  '/squad': 'Squad',
  '/tactics': 'Tactics',
  '/calendar': 'Calendar',
  '/league': 'League Table',
};

function getPageTitle(pathname: string): string {
  if (routeTitleMap[pathname]) {
    return routeTitleMap[pathname];
  }
  if (pathname.match(/^\/match(es)?\/\d+\/preview$/)) return 'Match Preview';
  if (pathname.match(/^\/match(es)?\/\d+\/live$/)) return 'Match Live';
  if (pathname.match(/^\/match(es)?\/\d+\/result$/)) return 'Match Result';
  return 'Football FM';
}

const Header: React.FC<HeaderProps> = ({ onMenuClick }) => {
  const dispatch = useAppDispatch();
  const location = useLocation();
  const auth = useAppSelector((s) => s.auth);
  const gameTime = useAppSelector((s) => s.gameTime);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const pageTitle = getPageTitle(location.pathname);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = () => {
    setDropdownOpen(false);
    dispatch(logoutThunk());
  };

  const nextMatchId = gameTime.nextMatch?.id;

  return (
    <header className="h-14 bg-white border-b border-surface-border px-6 flex items-center justify-between flex-shrink-0 sticky top-0 z-30">
      <div className="flex items-center gap-4">
        <button
          onClick={onMenuClick}
          className="text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-md p-1.5 transition-colors"
          aria-label="Toggle sidebar"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        <h1 className="font-display text-xl font-bold uppercase tracking-wide text-navy-900">
          {pageTitle}
        </h1>
      </div>

      <div className="flex items-center gap-3">
        {gameTime.isMatchDay && nextMatchId && (
          <Link to={`/match/${nextMatchId}/preview`} className="flex items-center">
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent-500 text-white text-caption font-bold uppercase tracking-wider shadow-glow-accent cursor-pointer animate-pulse">
              <span className="w-2 h-2 rounded-full bg-white" />
              Match Day
            </span>
          </Link>
        )}
        {gameTime.isMatchDay && !nextMatchId && (
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent-500 text-white text-caption font-bold uppercase tracking-wider shadow-glow-accent animate-pulse">
            <span className="w-2 h-2 rounded-full bg-white" />
            Match Day
          </span>
        )}

        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className="flex items-center gap-2 text-body text-gray-600 hover:text-gray-900 rounded-lg px-2 py-1.5 transition-colors hover:bg-gray-100"
          >
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-500 to-navy-700 flex items-center justify-center text-white text-xs font-bold shadow-sm">
              {auth.user?.name?.charAt(0)?.toUpperCase() || 'U'}
            </div>
            <span className="hidden sm:inline font-medium text-gray-700">
              {auth.user?.name || 'Manager'}
            </span>
            <svg
              className={`w-4 h-4 text-gray-400 transition-transform duration-150 ${
                dropdownOpen ? 'rotate-180' : ''
              }`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {dropdownOpen && (
            <div className="absolute right-0 mt-1.5 w-52 bg-white rounded-xl shadow-dropdown border border-surface-border py-1 z-50 animate-slide-in-up">
              <div className="px-4 py-2.5 border-b border-surface-border-subtle">
                <p className="text-body font-medium text-gray-900">
                  {auth.user?.name || 'Manager'}
                </p>
                <p className="text-caption text-gray-400 truncate">
                  {auth.user?.email || ''}
                </p>
              </div>
              {auth.user?.managed_team?.name && (
                <div className="px-4 py-2.5 border-b border-surface-border-subtle">
                  <p className="text-overline text-gray-400 uppercase">Team</p>
                  <p className="text-body text-gray-700 mt-0.5">
                    {auth.user.managed_team.name}
                  </p>
                </div>
              )}
              <div className="mx-1 mt-1 mb-1">
                <button
                  onClick={handleLogout}
                  className="w-full text-left px-3 py-2 text-body text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                >
                  Sign Out
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

export default Header;
