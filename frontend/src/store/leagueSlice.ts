import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import * as api from 'api/endpoints';
import type {
  LeagueState,
  League,
  StandingEntry,
  LeagueOverviewEntry,
  LeagueStandingsResponse,
} from 'types';

const initialState: LeagueState = {
  leagues: [],
  currentLeague: null,
  standings: [],
  overview: [],
  loading: 'idle',
  error: null,
};

// ---------------------------------------------------------------------------
// Thunks
// ---------------------------------------------------------------------------

export const fetchLeagues = createAsyncThunk<
  League[],
  void,
  { rejectValue: string }
>('league/fetchLeagues', async (_, { rejectWithValue }) => {
  try {
    const result = await api.getLeagues();
    return result.data; // PaginatedResponse — extract inner data array
  } catch (err: any) {
    return rejectWithValue(
      err.response?.data?.message || err.message || 'Failed to fetch leagues',
    );
  }
});

export const fetchStandings = createAsyncThunk<
  LeagueStandingsResponse,
  number,
  { rejectValue: string }
>('league/fetchStandings', async (leagueId, { rejectWithValue }) => {
  try {
    return await api.getLeagueStandings(leagueId);
  } catch (err: any) {
    return rejectWithValue(
      err.response?.data?.message || err.message || 'Failed to fetch standings',
    );
  }
});

export const fetchOverview = createAsyncThunk<
  LeagueOverviewEntry[],
  void,
  { rejectValue: string }
>('league/fetchOverview', async (_, { rejectWithValue }) => {
  try {
    return await api.getStatsOverview();
  } catch (err: any) {
    return rejectWithValue(
      err.response?.data?.message || err.message || 'Failed to fetch overview',
    );
  }
});

// ---------------------------------------------------------------------------
// Slice
// ---------------------------------------------------------------------------

const leagueSlice = createSlice({
  name: 'league',
  initialState,
  reducers: {
    clearLeagueError(state) {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    // --- fetchLeagues ---
    builder.addCase(fetchLeagues.pending, (state) => {
      state.loading = 'loading';
      state.error = null;
    });
    builder.addCase(fetchLeagues.fulfilled, (state, action) => {
      state.loading = 'succeeded';
      state.leagues = action.payload;
    });
    builder.addCase(fetchLeagues.rejected, (state, action) => {
      state.loading = 'failed';
      state.error = action.payload ?? 'Failed to fetch leagues';
    });

    // --- fetchStandings ---
    builder.addCase(fetchStandings.pending, (state) => {
      state.loading = 'loading';
      state.error = null;
    });
    builder.addCase(fetchStandings.fulfilled, (state, action) => {
      state.loading = 'succeeded';
      state.standings = action.payload.standings;
      state.currentLeague = {
        id: action.payload.league.id,
        name: action.payload.league.name,
        country: action.payload.league.country ?? '',
      } as League;
    });
    builder.addCase(fetchStandings.rejected, (state, action) => {
      state.loading = 'failed';
      state.error = action.payload ?? 'Failed to fetch standings';
    });

    // --- fetchOverview ---
    builder.addCase(fetchOverview.pending, (state) => {
      state.loading = 'loading';
      state.error = null;
    });
    builder.addCase(fetchOverview.fulfilled, (state, action) => {
      state.loading = 'succeeded';
      state.overview = action.payload;
    });
    builder.addCase(fetchOverview.rejected, (state, action) => {
      state.loading = 'failed';
      state.error = action.payload ?? 'Failed to fetch overview';
    });
  },
});

export const { clearLeagueError } = leagueSlice.actions;
export default leagueSlice.reducer;
