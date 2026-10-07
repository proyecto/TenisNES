/**
 * Tennis ballistics utility for calculating realistic shot velocities
 * with proper net clearance, parabolic arc, and directional steering.
 */

export interface HitParameters {
  fromPos: [number, number, number];
  targetZ: number; // Opponent court depth (e.g. -8m to -11m)
  targetX?: number; // Target lateral placement
  steeringX?: number; // Player input steer: -1 (left), 0 (center), +1 (right)
  isServe?: boolean;
}

export interface ShotVelocity {
  x: number;
  y: number;
  z: number;
}

const GRAVITY = 9.81;
const NET_Z = 0;
const NET_SAFE_HEIGHT = 1.25; // 0.914m net + safety margin

export function calculateShotVelocity({
  fromPos,
  targetZ,
  targetX = 0,
  steeringX = 0,
  isServe = false,
}: HitParameters): ShotVelocity {
  const [x0, y0, z0] = fromPos;
  const isMovingForward = targetZ < z0;

  if (isServe) {
    // 1. Tennis serve: analytic trajectory connecting (x0, y0, z0)
    // to (targetX, yLand = 0.08, targetZ) with guaranteed net clearance (1.45m).
    const dzTotal = targetZ - z0;
    const absDzTotal = Math.abs(dzTotal);

    // Fraction of path from server to net (at Z = 0)
    const distToNet = Math.abs(z0 - NET_Z);
    const alpha = Math.max(0.15, Math.min(0.92, distToNet / Math.max(1.0, absDzTotal)));

    // Height clearance at the net tape (regulation net is 1.00m, 1.45m guarantees safe margin)
    const yNetTarget = 1.45;
    const yLand = 0.08;

    // Closed-form solution for parabolic flight:
    const num = yNetTarget - (1 - alpha) * y0 - alpha * yLand;
    const den = 0.5 * GRAVITY * alpha * (1 - alpha);

    let tLand: number;
    let vy: number;

    if (num > 0.05 && den > 0.01) {
      tLand = Math.sqrt(num / den);
      // Realistic serve flight duration
      tLand = Math.max(0.55, Math.min(1.0, tLand));
      vy = (yLand - y0 + 0.5 * GRAVITY * tLand * tLand) / tLand;
    } else {
      // Fallback for extreme bounds
      const speedZ = 22.0;
      tLand = absDzTotal / speedZ;
      const tNet = tLand * alpha;
      vy = (yNetTarget - y0 + 0.5 * GRAVITY * tNet * tNet) / Math.max(0.1, tNet);
    }

    const vz = dzTotal / tLand;
    const vx = (targetX - x0) / tLand;

    return { x: vx, y: vy, z: vz };
  }

  // 2. Regular rally shots (Forehand / Backhand)
  const speedZ = 18.5; // m/s
  const vz = isMovingForward ? -speedZ : speedZ;
  const timeToNet = Math.abs(z0 - NET_Z) / speedZ;
  const totalFlightTime = Math.abs(z0 - targetZ) / speedZ;

  const requiredVyForNet =
    (NET_SAFE_HEIGHT - y0 + 0.5 * GRAVITY * timeToNet * timeToNet) / timeToNet;
  const vy = Math.max(requiredVyForNet, 4.0);

  const effectiveTargetX = targetX + steeringX * 2.8;
  const vx = (effectiveTargetX - x0) / Math.max(0.1, totalFlightTime);

  return { x: vx, y: vy, z: vz };
}
