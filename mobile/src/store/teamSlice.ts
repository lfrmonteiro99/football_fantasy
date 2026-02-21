import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import * as api from '../api/tauri';
import type { Team, Player, SquadStats, Tactic } from '../api/tauri';

interface TeamState {
  currentTeam: Team | null;
  squad: Player[];
  squadStats: SquadStats | null;
  tactics: Tactic[];
  loading: boolean;
}

const initialState: TeamState = {
  currentTeam: null,
  squad: [],
  squadStats: null,
  tactics: [],
  loading: false,
};

export const fetchTeam = createAsyncThunk('team/fetch', async (teamId: number) => {
  return await api.getTeam(teamId);
});

export const fetchSquad = createAsyncThunk('team/fetchSquad', async (teamId: number) => {
  const [squad, stats] = await Promise.all([api.getSquad(teamId), api.getSquadStats(teamId)]);
  return { squad, stats };
});

export const fetchTeamTactics = createAsyncThunk('team/fetchTactics', async (teamId: number) => {
  return await api.getTeamTactics(teamId);
});

const teamSlice = createSlice({
  name: 'team',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchTeam.fulfilled, (s, a) => { s.currentTeam = a.payload; })
      .addCase(fetchSquad.pending, (s) => { s.loading = true; })
      .addCase(fetchSquad.fulfilled, (s, a) => { s.loading = false; s.squad = a.payload.squad; s.squadStats = a.payload.stats; })
      .addCase(fetchTeamTactics.fulfilled, (s, a) => { s.tactics = a.payload; });
  },
});

export default teamSlice.reducer;
