import { create } from 'zustand';
import { calculatePointProgression } from '../utils/tennisScoring';
import { tennisAudio } from '../utils/tennisAudio';

/**
 * @file useTennisStore.ts
 * @description Centralized Zustand state container implementing the Tennis Finite State Machine (FSM),
 * match scoring (ITF standard), player positioning, shot tracking, and Hawk-Eye bounce logging.
 *
 * ## Tennis Match State Machine (FSM)
 * ```
 *                 ┌────────────────┐
 *                 │   serve_prep   │◄──────────────┐
 *                 └───────┬────────┘               │
 *                         │ [Ball Toss]            │
 *                         ▼                        │
 *                 ┌────────────────┐               │
 *                 │    serving     │               │
 *                 └───────┬────────┘               │
 *             [Hit Serve] │                        │
 *                         ▼                        │
 *                 ┌────────────────┐               │
 *                 │    playing     │               │
 *                 └───────┬────────┘               │
 *            [Point/Fault]│                        │
 *                         ▼                        │
 *                 ┌────────────────┐               │
 *                 │   point_over   ├───────────────┘
 *                 └───────┬────────┘ (Reset serve)
 *            [Match Point]│
 *                         ▼
 *                 ┌────────────────┐
 *                 │   game_over    │
 *                 └────────────────┘
 * ```
 */

export interface ScoreState {
  /** P1 current game points: 0, 15 (1), 30 (2), 40 (3), AD (4) */
  p1Points: number;
  /** CPU / P2 current game points: 0, 15 (1), 30 (2), 40 (3), AD (4) */
  p2Points: number;
  /** Games won by Player 1 in the current set */
  p1Games: number;
  /** Games won by Player 2 (CPU) in the current set */
  p2Games: number;
  /** Sets won by Player 1 */
  p1Sets: number;
  /** Sets won by Player 2 (CPU) */
  p2Sets: number;
  /** Aces scored by Player 1 */
  p1Aces: number;
  /** Aces scored by CPU */
  p2Aces: number;
  /** Player currently serving ('p1' or 'cpu') */
  server: 'p1' | 'cpu';
  /** Court side for current serve: 'deuce' (right) or 'ad' (left) */
  serveSide: 'deuce' | 'ad';
  /** Number of consecutive serve faults for active point (0 = 1st serve, 1 = 2nd serve) */
  faultCount: number;
  /** Number of shot exchanges in current rally */
  rallyCount: number;
  /** Current state in the tennis match state machine */
  matchStatus: 'idle' | 'serve_prep' | 'serving' | 'playing' | 'point_over' | 'game_over';
  /** Player who made the last racket contact ('p1' | 'cpu' | null) */
  lastHitter: 'p1' | 'cpu' | null;
  /** Text of the latest umpire announcement / call */
  lastCall: string | null;
  /** Hex color for the umpire announcement banner */
  lastCallColor: string;
  /** Position [X, Y, Z] of Player 1 in world space */
  p1Pos: [number, number, number];
  /** Position [X, Y, Z] of CPU Opponent in world space */
  cpuPos: [number, number, number];
  /** Position [X, Y, Z] of tennis ball in world space */
  ballPos: [number, number, number];
  /** Velocity vector [Vx, Vy, Vz] of tennis ball */
  ballVel: [number, number, number];
  /** Monotonic counter to trigger CPU swing animation */
  cpuSwingTrigger: number;
  /** Monotonic counter to trigger Player 1 swing animation */
  p1SwingTrigger: number;
  /** Stroke type for Player 1 */
  p1ShotType: 'drive' | 'backhand' | 'smash' | 'lob' | 'slice';
  /** Stroke type for CPU */
  cpuShotType: 'drive' | 'backhand' | 'smash' | 'lob' | 'slice';
  /** Timestamp when ball was tossed in air for serve */
  serveTossTime: number;
  /** Speed of latest shot in km/h */
  lastSpeedKmh: number;
  /** Speed of latest shot in mph */
  lastSpeedMph: number;
  /** Display label for shot speed (e.g. 'SAQUE P1', 'DRIVE') */
  lastSpeedLabel: string;
  /** Player who hit the measured shot */
  lastSpeedHitter: 'p1' | 'cpu' | null;
  /** Fastest serve speed achieved by Player 1 in km/h */
  maxServeSpeedP1: number;
  /** Fastest serve speed achieved by CPU in km/h */
  maxServeSpeedCpu: number;
  /** Coordinates [X, Z] of the last ground bounce */
  lastBouncePos: [number, number] | null;
  /** Whether the last bounce was inside legal court boundaries */
  lastBounceInBounds: boolean | null;
  /** Distance in centimeters from bounce mark to nearest line */
  lastBounceDistanceCm: number | null;
  /** High-resolution timestamp of last bounce */
  lastBounceTime: number;
  /** Whether all audio playback is muted */
  isMuted: boolean;
  /** Master volume factor between 0.0 and 1.0 */
  volume: number;
}

interface TennisStore extends ScoreState {
  /** Updates the current match status FSM */
  setMatchStatus: (status: ScoreState['matchStatus']) => void;
  /** Sets the timestamp of the serve ball toss */
  setServeTossTime: (time: number) => void;
  /** Increments current rally exchange counter */
  incrementRally: () => void;
  /** Resets rally counter for a new point */
  resetPoint: () => void;
  /** Awards a point to the specified player and calculates game/set/match progression */
  awardPoint: (winner: 'p1' | 'cpu', isAce?: boolean) => void;
  /** Records a serve fault (1st fault or double fault) */
  recordFault: (wasNetFault?: boolean) => void;
  /** Records an ITF Rule 22 Let (serve clipped net tape and landed in service box) */
  recordLet: () => void;
  /** Updates Player 1 world coordinates */
  setP1Pos: (pos: [number, number, number]) => void;
  /** Updates CPU world coordinates */
  setCpuPos: (pos: [number, number, number]) => void;
  /** Sets the player who last struck the ball */
  setLastHitter: (hitter: 'p1' | 'cpu' | null) => void;
  /** Displays a custom umpire call banner with optional color */
  setLastCall: (call: string | null, color?: string) => void;
  /** Triggers CPU racket swing animation */
  triggerCpuSwing: (shotType?: 'drive' | 'backhand' | 'smash' | 'lob' | 'slice') => void;
  /** Triggers Player 1 racket swing animation */
  triggerP1Swing: (shotType?: 'drive' | 'backhand' | 'smash' | 'lob' | 'slice') => void;
  /** Prepares players and ball for the next serve */
  resetServe: () => void;
  /** Logs shot radar speed telemetry */
  recordShotSpeed: (speedKmh: number, label: string, hitter: 'p1' | 'cpu', isServe?: boolean) => void;
  /** Logs Hawk-Eye bounce coordinates and distance to line */
  recordBounceLocation: (x: number, z: number, inBounds: boolean, distanceCm: number, timestamp: number) => void;
  /** Toggles audio mute state */
  toggleMute: () => void;
  /** Updates audio volume level */
  setVolume: (volume: number) => void;
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
  serveTossTime: 0,
  lastSpeedKmh: 0,
  lastSpeedMph: 0,
  lastSpeedLabel: '',
  lastSpeedHitter: null,
  maxServeSpeedP1: 0,
  maxServeSpeedCpu: 0,
  lastBouncePos: null,
  lastBounceInBounds: null,
  lastBounceDistanceCm: null,
  lastBounceTime: 0,
  isMuted: false,
  volume: 0.8,

  toggleMute: () =>
    set((state) => {
      const nextMuted = !state.isMuted;
      tennisAudio.setMuted(nextMuted);
      return { isMuted: nextMuted };
    }),

  setVolume: (volume: number) =>
    set(() => {
      tennisAudio.setVolume(volume);
      return { volume };
    }),

  recordShotSpeed: (speedKmh, label, hitter, isServe = false) =>
    set((state) => {
      const speedMph = Math.round(speedKmh * 0.621371);
      const newMaxP1 = isServe && hitter === 'p1' ? Math.max(state.maxServeSpeedP1, speedKmh) : state.maxServeSpeedP1;
      const newMaxCpu = isServe && hitter === 'cpu' ? Math.max(state.maxServeSpeedCpu, speedKmh) : state.maxServeSpeedCpu;
      return {
        lastSpeedKmh: speedKmh,
        lastSpeedMph: speedMph,
        lastSpeedLabel: label,
        lastSpeedHitter: hitter,
        maxServeSpeedP1: newMaxP1,
        maxServeSpeedCpu: newMaxCpu,
      };
    }),

  recordBounceLocation: (x, z, inBounds, distanceCm, timestamp) =>
    set({
      lastBouncePos: [x, z],
      lastBounceInBounds: inBounds,
      lastBounceDistanceCm: distanceCm,
      lastBounceTime: timestamp,
    }),

  setMatchStatus: (status) => set({ matchStatus: status }),
  setServeTossTime: (time) => set({ serveTossTime: time }),
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

      // Audio feedback & commentary
      if (isAce) {
        tennisAudio.playUmpireTone('ace');
        tennisAudio.playCrowdCheer('roar');
        tennisAudio.speakUmpireCall('Ace!');
      } else if (next.matchWon) {
        tennisAudio.playUmpireTone('game');
        tennisAudio.playCrowdCheer('roar');
        tennisAudio.speakUmpireCall(`Game, set and match, ${winner === 'p1' ? 'Nadal' : 'Murray'}`);
      } else if (next.gameWon !== null) {
        tennisAudio.playUmpireTone('game');
        tennisAudio.playCrowdCheer('applause');
        tennisAudio.speakUmpireCall(`Game, ${winner === 'p1' ? 'Nadal' : 'Murray'}`);
      } else {
        if (state.rallyCount >= 4) {
          tennisAudio.playCrowdCheer('applause');
        }
        if (next.announcement.includes('IGUALES')) {
          tennisAudio.playUmpireTone('deuce');
          tennisAudio.speakUmpireCall('Deuce');
        } else if (next.announcement.includes('VENTAJA')) {
          tennisAudio.speakUmpireCall(winner === 'p1' ? 'Advantage Nadal' : 'Advantage Murray');
        }
      }

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

  recordFault: (wasNetFault = false) =>
    set((state) => {
      tennisAudio.playUmpireTone('fault');
      if (state.faultCount === 0) {
        tennisAudio.speakUmpireCall(wasNetFault ? 'Fault, into the net' : 'Fault!');
        return {
          faultCount: 1,
          lastCall: wasNetFault ? '¡RED Y FUERA! FALTA (2º SERVICIO)' : '¡FALTA! SEGUNDO SERVICIO',
          lastCallColor: '#f59e0b',
          matchStatus: 'point_over',
          rallyCount: 0,
        };
      } else {
        tennisAudio.speakUmpireCall('Double fault!');
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

        const faultPrefix = wasNetFault ? '¡RED Y FUERA! ' : '';

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
          lastCall: `${faultPrefix}¡DOBLE FALTA! ${next.announcement}`,
          lastCallColor: '#ef4444',
          p1Pos: [p1X, state.p1Pos[1], 12.35],
          cpuPos: [cpuX, state.cpuPos[1], -12.35],
        };
      }
    }),

  recordLet: () =>
    set((state) => {
      tennisAudio.playUmpireTone('let');
      tennisAudio.speakUmpireCall('Let, first service');
      return {
        lastCall:
          state.faultCount === 1
            ? '¡NET! SE REPITE EL 2º SERVICIO'
            : '¡NET! SE REPITE EL 1º SERVICIO',
        lastCallColor: '#38bdf8',
        matchStatus: 'point_over',
        rallyCount: 0,
      };
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

