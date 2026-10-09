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

  it('modulates shot strength and depth with steeringZ (forward strong vs backward soft drop)', () => {
    const neutralShot = calculateShotVelocity({
      fromPos: [0, 1.0, 10.0],
      targetZ: -9.0,
      steeringZ: 0,
      shotType: 'drive',
    });

    const forwardHardShot = calculateShotVelocity({
      fromPos: [0, 1.0, 10.0],
      targetZ: -9.0,
      steeringZ: 1, // Adelante: más fuerte y profunda
      shotType: 'drive',
    });

    const backwardDropShot = calculateShotVelocity({
      fromPos: [0, 1.0, 10.0],
      targetZ: -9.0,
      steeringZ: -1, // Atrás: más floja, corta cerca de la red
      shotType: 'drive',
    });

    // Forward shot is faster than neutral
    expect(Math.abs(forwardHardShot.z)).toBeGreaterThan(Math.abs(neutralShot.z));
    // Backward drop shot is slower and softer than neutral
    expect(Math.abs(backwardDropShot.z)).toBeLessThan(Math.abs(neutralShot.z));
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

  it('detects high overhead ball for smash in evaluateHitReach', () => {
    const playerPos: [number, number, number] = [0, 0, 10.0];

    // High ball at y = 1.95m directly above / in front
    const highBall = evaluateHitReach(playerPos, [0.4, 1.95, 9.6], false);
    expect(highBall.canHit).toBe(true);
    expect(highBall.isOverhead).toBe(true);
    expect(highBall.shotType).toBe('smash');
  });

  it('calculates high-arching lob trajectory flying over the net and deep into baseline', () => {
    const lobShot = calculateShotVelocity({
      fromPos: [0, 1.0, 10.0],
      targetZ: -10.0,
      shotType: 'lob',
    });

    expect(lobShot.z).toBeLessThan(0); // Towards opponent
    expect(lobShot.y).toBeGreaterThan(6.0); // High vertical launch

    // Height at net (Z = 0) must easily clear someone waiting at the net (height > 3.5m)
    const timeToNet = 10.0 / Math.abs(lobShot.z);
    const heightAtNet = 1.0 + lobShot.y * timeToNet - 0.5 * 9.81 * timeToNet * timeToNet;
    expect(heightAtNet).toBeGreaterThan(3.5);
  });

  it('calculates explosive rally smash velocity clearing the net', () => {
    const smashShot = calculateShotVelocity({
      fromPos: [0, 2.1, 8.0],
      targetZ: -8.0,
      shotType: 'smash',
      isServe: false,
    });

    // Fast downward plunge: speedZ should be ~28.5 m/s
    expect(Math.abs(smashShot.z)).toBeGreaterThan(25.0);

    // Ball clears net
    const timeToNet = 8.0 / Math.abs(smashShot.z);
    const heightAtNet = 2.1 + smashShot.y * timeToNet - 0.5 * 9.81 * timeToNet * timeToNet;
    expect(heightAtNet).toBeGreaterThanOrEqual(1.10);
  });

  it('correctly resolves distinct strategies in resolveShotStrategy', () => {
    // Serve strategy
    const serve = calculateShotVelocity({ fromPos: [0, 2.2, 11], targetZ: -8, isServe: true });
    expect(serve).toBeDefined();

    // Smash strategy
    const smash = calculateShotVelocity({ fromPos: [0, 2.2, 8], targetZ: -8, isServe: false, shotType: 'smash' });
    expect(Math.abs(smash.z)).toBeGreaterThan(25);

    // Lob strategy
    const lob = calculateShotVelocity({ fromPos: [0, 1.0, 8], targetZ: -8, isServe: false, shotType: 'lob' });
    expect(lob.y).toBeGreaterThan(5);

    // Groundstroke strategy
    const ground = calculateShotVelocity({ fromPos: [0, 1.0, 8], targetZ: -8, isServe: false, shotType: 'drive' });
    expect(Math.abs(ground.z)).toBeLessThan(25);
  });

  it('evaluates inverted reach orientation and expanded stretch reach for opponent (CPU)', () => {
    const cpuPos: [number, number, number] = [0, 0, -10.0];

    // For CPU facing +Z: left side (dx < 0) is right-hand forehand drive!
    const cpuForehand = evaluateHitReach(cpuPos, [-1.5, 1.1, -9.6], true);
    expect(cpuForehand.canHit).toBe(true);
    expect(cpuForehand.shotType).toBe('drive');

    // For CPU facing +Z: right side (dx > 0) is two-handed backhand with stretch reach up to 1.70m
    const cpuBackhand = evaluateHitReach(cpuPos, [1.4, 1.1, -9.6], true);
    expect(cpuBackhand.canHit).toBe(true);
    expect(cpuBackhand.shotType).toBe('backhand');
  });

  it('calculates shot trajectory flying from CPU side (Z < 0) to Player 1 side (Z > 0)', () => {
    const cpuToP1Shot = calculateShotVelocity({
      fromPos: [0, 1.0, -11.5],
      targetZ: 8.5,
      isServe: false,
      shotType: 'drive',
    });

    // Z velocity must be positive (towards +Z)
    expect(cpuToP1Shot.z).toBeGreaterThan(0);
    // Net clearance at Z = 0
    const timeToNet = 11.5 / cpuToP1Shot.z;
    const heightAtNet = 1.0 + cpuToP1Shot.y * timeToNet - 0.5 * 9.81 * timeToNet * timeToNet;
    expect(heightAtNet).toBeGreaterThanOrEqual(1.20);
  });
});

