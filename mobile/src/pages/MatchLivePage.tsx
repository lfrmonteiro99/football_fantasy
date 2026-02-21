import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { listen } from '@tauri-apps/api/event';
import { useAppDispatch, useAppSelector } from '../store';
import { fetchMatch, addTick, setLineupData, setSimulationRunning, setFinalScore, clearSimulation } from '../store/matchSlice';
import { SegmentControl, Spinner } from '../components/common';
import Pitch2D from '../components/match/Pitch2D';
import type { Pitch2DPlayer } from '../components/match/Pitch2D';
import ScoreBar from '../components/match/ScoreBar';
import LiveStats from '../components/match/LiveStats';
import EventTimeline from '../components/match/EventTimeline';
import type { TimelineEntry } from '../components/match/EventTimeline';
import * as api from '../api/tauri';
import type { SimulationTick, SimulationEvent, LineupData } from '../api/tauri';

type View = 'pitch' | 'stats' | 'events';

export default function MatchLivePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { current: match, simulation } = useAppSelector((s) => s.match);
  const [view, setView] = useState<View>('pitch');
  const [speed, setSpeed] = useState('fast');
  const [players, setPlayers] = useState<Pitch2DPlayer[]>([]);

  useEffect(() => {
    if (id) dispatch(fetchMatch(Number(id)));
  }, [dispatch, id]);

  // Set up Tauri event listeners
  useEffect(() => {
    const unlisteners: (() => void)[] = [];

    const setup = async () => {
      const u1 = await listen<LineupData>('match:lineup', (e) => {
        dispatch(setLineupData(e.payload));
        const allPlayers = [...e.payload.home, ...e.payload.away].map((p) => ({
          id: p.id,
          name: p.name,
          shirtNumber: p.shirt_number,
          x: p.x,
          y: p.y,
          team: p.team as 'home' | 'away',
          position: p.position,
        }));
        setPlayers(allPlayers);
      });
      unlisteners.push(u1);

      const u2 = await listen<SimulationTick>('match:minute', (e) => {
        dispatch(addTick(e.payload));
        // Update ball-relative player positions with jitter
        setPlayers((prev) => prev.map((p) => ({
          ...p,
          x: p.x + (Math.random() - 0.5) * 3,
          y: p.y + (Math.random() - 0.5) * 2,
        })));
      });
      unlisteners.push(u2);

      const u3 = await listen<SimulationTick>('match:full_time', (e) => {
        dispatch(setFinalScore(e.payload.score));
        dispatch(setSimulationRunning(false));
      });
      unlisteners.push(u3);

      const u4 = await listen<SimulationEvent>('match:goal', () => {});
      unlisteners.push(u4);
    };

    setup();
    return () => { unlisteners.forEach((u) => u()); };
  }, [dispatch]);

  // Start simulation
  const startSim = useCallback(async () => {
    if (!id) return;
    dispatch(clearSimulation());
    dispatch(setSimulationRunning(true));
    try {
      await api.simulateMatch(Number(id), speed);
    } catch (err) {
      console.error('Simulation error:', err);
      dispatch(setSimulationRunning(false));
    }
  }, [dispatch, id, speed]);

  useEffect(() => {
    if (match && match.status !== 'completed' && !simulation.running && simulation.ticks.length === 0) {
      startSim();
    }
  }, [match, simulation.running, simulation.ticks.length, startSim]);

  const tick = simulation.currentTick;
  const isFinished = tick?.phase === 'full_time' || simulation.finalScore !== null;

  // Build timeline from ticks
  const timeline: TimelineEntry[] = simulation.ticks.flatMap((t) =>
    t.events
      .filter((e) => ['goal', 'yellow_card', 'red_card', 'second_yellow'].includes(e.event_type))
      .map((e) => ({
        minute: t.minute,
        type: e.event_type,
        team: e.team,
        player: e.primary_player,
        description: e.description,
      }))
  );

  if (!match) return <div className="h-full flex items-center justify-center"><Spinner size="lg" /></div>;

  return (
    <div className="flex flex-col h-full bg-navy-950 pt-safe-top">
      {/* Score Bar */}
      <ScoreBar
        homeTeam={match.home_team_name || 'Home'}
        awayTeam={match.away_team_name || 'Away'}
        homeScore={tick?.score.home ?? match.home_score ?? 0}
        awayScore={tick?.score.away ?? match.away_score ?? 0}
        homeColor={match.home_team_color || undefined}
        awayColor={match.away_team_color || undefined}
        homeFormation={match.home_formation_name || undefined}
        awayFormation={match.away_formation_name || undefined}
        minute={tick?.minute}
        phase={tick?.phase}
      />

      {/* View Selector */}
      <div className="px-4 py-2">
        <SegmentControl
          options={[
            { label: 'Pitch', value: 'pitch' },
            { label: 'Stats', value: 'stats' },
            { label: 'Events', value: 'events' },
          ]}
          value={view}
          onChange={(v) => setView(v as View)}
        />
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-hidden px-2">
        {view === 'pitch' && (
          <div className="flex flex-col h-full gap-2">
            <Pitch2D
              players={players}
              ball={tick?.ball}
              animated
              homeColor={match.home_team_color || '#16a34a'}
              awayColor={match.away_team_color || '#345084'}
            />
            {/* Commentary */}
            <div className="glass-card p-3 flex-shrink-0">
              <p className="text-[11px] text-navy-200 leading-relaxed line-clamp-2">
                {tick?.commentary || 'Waiting for kickoff...'}
              </p>
            </div>
            {/* Mini timeline */}
            <div className="flex-1 overflow-hidden">
              <EventTimeline events={timeline} compact />
            </div>
          </div>
        )}

        {view === 'stats' && tick && (
          <div className="flex flex-col h-full justify-center">
            <LiveStats home={tick.stats.home} away={tick.stats.away} />
          </div>
        )}

        {view === 'events' && (
          <div className="flex flex-col h-full">
            <EventTimeline events={timeline} />
          </div>
        )}
      </div>

      {/* Speed Control / Finish */}
      <div className="px-4 py-3 flex-shrink-0 pb-safe-bottom">
        {isFinished ? (
          <button
            onClick={() => navigate(`/matches/${id}/result`)}
            className="mobile-btn-primary w-full h-11 text-sm"
          >
            View Full Result
          </button>
        ) : (
          <div className="flex items-center justify-center gap-3">
            <span className="text-[10px] text-navy-400">Speed:</span>
            {['slow', 'fast', 'instant'].map((s) => (
              <button
                key={s}
                onClick={() => setSpeed(s)}
                className={`px-3 py-1 rounded-lg text-[10px] font-semibold ${
                  speed === s ? 'bg-brand-600 text-white' : 'bg-white/5 text-navy-400'
                }`}
              >
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
