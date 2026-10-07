import { create } from 'zustand';
import { calculatePointProgression } from '../utils/tennisScoring';

export interface ScoreState {
  p1Points: number; // 0, 15, 30, 40, Ad (0..4)
  p2Points: number;
  p1Games: number;
  p2Games: number;
  server: 'p1' | 'cpu';
  serveSide: 'deuce' | 'ad';
  faultCount: number;
  rallyCount: number;
  matchStatus: 'idle' | 'serve_prep' | 'serving' | 'playing' | 'point_over' | 'game_over';
  lastHitter: 'p1' | 'cpu' | null;
  lastCall: string | null;
  lastCallColor: string;
  p1Pos: [number, number, number];
  cpuPos: [number, number, number];
  ballPos: [number, number, number];
  ballVel: [number, number, number];
  cpuSwingTrigger: number;
}

interface TennisStore extends ScoreState {
  setMatchStatus: (status: ScoreState['matchStatus']) => void;
  incrementRally: () => void;
  resetPoint: () => void;
  awardPoint: (winner: 'p1' | 'cpu') => void;
  recordFault: () => void;
  setP1Pos: (pos: [number, number, number]) => void;
  setCpuPos: (pos: [number, number, number]) => void;
  setLastHitter: (hitter: 'p1' | 'cpu' | null) => void;
  setLastCall: (call: string | null, color?: string) => void;
  triggerCpuSwing: () => void;
  resetServe: () => void;
}

export const useTennisStore = create<TennisStore>((set) => ({
  p1Points: 0,
  p2Points: 0,
  p1Games: 0,
  p2Games: 0,
  server: 'p1',
  serveSide: 'deuce',
  faultCount: 0,
  rallyCount: 0,
  matchStatus: 'serve_prep',
  lastHitter: null,
  lastCall: null,
  lastCallColor: '#ccff00',
  p1Pos: [0.8, 0, 12.2],
  cpuPos: [0, 0, -12.2],
  ballPos: [0.6, 1.15, 11.9],
  ballVel: [0, 0, 0],
  cpuSwingTrigger: 0,

  setMatchStatus: (status) => set({ matchStatus: status }),
  incrementRally: () => set((state) => ({ rallyCount: state.rallyCount + 1 })),
  resetPoint: () => set({ rallyCount: 0 }),
  setLastCall: (call, color = '#ccff00') => set({ lastCall: call, lastCallColor: color }),

  awardPoint: (winner) =>
    set((state) => {
      const next = calculatePointProgression(
        {
          p1Points: state.p1Points,
          p2Points: state.p2Points,
          p1Games: state.p1Games,
          p2Games: state.p2Games,
        },
        winner
      );

      const nextServeSide = state.serveSide === 'deuce' ? 'ad' : 'deuce';
      const p1X = nextServeSide === 'deuce' ? 0.8 : -0.8;

      return {
        rallyCount: 0,
        matchStatus: 'point_over',
        p1Points: next.p1Points,
        p2Points: next.p2Points,
        p1Games: next.p1Games,
        p2Games: next.p2Games,
        serveSide: nextServeSide,
        faultCount: 0,
        lastCall: next.announcement,
        lastCallColor: winner === 'p1' ? '#ccff00' : '#f43f5e',
        p1Pos: [p1X, state.p1Pos[1], 12.2],
      };
    }),

  recordFault: () =>
    set((state) => {
      if (state.faultCount === 0) {
        return {
          faultCount: 1,
          lastCall: '¡FALTA! SEGUNDO SERVICIO',
          lastCallColor: '#f59e0b',
          matchStatus: 'point_over',
          rallyCount: 0,
        };
      } else {
        // Double fault: receiver gets point
        const receiver = state.server === 'p1' ? 'cpu' : 'p1';
        const next = calculatePointProgression(
          {
            p1Points: state.p1Points,
            p2Points: state.p2Points,
            p1Games: state.p1Games,
            p2Games: state.p2Games,
          },
          receiver
        );
        const nextServeSide = state.serveSide === 'deuce' ? 'ad' : 'deuce';
        const p1X = nextServeSide === 'deuce' ? 0.8 : -0.8;

        return {
          faultCount: 0,
          rallyCount: 0,
          matchStatus: 'point_over',
          p1Points: next.p1Points,
          p2Points: next.p2Points,
          p1Games: next.p1Games,
          p2Games: next.p2Games,
          serveSide: nextServeSide,
          lastCall: '¡DOBLE FALTA! ' + next.announcement,
          lastCallColor: '#ef4444',
          p1Pos: [p1X, state.p1Pos[1], 12.2],
        };
      }
    }),

  setP1Pos: (pos) => set({ p1Pos: pos }),
  setCpuPos: (pos) => set({ cpuPos: pos }),
  setLastHitter: (hitter) => set({ lastHitter: hitter }),
  triggerCpuSwing: () => set((state) => ({ cpuSwingTrigger: state.cpuSwingTrigger + 1 })),
  resetServe: () =>
    set({
      matchStatus: 'serve_prep',
      lastHitter: null,
      lastCall: null,
    }),
}));

