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
  shotType?: 'drive' | 'backhand' | 'smash' | 'lob';
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
  shotType: 'drive' | 'backhand' | 'smash';
  dx: number;
  reachRatio: number;
  isOverhead: boolean;
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

  // For Player 1 (facing net at -Z): right side (derecha/drive) is strictly dx >= 0
  // For Opponent (facing P1 at +Z): right side (derecha/drive) is strictly dx <= 0
  const isRightHandSide = isOpponent ? dx <= 0 : dx >= 0;
  const isOverhead = ballPos[1] >= 1.65;
  const shotType: 'drive' | 'backhand' | 'smash' = isOverhead
    ? 'smash'
    : isRightHandSide
      ? 'drive'
      : 'backhand';

  // Asymmetric horizontal reach:
  // Drive (1 mano a la derecha): gran alcance (~1.95m)
  // Backhand (2 manos a la izquierda): alcance corto y compacto (~1.15m)
  // Smash (overhead vertical): alcance aéreo (~1.80m)
  const maxReachX = isOverhead ? 1.80 : isRightHandSide ? 1.95 : 1.15;

  // Front-back reach along direction of play
  const forwardDz = isOpponent ? dz : -dz;
  const inFront = forwardDz >= -0.45 && forwardDz <= 1.30;

  const normX = Math.abs(dx) / maxReachX;
  const normZ = forwardDz >= 0 ? forwardDz / 1.30 : Math.abs(forwardDz) / 0.45;
  const ellipseDist = Math.sqrt(normX * normX + normZ * normZ);

  // Height envelope: ball must be within reachable height [0.15m, 2.45m]
  const inHeight = ballPos[1] >= 0.15 && ballPos[1] <= 2.45;
  const canHit = inFront && inHeight && ellipseDist <= 1.0;

  return {
    canHit,
    shotType,
    dx,
    reachRatio: ellipseDist,
    isOverhead,
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

  if (isServe) {
    // 1. Tennis serve: analytic trajectory connecting (x0, y0, z0)
    // to (targetX, yLand = 0.08, targetZ)
    const dzTotal = targetZ - z0;
    const absDzTotal = Math.abs(dzTotal);

    const distToNet = Math.abs(z0 - NET_Z);
    const alpha = Math.max(0.15, Math.min(0.92, distToNet / Math.max(1.0, absDzTotal)));

    // Net clearance depends on strike height y0 and depth steering:
    // - High overhead strike (y0 >= 2.35m): clears comfortably (1.15m - 1.35m)
    // - Late toss strike (y0 < 2.15m): launch angle is too flat/downward, crashes into the net (0.75m - 0.88m)!
    // - Forward push (steeringZ > 0): flatter cannon trajectory, tight margin over tape
    let yNetTarget = 1.25;
    if (y0 < 2.15) {
      // Late strike on falling toss: crashes into the net!
      yNetTarget = 0.78 + (y0 - 1.6) * 0.25;
    } else if (steeringZ > 0) {
      // Aggressive flat drive serve: tight margin
      yNetTarget = y0 < 2.4 ? 0.88 : 1.10;
    } else {
      yNetTarget = 1.22 + (y0 - 2.2) * 0.25;
    }

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

  if (shotType === 'smash') {
    // 2. Overhead Smash during rally: explosive downward hammer strike!
    const speedZ = 28.5; // Fast downward plunge
    let effectiveTargetZ = isMovingForward ? -8.2 : 8.2;
    if (steeringZ > 0) {
      effectiveTargetZ = isMovingForward ? -10.2 : 10.2;
    } else if (steeringZ < 0) {
      effectiveTargetZ = isMovingForward ? -6.8 : 6.8;
    }

    const distToNet = Math.abs(z0 - NET_Z);
    const absDzTotal = Math.abs(effectiveTargetZ - z0);
    const tLand = Math.max(0.35, absDzTotal / speedZ);
    const yLand = 0.08;

    // Ensure ball safely clears the net tape (at least 1.10m clearance)
    const tNet = distToNet / speedZ;
    const minNetHeight = 1.10;
    const vyNetReq = (minNetHeight - y0 + 0.5 * GRAVITY * tNet * tNet) / Math.max(0.05, tNet);
    const vyLandReq = (yLand - y0 + 0.5 * GRAVITY * tLand * tLand) / Math.max(0.05, tLand);
    const vy = Math.max(vyNetReq, vyLandReq);

    const vz = isMovingForward ? -speedZ : speedZ;
    const steerMultiplier = 2.8;
    const effectiveTargetX = targetX + steeringX * steerMultiplier;
    const vx = (effectiveTargetX - x0) / Math.max(0.1, tLand);

    return { x: vx, y: vy, z: vz };
  }

  if (shotType === 'lob') {
    // 3. Globo (Lob): High-arching tactical shot flying over net rushers deep into baseline
    const speedZ = steeringZ > 0 ? 13.5 : steeringZ < 0 ? 10.2 : 11.8;
    const effectiveTargetZ = isMovingForward ? -10.6 : 10.6;
    const absDzTotal = Math.abs(effectiveTargetZ - z0);
    const flightTime = Math.max(1.3, absDzTotal / speedZ);

    const yLand = 0.08;
    // Parabolic vy so it reaches 5.5m - 6.5m apex and drops inside baseline
    const vy = (yLand - y0 + 0.5 * GRAVITY * flightTime * flightTime) / flightTime;
    const vz = isMovingForward ? -speedZ : speedZ;

    const steerMultiplier = 2.4;
    const effectiveTargetX = targetX + steeringX * steerMultiplier;
    const vx = (effectiveTargetX - x0) / flightTime;

    return { x: vx, y: vy, z: vz };
  }

  // 2. Regular rally shots: DRIVE (Right hand) vs BACKHAND (Revés / Left side)
  const isDrive = shotType === 'drive';

  let speedZ = isDrive ? 18.0 : 14.0;
  let effectiveTargetZ = targetZ;

  // Realistic Net Clearance depending on contact height y0 and shot type:
  // Net height is 0.914m at center and 1.07m at posts.
  // - Waist/Chest height (y0 >= 0.85m): normal clearance (1.25m - 1.45m)
  // - Low contact (y0 < 0.65m):
  //   * If hitting with forward power (steeringZ > 0): cannot lift in time, hits the net (0.80m - 0.88m)!
  //   * If neutral: tight clearance (1.05m)
  // - Drop shot from deep baseline (|z0| > 12.0m && steeringZ < 0): falls into the net!
  let clearance = isDrive ? 1.30 : 1.38;

  if (steeringZ > 0) {
    // Adelante: Tiro tenso, potente y plano
    speedZ = isDrive ? 22.0 : 17.0;
    effectiveTargetZ = isMovingForward ? -10.8 : 10.8;
    if (y0 < 0.65) {
      // Hitting a very low ball flat forward: crashes into the net!
      clearance = 0.82;
    } else {
      clearance = 1.12;
    }
  } else if (steeringZ < 0) {
    // Atrás: Dejada corta
    speedZ = isDrive ? 11.5 : 9.5;
    effectiveTargetZ = isMovingForward ? -3.2 : 3.2;
    if (Math.abs(z0) > 12.0) {
      // Drop shot attempted from too deep: dies in the net!
      clearance = 0.84;
    } else {
      clearance = 1.25;
    }
  } else {
    // Neutral shot:
    if (y0 < 0.50) {
      clearance = 0.86;
    } else {
      clearance = isDrive ? 1.30 : 1.38;
    }
  }

  const vz = isMovingForward ? -speedZ : speedZ;
  const timeToNet = Math.abs(z0 - NET_Z) / speedZ;
  const totalFlightTime = Math.abs(z0 - effectiveTargetZ) / speedZ;

  // 1. Calculate required vy for the chosen clearance
  const requiredVyForNet =
    (clearance - y0 + 0.5 * GRAVITY * timeToNet * timeToNet) / Math.max(0.1, timeToNet);

  // 2. Calculate ideal parabolic vy so the shot descends deep into opponent's baseline (y ≈ 0.08m)
  const yGround = 0.08;
  const requiredVyForLanding =
    (yGround - y0 + 0.5 * GRAVITY * totalFlightTime * totalFlightTime) / Math.max(0.1, totalFlightTime);

  // When clearance < 0.914m (net fault intended), do not override with landing vy!
  let vy: number;
  if (clearance < 0.914) {
    vy = requiredVyForNet;
  } else {
    const baseMinVy = steeringZ < 0 ? 3.0 : (isDrive ? 3.8 : 4.2);
    vy = Math.max(requiredVyForNet, requiredVyForLanding, baseMinVy);
  }

  // Lateral steering:
  // Forehand (Drive) generates sharper cross-court angles (3.6) vs Backhand (2.0)
  const steerMultiplier = isDrive ? 3.6 : 2.0;
  const effectiveTargetX = targetX + steeringX * steerMultiplier;
  const vx = (effectiveTargetX - x0) / Math.max(0.1, totalFlightTime);

  return { x: vx, y: vy, z: vz };
}
