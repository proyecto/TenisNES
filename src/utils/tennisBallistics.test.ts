import { describe, it, expect } from 'vitest';
import { calculateShotVelocity, evaluateHitReach } from './tennisBallistics';

describe('tennisBallistics', () => {
  it('calculates proper serve velocity with net clearance', () => {
    const shot = calculateShotVelocity({
      fromPos: [0.8, 2.2, 11.5],
      targetZ: -8.0,
      steeringX: 0,
      isServe: true,
    });

    expect(shot.z).toBeLessThan(0); // Flying towards opponent

    // Verify ball height at net (Z = 0)
    const timeToNet = 11.5 / Math.abs(shot.z);
    const heightAtNet = 2.2 + shot.y * timeToNet - 0.5 * 9.81 * timeToNet * timeToNet;
    expect(heightAtNet).toBeGreaterThanOrEqual(1.20); // Well clears 0.914m net with safety margin
  });

  it('calculates rally shot with steering to the right', () => {
    const shot = calculateShotVelocity({
      fromPos: [0, 1.0, 10.0],
      targetZ: -9.0,
      steeringX: 1, // Steer right
      isServe: false,
    });

    expect(shot.x).toBeGreaterThan(0); // Aimed right
    expect(shot.z).toBeLessThan(0);
  });

  it('differentiates drive (faster, wider angle) vs backhand (straighter, controlled)', () => {
    const driveShot = calculateShotVelocity({
      fromPos: [0, 1.0, 10.0],
      targetZ: -9.0,
      steeringX: 1,
      isServe: false,
      shotType: 'drive',
    });

    const backhandShot = calculateShotVelocity({
      fromPos: [0, 1.0, 10.0],
      targetZ: -9.0,
      steeringX: 1,
      isServe: false,
      shotType: 'backhand',
    });

    // Drive is faster forward (more negative Z)
    expect(Math.abs(driveShot.z)).toBeGreaterThan(Math.abs(backhandShot.z));
    // Drive has more cross-court steering angle
    expect(Math.abs(driveShot.x)).toBeGreaterThan(Math.abs(backhandShot.x));
  });

  it('evaluates asymmetric oval hit reach for right side drive and left side backhand', () => {
    const playerPos: [number, number, number] = [0, 0, 10.0];

    // Right side within drive reach (x = 1.25m, z = 9.6m -> forwardDz = 0.4m)
    const rightHit = evaluateHitReach(playerPos, [1.25, 1.1, 9.6], false);
    expect(rightHit.canHit).toBe(true);
    expect(rightHit.shotType).toBe('drive');

    // Left side at x = -1.45m exceeds compact backhand reach (max ~1.15m)
    const leftFarHit = evaluateHitReach(playerPos, [-1.45, 1.1, 9.6], false);
    expect(leftFarHit.canHit).toBe(false);
    expect(leftFarHit.shotType).toBe('backhand');

    // Left side within compact backhand reach (x = -0.75m)
    const leftHit = evaluateHitReach(playerPos, [-0.75, 1.1, 9.6], false);
    expect(leftHit.canHit).toBe(true);
    expect(leftHit.shotType).toBe('backhand');
  });
});
