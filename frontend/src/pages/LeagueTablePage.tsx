import React, { useEffect } from 'react';
import { useAppSelector, useAppDispatch } from 'store';
import { fetchStandings } from 'store/leagueSlice';
import Badge from 'components/common/Badge';
import Spinner from 'components/common/Spinner';
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
    return 'text-gray-500';
  };

  const formatGD = (gd: number): string => {
    if (gd > 0) return `+${gd}`;
    return String(gd);
  };

  if (league.loading === 'loading' && league.standings.length === 0) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner size="lg" />
      </div>
    );
  }

  if (league.error) {
    return (
      <div className="text-center py-20">
        <p className="text-red-600 text-sm">{league.error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900">League Table</h2>
        {league.currentLeague && (
          <p className="text-sm text-gray-500 mt-1">
            {league.currentLeague.name}
          </p>
        )}
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200 sticky top-0 z-10">
                <th className="px-4 py-3 text-left font-semibold text-gray-600 w-12">
                  #
                </th>
                <th className="px-4 py-3 text-left font-semibold text-gray-600">
                  Team
                </th>
                <th className="px-4 py-3 text-center font-semibold text-gray-600 w-10">
                  P
                </th>
                <th className="px-4 py-3 text-center font-semibold text-gray-600 w-10">
                  W
                </th>
                <th className="px-4 py-3 text-center font-semibold text-gray-600 w-10">
                  D
                </th>
                <th className="px-4 py-3 text-center font-semibold text-gray-600 w-10">
                  L
                </th>
                <th className="px-4 py-3 text-center font-semibold text-gray-600 w-10 hidden md:table-cell">
                  GF
                </th>
                <th className="px-4 py-3 text-center font-semibold text-gray-600 w-10 hidden md:table-cell">
                  GA
                </th>
                <th className="px-4 py-3 text-center font-semibold text-gray-600 w-12">
                  GD
                </th>
                <th className="px-4 py-3 text-center font-semibold text-gray-600 w-12">
                  Pts
                </th>
                <th className="px-4 py-3 text-left font-semibold text-gray-600 hidden sm:table-cell">
                  Form
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {league.standings.map((entry: StandingEntry) => {
                const isMyTeam = entry.team.id === teamId;
                return (
                  <tr
                    key={entry.team.id}
                    className={`transition-colors ${
                      isMyTeam
                        ? 'bg-green-50 font-semibold'
                        : 'hover:bg-gray-50'
                    }`}
                  >
                    {/* Position */}
                    <td className="px-4 py-3 text-gray-500">
                      {entry.position}
                    </td>

                    {/* Team Name */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {isMyTeam && (
                          <span
                            className="text-green-600 text-xs"
                            title="Your team"
                          >
                            *
                          </span>
                        )}
                        <span
                          className={
                            isMyTeam ? 'text-green-800' : 'text-gray-900'
                          }
                        >
                          {entry.team.name}
                        </span>
                      </div>
                    </td>

                    {/* Played */}
                    <td className="px-4 py-3 text-center text-gray-600">
                      {entry.played}
                    </td>

                    {/* Won */}
                    <td className="px-4 py-3 text-center text-gray-600">
                      {entry.won}
                    </td>

                    {/* Drawn */}
                    <td className="px-4 py-3 text-center text-gray-600">
                      {entry.drawn}
                    </td>

                    {/* Lost */}
                    <td className="px-4 py-3 text-center text-gray-600">
                      {entry.lost}
                    </td>

                    {/* Goals For (hidden on mobile) */}
                    <td className="px-4 py-3 text-center text-gray-600 hidden md:table-cell">
                      {entry.goals_for}
                    </td>

                    {/* Goals Against (hidden on mobile) */}
                    <td className="px-4 py-3 text-center text-gray-600 hidden md:table-cell">
                      {entry.goals_against}
                    </td>

                    {/* Goal Difference */}
                    <td
                      className={`px-4 py-3 text-center font-medium ${gdColor(
                        entry.goal_difference,
                      )}`}
                    >
                      {formatGD(entry.goal_difference)}
                    </td>

                    {/* Points */}
                    <td className="px-4 py-3 text-center font-bold text-gray-900">
                      {entry.points}
                    </td>

                    {/* Form (hidden on very small screens) */}
                    <td className="px-4 py-3 hidden sm:table-cell">
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
          <div className="text-center py-12">
            <p className="text-sm text-gray-500">
              No standings data available yet.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default LeagueTablePage;
