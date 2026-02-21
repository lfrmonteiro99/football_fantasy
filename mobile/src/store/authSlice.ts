import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import * as api from '../api/tauri';
import type { User, Team } from '../api/tauri';

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  availableTeams: Team[];
  loading: boolean;
  error: string | null;
}

const initialState: AuthState = {
  user: null,
  isAuthenticated: false,
  availableTeams: [],
  loading: false,
  error: null,
};

export const loginThunk = createAsyncThunk('auth/login', async ({ email, password }: { email: string; password: string }) => {
  return await api.login(email, password);
});

export const registerThunk = createAsyncThunk('auth/register', async (p: { name: string; email: string; password: string; managedTeamId: number }) => {
  return await api.register(p.name, p.email, p.password, p.managedTeamId);
});

export const fetchAvailableTeams = createAsyncThunk('auth/fetchAvailableTeams', async () => {
  return await api.getAvailableTeams();
});

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    logout: (state) => {
      state.user = null;
      state.isAuthenticated = false;
    },
    setUser: (state, action: PayloadAction<User>) => {
      state.user = action.payload;
      state.isAuthenticated = true;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(loginThunk.pending, (s) => { s.loading = true; s.error = null; })
      .addCase(loginThunk.fulfilled, (s, a) => { s.loading = false; s.user = a.payload; s.isAuthenticated = true; })
      .addCase(loginThunk.rejected, (s, a) => { s.loading = false; s.error = a.error.message || 'Login failed'; })
      .addCase(registerThunk.pending, (s) => { s.loading = true; s.error = null; })
      .addCase(registerThunk.fulfilled, (s, a) => { s.loading = false; s.user = a.payload; s.isAuthenticated = true; })
      .addCase(registerThunk.rejected, (s, a) => { s.loading = false; s.error = a.error.message || 'Registration failed'; })
      .addCase(fetchAvailableTeams.fulfilled, (s, a) => { s.availableTeams = a.payload; });
  },
});

export const { logout, setUser } = authSlice.actions;
export default authSlice.reducer;
