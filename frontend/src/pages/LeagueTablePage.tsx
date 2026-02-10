import React, { useEffect } from 'react';
import { useAppSelector, useAppDispatch } from 'store';
import { fetchStandings } from 'store/leagueSlice';
import Badge from 'components/common/Badge';
import Skeleton from 'components/common/Skeleton';
import EmptyState from 'components/common/EmptyState';
import type { FormResult, StandingEntry } from 'types';

const LeagueTablePage: React.FC = () => {
  const dispatch = useAppDispatch();
  const auth = useAppSelector((s) => s.auth);
  const league = useAppSelector((s) => s.league);

  const teamId = auth.user?.managed_team_id;
  const leagueId = auth.user?.managed_team?.league_id;

  useEffect(() => {
    if (leagueId) {
      dispatch(fetchStandings(leagueId));
    }
  }, [dispatch, leagueId]);

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

  const gdColor = (gd: number): string => {
    if (gd > 0) return 'text-green-600';
    if (gd < 0) return 'text-red-600';
    return 'text-navy-400';
  };

  const formatGD = (gd: number): string => {
    if (gd > 0) return `+${gd}`;
    return String(gd);
  };

  const positionColor = (position: number, total: number): string => {
    if (position <= 3) return 'text-accent-500';
    if (total >= 6 && position > total - 3) return 'text-red-500';
    return 'text-navy-400';
  };

  if (league.loading === 'loading' && league.standings.length === 0) {
    return (
      <div className="space-y-4">
        <div>
          <h2 className="font-display text-display uppercase tracking-tight text-navy-900">
            League Table
          </h2>
        </div>
        <div className="rounded-xl overflow-hidden shadow-card border border-surface-border">
          <Skeleton.Table rows={10} />
        </div>
      </div>
    );
  }

  if (league.error) {
    return (
      <div className="space-y-4">
        <div>
          <h2 className="font-display text-display uppercase tracking-tight text-navy-900">
            League Table
          </h2>
        </div>
        <div className="rounded-xl overflow-hidden shadow-card border border-surface-border p-6">
          <p className="text-center text-body text-red-600">{league.error}</p>
        </div>
      </div>
    );
  }

  const totalTeams = league.standings.length;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <h2 className="font-display text-display uppercase tracking-tight text-navy-900">
          League Table
        </h2>
        {league.currentLeague && (
          <p className="text-body text-navy-500 mt-1">
            {league.currentLeague.name}
          </p>
        )}
      </div>

      {/* Table */}
      <div className="rounded-xl overflow-hidden shadow-card border border-surface-border">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-navy-900 text-white sticky top-0 z-10">
                <th className="px-3 py-3 text-left font-display uppercase tracking-wider text-xs w-12">
                  #
                </th>
                <th className="px-3 py-3 text-left font-display uppercase tracking-wider text-xs">
                  Team
                </th>
                <th className="px-3 py-3 text-center font-display uppercase tracking-wider text-xs w-10">
                  P
                </th>
                <th className="px-3 py-3 text-center font-display uppercase tracking-wider text-xs w-10">
                  W
                </th>
                <th className="px-3 py-3 text-center font-display uppercase tracking-wider text-xs w-10">
                  D
                </th>
                <th className="px-3 py-3 text-center font-display uppercase tracking-wider text-xs w-10">
                  L
                </th>
                <th className="px-3 py-3 text-center font-display uppercase tracking-wider text-xs w-10 hidden md:table-cell">
                  GF
                </th>
                <th className="px-3 py-3 text-center font-display uppercase tracking-wider text-xs w-10 hidden md:table-cell">
                  GA
                </th>
                <th className="px-3 py-3 text-center font-display uppercase tracking-wider text-xs w-12">
                  GD
                </th>
                <th className="px-3 py-3 text-center font-display uppercase tracking-wider text-xs w-12">
                  Pts
                </th>
                <th className="px-3 py-3 text-left font-display uppercase tracking-wider text-xs hidden sm:table-cell">
                  Form
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-border-subtle bg-surface">
              {league.standings.map((entry: StandingEntry) => {
                const isMyTeam = entry.team.id === teamId;
                return (
                  <tr
                    key={entry.team.id}
                    className={`transition-colors ${
                      isMyTeam
                        ? 'bg-brand-50 border-l-4 border-l-brand-500 font-semibold'
                        : 'even:bg-surface-secondary hover:bg-surface-tertiary'
                    }`}
                  >
                    {/* Position */}
                    <td className="px-3 py-3">
                      <span
                        className={`font-display text-lg font-bold ${positionColor(
                          entry.position,
                          totalTeams,
                        )}`}
                      >
                        {entry.position}
                      </span>
                    </td>

                    {/* Team Name */}
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-2">
                        {isMyTeam && (
                          <span
                            className="text-brand-600 text-xs"
                            title="Your team"
                          >
                            *
                          </span>
                        )}
                        <span
                          className={
                            isMyTeam
                              ? 'font-bold text-navy-900'
                              : 'font-medium text-navy-900'
                          }
                        >
                          {entry.team.name}
                        </span>
                      </div>
                    </td>

                    {/* Played */}
                    <td className="px-3 py-3 text-center text-navy-500">
                      {entry.played}
                    </td>

                    {/* Won */}
                    <td className="px-3 py-3 text-center text-navy-500">
                      {entry.won}
                    </td>

                    {/* Drawn */}
                    <td className="px-3 py-3 text-center text-navy-500">
                      {entry.drawn}
                    </td>

                    {/* Lost */}
                    <td className="px-3 py-3 text-center text-navy-500">
                      {entry.lost}
                    </td>

                    {/* Goals For (hidden on mobile) */}
                    <td className="px-3 py-3 text-center text-navy-500 hidden md:table-cell">
                      {entry.goals_for}
                    </td>

                    {/* Goals Against (hidden on mobile) */}
                    <td className="px-3 py-3 text-center text-navy-500 hidden md:table-cell">
                      {entry.goals_against}
                    </td>

                    {/* Goal Difference */}
                    <td
                      className={`px-3 py-3 text-center font-mono font-medium ${gdColor(
                        entry.goal_difference,
                      )}`}
                    >
                      {formatGD(entry.goal_difference)}
                    </td>

                    {/* Points */}
                    <td className="px-3 py-3 text-center font-display text-heading-2 font-bold text-navy-900">
                      {entry.points}
                    </td>

                    {/* Form (hidden on very small screens) */}
                    <td className="px-3 py-3 hidden sm:table-cell">
                      <div className="flex items-center gap-1">
                        {entry.form.slice(-5).map((result, idx) => (
                          <Badge
                            key={idx}
                            variant={formBadgeVariant(result)}
                            size="sm"
                          >
                            {result}
                          </Badge>
                        ))}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {league.standings.length === 0 && (
          <EmptyState
            title="No standings available"
            description="No standings data available yet. Play some matches to see the league table."
          />
        )}
      </div>
    </div>
  );
};

export default LeagueTablePage;
