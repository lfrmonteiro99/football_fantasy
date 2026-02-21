import { useEffect, useState } from 'react';
import { useAppDispatch, useAppSelector } from '../store';
import { SegmentControl, FormBadge, Spinner, EmptyState } from '../components/common';
import * as api from '../api/tauri';
import type { StandingEntry, League } from '../api/tauri';

type View = 'table' | 'form';

export default function LeagueTablePage() {
  const { user } = useAppSelector((s) => s.auth);
  const { currentTeam } = useAppSelector((s) => s.team);
  const [standings, setStandings] = useState<StandingEntry[]>([]);
  const [leagues, setLeagues] = useState<League[]>([]);
  const [leagueId, setLeagueId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<View>('table');

  useEffect(() => {
    api.getLeagues().then((l) => {
      setLeagues(l);
      if (l.length > 0) setLeagueId(currentTeam?.league_id || l[0].id);
    });
  }, [currentTeam]);

  useEffect(() => {
    if (leagueId) {
      setLoading(true);
      api.getStandings(leagueId).then((s) => { setStandings(s); setLoading(false); });
    }
  }, [leagueId]);

  if (loading) return <div className="page-container items-center justify-center"><Spinner size="lg" /></div>;
  if (standings.length === 0) return <div className="page-container"><EmptyState title="No standings yet" subtitle="Play some matches first" /></div>;

  return (
    <div className="page-container">
      <div className="page-header">
        <h1 className="page-title">League</h1>
        {leagues.length > 1 && (
          <select
            value={leagueId || ''}
            onChange={(e) => setLeagueId(Number(e.target.value))}
            className="bg-white/5 text-xs text-white rounded-lg px-2 py-1 border border-white/10"
          >
            {leagues.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
        )}
      </div>

      <div className="px-4 pb-2">
        <SegmentControl
          options={[{ label: 'Standings', value: 'table' }, { label: 'Form', value: 'form' }]}
          value={view}
          onChange={(v) => setView(v as View)}
        />
      </div>

      <div className="page-body">
        {view === 'table' && (
          <div className="flex flex-col">
            {/* Header Row */}
            <div className="flex items-center gap-1 px-1 pb-1.5 border-b border-white/10">
              <span className="w-5 text-[9px] text-navy-500 text-center">#</span>
              <span className="flex-1 text-[9px] text-navy-500">Team</span>
              <span className="w-5 text-[9px] text-navy-500 text-center">P</span>
              <span className="w-5 text-[9px] text-navy-500 text-center">W</span>
              <span className="w-5 text-[9px] text-navy-500 text-center">D</span>
              <span className="w-5 text-[9px] text-navy-500 text-center">L</span>
              <span className="w-7 text-[9px] text-navy-500 text-center">GD</span>
              <span className="w-7 text-[9px] text-navy-500 text-center font-bold">Pts</span>
            </div>

            {/* Rows */}
            {standings.map((s) => {
              const isUserTeam = s.team_id === currentTeam?.id;
              const isChampion = s.position <= 3;
              const isRelegation = s.position > standings.length - 3;
              return (
                <div
                  key={s.team_id}
                  className={`flex items-center gap-1 px-1 py-1.5 border-b border-white/5 ${
                    isUserTeam ? 'bg-brand-600/10' : ''
                  }`}
                >
                  <span className={`w-5 text-[10px] text-center font-bold ${
                    isChampion ? 'text-brand-400' : isRelegation ? 'text-red-400' : 'text-navy-400'
                  }`}>
                    {s.position}
                  </span>
                  <div className="flex-1 flex items-center gap-1.5 min-w-0">
                    <div
                      className="w-3 h-3 rounded-full flex-shrink-0"
                      style={{ backgroundColor: s.primary_color || '#666' }}
                    />
                    <span className={`text-[10px] font-semibold truncate ${isUserTeam ? 'text-brand-400' : 'text-white'}`}>
                      {s.short_name || s.team_name}
                    </span>
                  </div>
                  <span className="w-5 text-[10px] text-navy-300 text-center tabular-nums">{s.played}</span>
                  <span className="w-5 text-[10px] text-navy-300 text-center tabular-nums">{s.won}</span>
                  <span className="w-5 text-[10px] text-navy-300 text-center tabular-nums">{s.drawn}</span>
                  <span className="w-5 text-[10px] text-navy-300 text-center tabular-nums">{s.lost}</span>
                  <span className={`w-7 text-[10px] text-center font-semibold tabular-nums ${
                    s.goal_difference > 0 ? 'text-brand-400' : s.goal_difference < 0 ? 'text-red-400' : 'text-navy-400'
                  }`}>
                    {s.goal_difference > 0 ? '+' : ''}{s.goal_difference}
                  </span>
                  <span className="w-7 text-[11px] text-center font-extrabold text-white tabular-nums">{s.points}</span>
                </div>
              );
            })}
          </div>
        )}

        {view === 'form' && (
          <div className="flex flex-col gap-1.5">
            {standings.map((s) => {
              const isUserTeam = s.team_id === currentTeam?.id;
              return (
                <div
                  key={s.team_id}
                  className={`flex items-center gap-2 px-2 py-1.5 rounded-lg ${isUserTeam ? 'bg-brand-600/10' : ''}`}
                >
                  <span className="text-[10px] font-bold text-navy-400 w-4">{s.position}</span>
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: s.primary_color || '#666' }} />
                  <span className={`text-[11px] font-semibold flex-1 truncate ${isUserTeam ? 'text-brand-400' : 'text-white'}`}>
                    {s.short_name || s.team_name}
                  </span>
                  <div className="flex gap-0.5">
                    {s.form.map((f, i) => <FormBadge key={i} result={f} />)}
                    {Array.from({ length: Math.max(0, 5 - s.form.length) }).map((_, i) => (
                      <span key={`empty-${i}`} className="px-1.5 py-0.5 text-[9px] text-navy-600">-</span>
                    ))}
                  </div>
                  <span className="text-[11px] font-extrabold text-white w-6 text-right tabular-nums">{s.points}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
