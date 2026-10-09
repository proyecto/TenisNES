import { describe, it, expect } from 'vitest';
import {
  predictBallLanding,
  determineCpuTargetPosition,
  selectCpuShot,
} from './tennisCpuAI';

describe('tennisCpuAI Tactical System', () => {
  it('correctly predicts deep ball landing and computes strike position behind baseline', () => {
    // Ball hit by P1 from Z = 11 towards CPU at Z = -11 with speed vz = -18 m/s
    const ballPos: [number, number, number] = [0.5, 1.2, 2.0];
    const ballVel: [number, number, number] = [1.2, 4.0, -18.0];

    const pred = predictBallLanding(ballPos, ballVel);

    expect(pred.isDeep).toBe(true);
    expect(pred.isShort).toBe(false);
    expect(pred.bounceZ).toBeLessThan(-6.4);
    // Strike position should be comfortably behind the baseline (<= -11.89m)
    expect(pred.strikeZ).toBeLessThanOrEqual(-12.4);
  });

  it('correctly detects short ball (drop shot) in front half of court', () => {
    // Drop shot that lands short near the service box (Z = -3.5m)
    const ballPos: [number, number, number] = [0.2, 0.9, -1.0];
    const ballVel: [number, number, number] = [0.1, 1.5, -6.5];

    const pred = predictBallLanding(ballPos, ballVel);

    expect(pred.isShort).toBe(true);
    expect(pred.bounceZ).toBeGreaterThan(-6.4);
    expect(pred.bounceZ).toBeLessThan(0);
    // Strike position must be in front half to retrieve short ball
    expect(pred.strikeZ).toBeGreaterThan(-7.0);
  });

  it('eliminates No Mans Land: positions deep at baseline during baseline rally', () => {
    const cpuPos: [number, number, number] = [0, 0, -12.35];
    const ballPos: [number, number, number] = [1.5, 1.1, 4.0];
    const ballVel: [number, number, number] = [1.0, 3.5, -16.0];

    const target = determineCpuTargetPosition(
      cpuPos,
      ballPos,
      ballVel,
      'playing',
      'p1',
      'deuce',
      0
    );

    expect(target.tacticalState).toBe('BASELINE_DEFENSE');
    // CPU target must be behind baseline (<= -12.0m), never stuck at -9m or -10m
    expect(target.targetZ).toBeLessThanOrEqual(-12.0);
    expect(target.desiredSpeed).toBeGreaterThanOrEqual(9.5);
  });

  it('commits fully to Net Attack when retrieving a short ball', () => {
    const cpuPos: [number, number, number] = [0, 0, -12.35];
    const ballPos: [number, number, number] = [0.5, 0.7, -2.0];
    const ballVel: [number, number, number] = [0.2, 1.2, -5.0];

    const target = determineCpuTargetPosition(
      cpuPos,
      ballPos,
      ballVel,
      'playing',
      'p1',
      'deuce',
      0
    );

    expect(target.tacticalState).toBe('NET_ATTACK');
    // Must sprint at maximum athletic speed
    expect(target.desiredSpeed).toBeGreaterThanOrEqual(10.0);
  });

  it('generates tactical non-predictable return choices in selectCpuShot', () => {
    const cpuPos: [number, number, number] = [1.0, 0, -12.4];
    const ballPos: [number, number, number] = [1.4, 1.1, -11.8];
    const p1Pos: [number, number, number] = [1.5, 0, 12.4];
    const reach = {
      canHit: true,
      shotType: 'drive' as const,
      dx: 0.4,
      reachRatio: 0.4,
      isOverhead: false,
    };

    const decisions = Array.from({ length: 30 }, () =>
      selectCpuShot(cpuPos, ballPos, p1Pos, reach)
    );

    // Decisions must contain valid target depths and non-empty announcements
    decisions.forEach((d) => {
      expect(d.targetZ).toBeGreaterThan(0);
      expect(d.label).toBeTruthy();
    });

    // Should produce both positive and negative targetX angles (variety)
    const hasPositiveX = decisions.some((d) => d.targetX > 1.0);
    const hasNegativeX = decisions.some((d) => d.targetX < -1.0);
    expect(hasPositiveX && hasNegativeX).toBe(true);
  });

  it('executes overhead smash when ball is high', () => {
    const cpuPos: [number, number, number] = [0, 0, -4.0];
    const ballPos: [number, number, number] = [0.2, 2.1, -3.8];
    const p1Pos: [number, number, number] = [0, 0, 12.0];
    const reach = {
      canHit: true,
      shotType: 'smash' as const,
      dx: 0.2,
      reachRatio: 0.2,
      isOverhead: true,
    };

    const decision = selectCpuShot(cpuPos, ballPos, p1Pos, reach);
    expect(decision.shotType).toBe('smash');
    expect(decision.label).toContain('SMASH');
  });

  it('stays anchored at the baseline and does NOT rush to net when returning Player 1 serve', () => {
    // Player 1 serves into CPU service box (Z = -4.2m)
    const cpuPos: [number, number, number] = [-2.2, 0, -12.35];
    const ballPos: [number, number, number] = [0.8, 1.8, 4.0];
    const ballVel: [number, number, number] = [-1.5, -2.0, -19.0];

    const target = determineCpuTargetPosition(
      cpuPos,
      ballPos,
      ballVel,
      'playing',
      'p1',
      'deuce',
      0,
      true // isServeIncoming = true!
    );

    // CPU MUST stay behind baseline (<= -12.4m) and NOT sprint into the net
    expect(target.tacticalState).toBe('BASELINE_DEFENSE');
    expect(target.targetZ).toBeLessThanOrEqual(-12.4);
  });

  it('guarantees all CPU shots are within singles court boundaries (no out-of-bounds shots)', () => {
    const cpuPos: [number, number, number] = [0, 0, -12.4];
    const ballPos: [number, number, number] = [0, 1.1, -11.8];
    const p1Pos: [number, number, number] = [0, 0, 12.0];
    const reach = {
      canHit: true,
      shotType: 'drive' as const,
      dx: 0.3,
      reachRatio: 0.3,
      isOverhead: false,
    };

    // Test normal rally shots and serve returns
    for (let i = 0; i < 50; i++) {
      const isReturn = i % 2 === 0;
      const shot = selectCpuShot(cpuPos, ballPos, p1Pos, reach, isReturn);

      // Width: singles sideline is ±4.115m. Target should leave comfortable margin (<= 3.2m)
      expect(Math.abs(shot.targetX)).toBeLessThanOrEqual(3.5);
      // Depth: baseline is at 11.89m. Target should land safely inside (<= 10.0m)
      expect(shot.targetZ).toBeLessThanOrEqual(10.0);
      expect(shot.targetZ).toBeGreaterThanOrEqual(2.5);
      // Steering multipliers must be 0 to avoid shooting balls out-of-bounds
      expect(shot.steeringX).toBe(0);
    }
  });
});
