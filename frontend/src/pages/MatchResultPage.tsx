import React, { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';

import type { Match, TeamMatchStats } from '../types';

import { useAppSelector, useAppDispatch } from '../store';
import { fetchMatchDetails } from '../store/matchSlice';
import Spinner from '../components/common/Spinner';

import ScoreBar from '../components/match/ScoreBar';
import LiveStats from '../components/match/LiveStats';
import EventTimeline from '../components/match/EventTimeline';
import { matchEventsToTimeline } from '../components/match/EventTimeline';
import { getMatchDetails } from '../api/endpoints';

// ---------------------------------------------------------------------------
// Default empty stats
// ---------------------------------------------------------------------------

const EMPTY_STATS: TeamMatchStats = {
  possession_pct: 50,
  shots: 0,
  shots_on_target: 0,
  corners: 0,
  fouls: 0,
  yellow_cards: 0,
  red_cards: 0,
  saves: 0,
  passes: 0,
  tackles: 0,
  offsides: 0,
};

// ---------------------------------------------------------------------------
// MatchResultPage Component
// ---------------------------------------------------------------------------

const MatchResultPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const matchId = Number(id);
  const navigate = useNavigate();
  const dispatch = useAppDispatch();

  const [match, setMatch] = useState<Match | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reduxMatch = useAppSelector((s: any) => s.match?.currentMatch);
  const activeMatch: Match | null = reduxMatch?.id === matchId ? reduxMatch : match;

  // Fetch match details
  useEffect(() => {
    let cancelled = false;

    const loadData = async () => {
      setLoading(true);
      setError(null);
      try {
        dispatch(fetchMatchDetails(matchId));
        const data = await getMatchDetails(matchId);
        if (!cancelled) setMatch(data);
      } catch (err: any) {
        if (!cancelled) setError(err.message || 'Failed to load match result');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    loadData();
    return () => { cancelled = true; };
  }, [matchId, dispatch]);

  // Derive timeline events
  const timelineEvents = useMemo(() => {
    if (!activeMatch?.events) return [];
    return matchEventsToTimeline(activeMatch.events);
  }, [activeMatch?.events]);

  // Derive stats
  const homeStats: TeamMatchStats = activeMatch?.match_stats?.home ?? EMPTY_STATS;
  const awayStats: TeamMatchStats = activeMatch?.match_stats?.away ?? EMPTY_STATS;

  const homeTeam = activeMatch?.home_team;
  const awayTeam = activeMatch?.away_team;
  const homeColor = homeTeam?.primary_color || '#3b82f6';
  const awayColor = awayTeam?.primary_color || '#ef4444';

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Spinner />
          <p className="text-gray-400 text-sm">Loading match result...</p>
        </div>
      </div>
    );
  }

  if (error || !activeMatch) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center px-4">
        <div className="bg-red-900/50 border border-red-700 rounded-lg p-6 text-red-300 max-w-md text-center">
          <p className="font-semibold text-lg">Error</p>
          <p className="text-sm mt-2">{error || 'Match not found'}</p>
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

  // Determine match result text
  let resultText = '';
  if (activeMatch.home_score > activeMatch.away_score) {
    resultText = `${homeTeam?.name ?? 'Home'} Win`;
  } else if (activeMatch.away_score > activeMatch.home_score) {
    resultText = `${awayTeam?.name ?? 'Away'} Win`;
  } else {
    resultText = 'Draw';
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <div className="px-4 pt-6">
        <div className="text-center mb-4">
          <p className="text-sm text-gray-400 uppercase tracking-wider">
            Full Time Result
          </p>
          <p className="text-lg font-semibold text-green-400 mt-1">
            {resultText}
          </p>
        </div>

        {/* Score Bar */}
        <ScoreBar
          homeTeam={homeTeam?.name ?? 'Home'}
          awayTeam={awayTeam?.name ?? 'Away'}
          homeScore={activeMatch.home_score}
          awayScore={activeMatch.away_score}
          homeFormation={activeMatch.home_formation?.name}
          awayFormation={activeMatch.away_formation?.name}
          homeColor={homeColor}
          awayColor={awayColor}
        />
      </div>

      {/* Match info */}
      <div className="px-4 py-2">
        <div className="flex items-center justify-center gap-4 text-sm text-gray-500">
          {activeMatch.match_date && (
            <span>
              {new Date(activeMatch.match_date).toLocaleDateString('en-GB', {
                weekday: 'short',
                day: 'numeric',
                month: 'short',
                year: 'numeric',
              })}
            </span>
          )}
          {activeMatch.stadium && <span>{activeMatch.stadium}</span>}
          {activeMatch.attendance && (
            <span>Att: {activeMatch.attendance.toLocaleString()}</span>
          )}
        </div>
      </div>

      {/* Main content grid */}
      <div className="px-4 py-4">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left: Event timeline */}
          <div>
            <EventTimeline
              events={timelineEvents}
              className="max-h-none"
            />
            {/* Override max-height for result page: show all events */}
            {timelineEvents.length === 0 && (
              <div className="bg-gray-800 rounded-lg p-4 text-center text-gray-500">
                <p>No detailed events available for this match.</p>
              </div>
            )}
          </div>

          {/* Right: Stats */}
          <div>
            <LiveStats
              homeStats={homeStats}
              awayStats={awayStats}
              homeColor={homeColor}
              awayColor={awayColor}
            />
          </div>
        </div>
      </div>

      {/* Goal scorers summary */}
      {timelineEvents.filter((e) => e.type === 'goal' || e.type === 'penalty').length > 0 && (
        <div className="px-4 pb-4">
          <div className="bg-gray-800 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">
              Goals
            </h3>
            <div className="space-y-2">
              {timelineEvents
                .filter((e) => e.type === 'goal' || e.type === 'penalty')
                .map((ev, idx) => (
                  <div
                    key={idx}
                    className={`flex items-center gap-2 ${
                      ev.team === 'home' ? 'justify-start' : 'justify-end'
                    }`}
                  >
                    {ev.team === 'home' && (
                      <>
                        <span className="text-green-400 font-bold">{ev.minute}'</span>
                        <span className="text-white font-medium">
                          {ev.playerName}
                        </span>
                        {ev.type === 'penalty' && (
                          <span className="text-xs text-gray-400">(pen)</span>
                        )}
                      </>
                    )}
                    {ev.team === 'away' && (
                      <>
                        {ev.type === 'penalty' && (
                          <span className="text-xs text-gray-400">(pen)</span>
                        )}
                        <span className="text-white font-medium">
                          {ev.playerName}
                        </span>
                        <span className="text-green-400 font-bold">{ev.minute}'</span>
                      </>
                    )}
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}

      {/* Navigation buttons */}
      <div className="px-4 pb-8">
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <button
            onClick={() => navigate('/')}
            className="w-full sm:w-auto px-8 py-3 bg-gray-700 hover:bg-gray-600 rounded-lg text-gray-300 font-semibold transition-colors"
          >
            Back to Dashboard
          </button>
          {activeMatch.league_id && (
            <button
              onClick={() => navigate(`/league/${activeMatch.league_id}/standings`)}
              className="w-full sm:w-auto px-8 py-3 bg-blue-600 hover:bg-blue-500 rounded-lg text-white font-semibold transition-colors"
            >
              View League Table
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default MatchResultPage;
