import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppSelector } from '../store';
import { SegmentControl, Badge, EmptyState, Spinner } from '../components/common';
import * as api from '../api/tauri';
import type { GameMatch } from '../api/tauri';

type Filter = 'all' | 'upcoming' | 'completed';

export default function CalendarPage() {
  const navigate = useNavigate();
  const { user } = useAppSelector((s) => s.auth);
  const { currentTeam } = useAppSelector((s) => s.team);
  const [matches, setMatches] = useState<GameMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>('all');

  useEffect(() => {
    if (user?.managed_team_id) {
      api.getTeamMatches(user.managed_team_id).then((m) => {
        setMatches(m);
        setLoading(false);
      });
    }
  }, [user]);

  const filtered = matches.filter((m) => {
    if (filter === 'upcoming') return m.status === 'scheduled';
    if (filter === 'completed') return m.status === 'completed';
    return true;
  });

  // Group by matchday
  const grouped: Record<string, GameMatch[]> = {};
  for (const m of filtered) {
    const key = m.matchday ? `Matchday ${m.matchday}` : 'Unscheduled';
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(m);
  }

  if (loading) return <div className="page-container items-center justify-center"><Spinner size="lg" /></div>;

  return (
    <div className="page-container">
      <div className="page-header">
        <h1 className="page-title">Matches</h1>
        <span className="text-xs text-navy-400">{matches.length} total</span>
      </div>

      <div className="px-4 pb-2">
        <SegmentControl
          options={[
            { label: 'All', value: 'all' },
            { label: 'Upcoming', value: 'upcoming' },
            { label: 'Played', value: 'completed' },
          ]}
          value={filter}
          onChange={(v) => setFilter(v as Filter)}
        />
      </div>

      <div className="page-body">
        {filtered.length === 0 ? (
          <EmptyState title="No matches found" />
        ) : (
          <div className="flex flex-col gap-3" style={{ maxHeight: 'calc(100vh - 10rem)' }}>
            {Object.entries(grouped).slice(0, 8).map(([group, gMatches]) => (
              <div key={group}>
                <p className="text-[10px] uppercase tracking-wider text-navy-500 font-medium mb-1">{group}</p>
                <div className="flex flex-col gap-1">
                  {gMatches.map((m) => {
                    const isHome = m.home_team_id === currentTeam?.id;
                    const isCompleted = m.status === 'completed';
                    const won = isCompleted && (
                      (isHome && (m.home_score ?? 0) > (m.away_score ?? 0)) ||
                      (!isHome && (m.away_score ?? 0) > (m.home_score ?? 0))
                    );
                    const lost = isCompleted && (
                      (isHome && (m.home_score ?? 0) < (m.away_score ?? 0)) ||
                      (!isHome && (m.away_score ?? 0) < (m.home_score ?? 0))
                    );
                    return (
                      <button
                        key={m.id}
                        onClick={() => {
                          if (m.status === 'completed') navigate(`/matches/${m.id}/result`);
                          else navigate(`/matches/${m.id}/preview`);
                        }}
                        className="flex items-center gap-2 px-2.5 py-2 rounded-lg bg-white/5 border border-white/5 active:scale-[0.98] transition-transform"
                      >
                        <div className="flex-1 flex items-center gap-1.5 min-w-0">
                          <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: m.home_team_color || '#666' }} />
                          <span className={`text-[10px] font-semibold truncate ${isHome ? 'text-brand-400' : 'text-white'}`}>
                            {m.home_team_name}
                          </span>
                        </div>

                        {isCompleted ? (
                          <div className="flex items-center gap-1 mx-1">
                            <span className="text-[11px] font-extrabold text-white tabular-nums">{m.home_score}</span>
                            <span className="text-[9px] text-navy-500">-</span>
                            <span className="text-[11px] font-extrabold text-white tabular-nums">{m.away_score}</span>
                          </div>
                        ) : (
                          <span className="text-[9px] text-navy-500 mx-1">vs</span>
                        )}

                        <div className="flex-1 flex items-center gap-1.5 justify-end min-w-0">
                          <span className={`text-[10px] font-semibold truncate ${!isHome ? 'text-brand-400' : 'text-white'}`}>
                            {m.away_team_name}
                          </span>
                          <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: m.away_team_color || '#666' }} />
                        </div>

                        <Badge
                          variant={isCompleted ? (won ? 'success' : lost ? 'danger' : 'warning') : 'info'}
                          size="sm"
                        >
                          {isCompleted ? (won ? 'W' : lost ? 'L' : 'D') : isHome ? 'H' : 'A'}
                        </Badge>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
