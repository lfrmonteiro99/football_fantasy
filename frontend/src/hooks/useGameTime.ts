import { useCallback } from 'react';
import { useAppDispatch, useAppSelector } from 'store';
import {
  fetchCurrentDate as fetchCurrentDateThunk,
  advanceDay as advanceDayThunk,
  advanceToMatch as advanceToMatchThunk,
} from 'store/gameTimeSlice';

export function useGameTime() {
  const dispatch = useAppDispatch();
  const {
    currentDate,
    formattedDate,
    nextMatch,
    daysUntilMatch,
    isMatchDay,
    loading,
  } = useAppSelector((state) => state.gameTime);

  const fetchCurrentDate = useCallback(
    (teamId?: number) => dispatch(fetchCurrentDateThunk(teamId)),
    [dispatch],
  );

  const advanceDay = useCallback(
    () => dispatch(advanceDayThunk()),
    [dispatch],
  );

  const advanceToMatch = useCallback(
    () => dispatch(advanceToMatchThunk()),
    [dispatch],
  );

  return {
    currentDate,
    formattedDate,
    nextMatch,
    daysUntilMatch,
    isMatchDay,
    loading,
    fetchCurrentDate,
    advanceDay,
    advanceToMatch,
  };
}
