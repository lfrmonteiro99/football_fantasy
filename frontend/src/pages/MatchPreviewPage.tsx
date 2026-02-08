import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

import type {
  Match,
  MatchLineupResponse,
  MatchLineup,
  FormationPosition,
} from '../types';

// ---------------------------------------------------------------------------
// Imports with safe fallbacks
// ---------------------------------------------------------------------------

let useAppSelector: any;
let useAppDispatch: any;
try {
  const storeImport = require('../store');
  useAppSelector = storeImport.useAppSelector;
  useAppDispatch = storeImport.useAppDispatch;
} catch {
  useAppSelector = (selector: any) => selector({
    match: { currentMatch: null, currentLineup: null, loading: 'idle', error: null },
  });
  useAppDispatch = () => (action: any) => action;
}

let fetchMatchDetails: any = (id: number) => ({ type: 'match/fetchDetails', payload: id });
let fetchMatchLineup: any = (id: number) => ({ type: 'match/fetchLineup', payload: id });
let saveMatchLineup: any = (args: any) => ({ type: 'match/saveLineup', payload: args });

try {
  const matchSlice = require('../store/matchSlice');
  fetchMatchDetails = matchSlice.fetchMatchDetails ?? fetchMatchDetails;
  fetchMatchLineup = matchSlice.fetchMatchLineup ?? fetchMatchLineup;
  saveMatchLineup = matchSlice.saveMatchLineup ?? saveMatchLineup;
} catch {
  // keep stubs
}

let Button: React.FC<any>;
let Spinner: React.FC<any>;
let Card: React.FC<any>;
try { Button = require('../components/common/Button').Button; } catch {
  Button = ({ children, onClick, className, disabled, variant }: any) => (
    <button onClick={onClick} className={className} disabled={disabled}>{children}</button>
  );
}
try { Spinner = require('../components/common/Spinner').Spinner; } catch {
  Spinner = () => <div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full" />;
}
try { Card = require('../components/common/Card').Card; } catch {
  Card = ({ children, className }: any) => <div className={className}>{children}</div>;
}

import Pitch2D from '../components/match/Pitch2D';
import type { Pitch2DPlayer } from '../components/match/Pitch2D';
import { getMatchDetails, getMatchLineup, saveMatchLineup as saveLineupApi } from '../api/endpoints';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Build Pitch2DPlayer[] from MatchLineupResponse starting XIs.
 * Uses formation positions or x/y from lineup entries, or falls back
 * to default position coordinates.
 */
const POSITION_DEFAULTS: Record<string, { x: number; y: number }> = {
  GK: { x: 8, y: 50 },
  CB: { x: 25, y: 50 },
  LB: { x: 22, y: 15 },
  RB: { x: 22, y: 85 },
  LWB: { x: 30, y: 10 },
  RWB: { x: 30, y: 90 },
  WB: { x: 30, y: 50 },
  SW: { x: 20, y: 50 },
  DM: { x: 38, y: 50 },
  CDM: { x: 38, y: 50 },
  CM: { x: 50, y: 50 },
  AM: { x: 62, y: 50 },
  CAM: { x: 62, y: 50 },
  LM: { x: 50, y: 15 },
  RM: { x: 50, y: 85 },
  LW: { x: 70, y: 15 },
  RW: { x: 70, y: 85 },
  ST: { x: 80, y: 50 },
  CF: { x: 78, y: 50 },
  F9: { x: 75, y: 50 },
};

function buildPitchPlayers(
  lineupSide: {
    starting: MatchLineup[];
    formation: { positions: FormationPosition[] } | null;
  },
  team: 'home' | 'away',
): Pitch2DPlayer[] {
  const players: Pitch2DPlayer[] = [];

  // Try to match players to formation positions by order
  const formationPositions = lineupSide.formation?.positions ?? [];

  // Group starting by position for y-axis spreading
  const byPosition: Record<string, MatchLineup[]> = {};
  for (const ml of lineupSide.starting) {
    const pos = ml.position || 'CM';
    if (!byPosition[pos]) byPosition[pos] = [];
    byPosition[pos].push(ml);
  }

  for (const [pos, group] of Object.entries(byPosition)) {
    const base = POSITION_DEFAULTS[pos] || POSITION_DEFAULTS['CM'];
    const count = group.length;
    const ySpread = count > 1 ? 25 : 0;
    const yStart = base.y - ySpread / 2;
    const yStep = count > 1 ? ySpread / (count - 1) : 0;

    group.forEach((ml, idx) => {
      // Use lineup x/y if available, otherwise defaults
      let x = ml.x != null ? ml.x : base.x;
      let y = ml.y != null ? ml.y : (count > 1 ? yStart + yStep * idx : base.y);

      // Mirror for away team
      if (team === 'away') {
        x = 100 - x;
        y = 100 - y;
      }

      const player = ml.player;
      players.push({
        id: ml.player_id,
        name: player?.full_name ?? player?.last_name ?? `Player ${ml.player_id}`,
        shirtNumber: player?.shirt_number ?? ml.sort_order ?? 0,
        x,
        y,
        team,
        position: pos,
      });
    });
  }

  // If formation positions are available and we got no lineup x/y, overlay
  if (formationPositions.length > 0 && lineupSide.starting.length > 0) {
    const sorted = [...lineupSide.starting].sort((a, b) => a.sort_order - b.sort_order);
    sorted.forEach((ml, idx) => {
      if (idx < formationPositions.length && ml.x == null) {
        const fp = formationPositions[idx];
        const existing = players.find((p) => p.id === ml.player_id);
        if (existing) {
          existing.x = team === 'away' ? 100 - fp.x : fp.x;
          existing.y = team === 'away' ? 100 - fp.y : fp.y;
        }
      }
    });
  }

  return players;
}

// ---------------------------------------------------------------------------
// MatchPreviewPage Component
// ---------------------------------------------------------------------------

const MatchPreviewPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const matchId = Number(id);
  const navigate = useNavigate();
  const dispatch = useAppDispatch();

  // Local state for direct API calls (fallback if Redux thunks aren't wired)
  const [match, setMatch] = useState<Match | null>(null);
  const [lineup, setLineup] = useState<MatchLineupResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Selection state for swap
  const [selectedStarterId, setSelectedStarterId] = useState<number | null>(null);
  const [swapTeam, setSwapTeam] = useState<'home' | 'away'>('home');

  // Redux state (may be populated by thunks)
  const reduxMatch = useAppSelector((s: any) => s.match?.currentMatch);
  const reduxLineup = useAppSelector((s: any) => s.match?.currentLineup);

  const activeMatch = reduxMatch ?? match;
  const activeLineup = reduxLineup ?? lineup;

  // Fetch data on mount
  useEffect(() => {
    let cancelled = false;

    const loadData = async () => {
      setLoading(true);
      setError(null);
      try {
        // Dispatch Redux thunks
        dispatch(fetchMatchDetails(matchId));
        dispatch(fetchMatchLineup(matchId));

        // Also fetch directly as fallback
        const [matchData, lineupData] = await Promise.all([
          getMatchDetails(matchId),
          getMatchLineup(matchId),
        ]);

        if (!cancelled) {
          setMatch(matchData);
          setLineup(lineupData);
        }
      } catch (err: any) {
        if (!cancelled) {
          setError(err.message || 'Failed to load match data');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    loadData();
    return () => { cancelled = true; };
  }, [matchId, dispatch]);

  // Build pitch players for home team
  const homePitchPlayers = useMemo(() => {
    if (!activeLineup?.home) return [];
    return buildPitchPlayers(
      { starting: activeLineup.home.starting, formation: activeLineup.home.formation },
      'home',
    );
  }, [activeLineup?.home]);

  // Handle player swap (starter <-> bench)
  const handleSwap = useCallback(
    (playerId: number, isStarter: boolean, team: 'home' | 'away') => {
      if (!activeLineup) return;

      if (isStarter) {
        // Select this starter for swapping
        setSelectedStarterId(playerId);
        setSwapTeam(team);
      } else if (selectedStarterId !== null && team === swapTeam) {
        // Bench player clicked — perform the swap
        const side = activeLineup[team];
        const starterIdx = side.starting.findIndex(
          (l) => l.player_id === selectedStarterId,
        );
        const benchIdx = side.bench.findIndex(
          (l) => l.player_id === playerId,
        );

        if (starterIdx >= 0 && benchIdx >= 0) {
          const newStarting = [...side.starting];
          const newBench = [...side.bench];

          // Swap the player entries
          const starterEntry = { ...newStarting[starterIdx] };
          const benchEntry = { ...newBench[benchIdx] };

          // Swap: starter goes to bench, bench goes to starting
          newStarting[starterIdx] = {
            ...benchEntry,
            is_starting: true,
            position: starterEntry.position,
            sort_order: starterEntry.sort_order,
            x: starterEntry.x,
            y: starterEntry.y,
          };
          newBench[benchIdx] = {
            ...starterEntry,
            is_starting: false,
          };

          const newLineup: MatchLineupResponse = {
            ...activeLineup,
            [team]: {
              ...side,
              starting: newStarting,
              bench: newBench,
            },
          };

          setLineup(newLineup);
        }

        setSelectedStarterId(null);
      } else {
        // Different team or no starter selected — just select nothing
        setSelectedStarterId(null);
      }
    },
    [activeLineup, selectedStarterId, swapTeam],
  );

  // Save lineup
  const handleSaveLineup = useCallback(async () => {
    if (!activeLineup) return;

    const homeStarting = activeLineup.home.starting.map((l) => ({
      player_id: l.player_id,
      position: l.position,
      x: l.x,
      y: l.y,
    }));
    const homeBench = activeLineup.home.bench.map((l) => ({
      player_id: l.player_id,
    }));

    setSaving(true);
    try {
      await saveLineupApi(matchId, {
        team_id: activeLineup.home.team.id,
        starting: homeStarting,
        bench: homeBench,
      });
      // Also dispatch Redux action
      try {
        dispatch(
          saveMatchLineup({
            matchId,
            payload: {
              team_id: activeLineup.home.team.id,
              starting: homeStarting,
              bench: homeBench,
            },
          }),
        );
      } catch {
        // Redux may not be wired
      }
    } catch (err: any) {
      setError(err.message || 'Failed to save lineup');
    } finally {
      setSaving(false);
    }
  }, [activeLineup, matchId, dispatch]);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Spinner />
          <p className="text-gray-400 text-sm">Loading match preview...</p>
        </div>
      </div>
    );
  }

  if (error && !activeMatch) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center px-4">
        <div className="bg-red-900/50 border border-red-700 rounded-lg p-6 text-red-300 max-w-md text-center">
          <p className="font-semibold text-lg">Error</p>
          <p className="text-sm mt-2">{error}</p>
          <button
            onClick={() => navigate(-1)}
            className="mt-4 px-4 py-2 bg-gray-700 rounded text-gray-300 text-sm"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  const homeTeam = activeMatch?.home_team;
  const awayTeam = activeMatch?.away_team;
  const homeColor = homeTeam?.primary_color || '#3b82f6';
  const awayColor = awayTeam?.primary_color || '#ef4444';

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Match Header */}
      <div className="px-4 pt-6 pb-4">
        <div className="bg-gray-800 rounded-lg p-6 text-center">
          <p className="text-sm text-gray-400 uppercase tracking-wider mb-2">
            Match Preview
          </p>
          <div className="flex items-center justify-center gap-6">
            <div className="text-right flex-1">
              <h2
                className="text-2xl font-bold truncate"
                style={{ color: homeColor }}
              >
                {homeTeam?.name ?? 'Home'}
              </h2>
              {activeLineup?.home?.formation && (
                <p className="text-sm text-gray-400 mt-1">
                  {activeLineup.home.formation.name}
                </p>
              )}
            </div>
            <span className="text-3xl font-light text-gray-500">vs</span>
            <div className="text-left flex-1">
              <h2
                className="text-2xl font-bold truncate"
                style={{ color: awayColor }}
              >
                {awayTeam?.name ?? 'Away'}
              </h2>
              {activeLineup?.away?.formation && (
                <p className="text-sm text-gray-400 mt-1">
                  {activeLineup.away.formation.name}
                </p>
              )}
            </div>
          </div>
          {/* Match info row */}
          <div className="mt-3 flex items-center justify-center gap-4 text-sm text-gray-500">
            {activeMatch?.match_date && (
              <span>
                {new Date(activeMatch.match_date).toLocaleDateString('en-GB', {
                  weekday: 'short',
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                })}
              </span>
            )}
            {activeMatch?.stadium && <span>{activeMatch.stadium}</span>}
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="px-4 pb-4">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left: Pitch */}
          <div>
            <div className="bg-gray-800 rounded-lg p-3">
              <h3 className="text-sm text-gray-400 uppercase tracking-wider mb-2 px-1">
                Home Formation
              </h3>
              <Pitch2D
                players={homePitchPlayers}
                homeColor={homeColor}
                awayColor={awayColor}
                animated={false}
                highlightedPlayerId={selectedStarterId}
                onPlayerClick={(pid) => handleSwap(pid, true, 'home')}
              />
            </div>
          </div>

          {/* Right: Lineup lists */}
          <div className="space-y-4">
            {/* Home Starting XI */}
            <div className="bg-gray-800 rounded-lg p-4">
              <h3 className="text-sm font-semibold uppercase tracking-wider mb-3" style={{ color: homeColor }}>
                {homeTeam?.name ?? 'Home'} — Starting XI
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {activeLineup?.home?.starting?.map((ml) => {
                  const isSelected = selectedStarterId === ml.player_id;
                  return (
                    <button
                      key={ml.player_id}
                      onClick={() => handleSwap(ml.player_id, true, 'home')}
                      className={`flex items-center gap-2 p-2 rounded-md text-left transition-colors ${
                        isSelected
                          ? 'bg-green-800 border border-green-500'
                          : 'bg-gray-700 border border-transparent hover:border-gray-500'
                      }`}
                    >
                      <span
                        className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white"
                        style={{ backgroundColor: homeColor }}
                      >
                        {ml.player?.shirt_number ?? ml.sort_order}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-white truncate">
                          {ml.player?.full_name ?? `Player ${ml.player_id}`}
                        </p>
                        <p className="text-xs text-gray-400">{ml.position}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Home Bench */}
            <div className="bg-gray-800 rounded-lg p-4">
              <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">
                Bench
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {activeLineup?.home?.bench?.map((ml) => (
                  <button
                    key={ml.player_id}
                    onClick={() => handleSwap(ml.player_id, false, 'home')}
                    className={`flex items-center gap-2 p-2 rounded-md text-left transition-colors ${
                      selectedStarterId
                        ? 'bg-gray-700 border border-yellow-600 hover:bg-yellow-900/30 cursor-pointer'
                        : 'bg-gray-700/50 border border-transparent'
                    }`}
                  >
                    <span className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white bg-gray-600">
                      {ml.player?.shirt_number ?? ml.sort_order}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-gray-300 truncate">
                        {ml.player?.full_name ?? `Player ${ml.player_id}`}
                      </p>
                      <p className="text-xs text-gray-500">
                        {ml.player?.primary_position?.short_name ?? 'SUB'}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
              {selectedStarterId && (
                <p className="text-xs text-yellow-400 mt-2">
                  Click a bench player to swap with the selected starter
                </p>
              )}
            </div>

            {/* Away Starting XI (read-only display) */}
            {activeLineup?.away && (
              <div className="bg-gray-800 rounded-lg p-4">
                <h3 className="text-sm font-semibold uppercase tracking-wider mb-3" style={{ color: awayColor }}>
                  {awayTeam?.name ?? 'Away'} — Starting XI
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {activeLineup.away.starting.map((ml) => (
                    <div
                      key={ml.player_id}
                      className="flex items-center gap-2 p-2 rounded-md bg-gray-700/50"
                    >
                      <span
                        className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white"
                        style={{ backgroundColor: awayColor }}
                      >
                        {ml.player?.shirt_number ?? ml.sort_order}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-gray-300 truncate">
                          {ml.player?.full_name ?? `Player ${ml.player_id}`}
                        </p>
                        <p className="text-xs text-gray-500">{ml.position}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Action buttons */}
      <div className="px-4 pb-8">
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <button
            onClick={handleSaveLineup}
            disabled={saving}
            className="w-full sm:w-auto px-8 py-3 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 rounded-lg text-white font-semibold transition-colors"
          >
            {saving ? 'Saving...' : 'Save Lineup'}
          </button>
          <button
            onClick={() => navigate(`/match/${matchId}/live`)}
            className="w-full sm:w-auto px-8 py-3 bg-green-600 hover:bg-green-500 rounded-lg text-white font-bold text-lg transition-colors"
          >
            Start Match
          </button>
        </div>
        {error && (
          <p className="text-red-400 text-sm text-center mt-3">{error}</p>
        )}
      </div>
    </div>
  );
};

export default MatchPreviewPage;
