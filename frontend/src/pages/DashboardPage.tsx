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
      <div className="flex items-center justify-center py-20">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900">
          Welcome back, Manager!
        </h2>
        {auth.user?.managed_team?.name && (
          <p className="mt-1 text-sm text-gray-500">
            Managing {auth.user.managed_team.name}
          </p>
        )}
      </div>

      {/* Top Cards Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Game Date Card */}
        <Card>
          <div className="flex flex-col">
            <span className="text-xs text-gray-400 uppercase tracking-wider font-medium mb-1">
              Game Date
            </span>
            <span className="text-2xl font-bold text-gray-900">
              {gameTime.formattedDate
                ? gameTime.formattedDate
                : gameTime.currentDate || '--'}
            </span>
            <div className="mt-4">
              <Button
                variant="primary"
                size="sm"
                onClick={handleAdvanceDay}
                isLoading={gameTime.loading === 'loading'}
                disabled={gameTime.isMatchDay}
              >
                Advance Day
              </Button>
            </div>
          </div>
        </Card>

        {/* Next Match Card */}
        <Card>
          <div className="flex flex-col">
            <span className="text-xs text-gray-400 uppercase tracking-wider font-medium mb-1">
              Next Match
            </span>
            {gameTime.nextMatch ? (
              <>
                <span className="text-2xl font-bold text-gray-900">
                  vs {getOpponentInfo(gameTime.nextMatch).name}
                </span>
                <span className="text-sm text-gray-500 mt-1">
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
                <div className="mt-4">
                  <Link to={`/match/${gameTime.nextMatch.id}/preview`}>
                    <Button variant="primary" size="sm">
                      Preview
                    </Button>
                  </Link>
                </div>
              </>
            ) : (
              <span className="text-lg text-gray-400">No upcoming match</span>
            )}
          </div>
        </Card>

        {/* League Position Card */}
        <Card>
          <div className="flex flex-col">
            <span className="text-xs text-gray-400 uppercase tracking-wider font-medium mb-1">
              League Position
            </span>
            {myStanding ? (
              <>
                <span className="text-2xl font-bold text-gray-900">
                  {getOrdinal(myStanding.position)} &mdash;{' '}
                  {myStanding.points} pts
                </span>
                {/* Form display */}
                <div className="flex items-center gap-1 mt-2">
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
                <div className="mt-4">
                  <Link to="/league">
                    <Button variant="secondary" size="sm">
                      View Table
                    </Button>
                  </Link>
                </div>
              </>
            ) : league.loading === 'loading' ? (
              <Spinner size="sm" />
            ) : (
              <span className="text-lg text-gray-400">--</span>
            )}
          </div>
        </Card>
      </div>

      {/* Quick Links */}
      <Card title="Quick Links">
        <div className="flex flex-wrap gap-3">
          <Link to="/squad">
            <Button variant="secondary" size="sm">
              Manage Squad
            </Button>
          </Link>
          <Link to="/tactics">
            <Button variant="secondary" size="sm">
              Edit Tactics
            </Button>
          </Link>
          <Link to="/calendar">
            <Button variant="secondary" size="sm">
              View Calendar
            </Button>
          </Link>
          <Link to="/league">
            <Button variant="secondary" size="sm">
              League Table
            </Button>
          </Link>
        </div>
      </Card>

      {/* Upcoming Fixtures */}
      <Card title="Upcoming Fixtures">
        {match.loading === 'loading' && match.upcomingMatches.length === 0 ? (
          <div className="flex justify-center py-6">
            <Spinner size="md" />
          </div>
        ) : match.upcomingMatches.length === 0 ? (
          <p className="text-sm text-gray-500 py-4">
            No upcoming fixtures scheduled.
          </p>
        ) : (
          <div className="divide-y divide-gray-100">
            {match.upcomingMatches.map((m) => {
              const opponent = getOpponentInfo(m);
              const isScheduled = m.status === 'scheduled';
              const matchDate = m.match_date ? formatDate(m.match_date) : '--';

              return (
                <div
                  key={m.id}
                  className="flex items-center justify-between py-3 first:pt-0 last:pb-0"
                >
                  <div className="flex items-center gap-4">
                    <span className="text-sm text-gray-500 w-24">
                      {matchDate}
                    </span>
                    <span className="text-sm font-medium text-gray-900">
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
                        <span className="text-sm text-gray-600">
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
