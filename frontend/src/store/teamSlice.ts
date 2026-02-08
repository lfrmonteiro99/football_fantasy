import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import * as api from 'api/endpoints';
import type {
  TeamState,
  Team,
  SquadPlayer,
  SquadStats,
  TacticWithPivot,
} from 'types';

const initialState: TeamState = {
  currentTeam: null,
  squad: [],
  squadStats: null,
  teamTactics: [],
  allTeams: [],
  loading: 'idle',
  error: null,
};

// ---------------------------------------------------------------------------
// Thunks
// ---------------------------------------------------------------------------

export const fetchTeam = createAsyncThunk<
  Team,
  number,
  { rejectValue: string }
>('team/fetchTeam', async (teamId, { rejectWithValue }) => {
  try {
    return await api.getTeam(teamId);
  } catch (err: any) {
    const message =
      err.response?.data?.message || err.message || 'Failed to fetch team';
    return rejectWithValue(message);
  }
});

export const fetchSquad = createAsyncThunk<
  { team: Team; players: SquadPlayer[]; stats: SquadStats },
  number,
  { rejectValue: string }
>('team/fetchSquad', async (teamId, { rejectWithValue }) => {
  try {
    const result = await api.getTeamSquad(teamId);
    return { team: result.team, players: result.players, stats: result.stats };
  } catch (err: any) {
    const message =
      err.response?.data?.message || err.message || 'Failed to fetch squad';
    return rejectWithValue(message);
  }
});

export const fetchTeamTactics = createAsyncThunk<
  { team: Team; tactics: TacticWithPivot[] },
  number,
  { rejectValue: string }
>('team/fetchTeamTactics', async (teamId, { rejectWithValue }) => {
  try {
    const result = await api.getTeamTactics(teamId);
    return { team: result.team, tactics: result.tactics };
  } catch (err: any) {
    const message =
      err.response?.data?.message || err.message || 'Failed to fetch tactics';
    return rejectWithValue(message);
  }
});

// ---------------------------------------------------------------------------
// Slice
// ---------------------------------------------------------------------------

const teamSlice = createSlice({
  name: 'team',
  initialState,
  reducers: {
    clearTeamError(state) {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    // --- fetchTeam ---
    builder.addCase(fetchTeam.pending, (state) => {
      state.loading = 'loading';
      state.error = null;
    });
    builder.addCase(fetchTeam.fulfilled, (state, action) => {
      state.loading = 'succeeded';
      state.currentTeam = action.payload;
    });
    builder.addCase(fetchTeam.rejected, (state, action) => {
      state.loading = 'failed';
      state.error = action.payload ?? 'Failed to fetch team';
    });

    // --- fetchSquad ---
    builder.addCase(fetchSquad.pending, (state) => {
      state.loading = 'loading';
      state.error = null;
    });
    builder.addCase(fetchSquad.fulfilled, (state, action) => {
      state.loading = 'succeeded';
      state.currentTeam = action.payload.team;
      state.squad = action.payload.players;
      state.squadStats = action.payload.stats;
    });
    builder.addCase(fetchSquad.rejected, (state, action) => {
      state.loading = 'failed';
      state.error = action.payload ?? 'Failed to fetch squad';
    });

    // --- fetchTeamTactics ---
    builder.addCase(fetchTeamTactics.pending, (state) => {
      state.loading = 'loading';
      state.error = null;
    });
    builder.addCase(fetchTeamTactics.fulfilled, (state, action) => {
      state.loading = 'succeeded';
      state.teamTactics = action.payload.tactics;
    });
    builder.addCase(fetchTeamTactics.rejected, (state, action) => {
      state.loading = 'failed';
      state.error = action.payload ?? 'Failed to fetch team tactics';
    });
  },
});

export const { clearTeamError } = teamSlice.actions;
export default teamSlice.reducer;
