/**
 * @file tennisCpuAI.ts
 * @description Advanced Tactical AI System for the CPU Tennis Opponent.
 *
 * ## Key Tactical Principles:
 * 1. **No Man's Land Elimination**:
 *    The CPU avoids lingering in mid-court (Z between -6.4m and -11.5m).
 *    - In baseline rallies: Recovers to deep baseline (Z = -12.4m to -12.6m, behind Z = -11.89m).
 *    - In net attacks: Commits fully to the net attack zone (Z = -2.2m to -2.8m).
 * 2. **Analytical Trajectory Prediction**:
 *    Accurately computes parabolic flight and post-bounce apex coordinates so the CPU
 *    moves immediately to the interception point, eliminating hesitation.
 * 3. **Non-Predictable Tactical Shot Selection**:
 *    Instead of always hitting to the opposite side, the CPU chooses dynamically between:
 *    - Cross-Court (Cruzado agresivo con ángulo) [55%]
 *    - Down-the-Line (Paralelo sorpresa a la línea) [30%]
 *    - Deep Center Body Shot (Bola pesada profunda al centro) [15%]
 *    - Surprise Drop Shot (Dejada amortiguada cuando P1 está retrasado)
 *    - Passing shots and tactical lobs when P1 rushes the net.
 *    - Overhead smashes and angled volleys when attacking at the net.
 */

import type { HitReachResult } from './tennisBallistics';

/**
 * Tactical positioning state for the CPU.
 */
export type CpuTacticalState = 'BASELINE_DEFENSE' | 'NET_ATTACK' | 'RETREAT_TO_BASELINE';

/**
 * Difficulty levels for the CPU Opponent.
 */
export type CpuDifficulty = 'amateur' | 'pro' | 'legend';

/**
 * Trajectory prediction result for an airborne ball.
 */
export interface BallPrediction {
  /** Estimated time in seconds until the ball bounces on the court floor */
  timeToBounce: number;
  /** Estimated X coordinate of the first bounce in meters */
  bounceX: number;
  /** Estimated Z coordinate of the first bounce in meters */
  bounceZ: number;
  /** True if the ball lands in the back half (Z <= -6.4m) */
  isDeep: boolean;
  /** True if the ball lands in the front half / service box (Z > -6.4m) */
  isShort: boolean;
  /** Optimal interception X position for the CPU racket */
  strikeX: number;
  /** Optimal interception Z position for the CPU */
  strikeZ: number;
}

/**
 * Recommended target position and velocity for the CPU this frame.
 */
export interface CpuTargetPosition {
  targetX: number;
  targetZ: number;
  desiredSpeed: number;
  tacticalState: CpuTacticalState;
}

/**
 * Planned stroke decision by the CPU AI.
 */
export interface CpuShotDecision {
  targetX: number;
  targetZ: number;
  steeringX: number;
  steeringZ: number;
  shotType: 'drive' | 'backhand' | 'smash' | 'lob';
  label: string;
}

const GRAVITY = 9.81;
const DEEP_RECOVERY_Z = -12.45;
const NET_ATTACK_Z = -2.50;

/**
 * Predicts where and when an incoming ball will bounce on the CPU side,
 * and calculates the optimal interception point post-bounce.
 *
 * @param ballPos Current ball position [x, y, z].
 * @param ballVel Current ball velocity [vx, vy, vz].
 * @param isServe True if the ball in flight is a serve (never treated as a drop shot).
 * @returns Ball trajectory prediction and optimal strike target.
 */
export function predictBallLanding(
  ballPos: [number, number, number],
  ballVel: [number, number, number],
  isServe: boolean = false
): BallPrediction {
  const [x0, y0, z0] = ballPos;
  const [vx, vy, vz] = ballVel;
  const yGround = 0.08;

  // Ball is moving towards CPU: vz < -0.5
  const isMovingToCpu = vz < -0.5;

  let timeToBounce = 0.45;
  if (isMovingToCpu && y0 > yGround) {
    const disc = vy * vy + 2 * GRAVITY * (y0 - yGround);
    if (disc >= 0) {
      const t1 = (vy + Math.sqrt(disc)) / GRAVITY;
      if (t1 > 0.02) {
        timeToBounce = t1;
      }
    }
  }

  const bounceZ = z0 + vz * timeToBounce;
  const bounceX = x0 + vx * timeToBounce;

  // Serves land in service box by rule, but are NEVER drop shots! Returner must stay deep
  const isShort = !isServe && bounceZ > -6.40 && bounceZ < -0.20;
  const isDeep = !isShort;

  let strikeX: number;
  let strikeZ: number;

  if (isServe) {
    // Return of serve: wait comfortably at the baseline behind the service box
    strikeZ = DEEP_RECOVERY_Z;
    // Track where the fast serve will project when it reaches Z = -12.4m
    const postBounceVz = Math.min(-10.0, vz * 0.78);
    const postBounceVx = vx * 0.78;
    const timeFromBounceToBaseline = Math.max(0.2, (DEEP_RECOVERY_Z - bounceZ) / postBounceVz);
    const projectedX = bounceX + postBounceVx * timeFromBounceToBaseline;
    const sideOffset = projectedX >= 0 ? -0.42 : 0.42;
    strikeX = Math.max(-4.2, Math.min(4.2, projectedX + sideOffset));
  } else if (isShort) {
    // Short ball / drop shot: strike before second bounce near landing point
    strikeZ = Math.max(-6.2, Math.min(-1.5, bounceZ - 0.45));
    const sideOffset = bounceX >= 0 ? -0.40 : 0.40;
    strikeX = Math.max(-4.8, Math.min(4.8, bounceX + sideOffset));
  } else {
    // Deep rally ball: post-bounce ball rebounds upward and continues towards -Z
    const postBounceDz = Math.min(-0.8, vz * 0.78 * 0.38);
    const postBounceDx = vx * 0.78 * 0.38;

    // Ideal strike position is comfortably behind baseline
    strikeZ = Math.max(-13.8, Math.min(DEEP_RECOVERY_Z, bounceZ + postBounceDz));
    const projectedX = bounceX + postBounceDx;
    const sideOffset = projectedX >= 0 ? -0.42 : 0.42;
    strikeX = Math.max(-5.0, Math.min(5.0, projectedX + sideOffset));
  }

  return {
    timeToBounce,
    bounceX,
    bounceZ,
    isDeep,
    isShort,
    strikeX,
    strikeZ,
  };
}

/**
 * Computes optimal court target coordinates and athletic movement speed for the CPU.
 *
 * @param cpuPos Current CPU position [x, y, z].
 * @param ballPos Current ball position [x, y, z].
 * @param ballVel Current ball velocity [vx, vy, vz].
 * @param matchStatus Current state machine status.
 * @param server Current serving player.
 * @param serveSide Active service court side ('deuce' | 'ad').
 * @param bouncesSinceHit Number of ground bounces since last racket strike.
 * @param isServeIncoming True if Player 1 is serving (CPU is returning serve).
 * @returns Recommended target position, sprint speed, and tactical state.
 */
export function determineCpuTargetPosition(
  cpuPos: [number, number, number],
  ballPos: [number, number, number],
  ballVel: [number, number, number],
  matchStatus: string,
  server: 'p1' | 'cpu',
  serveSide: 'deuce' | 'ad',
  bouncesSinceHit: number,
  isServeIncoming: boolean = false,
  difficulty: CpuDifficulty = 'pro'
): CpuTargetPosition {
  const speedScale = difficulty === 'amateur' ? 0.68 : difficulty === 'legend' ? 1.15 : 1.0;

  // Service preparation setup
  if (matchStatus === 'serve_prep' || (matchStatus === 'serving' && server === 'cpu')) {
    const targetX = server === 'cpu'
      ? (serveSide === 'deuce' ? -1.8 : 1.8)
      : (serveSide === 'deuce' ? -2.2 : 2.2);
    return {
      targetX,
      targetZ: DEEP_RECOVERY_Z,
      desiredSpeed: 6.5 * speedScale,
      tacticalState: 'BASELINE_DEFENSE',
    };
  }

  // Active rally or serve in play
  const isBallOnCpuSide = ballPos[2] < 0;
  const isBallMovingToCpu = ballVel[2] < -0.5;

  // 1. INCOMING BALL TO CPU
  if (isBallMovingToCpu || (isBallOnCpuSide && bouncesSinceHit <= 1)) {
    const prediction = predictBallLanding(ballPos, ballVel, isServeIncoming);

    if (prediction.isShort) {
      // SPRINT TO NET to retrieve short drop shot
      return {
        targetX: prediction.strikeX,
        targetZ: prediction.strikeZ,
        desiredSpeed: 10.8 * speedScale, // Scaled sprint to save drop shot
        tacticalState: 'NET_ATTACK',
      };
    } else {
      // BASELINE RALLY OR SERVE RETURN: stay deep at baseline
      return {
        targetX: prediction.strikeX,
        targetZ: prediction.strikeZ,
        desiredSpeed: 10.2 * speedScale, // Scaled baseline movement
        tacticalState: 'BASELINE_DEFENSE',
      };
    }
  }

  // 2. BALL IS TRAVELING TOWARDS PLAYER 1 (RECOVERY PHASE)
  // Check if CPU is already positioned at the net
  const isCpuAtNet = cpuPos[2] > -5.0;

  if (isCpuAtNet) {
    // Stay at the net ready to volley or smash! Never retreat to no-man's land unnecessarily
    return {
      targetX: Math.max(-2.5, Math.min(2.5, ballPos[0] * 0.4)),
      targetZ: NET_ATTACK_Z,
      desiredSpeed: 7.5 * speedScale,
      tacticalState: 'NET_ATTACK',
    };
  } else {
    // Standard baseline recovery: center court behind baseline
    return {
      targetX: 0,
      targetZ: DEEP_RECOVERY_Z,
      desiredSpeed: 8.5 * speedScale,
      tacticalState: 'BASELINE_DEFENSE',
    };
  }
}

/**
 * Generates an unpredictable, tactical return shot for the CPU opponent.
 * Ensures shots stay safely within regulation singles court boundaries (no unforced overshoots).
 *
 * @param cpuPos Current CPU coordinates [x, y, z].
 * @param ballPos Current ball coordinates [x, y, z].
 * @param p1Pos Current Player 1 coordinates [x, y, z].
 * @param cpuReach Reach evaluation result.
 * @param isServeReturn True if this stroke is returning Player 1's serve.
 * @returns Planned shot parameters and announcement label.
 */
export function selectCpuShot(
  cpuPos: [number, number, number],
  ballPos: [number, number, number],
  p1Pos: [number, number, number],
  cpuReach: HitReachResult,
  isServeReturn: boolean = false,
  difficulty: CpuDifficulty = 'pro'
): CpuShotDecision {
  const isCpuAtNet = cpuPos[2] > -5.0;
  const isP1AtNet = p1Pos[2] < 7.0;
  const isP1Deep = p1Pos[2] > 13.0;
  const isHighBall = cpuReach.isOverhead || ballPos[1] >= 1.65;

  // 1. SERVE RETURN: High-percentage controlled return
  if (isServeReturn) {
    const returnCrossSide = p1Pos[0] >= 0 ? -1.8 : 1.8;
    const returnSpread = difficulty === 'amateur' ? 0.5 : difficulty === 'legend' ? 1.4 : 1.0;
    return {
      targetX: (returnCrossSide + (Math.random() - 0.5) * returnSpread) * (difficulty === 'amateur' ? 0.65 : 1.0),
      targetZ: difficulty === 'amateur' ? 7.5 : difficulty === 'legend' ? 9.2 : 8.5,
      steeringX: 0,
      steeringZ: 0,
      shotType: cpuReach.shotType,
      label: difficulty === 'amateur' ? 'RESTO SUAVE CPU' : 'RESTO DE SAQUE CPU',
    };
  }

  // 2. OVERHEAD SMASH: Punish any high floater safely inside court
  if (isHighBall) {
    const openCornerX = p1Pos[0] >= 0 ? -2.6 : 2.6;
    const cornerMult = difficulty === 'amateur' ? 0.6 : difficulty === 'legend' ? 1.15 : 1.0;
    return {
      targetX: openCornerX * cornerMult + (Math.random() - 0.5) * 0.5,
      targetZ: difficulty === 'amateur' ? 7.6 : 8.4,
      steeringX: 0,
      steeringZ: 0,
      shotType: 'smash',
      label: difficulty === 'legend' ? '¡REMATE SMASH LETAL CPU!' : '¡REMATE SMASH IMPLACABLE CPU!',
    };
  }

  // 3. TACTICAL RESPONSE TO P1 RUSHING THE NET
  if (isP1AtNet && difficulty !== 'amateur') {
    const roll = Math.random();
    if (roll < (difficulty === 'legend' ? 0.50 : 0.40)) {
      // Tactical Lob over P1's head to baseline
      return {
        targetX: (p1Pos[0] >= 0 ? -1.8 : 1.8) + (Math.random() - 0.5) * 0.6,
        targetZ: difficulty === 'legend' ? 10.2 : 9.6,
        steeringX: 0,
        steeringZ: 0,
        shotType: 'lob',
        label: 'GLOBO TÁCTICO CPU',
      };
    } else {
      // Fast passing shot down the line or sharp cross-court
      const passTargetX = (p1Pos[0] >= 0 ? -2.8 : 2.8) * (difficulty === 'legend' ? 1.12 : 1.0);
      return {
        targetX: passTargetX,
        targetZ: difficulty === 'legend' ? 9.0 : 8.4,
        steeringX: 0,
        steeringZ: 0,
        shotType: cpuReach.shotType,
        label: difficulty === 'legend' ? 'PASSING SHOT GANADOR CPU' : 'PASSING SHOT CPU',
      };
    }
  }

  // 4. CPU ATTACKING AT THE NET (VOLLEYS)
  if (isCpuAtNet) {
    const angleSide = p1Pos[0] >= 0 ? -1 : 1;
    const widthFactor = difficulty === 'amateur' ? 1.6 : difficulty === 'legend' ? 3.1 : 2.4;
    const targetX = angleSide * (widthFactor + Math.random() * 0.5);
    return {
      targetX,
      targetZ: 6.2 + Math.random() * 0.8,
      steeringX: 0,
      steeringZ: 0,
      shotType: cpuReach.shotType,
      label: 'VOLEA DE RED CPU',
    };
  }

  // 5. BASELINE RALLY: Dynamic non-predictable tactical distribution
  // A. Surprise Drop Shot (Dejada) when P1 is pinned far behind the baseline (Pro & Legend only)
  const dropProb = difficulty === 'legend' ? 0.32 : difficulty === 'pro' ? 0.20 : 0.0;
  if (isP1Deep && Math.random() < dropProb) {
    const dropSide = p1Pos[0] >= 0 ? -1.8 : 1.8;
    return {
      targetX: dropSide,
      targetZ: difficulty === 'legend' ? 2.8 : 3.4,
      steeringX: 0,
      steeringZ: -1, // Backspin drop shot
      shotType: 'drive',
      label: difficulty === 'legend' ? '¡DEJADA MILIMÉTRICA CPU!' : '¡DEJADA CORTA SORPRESA CPU!',
    };
  }

  // B. Weighted Shot Selection: Cross-court (55%), Down-the-line (30%), Heavy Center (15%)
  const tacticalRoll = Math.random();
  let targetX: number;
  let label: string;

  if (difficulty === 'amateur') {
    // Amateur: comfortable central rally placement
    targetX = (Math.random() - 0.5) * 2.8;
    label = cpuReach.shotType === 'drive' ? 'DRIVE REGULAR CPU' : 'REVÉS REGULAR CPU';
  } else if (tacticalRoll < 0.55) {
    // Cross-court (Cruzado)
    const crossSide = p1Pos[0] >= 0 ? -1 : 1;
    const crossWidth = difficulty === 'legend' ? 2.8 + Math.random() * 0.5 : 2.4 + Math.random() * 0.6;
    targetX = crossSide * crossWidth;
    label = cpuReach.shotType === 'drive' ? 'DRIVE CRUZADO CPU' : 'REVÉS CRUZADO CPU';
  } else if (tacticalRoll < 0.85) {
    // Down-the-Line (Paralelo)
    const lineSide = p1Pos[0] >= 0 ? 1 : -1;
    const lineWidth = difficulty === 'legend' ? 2.6 + Math.random() * 0.5 : 2.2 + Math.random() * 0.5;
    targetX = lineSide * lineWidth;
    label = cpuReach.shotType === 'drive' ? 'DRIVE PARALELO CPU' : 'REVÉS PARALELO CPU';
  } else {
    // Heavy Center / Body Shot
    targetX = (Math.random() - 0.5) * 1.0;
    label = 'BOLA PROFUNDA AL CENTRO CPU';
  }

  // Depth modulation: Amateur ~7.6m, Pro ~8.8m, Legend ~9.6m
  const baseDepth = difficulty === 'amateur' ? 7.5 : difficulty === 'legend' ? 9.2 : 8.4;
  const targetZ = baseDepth + Math.random() * 0.8;

  return {
    targetX,
    targetZ,
    steeringX: 0,
    steeringZ: 0,
    shotType: cpuReach.shotType,
    label,
  };
}
