import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { fetchSquad, fetchTeamTactics } from '../store/teamSlice';
import {
  getFormations,
  getTacticAnalysis,
  createTactic as apiCreateTactic,
  updateTactic as apiUpdateTactic,
  assignTacticToTeam as apiAssignTactic,
} from '../api/endpoints';
import type {
  RootState,
  Formation,
  TacticWithPivot,
  TacticAnalysis,
  CreateTacticPayload,
  SquadPlayer,
  FormationPosition,
} from '../types';
import PitchEditor from '../components/tactics/PitchEditor';
import TacticSettings from '../components/tactics/TacticSettings';
import PlayerCard from '../components/tactics/PlayerCard';

// ---------------------------------------------------------------------------
// Typed dispatch
// ---------------------------------------------------------------------------

type AppDispatch = ReturnType<typeof useDispatch>;

// ---------------------------------------------------------------------------
// Default tactic payload
// ---------------------------------------------------------------------------

const DEFAULT_TACTIC: Partial<CreateTacticPayload> = {
  name: 'New Tactic',
  formation_id: undefined,
  mentality: 'balanced',
  team_instructions: 'mixed',
  defensive_line: 'standard',
  pressing: 'sometimes',
  tempo: 'standard',
  width: 'standard',
  offside_trap: false,
  play_out_of_defence: false,
  close_down_more: false,
  tackle_harder: false,
};

// ---------------------------------------------------------------------------
// Pitch position with player assignment
// ---------------------------------------------------------------------------

interface EditorPosition {
  position: string;
  x: number;
  y: number;
  playerId?: number;
  playerName?: string;
}

// ---------------------------------------------------------------------------
// Page Component
// ---------------------------------------------------------------------------

const TacticsPage: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const { user } = useSelector((state: RootState) => state.auth);
  const { squad, teamTactics, loading: teamLoading } = useSelector(
    (state: RootState) => state.team,
  );

  // Local state
  const [formations, setFormations] = useState<Formation[]>([]);
  const [loadingFormations, setLoadingFormations] = useState(false);
  const [activeTabId, setActiveTabId] = useState<number | 'new' | null>(null);
  const [tacticForm, setTacticForm] = useState<Partial<CreateTacticPayload>>(DEFAULT_TACTIC);
  const [editorPositions, setEditorPositions] = useState<EditorPosition[]>([]);
  const [playerAssignments, setPlayerAssignments] = useState<Record<string, number>>({});
  const [analysis, setAnalysis] = useState<TacticAnalysis | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [selectedPitchPosition, setSelectedPitchPosition] = useState<number | null>(null);

  const teamId = user?.managed_team_id;

  // --------------------------------------------------
  // Data fetching
  // --------------------------------------------------

  useEffect(() => {
    if (teamId) {
      dispatch(fetchSquad(teamId));
      dispatch(fetchTeamTactics(teamId));
    }
  }, [dispatch, teamId]);

  useEffect(() => {
    setLoadingFormations(true);
    getFormations()
      .then((data) => {
        setFormations(data);
        setLoadingFormations(false);
      })
      .catch(() => setLoadingFormations(false));
  }, []);

  // Auto-select first tactic tab when tactics load
  useEffect(() => {
    if (teamTactics.length > 0 && activeTabId === null) {
      setActiveTabId(teamTactics[0].id);
    }
  }, [teamTactics, activeTabId]);

  // Load tactic data when tab changes
  useEffect(() => {
    if (activeTabId === 'new') {
      setTacticForm({ ...DEFAULT_TACTIC });
      setEditorPositions([]);
      setPlayerAssignments({});
      setAnalysis(null);
      return;
    }

    const tactic = teamTactics.find((t) => t.id === activeTabId);
    if (!tactic) return;

    // Populate form from tactic
    setTacticForm({
      name: tactic.name,
      description: tactic.description ?? undefined,
      formation_id: tactic.formation_id,
      mentality: tactic.mentality,
      team_instructions: tactic.team_instructions,
      defensive_line: tactic.defensive_line,
      pressing: tactic.pressing,
      tempo: tactic.tempo,
      width: tactic.width,
      offside_trap: tactic.offside_trap,
      play_out_of_defence: tactic.play_out_of_defence,
      close_down_more: tactic.close_down_more,
      tackle_harder: tactic.tackle_harder,
      custom_positions: tactic.custom_positions ?? undefined,
      player_assignments: tactic.player_assignments ?? undefined,
    });

    // Load positions from formation or custom
    const positions = tactic.custom_positions ?? tactic.formation?.positions ?? [];
    const assignments = tactic.player_assignments ?? {};

    setPlayerAssignments(assignments);
    setEditorPositions(
      positions.map((p: FormationPosition, idx: number) => {
        const assignedPlayerId = assignments[String(idx)];
        const assignedPlayer = assignedPlayerId
          ? squad.find((s) => s.id === assignedPlayerId)
          : undefined;
        return {
          position: p.position,
          x: p.x,
          y: p.y,
          playerId: assignedPlayerId,
          playerName: assignedPlayer?.full_name,
        };
      }),
    );

    // Fetch analysis
    getTacticAnalysis(tactic.id)
      .then(setAnalysis)
      .catch(() => setAnalysis(null));
  }, [activeTabId, teamTactics, squad]);

  // --------------------------------------------------
  // Formation change
  // --------------------------------------------------

  const handleFormationChange = useCallback(
    (formationId: number) => {
      const formation = formations.find((f) => f.id === formationId);
      if (!formation) return;

      setTacticForm((prev) => ({ ...prev, formation_id: formationId }));
      setPlayerAssignments({});
      setEditorPositions(
        formation.positions.map((p) => ({
          position: p.position,
          x: p.x,
          y: p.y,
          playerId: undefined,
          playerName: undefined,
        })),
      );
    },
    [formations],
  );

  // --------------------------------------------------
  // Position dragging
  // --------------------------------------------------

  const handlePositionChange = useCallback(
    (index: number, x: number, y: number) => {
      setEditorPositions((prev) =>
        prev.map((p, i) => (i === index ? { ...p, x, y } : p)),
      );
    },
    [],
  );

  // --------------------------------------------------
  // Player assignment
  // --------------------------------------------------

  const handlePlayerAssign = useCallback(
    (positionIndex: number, playerId: number) => {
      const player = squad.find((s) => s.id === playerId);
      setEditorPositions((prev) =>
        prev.map((p, i) =>
          i === positionIndex
            ? { ...p, playerId, playerName: player?.full_name }
            : p,
        ),
      );
      setPlayerAssignments((prev) => ({
        ...prev,
        [String(positionIndex)]: playerId,
      }));
      setSelectedPitchPosition(null);
    },
    [squad],
  );

  const handlePlayerCardClick = useCallback(
    (player: SquadPlayer) => {
      if (selectedPitchPosition !== null) {
        handlePlayerAssign(selectedPitchPosition, player.id);
      }
    },
    [selectedPitchPosition, handlePlayerAssign],
  );

  // --------------------------------------------------
  // Form changes
  // --------------------------------------------------

  const handleTacticFieldChange = useCallback((field: string, value: any) => {
    setTacticForm((prev) => ({ ...prev, [field]: value }));
    setSaveSuccess(false);
  }, []);

  // --------------------------------------------------
  // Save tactic
  // --------------------------------------------------

  const handleSave = useCallback(async () => {
    if (!tacticForm.name || !tacticForm.formation_id) {
      setSaveError('Please provide a name and select a formation.');
      return;
    }

    setSaving(true);
    setSaveError(null);
    setSaveSuccess(false);

    const customPositions = editorPositions.map((p) => ({
      position: p.position,
      x: p.x,
      y: p.y,
    }));

    const payload: CreateTacticPayload = {
      name: tacticForm.name,
      description: tacticForm.description,
      formation_id: tacticForm.formation_id,
      mentality: tacticForm.mentality ?? 'balanced',
      team_instructions: tacticForm.team_instructions ?? 'mixed',
      defensive_line: tacticForm.defensive_line ?? 'standard',
      pressing: tacticForm.pressing ?? 'sometimes',
      tempo: tacticForm.tempo ?? 'standard',
      width: tacticForm.width ?? 'standard',
      offside_trap: tacticForm.offside_trap,
      play_out_of_defence: tacticForm.play_out_of_defence,
      close_down_more: tacticForm.close_down_more,
      tackle_harder: tacticForm.tackle_harder,
      custom_positions: customPositions,
      player_assignments: playerAssignments,
    };

    try {
      if (activeTabId === 'new') {
        const created = await apiCreateTactic(payload);
        // Assign to team
        if (teamId) {
          await apiAssignTactic(teamId, { tactic_id: created.id, is_primary: false });
          dispatch(fetchTeamTactics(teamId));
        }
        setActiveTabId(created.id);
      } else if (typeof activeTabId === 'number') {
        await apiUpdateTactic(activeTabId, payload);
        if (teamId) {
          dispatch(fetchTeamTactics(teamId));
        }
      }
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err: any) {
      setSaveError(err?.response?.data?.message || err.message || 'Failed to save tactic');
    } finally {
      setSaving(false);
    }
  }, [tacticForm, editorPositions, playerAssignments, activeTabId, teamId, dispatch]);

  // --------------------------------------------------
  // Set as primary
  // --------------------------------------------------

  const handleSetPrimary = useCallback(async () => {
    if (typeof activeTabId !== 'number' || !teamId) return;
    setSaving(true);
    setSaveError(null);
    try {
      await apiAssignTactic(teamId, { tactic_id: activeTabId, is_primary: true });
      dispatch(fetchTeamTactics(teamId));
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err: any) {
      setSaveError(err?.response?.data?.message || err.message || 'Failed to set as primary');
    } finally {
      setSaving(false);
    }
  }, [activeTabId, teamId, dispatch]);

  // --------------------------------------------------
  // Assigned player IDs (for graying out in player list)
  // --------------------------------------------------

  const assignedPlayerIds = useMemo(() => {
    return new Set(Object.values(playerAssignments));
  }, [playerAssignments]);

  // --------------------------------------------------
  // Current primary tactic
  // --------------------------------------------------

  const primaryTacticId = useMemo(() => {
    const primary = teamTactics.find((t) => t.pivot?.is_primary);
    return primary?.id ?? null;
  }, [teamTactics]);

  // --------------------------------------------------
  // Loading
  // --------------------------------------------------

  if (teamLoading === 'loading' && teamTactics.length === 0 && squad.length === 0) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto" />
          <p className="mt-4 text-gray-500">Loading tactics...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      {/* Header */}
      <h1 className="text-2xl font-bold text-gray-900 mb-4">Tactics Editor</h1>

      {/* Tactic tabs */}
      <div className="flex items-center gap-2 mb-6 overflow-x-auto pb-1">
        {teamTactics.map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTabId(t.id)}
            className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
              activeTabId === t.id
                ? 'bg-green-600 text-white shadow-sm'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {t.name}
            {t.pivot?.is_primary && (
              <span className="ml-1.5 inline-flex items-center px-1.5 py-0.5 rounded text-xs bg-yellow-400 text-yellow-900">
                Primary
              </span>
            )}
          </button>
        ))}
        <button
          onClick={() => setActiveTabId('new')}
          className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
            activeTabId === 'new'
              ? 'bg-green-600 text-white shadow-sm'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          + New Tactic
        </button>
      </div>

      {/* Main editor layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Left: Pitch */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
          <PitchEditor
            positions={editorPositions}
            availablePlayers={squad}
            onPositionChange={handlePositionChange}
            onPlayerAssign={handlePlayerAssign}
          />
        </div>

        {/* Right: Settings panel */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm overflow-y-auto max-h-[700px]">
          {/* Tactic name */}
          <div className="mb-4">
            <label className="text-sm font-medium text-gray-700 block mb-1">
              Tactic Name
            </label>
            <input
              type="text"
              value={tacticForm.name ?? ''}
              onChange={(e) => handleTacticFieldChange('name', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              placeholder="e.g. High Press 4-3-3"
            />
          </div>

          {/* Formation selector */}
          <div className="mb-6">
            <label className="text-sm font-medium text-gray-700 block mb-1">
              Formation
            </label>
            <select
              value={tacticForm.formation_id ?? ''}
              onChange={(e) => {
                const val = parseInt(e.target.value, 10);
                if (!isNaN(val)) handleFormationChange(val);
              }}
              disabled={loadingFormations}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 bg-white"
            >
              <option value="">Select formation...</option>
              {formations.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.display_name || f.name} ({f.style})
                </option>
              ))}
            </select>
          </div>

          {/* Tactic settings */}
          <TacticSettings
            tactic={tacticForm}
            onChange={handleTacticFieldChange}
            analysis={analysis}
          />

          {/* Action buttons */}
          <div className="flex items-center gap-3 mt-6 pt-4 border-t border-gray-200">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 px-4 py-2.5 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? 'Saving...' : 'Save Tactic'}
            </button>
            {typeof activeTabId === 'number' && activeTabId !== primaryTacticId && (
              <button
                onClick={handleSetPrimary}
                disabled={saving}
                className="px-4 py-2.5 bg-yellow-500 text-white rounded-lg text-sm font-medium hover:bg-yellow-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Set as Primary
              </button>
            )}
          </div>

          {/* Feedback messages */}
          {saveError && (
            <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              {saveError}
            </div>
          )}
          {saveSuccess && (
            <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">
              Tactic saved successfully.
            </div>
          )}
        </div>
      </div>

      {/* Bottom: Squad player cards for assignment */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">
          Squad Players
          {selectedPitchPosition !== null && (
            <span className="ml-2 text-green-600 font-normal">
              &mdash; Click a player to assign to {editorPositions[selectedPitchPosition]?.position ?? 'position'}
            </span>
          )}
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2">
          {squad.map((player) => (
            <PlayerCard
              key={player.id}
              player={player}
              isAssigned={assignedPlayerIds.has(player.id)}
              isSelected={
                selectedPitchPosition !== null &&
                editorPositions[selectedPitchPosition]?.playerId === player.id
              }
              onClick={() => handlePlayerCardClick(player)}
              size="sm"
            />
          ))}
        </div>
        {squad.length === 0 && (
          <p className="text-center text-gray-400 text-sm py-6">
            No squad players loaded.
          </p>
        )}
      </div>
    </div>
  );
};

export default TacticsPage;
