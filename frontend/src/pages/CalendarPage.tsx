import React, { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useAppSelector, useAppDispatch } from 'store';
import { fetchTeamMatches } from 'store/matchSlice';
import Badge from 'components/common/Badge';
import Button from 'components/common/Button';
import Spinner from 'components/common/Spinner';
import { formatDate } from 'utils/helpers';
import type { Match, FormResult } from 'types';

type FilterTab = 'all' | 'upcoming' | 'completed';

interface MonthGroup {
  key: string;
  label: string;
  matches: Match[];
}

const CalendarPage: React.FC = () => {
  const dispatch = useAppDispatch();
  const auth = useAppSelector((s) => s.auth);
  const matchState = useAppSelector((s) => s.match);
  const gameTime = useAppSelector((s) => s.gameTime);

  const teamId = auth.user?.managed_team_id;
  const [activeFilter, setActiveFilter] = useState<FilterTab>('all');

  useEffect(() => {
    if (teamId) {
      dispatch(fetchTeamMatches({ team_id: teamId }));
    }
  }, [dispatch, teamId]);

  // Filter matches based on active tab
  const filteredMatches = useMemo(() => {
    const matches = matchState.teamMatches;
    switch (activeFilter) {
      case 'upcoming':
        return matches.filter((m) => m.status === 'scheduled');
      case 'completed':
        return matches.filter((m) => m.status === 'completed');
      default:
        return matches;
    }
  }, [matchState.teamMatches, activeFilter]);

  // Group by month/year
  const monthGroups = useMemo((): MonthGroup[] => {
    const groups: Map<string, Match[]> = new Map();

    // Sort matches by date
    const sorted = [...filteredMatches].sort(
      (a, b) =>
        new Date(a.match_date).getTime() - new Date(b.match_date).getTime(),
    );

    for (const m of sorted) {
      const date = new Date(m.match_date);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const label = date.toLocaleDateString('en-US', {
        month: 'long',
        year: 'numeric',
      });

      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key)!.push(m);
    }

    return Array.from(groups.entries()).map(([key, matches]) => ({
      key,
      label: matches[0]
        ? new Date(matches[0].match_date).toLocaleDateString('en-US', {
            month: 'long',
            year: 'numeric',
          })
        : key,
      matches,
    }));
  }, [filteredMatches]);

  // Helpers
  const getOpponentInfo = (
    m: Match,
  ): { name: string; side: 'H' | 'A' } => {
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

  const getMatchResult = (
    m: Match,
  ): { score: string; result: FormResult } | null => {
    if (m.status !== 'completed') return null;

    const score = `${m.home_score} - ${m.away_score}`;
    let result: FormResult;

    if (m.home_team_id === teamId) {
      if (m.home_score > m.away_score) result = 'W';
      else if (m.home_score < m.away_score) result = 'L';
      else result = 'D';
    } else {
      if (m.away_score > m.home_score) result = 'W';
      else if (m.away_score < m.home_score) result = 'L';
      else result = 'D';
    }

    return { score, result };
  };

  const resultBadgeVariant = (
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

  const isNextMatch = (m: Match): boolean => {
    return gameTime.nextMatch?.id === m.id;
  };

  const formatMatchDate = (dateStr: string): string => {
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  const filterTabs: { key: FilterTab; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'upcoming', label: 'Upcoming' },
    { key: 'completed', label: 'Completed' },
  ];

  if (
    matchState.loading === 'loading' &&
    matchState.teamMatches.length === 0
  ) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Title */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Match Calendar</h2>
        <p className="text-sm text-gray-500 mt-1">
          {auth.user?.managed_team?.name
            ? `${auth.user.managed_team.name} fixtures`
            : 'Your team fixtures'}
        </p>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1 w-fit">
        {filterTabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveFilter(tab.key)}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
              activeFilter === tab.key
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Match Groups */}
      {monthGroups.length === 0 ? (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
          <p className="text-sm text-gray-500">
            No matches found for the selected filter.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {monthGroups.map((group) => (
            <div key={group.key}>
              {/* Month Header */}
              <h3 className="text-lg font-semibold text-gray-800 mb-3">
                {group.label}
              </h3>

              {/* Matches in this month */}
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 divide-y divide-gray-100">
                {group.matches.map((m) => {
                  const opponent = getOpponentInfo(m);
                  const result = getMatchResult(m);
                  const isNext = isNextMatch(m);

                  return (
                    <div
                      key={m.id}
                      className={`flex items-center justify-between px-4 py-3 transition-colors hover:bg-gray-50 ${
                        isNext ? 'border-l-4 border-l-green-500' : ''
                      }`}
                    >
                      {/* Left: Date + Opponent */}
                      <div className="flex items-center gap-4 min-w-0">
                        <span className="text-sm text-gray-500 w-28 flex-shrink-0">
                          {formatMatchDate(m.match_date)}
                        </span>
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-sm font-medium text-gray-900 truncate">
                            {opponent.side === 'H' ? 'vs' : 'at'}{' '}
                            {opponent.name}
                          </span>
                          <span className="text-xs text-gray-400 flex-shrink-0">
                            ({opponent.side})
                          </span>
                          {isNext && (
                            <Badge
                              variant="success"
                              size="sm"
                              className="flex-shrink-0"
                            >
                              NEXT
                            </Badge>
                          )}
                        </div>
                      </div>

                      {/* Right: Result or Status + Action */}
                      <div className="flex items-center gap-3 flex-shrink-0 ml-4">
                        {m.status === 'completed' && result ? (
                          <>
                            <span className="text-sm font-medium text-gray-900">
                              {result.score}
                            </span>
                            <Badge
                              variant={resultBadgeVariant(result.result)}
                              size="sm"
                            >
                              {result.result}
                            </Badge>
                            <Link to={`/match/${m.id}/result`}>
                              <Button variant="ghost" size="sm">
                                View
                              </Button>
                            </Link>
                          </>
                        ) : m.status === 'in_progress' ? (
                          <Badge variant="info" size="sm">
                            In Progress
                          </Badge>
                        ) : (
                          <>
                            <span className="text-sm text-gray-400">
                              Scheduled
                            </span>
                            {isNext && (
                              <Link to={`/match/${m.id}/preview`}>
                                <Button variant="ghost" size="sm">
                                  Preview
                                </Button>
                              </Link>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default CalendarPage;
