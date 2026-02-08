import React, { useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import { useAppSelector, useAppDispatch } from 'store';
import { fetchCurrentDate, advanceDay, advanceToMatch } from 'store/gameTimeSlice';
import Button from 'components/common/Button';
import Spinner from 'components/common/Spinner';
import { formatDate } from 'utils/helpers';

interface SidebarProps {
  isOpen: boolean;
  onToggle: () => void;
}

interface NavItem {
  to: string;
  label: string;
  icon: string;
}

const navItems: NavItem[] = [
  { to: '/', label: 'Dashboard', icon: 'H' },
  { to: '/squad', label: 'Squad', icon: 'S' },
  { to: '/tactics', label: 'Tactics', icon: 'T' },
  { to: '/calendar', label: 'Calendar', icon: 'C' },
  { to: '/league', label: 'League Table', icon: 'L' },
];

const Sidebar: React.FC<SidebarProps> = ({ isOpen, onToggle }) => {
  const dispatch = useAppDispatch();
  const auth = useAppSelector((s) => s.auth);
  const gameTime = useAppSelector((s) => s.gameTime);
  const teamId = auth.user?.managed_team_id;

  useEffect(() => {
    if (teamId) {
      dispatch(fetchCurrentDate(teamId));
    }
  }, [dispatch, teamId]);

  const handleAdvanceDay = async () => {
    await dispatch(advanceDay());
    if (teamId) {
      dispatch(fetchCurrentDate(teamId));
    }
  };

  const handleSkipToMatch = async () => {
    await dispatch(advanceToMatch());
    if (teamId) {
      dispatch(fetchCurrentDate(teamId));
    }
  };

  const getOpponentName = (): string | null => {
    const match = gameTime.nextMatch;
    if (!match) return null;
    if (match.home_team_id === teamId) {
      return match.away_team?.short_name || match.away_team?.name || 'Opponent';
    }
    return match.home_team?.short_name || match.home_team?.name || 'Opponent';
  };

  const getHomeOrAway = (): string => {
    const match = gameTime.nextMatch;
    if (!match) return '';
    return match.home_team_id === teamId ? '(H)' : '(A)';
  };

  return (
    <aside
      className={`bg-gray-900 text-white flex-shrink-0 flex flex-col transition-all duration-300 ease-in-out overflow-hidden ${
        isOpen ? 'w-64' : 'w-0'
      }`}
    >
      <div className="min-w-[16rem] flex flex-col h-full">
        {/* Logo / Title */}
        <div className="flex items-center justify-between px-5 py-5 border-b border-gray-700">
          <div className="flex items-center gap-2">
            <span className="text-xl font-bold text-green-400">FF</span>
            <span className="text-lg font-semibold tracking-tight">
              Football FM
            </span>
          </div>
          <button
            onClick={onToggle}
            className="text-gray-400 hover:text-white transition-colors lg:hidden"
            aria-label="Close sidebar"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-gray-800 text-green-400'
                    : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                }`
              }
            >
              <span className="flex items-center justify-center w-6 h-6 rounded bg-gray-700 text-xs font-bold">
                {item.icon}
              </span>
              {item.label}
            </NavLink>
          ))}
        </nav>

        {/* Game Time Section */}
        <div className="border-t border-gray-700 px-4 py-4">
          {gameTime.loading === 'loading' && !gameTime.currentDate ? (
            <div className="flex justify-center py-4">
              <Spinner size="sm" className="text-gray-400" />
            </div>
          ) : (
            <>
              {/* Current Date */}
              {gameTime.formattedDate && (
                <div className="mb-3">
                  <div className="flex items-center gap-2 text-xs text-gray-400 uppercase tracking-wider mb-1">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    Game Date
                  </div>
                  <p className="text-sm text-white font-medium">
                    {gameTime.formattedDate}
                  </p>
                </div>
              )}

              {/* Next Match Info */}
              {gameTime.nextMatch && (
                <div className="mb-4">
                  <p className="text-sm text-gray-300">
                    Next: vs {getOpponentName()} {getHomeOrAway()}
                  </p>
                  {gameTime.daysUntilMatch !== null && gameTime.daysUntilMatch > 0 && (
                    <p className="text-xs text-gray-500">
                      in {gameTime.daysUntilMatch} day
                      {gameTime.daysUntilMatch !== 1 ? 's' : ''}
                    </p>
                  )}
                  {gameTime.isMatchDay && (
                    <p className="text-xs text-green-400 font-semibold mt-1">
                      MATCH DAY
                    </p>
                  )}
                </div>
              )}

              {/* Action Buttons */}
              <div className="space-y-2">
                <Button
                  variant="secondary"
                  size="sm"
                  className="w-full justify-center bg-gray-700 text-gray-200 hover:bg-gray-600 focus:ring-gray-500"
                  onClick={handleAdvanceDay}
                  isLoading={gameTime.loading === 'loading'}
                  disabled={gameTime.isMatchDay}
                >
                  Advance Day
                </Button>
                {gameTime.nextMatch && !gameTime.isMatchDay && (
                  <Button
                    variant="secondary"
                    size="sm"
                    className="w-full justify-center bg-green-700 text-green-100 hover:bg-green-600 focus:ring-green-500"
                    onClick={handleSkipToMatch}
                    isLoading={gameTime.loading === 'loading'}
                  >
                    Skip to Match
                  </Button>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
