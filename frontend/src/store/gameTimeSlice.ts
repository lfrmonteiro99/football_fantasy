import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import * as api from 'api/endpoints';
import type { GameTimeState, Match, GameTimeResponse, AdvanceDayResponse } from 'types';

const initialState: GameTimeState = {
  currentDate: null,
  formattedDate: null,
  nextMatch: null,
  daysUntilMatch: null,
  isMatchDay: false,
  loading: 'idle',
  error: null,
};

// ---------------------------------------------------------------------------
// Thunks
// ---------------------------------------------------------------------------

export const fetchCurrentDate = createAsyncThunk<
  GameTimeResponse,
  number | undefined,
  { rejectValue: string }
>('gameTime/fetchCurrentDate', async (teamId, { rejectWithValue }) => {
  try {
    return await api.getCurrentGameDate(teamId);
  } catch (err: any) {
    return rejectWithValue(
      err.response?.data?.message || err.message || 'Failed to fetch game date',
    );
  }
});

export const advanceDay = createAsyncThunk<
  AdvanceDayResponse,
  void,
  { rejectValue: string; state: { auth: { user: { managed_team_id: number | null } | null } } }
>('gameTime/advanceDay', async (_, { rejectWithValue, getState }) => {
  try {
    const state = getState();
    const teamId = state.auth.user?.managed_team_id;
    if (!teamId) throw new Error('No managed team');
    return await api.advanceDay({ team_id: teamId });
  } catch (err: any) {
    return rejectWithValue(
      err.response?.data?.message || err.message || 'Failed to advance day',
    );
  }
});

export const advanceToMatch = createAsyncThunk<
  AdvanceDayResponse,
  void,
  { rejectValue: string; state: { auth: { user: { managed_team_id: number | null } | null } } }
>('gameTime/advanceToMatch', async (_, { rejectWithValue, getState }) => {
  try {
    const state = getState();
    const teamId = state.auth.user?.managed_team_id;
    if (!teamId) throw new Error('No managed team');
    return await api.advanceToMatch({ team_id: teamId });
  } catch (err: any) {
    return rejectWithValue(
      err.response?.data?.message || err.message || 'Failed to advance to match',
    );
  }
});

// ---------------------------------------------------------------------------
// Slice
// ---------------------------------------------------------------------------

const gameTimeSlice = createSlice({
  name: 'gameTime',
  initialState,
  reducers: {
    clearGameTimeError(state) {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    // --- fetchCurrentDate ---
    builder.addCase(fetchCurrentDate.pending, (state) => {
      state.loading = 'loading';
      state.error = null;
    });
    builder.addCase(fetchCurrentDate.fulfilled, (state, action) => {
      state.loading = 'succeeded';
      state.currentDate = action.payload.current_date;
      state.formattedDate = action.payload.formatted_date;
      state.nextMatch = action.payload.next_match ?? null;
      state.daysUntilMatch = action.payload.days_until_match ?? null;
      state.isMatchDay = action.payload.match_day ?? false;
    });
    builder.addCase(fetchCurrentDate.rejected, (state, action) => {
      state.loading = 'failed';
      state.error = action.payload ?? 'Failed to fetch game date';
    });

    // --- advanceDay ---
    builder.addCase(advanceDay.pending, (state) => {
      state.loading = 'loading';
      state.error = null;
    });
    builder.addCase(advanceDay.fulfilled, (state, action) => {
      state.loading = 'succeeded';
      state.currentDate = action.payload.current_date;
      state.formattedDate = action.payload.formatted_date;
      state.nextMatch = action.payload.next_match ?? null;
    });
    builder.addCase(advanceDay.rejected, (state, action) => {
      state.loading = 'failed';
      state.error = action.payload ?? 'Failed to advance day';
    });

    // --- advanceToMatch ---
    builder.addCase(advanceToMatch.pending, (state) => {
      state.loading = 'loading';
      state.error = null;
    });
    builder.addCase(advanceToMatch.fulfilled, (state, action) => {
      state.loading = 'succeeded';
      state.currentDate = action.payload.current_date;
      state.formattedDate = action.payload.formatted_date;
      state.nextMatch = action.payload.next_match ?? null;
      state.isMatchDay = true;
      state.daysUntilMatch = 0;
    });
    builder.addCase(advanceToMatch.rejected, (state, action) => {
      state.loading = 'failed';
      state.error = action.payload ?? 'Failed to advance to match';
    });
  },
});

export const { clearGameTimeError } = gameTimeSlice.actions;
export default gameTimeSlice.reducer;
