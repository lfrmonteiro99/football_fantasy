import React, { useEffect, useState, useCallback } from 'react';
import { useSelector } from 'react-redux';
import { fetchSquad } from '../store/teamSlice';
import { useAppDispatch } from '../store';
import type { RootState } from '../types';
import { formatCurrency } from '../utils/helpers';
import PlayerList from '../components/squad/PlayerList';
import PlayerDetail from '../components/squad/PlayerDetail';
import StatCard from '../components/common/StatCard';
import Skeleton from '../components/common/Skeleton';

// ---------------------------------------------------------------------------
// Icons (inline SVG)
// ---------------------------------------------------------------------------

const UsersIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
);

const ChartIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
  </svg>
);

const HeartIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
  </svg>
);

const InjuryIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
  </svg>
);

const CurrencyIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

// ---------------------------------------------------------------------------
// Page Component
// ---------------------------------------------------------------------------

const SquadPage: React.FC = () => {
  const dispatch = useAppDispatch();
  const { user } = useSelector((state: RootState) => state.auth);
  const { squad, squadStats, currentTeam, loading, error } = useSelector(
    (state: RootState) => state.team,
  );

  const [selectedPlayerId, setSelectedPlayerId] = useState<number | null>(null);

  useEffect(() => {
    const teamId = user?.managed_team_id;
    if (teamId) {
      dispatch(fetchSquad(teamId));
    }
  }, [dispatch, user?.managed_team_id]);

  const handlePlayerClick = useCallback((playerId: number) => {
    setSelectedPlayerId(playerId);
  }, []);

  const handleCloseDetail = useCallback(() => {
    setSelectedPlayerId(null);
  }, []);

  // Loading state
  if (loading === 'loading' && squad.length === 0) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        <div>
          <Skeleton className="h-8 w-48 mb-2" />
          <Skeleton className="h-4 w-64" />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton.StatCard key={i} />
          ))}
        </div>
        <Skeleton.Table rows={8} />
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="rounded-xl border border-surface-border bg-white shadow-card overflow-hidden">
          <div className="text-center py-8 px-5">
            <p className="text-heading-3 text-red-600">Failed to load squad</p>
            <p className="text-body-sm text-navy-500 mt-1">{error}</p>
            <button
              onClick={() => user?.managed_team_id && dispatch(fetchSquad(user.managed_team_id))}
              className="mt-4 px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 transition-colors"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="font-display text-display uppercase tracking-tight text-navy-900">
          Squad Overview
        </h1>
        {currentTeam && (
          <p className="text-body text-navy-500 mt-1">
            {currentTeam.name} &mdash; {currentTeam.stadium_name ?? 'No stadium'}
          </p>
        )}
      </div>

      {/* Stats cards */}
      {squadStats && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-6">
          <StatCard
            value={squadStats.total_players}
            label="Players"
            icon={<UsersIcon />}
            accent="brand"
          />
          <StatCard
            value={squadStats.average_age.toFixed(1)}
            label="Avg Age"
            icon={<ChartIcon />}
            accent="accent"
          />
          <StatCard
            value={squadStats.average_rating.toFixed(0)}
            label="Avg Rating"
            icon={<HeartIcon />}
            accent="navy"
          />
          <StatCard
            value={squadStats.injured_players}
            label="Injured"
            icon={<InjuryIcon />}
            accent="brand"
          />
          <StatCard
            value={formatCurrency(squadStats.total_value)}
            label="Total Value"
            icon={<CurrencyIcon />}
            accent="accent"
          />
        </div>
      )}

      {/* Player list */}
      <div className="rounded-xl border border-surface-border bg-white shadow-card overflow-hidden">
        <PlayerList
          players={squad}
          onPlayerClick={handlePlayerClick}
          selectedPlayerId={selectedPlayerId}
        />
      </div>

      {/* Player detail panel */}
      {selectedPlayerId !== null && (
        <PlayerDetail
          playerId={selectedPlayerId}
          onClose={handleCloseDetail}
        />
      )}
    </div>
  );
};

export default SquadPage;
