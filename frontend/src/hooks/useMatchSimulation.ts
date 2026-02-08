import { useCallback, useRef } from 'react';
import { useAppDispatch } from 'store';
import {
  addTick,
  setLineupData,
  setPhase,
  setSimulationRunning,
  setSimulationError,
  clearSimulation,
} from 'store/matchSlice';
import { createSimulationStream } from 'api/endpoints';
import toast from 'react-hot-toast';
import type { SimulationSpeed } from 'types';

export function useMatchSimulation() {
  const dispatch = useAppDispatch();
  const abortRef = useRef<(() => void) | null>(null);

  const start = useCallback(
    async (matchId: number, speed: SimulationSpeed = 'fast') => {
      // Abort any existing stream
      abortRef.current?.();
      dispatch(clearSimulation());
      dispatch(setSimulationRunning(true));

      try {
        const { stream, abort } = createSimulationStream(matchId, speed);
        abortRef.current = abort;

        // stream() returns an AsyncGenerator yielding { event, data }
        for await (const frame of stream()) {
          switch (frame.event) {
            case 'lineup':
              dispatch(setLineupData(frame.data as any));
              break;

            case 'minute':
              dispatch(addTick(frame.data as any));
              break;

            case 'goal': {
              const goal = frame.data as any;
              toast.success(
                `GOAL! ${goal.scorer ?? 'Unknown'} (${goal.minute}')`,
                { duration: 5000 },
              );
              break;
            }

            case 'card': {
              const card = frame.data as any;
              const icon = card.card_type === 'red' ? 'RED CARD' : 'YELLOW CARD';
              toast(`${icon}: ${card.player ?? 'Unknown'} (${card.minute}')`, {
                duration: 3000,
              });
              break;
            }

            case 'half_time':
              dispatch(setPhase('half_time'));
              break;

            case 'full_time':
              dispatch(setPhase('full_time'));
              dispatch(setSimulationRunning(false));
              break;

            case 'error': {
              const errorData = frame.data as any;
              dispatch(setSimulationError(errorData.message ?? 'Simulation error'));
              dispatch(setSimulationRunning(false));
              break;
            }
          }
        }
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          dispatch(setSimulationError(err.message ?? 'Simulation failed'));
          dispatch(setSimulationRunning(false));
        }
      }
    },
    [dispatch],
  );

  const abort = useCallback(() => {
    abortRef.current?.();
    dispatch(setSimulationRunning(false));
  }, [dispatch]);

  return { start, abort };
}
