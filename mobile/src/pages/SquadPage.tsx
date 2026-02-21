import { useEffect, useState } from 'react';
import { useAppDispatch, useAppSelector } from '../store';
import { fetchSquad } from '../store/teamSlice';
import { SegmentControl, Sheet, Badge, Spinner } from '../components/common';
import * as api from '../api/tauri';
import type { Player, PlayerAttributes } from '../api/tauri';

const POSITIONS = [
  { label: 'All', value: 'all' },
  { label: 'GK', value: 'goalkeeper' },
  { label: 'DEF', value: 'defender' },
  { label: 'MID', value: 'midfielder' },
  { label: 'FWD', value: 'forward' },
];

export default function SquadPage() {
  const dispatch = useAppDispatch();
  const { user } = useAppSelector((s) => s.auth);
  const { squad, squadStats, loading } = useAppSelector((s) => s.team);
  const [filter, setFilter] = useState('all');
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
  const [attrs, setAttrs] = useState<PlayerAttributes | null>(null);

  useEffect(() => {
    if (user?.managed_team_id) dispatch(fetchSquad(user.managed_team_id));
  }, [dispatch, user]);

  const filtered = filter === 'all' ? squad : squad.filter((p) => {
    const cat = p.position_name?.toLowerCase() || '';
    if (filter === 'goalkeeper') return cat.includes('goalkeeper') || p.position_short === 'GK';
    if (filter === 'defender') return cat.includes('back') || cat.includes('defender') || ['CB', 'LB', 'RB', 'WB', 'SW'].includes(p.position_short || '');
    if (filter === 'midfielder') return cat.includes('mid') || ['CM', 'DM', 'AM', 'LM', 'RM'].includes(p.position_short || '');
    return cat.includes('forward') || cat.includes('striker') || ['ST', 'CF', 'LW', 'RW', 'F9'].includes(p.position_short || '');
  });

  const openPlayer = async (player: Player) => {
    setSelectedPlayer(player);
    const a = await api.getPlayerAttributes(player.id);
    setAttrs(a);
  };

  if (loading) return <div className="page-container items-center justify-center"><Spinner size="lg" /></div>;

  return (
    <div className="page-container">
      <div className="page-header">
        <h1 className="page-title">Squad</h1>
        <span className="text-xs text-navy-400">{squad.length} players</span>
      </div>

      <div className="px-4 pb-2">
        <SegmentControl options={POSITIONS} value={filter} onChange={setFilter} />
      </div>

      {/* Player Grid - fits viewport */}
      <div className="page-body">
        <div className="grid grid-cols-2 gap-2 h-full content-start" style={{ maxHeight: 'calc(100vh - 11rem)' }}>
          {filtered.slice(0, 12).map((p) => (
            <button
              key={p.id}
              onClick={() => openPlayer(p)}
              className="glass-card-light p-2.5 flex items-center gap-2 active:scale-[0.97] transition-transform text-left"
            >
              <div className="w-8 h-8 rounded-full bg-navy-700 flex items-center justify-center flex-shrink-0">
                <span className="text-xs font-bold text-white">{p.shirt_number || '?'}</span>
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-bold text-white truncate">{p.last_name}</p>
                <div className="flex items-center gap-1">
                  <span className="text-[9px] font-semibold text-brand-400">{p.position_short || '?'}</span>
                  {p.is_injured && <Badge variant="danger" size="sm">INJ</Badge>}
                </div>
              </div>
            </button>
          ))}
        </div>
        {filtered.length > 12 && (
          <p className="text-center text-[10px] text-navy-500 mt-1">+{filtered.length - 12} more</p>
        )}
      </div>

      {/* Player Detail Sheet */}
      <Sheet open={!!selectedPlayer} onClose={() => { setSelectedPlayer(null); setAttrs(null); }} title={selectedPlayer ? `${selectedPlayer.first_name} ${selectedPlayer.last_name}` : ''}>
        {selectedPlayer && (
          <div className="px-5 py-3 flex flex-col gap-3">
            {/* Bio Row */}
            <div className="grid grid-cols-4 gap-2 text-center">
              <div>
                <p className="text-[10px] text-navy-400">Position</p>
                <p className="text-xs font-bold text-brand-400">{selectedPlayer.position_short}</p>
              </div>
              <div>
                <p className="text-[10px] text-navy-400">Age</p>
                <p className="text-xs font-bold text-white">
                  {selectedPlayer.date_of_birth
                    ? Math.floor((Date.now() - new Date(selectedPlayer.date_of_birth).getTime()) / 31557600000)
                    : '?'}
                </p>
              </div>
              <div>
                <p className="text-[10px] text-navy-400">Foot</p>
                <p className="text-xs font-bold text-white capitalize">{selectedPlayer.preferred_foot || '?'}</p>
              </div>
              <div>
                <p className="text-[10px] text-navy-400">Value</p>
                <p className="text-xs font-bold text-accent-400">
                  {selectedPlayer.market_value ? `${(selectedPlayer.market_value / 1000000).toFixed(1)}M` : '?'}
                </p>
              </div>
            </div>

            {/* Attributes */}
            {attrs && (
              <div className="flex flex-col gap-2">
                <AttrSection title="Technical" attrs={[
                  ['Finishing', attrs.finishing], ['Passing', attrs.passing], ['Dribbling', attrs.dribbling],
                  ['Technique', attrs.technique], ['Crossing', attrs.crossing], ['Heading', attrs.heading],
                ]} />
                <AttrSection title="Mental" attrs={[
                  ['Composure', attrs.composure], ['Decisions', attrs.decisions], ['Vision', attrs.vision],
                  ['Off the Ball', attrs.off_the_ball], ['Positioning', attrs.positioning], ['Anticipation', attrs.anticipation],
                ]} />
                <AttrSection title="Physical" attrs={[
                  ['Pace', attrs.pace], ['Strength', attrs.strength], ['Stamina', attrs.stamina],
                  ['Agility', attrs.agility], ['Balance', attrs.balance], ['Acceleration', attrs.acceleration],
                ]} />
                {selectedPlayer.position_short === 'GK' && (
                  <AttrSection title="Goalkeeping" attrs={[
                    ['Handling', attrs.handling], ['Reflexes', attrs.reflexes], ['Aerial', attrs.aerial_reach],
                    ['1-on-1', attrs.one_on_ones], ['Kicking', attrs.kicking], ['Command', attrs.command_of_area],
                  ]} />
                )}
              </div>
            )}
          </div>
        )}
      </Sheet>
    </div>
  );
}

function AttrSection({ title, attrs }: { title: string; attrs: [string, number][] }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider text-navy-400 font-medium mb-1">{title}</p>
      <div className="grid grid-cols-3 gap-x-3 gap-y-1">
        {attrs.map(([label, val]) => (
          <div key={label} className="flex items-center justify-between">
            <span className="text-[10px] text-navy-300 truncate">{label}</span>
            <span className={`text-[11px] font-bold tabular-nums ${
              val >= 16 ? 'text-brand-400' : val >= 12 ? 'text-white' : val >= 8 ? 'text-navy-300' : 'text-red-400'
            }`}>{val}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
