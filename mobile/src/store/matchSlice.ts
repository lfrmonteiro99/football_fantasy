import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import * as api from '../api/tauri';
import type { GameMatch, MatchEvent, MatchLineup, SimulationTick, SimulationEvent, LineupData } from '../api/tauri';

interface MatchState {
  upcoming: GameMatch[];
  teamMatches: GameMatch[];
  current: GameMatch | null;
  lineup: MatchLineup[];
  events: MatchEvent[];
  simulation: {
    running: boolean;
    ticks: SimulationTick[];
    currentTick: SimulationTick | null;
    lineupData: LineupData | null;
    finalScore: { home: number; away: number } | null;
  };
  loading: boolean;
}

const initialState: MatchState = {
  upcoming: [],
  teamMatches: [],
  current: null,
  lineup: [],
  events: [],
  simulation: { running: false, ticks: [], currentTick: null, lineupData: null, finalScore: null },
  loading: false,
};

export const fetchUpcoming = createAsyncThunk('match/fetchUpcoming', async (p?: { leagueId?: number; limit?: number }) => {
  return await api.getUpcomingMatches(p?.leagueId, p?.limit);
});

export const fetchTeamMatches = createAsyncThunk('match/fetchTeamMatches', async (teamId: number) => {
  return await api.getTeamMatches(teamId);
});

export const fetchMatch = createAsyncThunk('match/fetch', async (matchId: number) => {
  return await api.getMatchDetails(matchId);
});

export const fetchLineup = createAsyncThunk('match/fetchLineup', async (p: { matchId: number; teamId: number }) => {
  return await api.getMatchLineup(p.matchId, p.teamId);
});

export const fetchMatchEvents = createAsyncThunk('match/fetchEvents', async (matchId: number) => {
  return await api.getMatchEvents(matchId);
});

const matchSlice = createSlice({
  name: 'match',
  initialState,
  reducers: {
    addTick: (state, action: PayloadAction<SimulationTick>) => {
      state.simulation.ticks.push(action.payload);
      state.simulation.currentTick = action.payload;
    },
    setLineupData: (state, action: PayloadAction<LineupData>) => {
      state.simulation.lineupData = action.payload;
    },
    setSimulationRunning: (state, action: PayloadAction<boolean>) => {
      state.simulation.running = action.payload;
    },
    setFinalScore: (state, action: PayloadAction<{ home: number; away: number }>) => {
      state.simulation.finalScore = action.payload;
    },
    clearSimulation: (state) => {
      state.simulation = { running: false, ticks: [], currentTick: null, lineupData: null, finalScore: null };
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchUpcoming.fulfilled, (s, a) => { s.upcoming = a.payload; })
      .addCase(fetchTeamMatches.fulfilled, (s, a) => { s.teamMatches = a.payload; })
      .addCase(fetchMatch.fulfilled, (s, a) => { s.current = a.payload; })
      .addCase(fetchLineup.fulfilled, (s, a) => { s.lineup = a.payload; })
      .addCase(fetchMatchEvents.fulfilled, (s, a) => { s.events = a.payload; });
  },
});

export const { addTick, setLineupData, setSimulationRunning, setFinalScore, clearSimulation } = matchSlice.actions;
export default matchSlice.reducer;
