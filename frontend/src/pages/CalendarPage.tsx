import React, { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useAppSelector, useAppDispatch } from 'store';
import { fetchTeamMatches } from 'store/matchSlice';
import Badge from 'components/common/Badge';
import Button from 'components/common/Button';
import Skeleton from 'components/common/Skeleton';
import EmptyState from 'components/common/EmptyState';
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
      <div className="space-y-6">
        <div>
          <Skeleton className="h-9 w-56 mb-2" />
          <Skeleton className="h-4 w-40" />
        </div>
        <div className="flex gap-1">
          <Skeleton className="h-9 w-16 rounded-md" />
          <Skeleton className="h-9 w-24 rounded-md" />
          <Skeleton className="h-9 w-24 rounded-md" />
        </div>
        <div className="space-y-6">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i}>
              <Skeleton className="h-6 w-36 mb-3" />
              <div className="rounded-xl border border-gray-200/60 bg-white shadow-card divide-y divide-gray-100">
                {Array.from({ length: 4 }).map((_, j) => (
                  <div key={j} className="flex items-center justify-between px-4 py-3">
                    <div className="flex items-center gap-4">
                      <Skeleton className="h-4 w-24" />
                      <Skeleton className="h-4 w-32" />
                    </div>
                    <Skeleton className="h-4 w-16" />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Title */}
      <div>
        <h2 className="font-display text-display uppercase tracking-tight text-navy-900">Match Calendar</h2>
        <p className="text-body text-navy-500 mt-1">
          {auth.user?.managed_team?.name
            ? `${auth.user.managed_team.name} fixtures`
            : 'Your team fixtures'}
        </p>
      </div>

      {/* Filter Tabs */}
      <div className="inline-flex rounded-lg bg-navy-50 p-1">
        {filterTabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveFilter(tab.key)}
            className={`rounded-md px-4 py-1.5 text-body-sm font-medium transition-all ${
              activeFilter === tab.key
                ? 'bg-navy-900 text-white shadow-sm'
                : 'text-navy-400 hover:text-navy-600'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Match Groups */}
      {monthGroups.length === 0 ? (
        <div className="rounded-xl border border-surface-border bg-white shadow-card">
          <EmptyState
            title="No matches found"
            description="No matches found for the selected filter."
          />
        </div>
      ) : (
        <div className="space-y-6">
          {monthGroups.map((group) => (
            <div key={group.key}>
              {/* Month Header */}
              <h3 className="font-display text-lg font-bold uppercase tracking-wide text-navy-800 mb-3">
                {group.label}
              </h3>

              {/* Matches in this month */}
              <div className="rounded-xl border border-surface-border bg-white shadow-card divide-y divide-surface-border-subtle">
                {group.matches.map((m) => {
                  const opponent = getOpponentInfo(m);
                  const result = getMatchResult(m);
                  const isNext = isNextMatch(m);

                  return (
                    <div
                      key={m.id}
                      className={`flex items-center justify-between hover:bg-surface-secondary hover:translate-x-0.5 transition-all duration-250 ease-spring px-4 py-3 ${
                        isNext ? 'border-l-4 border-accent-400 bg-accent-50/30' : ''
                      }`}
                    >
                      {/* Left: Date + Opponent */}
                      <div className="flex items-center gap-4 min-w-0">
                        <span className="text-body-sm text-navy-500 font-mono w-28 flex-shrink-0">
                          {formatMatchDate(m.match_date)}
                        </span>
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-body font-medium text-navy-900 truncate">
                            {opponent.side === 'H' ? 'vs' : 'at'}{' '}
                            {opponent.name}
                          </span>
                          <span className="text-caption text-navy-400 flex-shrink-0">
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
                            <span className="font-display text-body font-bold text-navy-900">
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
                            <span className="text-body-sm text-navy-400">
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
