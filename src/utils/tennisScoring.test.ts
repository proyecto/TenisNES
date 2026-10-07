import { describe, it, expect } from 'vitest';
import { evaluateBounce, calculatePointProgression } from './tennisScoring';

describe('tennisScoring', () => {
  it('correctly evaluates a legal deuce serve (diagonal to left box)', () => {
    const result = evaluateBounce({
      x: -2.0,
      z: -4.5, // Inside CPU deuce service box
      isServe: true,
      serveSide: 'deuce',
      hitter: 'p1',
    });

    expect(result.isInBounds).toBe(true);
    expect(result.isFault).toBe(false);
  });

  it('flags fault when deuce serve lands in wrong (right) box', () => {
    const result = evaluateBounce({
      x: 2.0, // Lands in right box instead of diagonal left box
      z: -4.5,
      isServe: true,
      serveSide: 'deuce',
      hitter: 'p1',
    });

    expect(result.isInBounds).toBe(false);
    expect(result.isFault).toBe(true);
  });

  it('correctly evaluates a legal ad serve (diagonal to right box)', () => {
    const result = evaluateBounce({
      x: 2.0, // Inside CPU right service box
      z: -4.5,
      isServe: true,
      serveSide: 'ad',
      hitter: 'p1',
    });

    expect(result.isInBounds).toBe(true);
    expect(result.isFault).toBe(false);
  });

  it('flags fault when ad serve lands in wrong (left) box', () => {
    const result = evaluateBounce({
      x: -2.0, // Lands in left box instead of diagonal right box
      z: -4.5,
      isServe: true,
      serveSide: 'ad',
      hitter: 'p1',
    });

    expect(result.isInBounds).toBe(false);
    expect(result.isFault).toBe(true);
  });

  it('correctly flags a serve fault when out of service box (long past 6.40m)', () => {
    const result = evaluateBounce({
      x: -2.0,
      z: -8.5, // Deep past the service line (6.4m)
      isServe: true,
      serveSide: 'deuce',
      hitter: 'p1',
    });

    expect(result.isInBounds).toBe(false);
    expect(result.isFault).toBe(true);
  });

  it('evaluates in-bounds rally shot', () => {
    const result = evaluateBounce({
      x: 3.0,
      z: -10.0,
      isServe: false,
      serveSide: 'deuce',
      hitter: 'p1',
    });

    expect(result.isInBounds).toBe(true);
  });

  it('evaluates out-of-bounds wide rally shot', () => {
    const result = evaluateBounce({
      x: 5.0, // Past singles sideline 4.115m
      z: -9.0,
      isServe: false,
      serveSide: 'deuce',
      hitter: 'p1',
    });

    expect(result.isInBounds).toBe(false);
    expect(result.callMessage).toBe('¡FUERA!');
  });

  it('handles standard game progression from 0-0 to game won', () => {
    let state = { p1Points: 0, p2Points: 0, p1Games: 0, p2Games: 0 };

    // Point 1 -> 15-0
    let res = calculatePointProgression(state, 'p1');
    expect(res.p1Points).toBe(1);

    // Point 2 -> 30-0
    res = calculatePointProgression(res, 'p1');
    expect(res.p1Points).toBe(2);

    // Point 3 -> 40-0
    res = calculatePointProgression(res, 'p1');
    expect(res.p1Points).toBe(3);

    // Point 4 -> Game P1!
    res = calculatePointProgression(res, 'p1');
    expect(res.p1Games).toBe(1);
    expect(res.p1Points).toBe(0);
    expect(res.gameWon).toBe('p1');
  });

  it('handles deuce and advantage correctly', () => {
    // Both at 40 (3-3)
    let state = { p1Points: 3, p2Points: 3, p1Games: 0, p2Games: 0 };

    // P1 gets advantage
    let res = calculatePointProgression(state, 'p1');
    expect(res.p1Points).toBe(4);
    expect(res.announcement).toContain('VENTAJA');

    // CPU wins point -> back to Deuce
    res = calculatePointProgression(res, 'cpu');
    expect(res.p1Points).toBe(3);
    expect(res.p2Points).toBe(3);
    expect(res.announcement).toContain('IGUALES');
  });
});
