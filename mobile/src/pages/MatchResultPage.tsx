import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '../store';
import { fetchMatch, fetchMatchEvents } from '../store/matchSlice';
import { SegmentControl, Spinner } from '../components/common';
import ScoreBar from '../components/match/ScoreBar';
import LiveStats from '../components/match/LiveStats';
import EventTimeline from '../components/match/EventTimeline';
import type { TimelineEntry } from '../components/match/EventTimeline';
import type { TeamStats } from '../api/tauri';

type Tab = 'events' | 'stats';

export default function MatchResultPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { current: match, events, simulation } = useAppSelector((s) => s.match);
  const [tab, setTab] = useState<Tab>('events');

  useEffect(() => {
    if (id) {
      dispatch(fetchMatch(Number(id)));
      dispatch(fetchMatchEvents(Number(id)));
    }
  }, [dispatch, id]);

  if (!match) return <div className="page-container items-center justify-center"><Spinner size="lg" /></div>;

  // Build timeline from match events
  const timeline: TimelineEntry[] = events.map((e) => ({
    minute: e.minute,
    type: e.event_type,
    team: e.team_type || 'home',
    player: e.player_name,
    description: e.description || '',
  }));

  // Try to get stats from match or simulation
  const stats: { home: TeamStats; away: TeamStats } | null = (() => {
    if (simulation.currentTick?.stats) return simulation.currentTick.stats;
    if (match.match_stats) {
      try { return JSON.parse(match.match_stats); } catch { return null; }
    }
    return null;
  })();

  return (
    <div className="page-container">
      {/* Header */}
      <div className="page-header">
        <button onClick={() => navigate('/')} className="text-navy-400 text-sm">&larr; Home</button>
        <span className="text-[10px] text-navy-400">Full Time</span>
      </div>

      {/* Score */}
      <ScoreBar
        homeTeam={match.home_team_name || 'Home'}
        awayTeam={match.away_team_name || 'Away'}
        homeScore={match.home_score ?? 0}
        awayScore={match.away_score ?? 0}
        homeColor={match.home_team_color || undefined}
        awayColor={match.away_team_color || undefined}
        homeFormation={match.home_formation_name || undefined}
        awayFormation={match.away_formation_name || undefined}
        phase="full_time"
      />

      {/* Tab Control */}
      <div className="px-4 py-3">
        <SegmentControl
          options={[
            { label: 'Events', value: 'events' },
            { label: 'Statistics', value: 'stats' },
          ]}
          value={tab}
          onChange={(v) => setTab(v as Tab)}
        />
      </div>

      {/* Content */}
      <div className="page-body">
        {tab === 'events' && <EventTimeline events={timeline} />}
        {tab === 'stats' && stats && (
          <div className="flex flex-col justify-center h-full">
            <LiveStats home={stats.home} away={stats.away} />
          </div>
        )}
        {tab === 'stats' && !stats && (
          <div className="flex items-center justify-center h-full text-navy-500 text-xs">
            No statistics available
          </div>
        )}
      </div>
    </div>
  );
}
