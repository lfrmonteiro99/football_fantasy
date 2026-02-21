import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import * as api from '../api/tauri';
import type { GameTimeResponse } from '../api/tauri';

interface GameTimeState {
  data: GameTimeResponse | null;
  loading: boolean;
}

const initialState: GameTimeState = {
  data: null,
  loading: false,
};

export const fetchGameTime = createAsyncThunk('gameTime/fetch', async (userId: number) => {
  return await api.getCurrentDate(userId);
});

export const advanceDayThunk = createAsyncThunk('gameTime/advanceDay', async (userId: number) => {
  return await api.advanceDay(userId);
});

export const advanceToMatchThunk = createAsyncThunk('gameTime/advanceToMatch', async (userId: number) => {
  return await api.advanceToMatch(userId);
});

const gameTimeSlice = createSlice({
  name: 'gameTime',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchGameTime.pending, (s) => { s.loading = true; })
      .addCase(fetchGameTime.fulfilled, (s, a) => { s.loading = false; s.data = a.payload; })
      .addCase(advanceDayThunk.fulfilled, (s, a) => { s.data = a.payload; })
      .addCase(advanceToMatchThunk.fulfilled, (s, a) => { s.data = a.payload; });
  },
});

export default gameTimeSlice.reducer;
