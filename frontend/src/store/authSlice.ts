import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import * as api from 'api/endpoints';
import { setStoredToken, clearStoredToken, getStoredToken } from 'api/client';
import type { AuthState, User, Team, LoginPayload, RegisterPayload } from 'types';

const initialState: AuthState = {
  user: null,
  token: getStoredToken(),
  isAuthenticated: !!getStoredToken(),
  loading: 'idle',
  error: null,
};

// ---------------------------------------------------------------------------
// Thunks
// ---------------------------------------------------------------------------

export const login = createAsyncThunk<
  { user: User; token: string },
  LoginPayload,
  { rejectValue: string }
>('auth/login', async (credentials, { rejectWithValue }) => {
  try {
    const result = await api.login(credentials);
    setStoredToken(result.token);
    return { user: result.user, token: result.token };
  } catch (err: any) {
    const message =
      err.response?.data?.message || err.message || 'Login failed';
    return rejectWithValue(message);
  }
});

export const register = createAsyncThunk<
  { user: User; token: string },
  RegisterPayload,
  { rejectValue: string }
>('auth/register', async (data, { rejectWithValue }) => {
  try {
    const result = await api.register(data);
    setStoredToken(result.token);
    return { user: result.user, token: result.token };
  } catch (err: any) {
    const message =
      err.response?.data?.message || err.message || 'Registration failed';
    return rejectWithValue(message);
  }
});

export const fetchProfile = createAsyncThunk<
  User,
  void,
  { rejectValue: string }
>('auth/fetchProfile', async (_, { rejectWithValue }) => {
  try {
    return await api.getProfile();
  } catch (err: any) {
    const message =
      err.response?.data?.message || err.message || 'Failed to fetch profile';
    return rejectWithValue(message);
  }
});

export const fetchAvailableTeams = createAsyncThunk<
  Team[],
  void,
  { rejectValue: string }
>('auth/fetchAvailableTeams', async (_, { rejectWithValue }) => {
  try {
    return await api.getAvailableTeams();
  } catch (err: any) {
    const message =
      err.response?.data?.message || err.message || 'Failed to fetch teams';
    return rejectWithValue(message);
  }
});

export const logoutThunk = createAsyncThunk<void, void, { rejectValue: string }>(
  'auth/logout',
  async (_, { rejectWithValue }) => {
    try {
      await api.logout();
      clearStoredToken();
    } catch (err: any) {
      // Still clear token locally even if server call fails
      clearStoredToken();
      const message =
        err.response?.data?.message || err.message || 'Logout failed';
      return rejectWithValue(message);
    }
  },
);

// ---------------------------------------------------------------------------
// Slice
// ---------------------------------------------------------------------------

// We keep availableTeams in a separate part of the state since it's only used
// during registration and doesn't belong to AuthState from types.  We extend
// the typed state locally.

interface AuthSliceState extends AuthState {
  availableTeams: Team[];
}

const extendedInitialState: AuthSliceState = {
  ...initialState,
  availableTeams: [],
};

const authSlice = createSlice({
  name: 'auth',
  initialState: extendedInitialState,
  reducers: {
    clearAuthError(state) {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    // --- login ---
    builder.addCase(login.pending, (state) => {
      state.loading = 'loading';
      state.error = null;
    });
    builder.addCase(login.fulfilled, (state, action) => {
      state.loading = 'succeeded';
      state.user = action.payload.user;
      state.token = action.payload.token;
      state.isAuthenticated = true;
      state.error = null;
    });
    builder.addCase(login.rejected, (state, action) => {
      state.loading = 'failed';
      state.error = action.payload ?? 'Login failed';
    });

    // --- register ---
    builder.addCase(register.pending, (state) => {
      state.loading = 'loading';
      state.error = null;
    });
    builder.addCase(register.fulfilled, (state, action) => {
      state.loading = 'succeeded';
      state.user = action.payload.user;
      state.token = action.payload.token;
      state.isAuthenticated = true;
      state.error = null;
    });
    builder.addCase(register.rejected, (state, action) => {
      state.loading = 'failed';
      state.error = action.payload ?? 'Registration failed';
    });

    // --- fetchProfile ---
    builder.addCase(fetchProfile.pending, (state) => {
      state.loading = 'loading';
    });
    builder.addCase(fetchProfile.fulfilled, (state, action) => {
      state.loading = 'succeeded';
      state.user = action.payload;
      state.isAuthenticated = true;
    });
    builder.addCase(fetchProfile.rejected, (state, action) => {
      state.loading = 'failed';
      state.error = action.payload ?? 'Profile fetch failed';
      state.isAuthenticated = false;
      state.token = null;
      state.user = null;
    });

    // --- fetchAvailableTeams ---
    builder.addCase(fetchAvailableTeams.pending, (state) => {
      state.loading = 'loading';
    });
    builder.addCase(fetchAvailableTeams.fulfilled, (state, action) => {
      state.loading = 'succeeded';
      state.availableTeams = action.payload;
    });
    builder.addCase(fetchAvailableTeams.rejected, (state, action) => {
      state.loading = 'failed';
      state.error = action.payload ?? 'Failed to fetch available teams';
    });

    // --- logout ---
    builder.addCase(logoutThunk.fulfilled, (state) => {
      state.user = null;
      state.token = null;
      state.isAuthenticated = false;
      state.loading = 'idle';
      state.error = null;
      state.availableTeams = [];
    });
    builder.addCase(logoutThunk.rejected, (state) => {
      // Even on server-side failure, clear local auth state
      state.user = null;
      state.token = null;
      state.isAuthenticated = false;
      state.loading = 'idle';
      state.availableTeams = [];
    });
  },
});

export const { clearAuthError } = authSlice.actions;
export default authSlice.reducer;
