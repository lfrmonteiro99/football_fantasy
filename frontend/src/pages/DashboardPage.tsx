import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAppSelector, useAppDispatch } from 'store';
import { fetchCurrentDate, advanceDay } from 'store/gameTimeSlice';
import { fetchStandings } from 'store/leagueSlice';
import { fetchUpcomingMatches } from 'store/matchSlice';
import Card from 'components/common/Card';
import Button from 'components/common/Button';
import Badge from 'components/common/Badge';
import Spinner from 'components/common/Spinner';
import StatCard from 'components/common/StatCard';
import Skeleton from 'components/common/Skeleton';
import EmptyState from 'components/common/EmptyState';
import { formatDate } from 'utils/helpers';
import type { FormResult, Match, StandingEntry } from 'types';

const DashboardPage: React.FC = () => {
  const dispatch = useAppDispatch();
  const auth = useAppSelector((s) => s.auth);
  const gameTime = useAppSelector((s) => s.gameTime);
  const league = useAppSelector((s) => s.league);
  const match = useAppSelector((s) => s.match);

  const teamId = auth.user?.managed_team_id;
  const leagueId = auth.user?.managed_team?.league_id;

  useEffect(() => {
    if (teamId) {
      dispatch(fetchCurrentDate(teamId));
      dispatch(fetchUpcomingMatches({ limit: 5 }));
    }
    if (leagueId) {
      dispatch(fetchStandings(leagueId));
    }
  }, [dispatch, teamId, leagueId]);

  // Find user's team in standings
  const myStanding: StandingEntry | undefined = league.standings.find(
    (entry) => entry.team.id === teamId,
  );

  // Helpers
  const getOpponentInfo = (m: Match): { name: string; side: string } => {
    if (m.home_team_id === teamId) {
      return {
        name: m.away_team?.short_name || m.away_team?.name || 'TBD',
        side: 'H',
      };
    }
    return {
      name: m.home_team?.short_name || m.home_team?.name || 'TBD',
      side: 'A',
    };
  };

  const formBadgeVariant = (
    result: FormResult,
  ): 'success' | 'warning' | 'danger' => {
    switch (result) {
      case 'W':
        return 'success';
      case 'D':
        return 'warning';
      case 'L':
        return 'danger';
    }
  };

  const handleAdvanceDay = async () => {
    await dispatch(advanceDay());
    if (teamId) {
      dispatch(fetchCurrentDate(teamId));
    }
  };

  const isLoading =
    (gameTime.loading === 'loading' || league.loading === 'loading') &&
    !gameTime.currentDate;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Skeleton.StatCard key={i} />
          ))}
        </div>
        <Skeleton.Table rows={4} />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Welcome Hero Banner */}
      <div className="rounded-2xl bg-gradient-to-r from-brand-900 to-navy-900 px-8 py-8 text-white shadow-lg">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="font-display text-display uppercase tracking-tight text-white">
              Welcome back, Manager!
            </h2>
            {auth.user?.managed_team?.name && (
              <p className="mt-2 text-body text-white/70">
                Managing{' '}
                <span className="font-semibold text-accent-300">
                  {auth.user.managed_team.name}
                </span>
              </p>
            )}
          </div>
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-white/10 backdrop-blur-sm px-5 py-3 text-center">
              <span className="block text-overline text-white/60 uppercase tracking-wider mb-1">
                Game Date
              </span>
              <span className="block font-display text-display-sm text-white uppercase">
                {gameTime.formattedDate
                  ? gameTime.formattedDate
                  : gameTime.currentDate || '--'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Top Cards Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Game Date Card */}
        <StatCard
          accent="brand"
          label="Game Date"
          value={
            gameTime.formattedDate
              ? gameTime.formattedDate
              : gameTime.currentDate || '--'
          }
        />

        {/* Next Match Card */}
        <Card>
          <div className="flex flex-col">
            <span className="text-overline text-navy-500 uppercase tracking-wider font-semibold mb-2">
              Next Match
            </span>
            {gameTime.nextMatch ? (
              <>
                <span className="font-display text-display-sm text-navy-900 uppercase tracking-tight">
                  vs {getOpponentInfo(gameTime.nextMatch).name}
                </span>
                <span className="text-body-sm text-navy-500 mt-1">
                  ({getOpponentInfo(gameTime.nextMatch).side}){' '}
                  {gameTime.daysUntilMatch !== null && gameTime.daysUntilMatch > 0
                    ? `in ${gameTime.daysUntilMatch} day${gameTime.daysUntilMatch !== 1 ? 's' : ''}`
                    : ''}
                  {gameTime.isMatchDay && (
                    <Badge variant="success" size="sm" className="ml-2">
                      TODAY
                    </Badge>
                  )}
                </span>
                <div className="mt-5">
                  <Link to={`/match/${gameTime.nextMatch.id}/preview`}>
                    <Button variant="primary" size="md">
                      Preview Match
                    </Button>
                  </Link>
                </div>
              </>
            ) : (
              <span className="text-body text-navy-400">No upcoming match</span>
            )}
          </div>
        </Card>

        {/* League Position Card */}
        <Card>
          <div className="flex flex-col">
            <span className="text-overline text-navy-500 uppercase tracking-wider font-semibold mb-2">
              League Position
            </span>
            {myStanding ? (
              <>
                <div className="flex items-baseline gap-3">
                  <span className="font-display text-stat text-navy-900">
                    {getOrdinal(myStanding.position)}
                  </span>
                  <span className="text-body text-navy-500 font-medium">
                    {myStanding.points} pts
                  </span>
                </div>
                {/* Form display */}
                <div className="flex items-center gap-1.5 mt-3">
                  {myStanding.form.slice(-5).map((result, idx) => (
                    <Badge
                      key={idx}
                      variant={formBadgeVariant(result)}
                      size="sm"
                    >
                      {result}
                    </Badge>
                  ))}
                </div>
                <div className="mt-5">
                  <Link to="/league">
                    <Button variant="outline" size="sm">
                      View Table
                    </Button>
                  </Link>
                </div>
              </>
            ) : league.loading === 'loading' ? (
              <Spinner size="sm" />
            ) : (
              <span className="text-body text-navy-400">--</span>
            )}
          </div>
        </Card>
      </div>

      {/* Quick Links */}
      <div>
        <h3 className="font-display text-base font-bold uppercase tracking-wide text-navy-800 mb-4">
          Quick Links
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Link to="/squad" className="group">
            <div className="rounded-xl border border-surface-border bg-white p-5 shadow-card hover:shadow-card-hover hover:border-brand-300 transition-all duration-250 text-center">
              <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-brand-50 text-brand-600 group-hover:bg-brand-100 transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-3a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v3h-3zM4.75 12.094A5.973 5.973 0 004 15v3H1v-3a3 3 0 013.75-2.906z" />
                </svg>
              </div>
              <span className="font-display text-body-sm font-bold uppercase tracking-wide text-navy-800 group-hover:text-brand-700 transition-colors">
                Manage Squad
              </span>
            </div>
          </Link>
          <Link to="/tactics" className="group">
            <div className="rounded-xl border border-surface-border bg-white p-5 shadow-card hover:shadow-card-hover hover:border-accent-300 transition-all duration-250 text-center">
              <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-accent-50 text-accent-600 group-hover:bg-accent-100 transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
                </svg>
              </div>
              <span className="font-display text-body-sm font-bold uppercase tracking-wide text-navy-800 group-hover:text-accent-700 transition-colors">
                Edit Tactics
              </span>
            </div>
          </Link>
          <Link to="/calendar" className="group">
            <div className="rounded-xl border border-surface-border bg-white p-5 shadow-card hover:shadow-card-hover hover:border-navy-300 transition-all duration-250 text-center">
              <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-navy-50 text-navy-600 group-hover:bg-navy-100 transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" />
                </svg>
              </div>
              <span className="font-display text-body-sm font-bold uppercase tracking-wide text-navy-800 group-hover:text-navy-700 transition-colors">
                View Calendar
              </span>
            </div>
          </Link>
          <Link to="/league" className="group">
            <div className="rounded-xl border border-surface-border bg-white p-5 shadow-card hover:shadow-card-hover hover:border-brand-300 transition-all duration-250 text-center">
              <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-brand-50 text-brand-600 group-hover:bg-brand-100 transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M5 3a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2V5a2 2 0 00-2-2H5zM5 11a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2v-2a2 2 0 00-2-2H5zM11 5a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V5zM14 11a1 1 0 011 1v1h1a1 1 0 110 2h-1v1a1 1 0 11-2 0v-1h-1a1 1 0 110-2h1v-1a1 1 0 011-1z" />
                </svg>
              </div>
              <span className="font-display text-body-sm font-bold uppercase tracking-wide text-navy-800 group-hover:text-brand-700 transition-colors">
                League Table
              </span>
            </div>
          </Link>
        </div>
      </div>

      {/* Upcoming Fixtures */}
      <Card title="Upcoming Fixtures">
        {match.loading === 'loading' && match.upcomingMatches.length === 0 ? (
          <div className="flex justify-center py-6">
            <Spinner size="md" />
          </div>
        ) : match.upcomingMatches.length === 0 ? (
          <EmptyState
            title="No upcoming fixtures"
            description="Check back after the schedule is released"
          />
        ) : (
          <div className="divide-y divide-surface-border-subtle">
            {match.upcomingMatches.map((m) => {
              const opponent = getOpponentInfo(m);
              const isScheduled = m.status === 'scheduled';
              const matchDate = m.match_date ? formatDate(m.match_date) : '--';

              return (
                <div
                  key={m.id}
                  className="flex items-center justify-between py-3.5 first:pt-0 last:pb-0 hover:translate-x-1 hover:bg-surface-secondary transition-all duration-250 ease-spring rounded-md px-2 -mx-2"
                >
                  <div className="flex items-center gap-4">
                    <span className="text-body-sm text-navy-600 w-24">
                      {matchDate}
                    </span>
                    <span className="text-body-sm font-medium text-navy-900">
                      {opponent.side === 'H' ? 'vs' : 'at'} {opponent.name} ({opponent.side})
                    </span>
                  </div>
                  <div>
                    {isScheduled ? (
                      <Link to={`/match/${m.id}/preview`}>
                        <Button variant="ghost" size="sm">
                          Preview
                        </Button>
                      </Link>
                    ) : m.status === 'completed' ? (
                      <Link to={`/match/${m.id}/result`}>
                        <span className="font-display text-body-sm font-bold text-navy-800">
                          {m.home_score} - {m.away_score}
                        </span>
                      </Link>
                    ) : (
                      <Badge variant="info" size="sm">
                        In Progress
                      </Badge>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
};

/** Returns ordinal string for a number: 1 -> "1st", 2 -> "2nd", etc. */
function getOrdinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

export default DashboardPage;
