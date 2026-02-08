import { configureStore } from '@reduxjs/toolkit';
import { TypedUseSelectorHook, useDispatch, useSelector } from 'react-redux';
import authReducer from './authSlice';
import teamReducer from './teamSlice';
import matchReducer from './matchSlice';
import leagueReducer from './leagueSlice';
import tacticsReducer from './tacticsSlice';
import gameTimeReducer from './gameTimeSlice';

export const store = configureStore({
  reducer: {
    auth: authReducer,
    team: teamReducer,
    match: matchReducer,
    league: leagueReducer,
    tactics: tacticsReducer,
    gameTime: gameTimeReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
export const useAppDispatch = () => useDispatch<AppDispatch>();
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;
