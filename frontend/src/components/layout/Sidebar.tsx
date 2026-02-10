import React, { useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import { useAppSelector, useAppDispatch } from 'store';
import { fetchCurrentDate, advanceDay, advanceToMatch } from 'store/gameTimeSlice';
import Button from 'components/common/Button';
import Spinner from 'components/common/Spinner';

interface SidebarProps {
  isOpen: boolean;
  onToggle: () => void;
}

interface NavItem {
  to: string;
  label: string;
  icon: React.ReactNode;
}

const DashboardIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0a1 1 0 01-1-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 01-1 1" />
  </svg>
);

const SquadIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
);

const TacticsIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
  </svg>
);

const CalendarIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
  </svg>
);

const LeagueIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
  </svg>
);

const navItems: NavItem[] = [
  { to: '/', label: 'Dashboard', icon: <DashboardIcon /> },
  { to: '/squad', label: 'Squad', icon: <SquadIcon /> },
  { to: '/tactics', label: 'Tactics', icon: <TacticsIcon /> },
  { to: '/calendar', label: 'Calendar', icon: <CalendarIcon /> },
  { to: '/league', label: 'League Table', icon: <LeagueIcon /> },
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
      className={`bg-navy-900 flex-shrink-0 flex flex-col transition-all duration-300 ease-spring overflow-hidden ${
        isOpen ? 'w-64' : 'w-0'
      }`}
    >
      <div className="min-w-[16rem] flex flex-col h-full">
        {/* Logo */}
        <div className="flex items-center justify-between px-5 py-5">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-to-br from-brand-400 to-brand-600 text-white font-display text-sm font-bold shadow-glow-brand">
              FF
            </div>
            <div>
              <span className="font-display text-base font-bold uppercase tracking-wider text-white">
                Football FM
              </span>
            </div>
          </div>
          <button
            onClick={onToggle}
            className="text-navy-400 hover:text-white hover:bg-navy-800 rounded-md p-1 transition-colors lg:hidden"
            aria-label="Close sidebar"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-2 space-y-0.5 overflow-y-auto">
          <div className="px-3 mb-3">
            <span className="text-overline text-navy-500 uppercase">Menu</span>
          </div>
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-body-sm font-medium transition-all duration-150 ${
                  isActive
                    ? 'bg-brand-600/20 text-brand-400 shadow-sm'
                    : 'text-navy-300 hover:bg-navy-800 hover:text-white'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <span
                    className={`flex items-center justify-center w-7 h-7 rounded-lg transition-colors ${
                      isActive
                        ? 'bg-brand-600/30 text-brand-400'
                        : 'bg-navy-800 text-navy-400'
                    }`}
                  >
                    {item.icon}
                  </span>
                  {item.label}
                  {isActive && (
                    <span className="ml-auto w-1.5 h-1.5 rounded-full bg-brand-400" />
                  )}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Game Time */}
        <div className="border-t border-navy-800 px-4 py-4">
          {gameTime.loading === 'loading' && !gameTime.currentDate ? (
            <div className="flex justify-center py-4">
              <Spinner size="sm" color="white" />
            </div>
          ) : (
            <>
              {gameTime.formattedDate && (
                <div className="mb-3">
                  <div className="text-overline text-navy-500 uppercase mb-1.5">
                    Game Date
                  </div>
                  <p className="text-body font-medium text-white">
                    {gameTime.formattedDate}
                  </p>
                </div>
              )}

              {gameTime.nextMatch && (
                <div className="mb-3 rounded-lg bg-navy-800/80 px-3 py-2.5">
                  <p className="text-body-sm text-navy-200">
                    Next: vs {getOpponentName()} {getHomeOrAway()}
                  </p>
                  {gameTime.daysUntilMatch !== null && gameTime.daysUntilMatch > 0 && (
                    <p className="text-caption text-navy-400 mt-0.5">
                      in {gameTime.daysUntilMatch} day
                      {gameTime.daysUntilMatch !== 1 ? 's' : ''}
                    </p>
                  )}
                  {gameTime.isMatchDay && (
                    <p className="text-caption text-accent-400 font-bold mt-1 uppercase">
                      Match Day
                    </p>
                  )}
                </div>
              )}

              <div className="space-y-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full justify-center !border-navy-600 !text-navy-200 !bg-transparent hover:!bg-navy-800 hover:!text-white"
                  onClick={handleAdvanceDay}
                  isLoading={gameTime.loading === 'loading'}
                  disabled={gameTime.isMatchDay}
                >
                  Advance Day
                </Button>
                {gameTime.nextMatch && !gameTime.isMatchDay && (
                  <Button
                    variant="primary"
                    size="sm"
                    className="w-full justify-center"
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
