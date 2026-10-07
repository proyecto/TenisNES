import { describe, it, expect } from 'vitest';
import { calculateShotVelocity } from './tennisBallistics';

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
});
