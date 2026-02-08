import { useCallback } from 'react';
import { useAppDispatch, useAppSelector } from 'store';
import {
  login as loginThunk,
  register as registerThunk,
  logoutThunk,
  fetchAvailableTeams as fetchAvailableTeamsThunk,
  fetchProfile,
} from 'store/authSlice';
import type { LoginPayload, RegisterPayload } from 'types';

export function useAuth() {
  const dispatch = useAppDispatch();
  const { user, isAuthenticated, loading, error } = useAppSelector(
    (state) => state.auth,
  );
  const availableTeams = useAppSelector(
    (state) => (state.auth as any).availableTeams ?? [],
  );

  const login = useCallback(
    (credentials: LoginPayload) => dispatch(loginThunk(credentials)),
    [dispatch],
  );

  const register = useCallback(
    (data: RegisterPayload) => dispatch(registerThunk(data)),
    [dispatch],
  );

  const logout = useCallback(
    () => dispatch(logoutThunk()),
    [dispatch],
  );

  const fetchAvailableTeams = useCallback(
    () => dispatch(fetchAvailableTeamsThunk()),
    [dispatch],
  );

  const refreshProfile = useCallback(
    () => dispatch(fetchProfile()),
    [dispatch],
  );

  return {
    user,
    isAuthenticated,
    loading,
    error,
    login,
    register,
    logout,
    fetchAvailableTeams,
    availableTeams,
    refreshProfile,
  };
}
