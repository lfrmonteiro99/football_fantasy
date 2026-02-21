import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '../store';
import { fetchMatch, fetchLineup } from '../store/matchSlice';
import Pitch2D from '../components/match/Pitch2D';
import ScoreBar from '../components/match/ScoreBar';
import { Spinner, Sheet } from '../components/common';
import * as api from '../api/tauri';
import type { Player, MatchLineup } from '../api/tauri';

export default function MatchPreviewPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { user } = useAppSelector((s) => s.auth);
  const { current: match, lineup } = useAppSelector((s) => s.match);
  const { squad } = useAppSelector((s) => s.team);
  const [starters, setStarters] = useState<MatchLineup[]>([]);
  const [bench, setBench] = useState<MatchLineup[]>([]);
  const [showBench, setShowBench] = useState(false);
  const [swapTarget, setSwapTarget] = useState<MatchLineup | null>(null);

  useEffect(() => {
    if (id) {
      dispatch(fetchMatch(Number(id)));
      if (user?.managed_team_id) {
        dispatch(fetchLineup({ matchId: Number(id), teamId: user.managed_team_id }));
      }
    }
  }, [dispatch, id, user]);

  useEffect(() => {
    setStarters(lineup.filter((l) => l.is_starting));
    setBench(lineup.filter((l) => !l.is_starting));
  }, [lineup]);

  const pitchPlayers = starters.map((l) => ({
    id: l.player_id,
    name: l.player_name || '',
    shirtNumber: l.shirt_number || 0,
    x: l.x || 50,
    y: l.y || 34,
    team: 'home' as const,
    position: l.position || '',
  }));

  const handleSwap = (benchPlayer: MatchLineup) => {
    if (!swapTarget) return;
    const newStarters = starters.map((s) =>
      s.player_id === swapTarget.player_id
        ? { ...benchPlayer, is_starting: true, x: swapTarget.x, y: swapTarget.y, position: swapTarget.position }
        : s
    );
    const newBench = bench.map((b) =>
      b.player_id === benchPlayer.player_id
        ? { ...swapTarget, is_starting: false, x: null, y: null }
        : b
    );
    setStarters(newStarters);
    setBench(newBench);
    setSwapTarget(null);
    setShowBench(false);
  };

  const handleSave = async () => {
    if (!id || !user?.managed_team_id) return;
    await api.saveMatchLineup(Number(id), user.managed_team_id, {
      starters: starters.map((s) => ({
        player_id: s.player_id,
        position: s.position || undefined,
        x: s.x || undefined,
        y: s.y || undefined,
      })),
      bench: bench.map((b) => ({ player_id: b.player_id })),
    });
  };

  const startMatch = async () => {
    await handleSave();
    navigate(`/matches/${id}/live`);
  };

  if (!match) return <div className="page-container items-center justify-center"><Spinner size="lg" /></div>;

  return (
    <div className="page-container">
      {/* Back + Header */}
      <div className="page-header">
        <button onClick={() => navigate(-1)} className="text-navy-400 text-sm">&larr; Back</button>
        <span className="text-[10px] text-navy-400">Matchday {match.matchday || ''}</span>
      </div>

      {/* Score Bar */}
      <ScoreBar
        homeTeam={match.home_team_name || 'Home'}
        awayTeam={match.away_team_name || 'Away'}
        homeScore={0}
        awayScore={0}
        homeColor={match.home_team_color || undefined}
        awayColor={match.away_team_color || undefined}
        homeFormation={match.home_formation_name || undefined}
      />

      {/* Pitch */}
      <div className="px-2">
        <Pitch2D
          players={pitchPlayers}
          homeColor={match.home_team_color || '#16a34a'}
          onPlayerTap={(p) => {
            const starter = starters.find((s) => s.player_id === p.id);
            if (starter) {
              setSwapTarget(starter);
              setShowBench(true);
            }
          }}
        />
      </div>

      {/* Bench bar */}
      <div className="px-4 flex items-center justify-between mt-1">
        <span className="text-[10px] text-navy-400 font-medium">
          {starters.length}/11 starters | Tap player to swap
        </span>
        <button onClick={() => setShowBench(true)} className="mobile-btn-secondary text-[10px] h-7 px-3">
          Bench ({bench.length})
        </button>
      </div>

      {/* Start Button */}
      <div className="px-4 mt-auto pb-4 flex-shrink-0">
        <button onClick={startMatch} className="mobile-btn-primary w-full h-12 text-sm">
          Start Simulation
        </button>
      </div>

      {/* Bench Sheet */}
      <Sheet open={showBench} onClose={() => { setShowBench(false); setSwapTarget(null); }} title={swapTarget ? `Swap ${swapTarget.player_name}` : 'Bench'}>
        <div className="px-5 py-3 flex flex-col gap-2">
          {bench.map((b) => (
            <button
              key={b.player_id}
              onClick={() => swapTarget ? handleSwap(b) : undefined}
              className="flex items-center gap-3 p-2.5 rounded-xl bg-white/5 border border-white/10 active:scale-[0.97] transition-transform"
            >
              <div className="w-8 h-8 rounded-full bg-navy-700 flex items-center justify-center">
                <span className="text-xs font-bold text-white">{b.shirt_number}</span>
              </div>
              <div className="flex-1 text-left">
                <p className="text-xs font-semibold text-white">{b.player_name}</p>
                <p className="text-[10px] text-navy-400">{b.position}</p>
              </div>
              {swapTarget && (
                <span className="text-[10px] font-semibold text-brand-400">Swap</span>
              )}
            </button>
          ))}
        </div>
      </Sheet>
    </div>
  );
}
