/**
 * Tennis ballistics utility for calculating realistic shot velocities
 * with proper net clearance, parabolic arc, and directional steering.
 */

export interface HitParameters {
  fromPos: [number, number, number];
  targetZ: number; // Opponent court depth (e.g. -8m to -11m)
  targetX?: number; // Target lateral placement
  steeringX?: number; // Player input steer: -1 (left), 0 (center), +1 (right)
  steeringZ?: number; // Depth steer: +1 (adelante / fuerte), -1 (atrás / floja y corta), 0 (neutral)
  isServe?: boolean;
  shotType?: 'drive' | 'backhand' | 'smash';
}

export interface ShotVelocity {
  x: number;
  y: number;
  z: number;
}

const GRAVITY = 9.81;
const NET_Z = 0;

export interface HitReachResult {
  canHit: boolean;
  shotType: 'drive' | 'backhand';
  dx: number;
  reachRatio: number;
}

/**
 * Evaluates whether a tennis ball is within reach using a compact, athletic asymmetric oval base:
 * - Right side (Forehand / Drive): 1-handed reach (~1.65m)
 * - Left side (Backhand / Revés): 2-handed reach (~1.15m)
 * - Tight depth window along direction of play (-0.40m to +1.25m)
 */
export function evaluateHitReach(
  playerPos: [number, number, number],
  ballPos: [number, number, number],
  isOpponent: boolean = false
): HitReachResult {
  const dx = ballPos[0] - playerPos[0];
  const dz = ballPos[2] - playerPos[2];

  // For Player 1 (facing net at -Z): right side is dx >= -0.10
  // For Opponent (facing P1 at +Z): right side is dx <= +0.10
  const isRightHandSide = isOpponent ? dx <= 0.10 : dx >= -0.10;
  const shotType: 'drive' | 'backhand' = isRightHandSide ? 'drive' : 'backhand';

  // Asymmetric horizontal reach (compact oval base):
  // Drive (mano diestra a 1 mano): reach (~1.65m)
  // Backhand (2 manos): shorter, compact reach (~1.15m)
  const maxReachX = isRightHandSide ? 1.65 : 1.15;

  // Front-back reach along direction of play (reduced from 3.2m depth to 1.65m)
  const forwardDz = isOpponent ? dz : -dz;
  const inFront = forwardDz >= -0.40 && forwardDz <= 1.25;

  const normX = Math.abs(dx) / maxReachX;
  const normZ = forwardDz >= 0 ? forwardDz / 1.25 : Math.abs(forwardDz) / 0.40;
  const ellipseDist = Math.sqrt(normX * normX + normZ * normZ);

  // Height envelope: ball must be within reachable height [0.15m, 2.10m]
  const inHeight = ballPos[1] >= 0.15 && ballPos[1] <= 2.10;
  const canHit = inFront && inHeight && ellipseDist <= 1.0;

  return {
    canHit,
    shotType,
    dx,
    reachRatio: ellipseDist,
  };
}

export function calculateShotVelocity({
  fromPos,
  targetZ,
  targetX = 0,
  steeringX = 0,
  steeringZ = 0,
  isServe = false,
  shotType = 'drive',
}: HitParameters): ShotVelocity {
  const [x0, y0, z0] = fromPos;
  const isMovingForward = targetZ < z0;

  if (isServe || shotType === 'smash') {
    // 1. Tennis serve / smash: analytic trajectory connecting (x0, y0, z0)
    // to (targetX, yLand = 0.08, targetZ) with guaranteed net clearance.
    const dzTotal = targetZ - z0;
    const absDzTotal = Math.abs(dzTotal);

    const distToNet = Math.abs(z0 - NET_Z);
    const alpha = Math.max(0.15, Math.min(0.92, distToNet / Math.max(1.0, absDzTotal)));

    const yNetTarget = 1.45;
    const yLand = 0.08;

    const num = yNetTarget - (1 - alpha) * y0 - alpha * yLand;
    const den = 0.5 * GRAVITY * alpha * (1 - alpha);

    let tLand: number;
    let vy: number;

    if (num > 0.05 && den > 0.01) {
      tLand = Math.sqrt(num / den);
      tLand = Math.max(0.65, Math.min(1.15, tLand));
      vy = (yLand - y0 + 0.5 * GRAVITY * tLand * tLand) / tLand;
    } else {
      const speedZ = 19.5;
      tLand = absDzTotal / speedZ;
      const tNet = tLand * alpha;
      vy = (yNetTarget - y0 + 0.5 * GRAVITY * tNet * tNet) / Math.max(0.1, tNet);
    }

    const vz = dzTotal / tLand;
    const vx = (targetX - x0) / tLand;

    return { x: vx, y: vy, z: vz };
  }

  // 2. Regular rally shots: DRIVE (Right hand) vs BACKHAND (Revés / Left side)
  const isDrive = shotType === 'drive';

  // Base speed & depth modulated by steeringZ:
  // - Right hand Forehand (Drive): visibly more speed, power and offensive whip
  // - Left side Backhand (Revés): noticeably softer, controlled and defensive pace
  let speedZ = isDrive ? 17.5 : 13.5;
  let effectiveTargetZ = targetZ;
  let clearance = isDrive ? 1.20 : 1.32;

  if (steeringZ > 0) {
    // Adelante: Tiro potente y profundo
    speedZ = isDrive ? 21.5 : 16.5;
    effectiveTargetZ = isMovingForward ? -10.5 : 10.5;
    clearance = isDrive ? 1.05 : 1.15;
  } else if (steeringZ < 0) {
    // Atrás: Dejada floja cerca de la red
    speedZ = isDrive ? 11.5 : 9.0;
    effectiveTargetZ = isMovingForward ? -3.0 : 3.0;
    clearance = 1.38;
  }

  const vz = isMovingForward ? -speedZ : speedZ;
  const timeToNet = Math.abs(z0 - NET_Z) / speedZ;
  const totalFlightTime = Math.abs(z0 - effectiveTargetZ) / speedZ;

  const requiredVyForNet =
    (clearance - y0 + 0.5 * GRAVITY * timeToNet * timeToNet) / timeToNet;
  const vy = Math.max(requiredVyForNet, steeringZ < 0 ? 2.8 : 3.6);

  // Lateral steering:
  // Forehand (Drive) generates sharper cross-court angles (3.6) vs Backhand (2.0)
  const steerMultiplier = isDrive ? 3.6 : 2.0;
  const effectiveTargetX = targetX + steeringX * steerMultiplier;
  const vx = (effectiveTargetX - x0) / Math.max(0.1, totalFlightTime);

  return { x: vx, y: vy, z: vz };
}
