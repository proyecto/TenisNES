import { create } from 'zustand';
import { calculatePointProgression } from '../utils/tennisScoring';

export interface ScoreState {
  p1Points: number; // 0, 15, 30, 40, Ad (0..4)
  p2Points: number;
  p1Games: number;
  p2Games: number;
  p1Sets: number;
  p2Sets: number;
  p1Aces: number;
  p2Aces: number;
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
  p1SwingTrigger: number;
  p1ShotType: 'drive' | 'backhand' | 'smash';
  cpuShotType: 'drive' | 'backhand' | 'smash';
}

interface TennisStore extends ScoreState {
  setMatchStatus: (status: ScoreState['matchStatus']) => void;
  incrementRally: () => void;
  resetPoint: () => void;
  awardPoint: (winner: 'p1' | 'cpu', isAce?: boolean) => void;
  recordFault: () => void;
  recordLet: () => void;
  setP1Pos: (pos: [number, number, number]) => void;
  setCpuPos: (pos: [number, number, number]) => void;
  setLastHitter: (hitter: 'p1' | 'cpu' | null) => void;
  setLastCall: (call: string | null, color?: string) => void;
  triggerCpuSwing: (shotType?: 'drive' | 'backhand' | 'smash') => void;
  triggerP1Swing: (shotType?: 'drive' | 'backhand' | 'smash') => void;
  resetServe: () => void;
}

export const useTennisStore = create<TennisStore>((set) => ({
  p1Points: 0,
  p2Points: 0,
  p1Games: 0,
  p2Games: 0,
  p1Sets: 0,
  p2Sets: 0,
  p1Aces: 0,
  p2Aces: 0,
  server: 'p1',
  serveSide: 'deuce',
  faultCount: 0,
  rallyCount: 0,
  matchStatus: 'serve_prep',
  lastHitter: null,
  lastCall: null,
  lastCallColor: '#ccff00',
  p1Pos: [1.8, 0, 12.35],
  cpuPos: [-2.2, 0, -12.35],
  ballPos: [1.6, 1.15, 12.0],
  ballVel: [0, 0, 0],
  cpuSwingTrigger: 0,
  p1SwingTrigger: 0,
  p1ShotType: 'drive',
  cpuShotType: 'drive',

  setMatchStatus: (status) => set({ matchStatus: status }),
  incrementRally: () => set((state) => ({ rallyCount: state.rallyCount + 1 })),
  resetPoint: () => set({ rallyCount: 0 }),
  setLastCall: (call, color = '#ccff00') => set({ lastCall: call, lastCallColor: color }),

  awardPoint: (winner, isAce = false) =>
    set((state) => {
      const next = calculatePointProgression(
        {
          p1Points: state.p1Points,
          p2Points: state.p2Points,
          p1Games: state.p1Games,
          p2Games: state.p2Games,
          p1Sets: state.p1Sets,
          p2Sets: state.p2Sets,
          server: state.server,
        },
        winner
      );

      const nextServer = next.nextServer;
      // When a game is won, next game starts from DEUCE. Within a game, it alternates.
      const nextServeSide: 'deuce' | 'ad' = next.gameWon !== null ? 'deuce' : state.serveSide === 'deuce' ? 'ad' : 'deuce';

      const p1X = nextServer === 'p1'
        ? (nextServeSide === 'deuce' ? 1.8 : -1.8)
        : (nextServeSide === 'deuce' ? 2.2 : -2.2);

      const cpuX = nextServer === 'cpu'
        ? (nextServeSide === 'deuce' ? -1.8 : 1.8)
        : (nextServeSide === 'deuce' ? -2.2 : 2.2);

      const aceAnnouncement = isAce
        ? (winner === 'p1' ? '⚡ ¡ACE! SAQUE DIRECTO JUGADOR 1' : '⚡ ¡ACE! SAQUE DIRECTO CPU')
        : null;

      const callText = aceAnnouncement
        ? (next.gameWon || next.setWon || next.matchWon ? `${aceAnnouncement} • ${next.announcement}` : aceAnnouncement)
        : next.announcement;

      const callColor = isAce
        ? '#fbbf24'
        : (winner === 'p1' ? '#ccff00' : '#f43f5e');

      return {
        rallyCount: 0,
        matchStatus: next.matchWon ? 'game_over' : 'point_over',
        p1Points: next.p1Points,
        p2Points: next.p2Points,
        p1Games: next.p1Games,
        p2Games: next.p2Games,
        p1Sets: next.p1Sets,
        p2Sets: next.p2Sets,
        p1Aces: isAce && winner === 'p1' ? state.p1Aces + 1 : state.p1Aces,
        p2Aces: isAce && winner === 'cpu' ? state.p2Aces + 1 : state.p2Aces,
        server: nextServer,
        serveSide: nextServeSide,
        faultCount: 0,
        lastCall: callText,
        lastCallColor: callColor,
        p1Pos: [p1X, state.p1Pos[1], 12.35],
        cpuPos: [cpuX, state.cpuPos[1], -12.35],
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
        // Double fault: receiver wins the point
        const receiver = state.server === 'p1' ? 'cpu' : 'p1';
        const next = calculatePointProgression(
          {
            p1Points: state.p1Points,
            p2Points: state.p2Points,
            p1Games: state.p1Games,
            p2Games: state.p2Games,
            p1Sets: state.p1Sets,
            p2Sets: state.p2Sets,
            server: state.server,
          },
          receiver
        );
        const nextServer = next.nextServer;
        const nextServeSide: 'deuce' | 'ad' = next.gameWon !== null ? 'deuce' : state.serveSide === 'deuce' ? 'ad' : 'deuce';

        const p1X = nextServer === 'p1'
          ? (nextServeSide === 'deuce' ? 1.8 : -1.8)
          : (nextServeSide === 'deuce' ? 2.2 : -2.2);

        const cpuX = nextServer === 'cpu'
          ? (nextServeSide === 'deuce' ? -1.8 : 1.8)
          : (nextServeSide === 'deuce' ? -2.2 : 2.2);

        return {
          faultCount: 0,
          rallyCount: 0,
          matchStatus: next.matchWon ? 'game_over' : 'point_over',
          p1Points: next.p1Points,
          p2Points: next.p2Points,
          p1Games: next.p1Games,
          p2Games: next.p2Games,
          p1Sets: next.p1Sets,
          p2Sets: next.p2Sets,
          server: nextServer,
          serveSide: nextServeSide,
          lastCall: '¡DOBLE FALTA! ' + next.announcement,
          lastCallColor: '#ef4444',
          p1Pos: [p1X, state.p1Pos[1], 12.35],
          cpuPos: [cpuX, state.cpuPos[1], -12.35],
        };
      }
    }),

  recordLet: () =>
    set({
      lastCall: '¡LET! SE REPITE EL SERVICIO',
      lastCallColor: '#38bdf8',
      matchStatus: 'point_over',
      rallyCount: 0,
    }),

  setP1Pos: (pos) => set({ p1Pos: pos }),
  setCpuPos: (pos) => set({ cpuPos: pos }),
  setLastHitter: (hitter) => set({ lastHitter: hitter }),
  triggerCpuSwing: (shotType = 'drive') =>
    set((state) => ({ cpuSwingTrigger: state.cpuSwingTrigger + 1, cpuShotType: shotType })),
  triggerP1Swing: (shotType = 'drive') =>
    set((state) => ({ p1SwingTrigger: state.p1SwingTrigger + 1, p1ShotType: shotType })),
  resetServe: () =>
    set({
      matchStatus: 'serve_prep',
      lastHitter: null,
      lastCall: null,
    }),
}));

