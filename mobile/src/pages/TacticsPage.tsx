import { useEffect, useState } from 'react';
import { useAppDispatch, useAppSelector } from '../store';
import { fetchTeamTactics } from '../store/teamSlice';
import { SegmentControl, SliderControl, Sheet, Spinner } from '../components/common';
import Pitch2D from '../components/match/Pitch2D';
import type { Tactic, Formation } from '../api/tauri';
import * as api from '../api/tauri';

type Tab = 'pitch' | 'settings';

export default function TacticsPage() {
  const dispatch = useAppDispatch();
  const { user } = useAppSelector((s) => s.auth);
  const { tactics, currentTeam } = useAppSelector((s) => s.team);
  const [activeTactic, setActiveTactic] = useState<Tactic | null>(null);
  const [formations, setFormations] = useState<Formation[]>([]);
  const [tab, setTab] = useState<Tab>('pitch');
  const [showTacticPicker, setShowTacticPicker] = useState(false);

  useEffect(() => {
    if (user?.managed_team_id) {
      dispatch(fetchTeamTactics(user.managed_team_id));
      api.getFormations().then(setFormations);
    }
  }, [dispatch, user]);

  useEffect(() => {
    if (tactics.length > 0 && !activeTactic) setActiveTactic(tactics[0]);
  }, [tactics, activeTactic]);

  const formation = formations.find((f) => f.id === activeTactic?.formation_id);
  const positions = formation ? (JSON.parse(formation.positions) as { position: string; x: number; y: number }[]) : [];

  const pitchPlayers = positions.map((p, i) => ({
    id: i + 1,
    name: p.position,
    shirtNumber: i + 1,
    x: p.x,
    y: p.y,
    team: 'home' as const,
    position: p.position,
  }));

  const handleSettingChange = async (field: string, value: string) => {
    if (!activeTactic) return;
    await api.updateTactic(activeTactic.id, { [field]: value });
    setActiveTactic({ ...activeTactic, [field]: value });
  };

  if (!activeTactic) {
    return <div className="page-container items-center justify-center"><Spinner size="lg" /></div>;
  }

  return (
    <div className="page-container">
      {/* Header */}
      <div className="page-header">
        <h1 className="page-title">Tactics</h1>
        <button onClick={() => setShowTacticPicker(true)} className="mobile-btn-secondary text-xs h-8 px-3">
          {activeTactic.name}
        </button>
      </div>

      {/* Tab Control */}
      <div className="px-4 pb-2">
        <SegmentControl
          options={[{ label: 'Formation', value: 'pitch' }, { label: 'Settings', value: 'settings' }]}
          value={tab}
          onChange={(v) => setTab(v as Tab)}
        />
      </div>

      {/* Content */}
      <div className="page-body flex flex-col gap-3">
        {tab === 'pitch' && (
          <>
            {/* Formation selector */}
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-navy-400 font-medium">Formation:</span>
              <div className="flex gap-1 flex-wrap">
                {formations.slice(0, 8).map((f) => (
                  <button
                    key={f.id}
                    onClick={async () => {
                      await api.updateTactic(activeTactic.id, { formation_id: f.id });
                      setActiveTactic({ ...activeTactic, formation_id: f.id, formation_name: f.name });
                    }}
                    className={`px-2 py-1 rounded-lg text-[10px] font-semibold transition-all ${
                      f.id === activeTactic.formation_id
                        ? 'bg-brand-600 text-white'
                        : 'bg-white/5 text-navy-400'
                    }`}
                  >
                    {f.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Pitch */}
            <Pitch2D
              players={pitchPlayers}
              homeColor={currentTeam?.primary_color || '#16a34a'}
            />

            {/* Position labels */}
            <div className="flex justify-center gap-3 flex-wrap">
              {positions.map((p, i) => (
                <span key={i} className="text-[9px] font-semibold text-navy-400 bg-white/5 px-2 py-0.5 rounded-full">
                  {p.position}
                </span>
              ))}
            </div>
          </>
        )}

        {tab === 'settings' && (
          <div className="flex flex-col gap-4">
            <SliderControl
              label="Mentality"
              value={activeTactic.mentality || 'balanced'}
              options={['very_defensive', 'defensive', 'balanced', 'attacking', 'very_attacking']}
              onChange={(v) => handleSettingChange('mentality', v)}
            />
            <SliderControl
              label="Defensive Line"
              value={activeTactic.defensive_line || 'standard'}
              options={['very_deep', 'deep', 'standard', 'high', 'very_high']}
              onChange={(v) => handleSettingChange('defensive_line', v)}
            />
            <SliderControl
              label="Pressing"
              value={activeTactic.pressing || 'sometimes'}
              options={['never', 'rarely', 'sometimes', 'often', 'always']}
              onChange={(v) => handleSettingChange('pressing', v)}
            />
            <SliderControl
              label="Tempo"
              value={activeTactic.tempo || 'standard'}
              options={['very_slow', 'slow', 'standard', 'fast', 'very_fast']}
              onChange={(v) => handleSettingChange('tempo', v)}
            />
            <SliderControl
              label="Width"
              value={activeTactic.width || 'standard'}
              options={['very_narrow', 'narrow', 'standard', 'wide', 'very_wide']}
              onChange={(v) => handleSettingChange('width', v)}
            />

            {/* Team Instructions */}
            <div className="flex flex-col gap-1.5">
              <span className="text-[11px] font-medium text-navy-300">Team Instructions</span>
              <div className="flex gap-1.5 flex-wrap">
                {['control_possession', 'direct_passing', 'short_passing', 'mixed'].map((opt) => (
                  <button
                    key={opt}
                    onClick={() => handleSettingChange('team_instructions', opt)}
                    className={`px-3 py-1.5 rounded-lg text-[10px] font-semibold transition-all ${
                      activeTactic.team_instructions === opt
                        ? 'bg-brand-600 text-white'
                        : 'bg-white/5 text-navy-400'
                    }`}
                  >
                    {opt.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Tactic Picker Sheet */}
      <Sheet open={showTacticPicker} onClose={() => setShowTacticPicker(false)} title="Select Tactic">
        <div className="px-5 py-3 flex flex-col gap-2">
          {tactics.map((t) => (
            <button
              key={t.id}
              onClick={() => { setActiveTactic(t); setShowTacticPicker(false); }}
              className={`p-3 rounded-xl border text-left transition-all ${
                t.id === activeTactic?.id ? 'border-brand-500 bg-brand-500/10' : 'border-white/10 bg-white/5'
              }`}
            >
              <p className="text-sm font-bold text-white">{t.name}</p>
              <p className="text-[10px] text-navy-400">{t.formation_name} | {t.mentality}</p>
            </button>
          ))}
        </div>
      </Sheet>
    </div>
  );
}
