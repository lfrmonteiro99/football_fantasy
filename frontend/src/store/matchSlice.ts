import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import * as api from 'api/endpoints';
import type {
  MatchState_Redux,
  Match,
  MatchLineupResponse,
  SimulationTick,
  SSELineupData,
  MatchStats,
  SaveLineupPayload,
} from 'types';

const initialState: MatchState_Redux = {
  upcomingMatches: [],
  leagueMatches: [],
  teamMatches: [],
  currentMatch: null,
  currentLineup: null,
  matchEvents: [],
  simulation: {
    isRunning: false,
    currentTick: null,
    ticks: [],
    lineupData: null,
    finalScore: null,
    finalStats: null,
    error: null,
  },
  loading: 'idle',
  error: null,
};

// ---------------------------------------------------------------------------
// Thunks
// ---------------------------------------------------------------------------

export const fetchUpcomingMatches = createAsyncThunk<
  Match[],
  { league_id?: number; limit?: number } | undefined,
  { rejectValue: string }
>('match/fetchUpcoming', async (params, { rejectWithValue }) => {
  try {
    return await api.getUpcomingMatches(params);
  } catch (err: any) {
    return rejectWithValue(
      err.response?.data?.message || err.message || 'Failed to fetch upcoming matches',
    );
  }
});

export const fetchTeamMatches = createAsyncThunk<
  Match[],
  { team_id: number; season_id?: number; status?: string },
  { rejectValue: string }
>('match/fetchTeamMatches', async (params, { rejectWithValue }) => {
  try {
    return await api.getTeamMatches(params);
  } catch (err: any) {
    return rejectWithValue(
      err.response?.data?.message || err.message || 'Failed to fetch team matches',
    );
  }
});

export const fetchMatchDetails = createAsyncThunk<
  Match,
  number,
  { rejectValue: string }
>('match/fetchDetails', async (matchId, { rejectWithValue }) => {
  try {
    return await api.getMatchDetails(matchId);
  } catch (err: any) {
    return rejectWithValue(
      err.response?.data?.message || err.message || 'Failed to fetch match details',
    );
  }
});

export const fetchMatchLineup = createAsyncThunk<
  MatchLineupResponse,
  number,
  { rejectValue: string }
>('match/fetchLineup', async (matchId, { rejectWithValue }) => {
  try {
    return await api.getMatchLineup(matchId);
  } catch (err: any) {
    return rejectWithValue(
      err.response?.data?.message || err.message || 'Failed to fetch lineup',
    );
  }
});

export const saveMatchLineup = createAsyncThunk<
  MatchLineupResponse,
  { matchId: number; data: SaveLineupPayload },
  { rejectValue: string }
>('match/saveLineup', async ({ matchId, data }, { rejectWithValue }) => {
  try {
    return await api.saveMatchLineup(matchId, data);
  } catch (err: any) {
    return rejectWithValue(
      err.response?.data?.message || err.message || 'Failed to save lineup',
    );
  }
});

export const resetMatch = createAsyncThunk<
  void,
  number,
  { rejectValue: string }
>('match/reset', async (matchId, { rejectWithValue }) => {
  try {
    await api.resetMatch(matchId);
  } catch (err: any) {
    return rejectWithValue(
      err.response?.data?.message || err.message || 'Failed to reset match',
    );
  }
});

// ---------------------------------------------------------------------------
// Slice
// ---------------------------------------------------------------------------

const matchSlice = createSlice({
  name: 'match',
  initialState,
  reducers: {
    addTick(state, action: PayloadAction<SimulationTick>) {
      state.simulation.ticks.push(action.payload);
      state.simulation.currentTick = action.payload;
    },
    setLineupData(state, action: PayloadAction<SSELineupData>) {
      state.simulation.lineupData = action.payload;
    },
    setPhase(state, action: PayloadAction<string>) {
      // On full_time, capture the final score & stats from the latest tick
      if (action.payload === 'full_time' && state.simulation.currentTick) {
        state.simulation.finalScore = state.simulation.currentTick.score;
        state.simulation.finalStats = state.simulation.currentTick.stats;
      }
    },
    setSimulationRunning(state, action: PayloadAction<boolean>) {
      state.simulation.isRunning = action.payload;
    },
    setSimulationError(state, action: PayloadAction<string>) {
      state.simulation.error = action.payload;
    },
    clearSimulation(state) {
      state.simulation = { ...initialState.simulation };
    },
    clearMatchError(state) {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    // --- fetchUpcomingMatches ---
    builder.addCase(fetchUpcomingMatches.pending, (state) => {
      state.loading = 'loading';
      state.error = null;
    });
    builder.addCase(fetchUpcomingMatches.fulfilled, (state, action) => {
      state.loading = 'succeeded';
      state.upcomingMatches = action.payload;
    });
    builder.addCase(fetchUpcomingMatches.rejected, (state, action) => {
      state.loading = 'failed';
      state.error = action.payload ?? 'Failed to fetch upcoming matches';
    });

    // --- fetchTeamMatches ---
    builder.addCase(fetchTeamMatches.pending, (state) => {
      state.loading = 'loading';
      state.error = null;
    });
    builder.addCase(fetchTeamMatches.fulfilled, (state, action) => {
      state.loading = 'succeeded';
      state.teamMatches = action.payload;
    });
    builder.addCase(fetchTeamMatches.rejected, (state, action) => {
      state.loading = 'failed';
      state.error = action.payload ?? 'Failed to fetch team matches';
    });

    // --- fetchMatchDetails ---
    builder.addCase(fetchMatchDetails.pending, (state) => {
      state.loading = 'loading';
      state.error = null;
    });
    builder.addCase(fetchMatchDetails.fulfilled, (state, action) => {
      state.loading = 'succeeded';
      state.currentMatch = action.payload;
      state.matchEvents = action.payload.events ?? [];
    });
    builder.addCase(fetchMatchDetails.rejected, (state, action) => {
      state.loading = 'failed';
      state.error = action.payload ?? 'Failed to fetch match details';
    });

    // --- fetchMatchLineup ---
    builder.addCase(fetchMatchLineup.pending, (state) => {
      state.loading = 'loading';
      state.error = null;
    });
    builder.addCase(fetchMatchLineup.fulfilled, (state, action) => {
      state.loading = 'succeeded';
      state.currentLineup = action.payload;
    });
    builder.addCase(fetchMatchLineup.rejected, (state, action) => {
      state.loading = 'failed';
      state.error = action.payload ?? 'Failed to fetch lineup';
    });

    // --- saveMatchLineup ---
    builder.addCase(saveMatchLineup.pending, (state) => {
      state.loading = 'loading';
      state.error = null;
    });
    builder.addCase(saveMatchLineup.fulfilled, (state, action) => {
      state.loading = 'succeeded';
      state.currentLineup = action.payload;
    });
    builder.addCase(saveMatchLineup.rejected, (state, action) => {
      state.loading = 'failed';
      state.error = action.payload ?? 'Failed to save lineup';
    });

    // --- resetMatch ---
    builder.addCase(resetMatch.pending, (state) => {
      state.loading = 'loading';
      state.error = null;
    });
    builder.addCase(resetMatch.fulfilled, (state) => {
      state.loading = 'succeeded';
      state.currentMatch = null;
      state.currentLineup = null;
      state.matchEvents = [];
      state.simulation = { ...initialState.simulation };
    });
    builder.addCase(resetMatch.rejected, (state, action) => {
      state.loading = 'failed';
      state.error = action.payload ?? 'Failed to reset match';
    });
  },
});

export const {
  addTick,
  setLineupData,
  setPhase,
  setSimulationRunning,
  setSimulationError,
  clearSimulation,
  clearMatchError,
} = matchSlice.actions;

export default matchSlice.reducer;
