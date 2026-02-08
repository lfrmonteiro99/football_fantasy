import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import * as api from 'api/endpoints';
import type {
  TacticsState,
  Tactic,
  Formation,
  FormationVisualization,
  TacticAnalysis,
  CreateTacticPayload,
  UpdateTacticPayload,
  AssignTacticPayload,
  TacticAssignResponse,
} from 'types';

const initialState: TacticsState = {
  tactics: [],
  currentTactic: null,
  tacticAnalysis: null,
  formations: [],
  formationsByStyle: null,
  currentFormation: null,
  formationVisualization: null,
  positions: [],
  loading: 'idle',
  error: null,
};

// ---------------------------------------------------------------------------
// Thunks
// ---------------------------------------------------------------------------

export const fetchTactics = createAsyncThunk<
  Tactic[],
  { formation_id?: number; mentality?: string; style?: string; per_page?: number; page?: number } | undefined,
  { rejectValue: string }
>('tactics/fetchTactics', async (params, { rejectWithValue }) => {
  try {
    const result = await api.getTactics(params);
    return result.data; // PaginatedResponse — extract inner data array
  } catch (err: any) {
    return rejectWithValue(
      err.response?.data?.message || err.message || 'Failed to fetch tactics',
    );
  }
});

export const fetchTactic = createAsyncThunk<
  Tactic,
  number,
  { rejectValue: string }
>('tactics/fetchTactic', async (tacticId, { rejectWithValue }) => {
  try {
    return await api.getTactic(tacticId);
  } catch (err: any) {
    return rejectWithValue(
      err.response?.data?.message || err.message || 'Failed to fetch tactic',
    );
  }
});

export const createTactic = createAsyncThunk<
  Tactic,
  CreateTacticPayload,
  { rejectValue: string }
>('tactics/createTactic', async (payload, { rejectWithValue }) => {
  try {
    return await api.createTactic(payload);
  } catch (err: any) {
    return rejectWithValue(
      err.response?.data?.message || err.message || 'Failed to create tactic',
    );
  }
});

export const updateTactic = createAsyncThunk<
  Tactic,
  { id: number; data: UpdateTacticPayload },
  { rejectValue: string }
>('tactics/updateTactic', async ({ id, data }, { rejectWithValue }) => {
  try {
    return await api.updateTactic(id, data);
  } catch (err: any) {
    return rejectWithValue(
      err.response?.data?.message || err.message || 'Failed to update tactic',
    );
  }
});

export const deleteTactic = createAsyncThunk<
  number,
  number,
  { rejectValue: string }
>('tactics/deleteTactic', async (tacticId, { rejectWithValue }) => {
  try {
    await api.deleteTactic(tacticId);
    return tacticId;
  } catch (err: any) {
    return rejectWithValue(
      err.response?.data?.message || err.message || 'Failed to delete tactic',
    );
  }
});

export const fetchFormations = createAsyncThunk<
  Formation[],
  void,
  { rejectValue: string }
>('tactics/fetchFormations', async (_, { rejectWithValue }) => {
  try {
    return await api.getFormations();
  } catch (err: any) {
    return rejectWithValue(
      err.response?.data?.message || err.message || 'Failed to fetch formations',
    );
  }
});

export const fetchFormationDetail = createAsyncThunk<
  FormationVisualization,
  number,
  { rejectValue: string }
>('tactics/fetchFormationDetail', async (formationId, { rejectWithValue }) => {
  try {
    return await api.getFormationVisualization(formationId);
  } catch (err: any) {
    return rejectWithValue(
      err.response?.data?.message || err.message || 'Failed to fetch formation detail',
    );
  }
});

export const assignTacticToTeam = createAsyncThunk<
  TacticAssignResponse,
  { tacticId: number; teamId: number; isPrimary?: boolean },
  { rejectValue: string }
>('tactics/assignTacticToTeam', async ({ tacticId, teamId, isPrimary }, { rejectWithValue }) => {
  try {
    return await api.assignTacticToTeamViaTactic(tacticId, {
      team_id: teamId,
      is_primary: isPrimary,
    });
  } catch (err: any) {
    return rejectWithValue(
      err.response?.data?.message || err.message || 'Failed to assign tactic',
    );
  }
});

// ---------------------------------------------------------------------------
// Slice
// ---------------------------------------------------------------------------

const tacticsSlice = createSlice({
  name: 'tactics',
  initialState,
  reducers: {
    clearTacticsError(state) {
      state.error = null;
    },
    clearCurrentTactic(state) {
      state.currentTactic = null;
      state.tacticAnalysis = null;
    },
  },
  extraReducers: (builder) => {
    // --- fetchTactics ---
    builder.addCase(fetchTactics.pending, (state) => {
      state.loading = 'loading';
      state.error = null;
    });
    builder.addCase(fetchTactics.fulfilled, (state, action) => {
      state.loading = 'succeeded';
      state.tactics = action.payload;
    });
    builder.addCase(fetchTactics.rejected, (state, action) => {
      state.loading = 'failed';
      state.error = action.payload ?? 'Failed to fetch tactics';
    });

    // --- fetchTactic ---
    builder.addCase(fetchTactic.pending, (state) => {
      state.loading = 'loading';
      state.error = null;
    });
    builder.addCase(fetchTactic.fulfilled, (state, action) => {
      state.loading = 'succeeded';
      state.currentTactic = action.payload;
    });
    builder.addCase(fetchTactic.rejected, (state, action) => {
      state.loading = 'failed';
      state.error = action.payload ?? 'Failed to fetch tactic';
    });

    // --- createTactic ---
    builder.addCase(createTactic.pending, (state) => {
      state.loading = 'loading';
      state.error = null;
    });
    builder.addCase(createTactic.fulfilled, (state, action) => {
      state.loading = 'succeeded';
      state.tactics.push(action.payload);
      state.currentTactic = action.payload;
    });
    builder.addCase(createTactic.rejected, (state, action) => {
      state.loading = 'failed';
      state.error = action.payload ?? 'Failed to create tactic';
    });

    // --- updateTactic ---
    builder.addCase(updateTactic.pending, (state) => {
      state.loading = 'loading';
      state.error = null;
    });
    builder.addCase(updateTactic.fulfilled, (state, action) => {
      state.loading = 'succeeded';
      state.currentTactic = action.payload;
      const idx = state.tactics.findIndex((t) => t.id === action.payload.id);
      if (idx !== -1) {
        state.tactics[idx] = action.payload;
      }
    });
    builder.addCase(updateTactic.rejected, (state, action) => {
      state.loading = 'failed';
      state.error = action.payload ?? 'Failed to update tactic';
    });

    // --- deleteTactic ---
    builder.addCase(deleteTactic.pending, (state) => {
      state.loading = 'loading';
      state.error = null;
    });
    builder.addCase(deleteTactic.fulfilled, (state, action) => {
      state.loading = 'succeeded';
      state.tactics = state.tactics.filter((t) => t.id !== action.payload);
      if (state.currentTactic?.id === action.payload) {
        state.currentTactic = null;
      }
    });
    builder.addCase(deleteTactic.rejected, (state, action) => {
      state.loading = 'failed';
      state.error = action.payload ?? 'Failed to delete tactic';
    });

    // --- fetchFormations ---
    builder.addCase(fetchFormations.pending, (state) => {
      state.loading = 'loading';
      state.error = null;
    });
    builder.addCase(fetchFormations.fulfilled, (state, action) => {
      state.loading = 'succeeded';
      state.formations = action.payload;
    });
    builder.addCase(fetchFormations.rejected, (state, action) => {
      state.loading = 'failed';
      state.error = action.payload ?? 'Failed to fetch formations';
    });

    // --- fetchFormationDetail ---
    builder.addCase(fetchFormationDetail.pending, (state) => {
      state.loading = 'loading';
      state.error = null;
    });
    builder.addCase(fetchFormationDetail.fulfilled, (state, action) => {
      state.loading = 'succeeded';
      state.formationVisualization = action.payload;
      state.currentFormation = action.payload.formation;
    });
    builder.addCase(fetchFormationDetail.rejected, (state, action) => {
      state.loading = 'failed';
      state.error = action.payload ?? 'Failed to fetch formation detail';
    });

    // --- assignTacticToTeam ---
    builder.addCase(assignTacticToTeam.pending, (state) => {
      state.loading = 'loading';
      state.error = null;
    });
    builder.addCase(assignTacticToTeam.fulfilled, (state) => {
      state.loading = 'succeeded';
    });
    builder.addCase(assignTacticToTeam.rejected, (state, action) => {
      state.loading = 'failed';
      state.error = action.payload ?? 'Failed to assign tactic';
    });
  },
});

export const { clearTacticsError, clearCurrentTactic } = tacticsSlice.actions;
export default tacticsSlice.reducer;
