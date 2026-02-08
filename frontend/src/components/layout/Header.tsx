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
  // Check exact matches first
  if (routeTitleMap[pathname]) {
    return routeTitleMap[pathname];
  }

  // Check pattern matches
  if (pathname.match(/^\/match\/\d+\/preview$/)) return 'Match Preview';
  if (pathname.match(/^\/match\/\d+\/live$/)) return 'Match Live';
  if (pathname.match(/^\/match\/\d+\/result$/)) return 'Match Result';

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

  // Close dropdown when clicking outside
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
    <header className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between flex-shrink-0">
      {/* Left side: hamburger + page title */}
      <div className="flex items-center gap-4">
        <button
          onClick={onMenuClick}
          className="text-gray-500 hover:text-gray-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 rounded-lg p-1"
          aria-label="Toggle sidebar"
        >
          <svg
            className="w-6 h-6"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 6h16M4 12h16M4 18h16"
            />
          </svg>
        </button>
        <h1 className="text-xl font-semibold text-gray-900">{pageTitle}</h1>
      </div>

      {/* Right side: match day badge + user dropdown */}
      <div className="flex items-center gap-4">
        {/* Match Day indicator */}
        {gameTime.isMatchDay && nextMatchId && (
          <Link
            to={`/match/${nextMatchId}/preview`}
            className="flex items-center"
          >
            <Badge variant="success" size="md" className="animate-pulse cursor-pointer">
              MATCH DAY
            </Badge>
          </Link>
        )}
        {gameTime.isMatchDay && !nextMatchId && (
          <Badge variant="success" size="md" className="animate-pulse">
            MATCH DAY
          </Badge>
        )}

        {/* User dropdown */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className="flex items-center gap-2 text-sm text-gray-700 hover:text-gray-900
              focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 rounded-lg px-2 py-1"
          >
            {/* User avatar placeholder */}
            <div className="w-8 h-8 rounded-full bg-green-600 flex items-center justify-center text-white text-xs font-bold">
              {auth.user?.name?.charAt(0)?.toUpperCase() || 'U'}
            </div>
            <span className="hidden sm:inline font-medium">
              {auth.user?.name || 'Manager'}
            </span>
            <svg
              className={`w-4 h-4 transition-transform ${
                dropdownOpen ? 'rotate-180' : ''
              }`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </button>

          {/* Dropdown menu */}
          {dropdownOpen && (
            <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50">
              <div className="px-4 py-2 border-b border-gray-100">
                <p className="text-sm font-medium text-gray-900">
                  {auth.user?.name || 'Manager'}
                </p>
                <p className="text-xs text-gray-500 truncate">
                  {auth.user?.email || ''}
                </p>
              </div>
              {auth.user?.managed_team?.name && (
                <div className="px-4 py-2 border-b border-gray-100">
                  <p className="text-xs text-gray-400 uppercase tracking-wider">
                    Team
                  </p>
                  <p className="text-sm text-gray-700">
                    {auth.user.managed_team.name}
                  </p>
                </div>
              )}
              <button
                onClick={handleLogout}
                className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
              >
                Sign Out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

export default Header;
