import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '../store';
import { fetchTeam, fetchSquad } from '../store/teamSlice';
import { fetchGameTime, advanceDayThunk, advanceToMatchThunk } from '../store/gameTimeSlice';
import { fetchUpcoming } from '../store/matchSlice';
import { StatCard, Badge, Spinner } from '../components/common';

export default function DashboardPage() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { user } = useAppSelector((s) => s.auth);
  const { currentTeam, squadStats } = useAppSelector((s) => s.team);
  const { data: gameTime } = useAppSelector((s) => s.gameTime);
  const { upcoming } = useAppSelector((s) => s.match);

  useEffect(() => {
    if (user?.managed_team_id) {
      dispatch(fetchTeam(user.managed_team_id));
      dispatch(fetchSquad(user.managed_team_id));
      dispatch(fetchGameTime(user.id));
      dispatch(fetchUpcoming({ limit: 3 }));
    }
  }, [dispatch, user]);

  if (!currentTeam || !gameTime) {
    return <div className="page-container items-center justify-center"><Spinner size="lg" /></div>;
  }

  const handleAdvanceDay = () => { if (user) dispatch(advanceDayThunk(user.id)); };
  const handleSkipToMatch = () => { if (user) dispatch(advanceToMatchThunk(user.id)); };

  return (
    <div className="page-container">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">{currentTeam.short_name || currentTeam.name}</h1>
          <p className="text-[10px] text-navy-400">{gameTime.formatted_date}</p>
        </div>
        <div className="flex items-center gap-2">
          {gameTime.is_match_day && <Badge variant="warning" size="md">Match Day</Badge>}
        </div>
      </div>

      {/* Body */}
      <div className="page-body flex flex-col gap-3 pt-2">
        {/* Stats Grid */}
        <div className="grid grid-cols-3 gap-2">
          <StatCard label="Players" value={squadStats?.total_players || 0} color="brand" />
          <StatCard label="Avg Rating" value={squadStats?.avg_rating?.toFixed(1) || '0'} color="accent" />
          <StatCard
            label="Injured"
            value={squadStats?.injured_count || 0}
            color={squadStats?.injured_count ? 'red' : 'navy'}
          />
        </div>

        {/* Next Match Card */}
        {gameTime.next_match && (
          <div className="glass-card p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] uppercase tracking-wider text-navy-400 font-medium">Next Match</span>
              {gameTime.days_until_match !== null && (
                <Badge variant={gameTime.is_match_day ? 'warning' : 'info'}>
                  {gameTime.is_match_day ? 'TODAY' : `In ${gameTime.days_until_match}d`}
                </Badge>
              )}
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded-full" style={{ backgroundColor: gameTime.next_match.home_team_color || '#16a34a' }} />
                <span className="text-sm font-bold text-white">{gameTime.next_match.home_team_name}</span>
              </div>
              <span className="text-xs font-bold text-navy-500">vs</span>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-white">{gameTime.next_match.away_team_name}</span>
                <div className="w-4 h-4 rounded-full" style={{ backgroundColor: gameTime.next_match.away_team_color || '#345084' }} />
              </div>
            </div>
            {gameTime.is_match_day && (
              <button
                onClick={() => navigate(`/matches/${gameTime.next_match!.id}/preview`)}
                className="mobile-btn-primary w-full mt-3 text-sm"
              >
                Prepare Lineup
              </button>
            )}
          </div>
        )}

        {/* Quick Actions */}
        <div className="grid grid-cols-2 gap-2">
          <button onClick={handleAdvanceDay} className="glass-card-light p-3 flex flex-col items-center gap-1 active:scale-95 transition-transform">
            <span className="text-lg">&#9654;</span>
            <span className="text-[10px] font-semibold text-navy-300">Advance Day</span>
          </button>
          <button onClick={handleSkipToMatch} className="glass-card-light p-3 flex flex-col items-center gap-1 active:scale-95 transition-transform">
            <span className="text-lg">&#9193;</span>
            <span className="text-[10px] font-semibold text-navy-300">Skip to Match</span>
          </button>
        </div>

        {/* Upcoming Fixtures */}
        {upcoming.length > 0 && (
          <div className="glass-card p-3">
            <span className="text-[10px] uppercase tracking-wider text-navy-400 font-medium">Upcoming</span>
            <div className="flex flex-col gap-2 mt-2">
              {upcoming.slice(0, 3).map((m) => (
                <div key={m.id} className="flex items-center justify-between">
                  <span className="text-[11px] text-white font-medium truncate flex-1">
                    {m.home_team_name}
                  </span>
                  <span className="text-[10px] text-navy-500 mx-2">vs</span>
                  <span className="text-[11px] text-white font-medium truncate flex-1 text-right">
                    {m.away_team_name}
                  </span>
                  <Badge variant={m.status === 'completed' ? 'success' : 'info'} size="sm">
                    {m.status === 'completed'
                      ? `${m.home_score}-${m.away_score}`
                      : m.matchday ? `MD${m.matchday}` : 'TBD'}
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
