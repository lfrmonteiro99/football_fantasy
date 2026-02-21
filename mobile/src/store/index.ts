import { configureStore } from '@reduxjs/toolkit';
import authReducer from './authSlice';
import teamReducer from './teamSlice';
import matchReducer from './matchSlice';
import gameTimeReducer from './gameTimeSlice';
import { TypedUseSelectorHook, useDispatch, useSelector } from 'react-redux';

export const store = configureStore({
  reducer: {
    auth: authReducer,
    team: teamReducer,
    match: matchReducer,
    gameTime: gameTimeReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

export const useAppDispatch: () => AppDispatch = useDispatch;
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;
