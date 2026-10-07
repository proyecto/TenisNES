import { describe, it, expect, beforeEach } from 'vitest';
import { useTennisStore } from './useTennisStore';

describe('useTennisStore', () => {
  beforeEach(() => {
    useTennisStore.setState({
      p1Points: 0,
      p2Points: 0,
      p1Games: 0,
      p2Games: 0,
      server: 'p1',
      serveSide: 'deuce',
      rallyCount: 0,
      matchStatus: 'idle',
    });
  });

  it('increments rally count', () => {
    useTennisStore.getState().incrementRally();
    expect(useTennisStore.getState().rallyCount).toBe(1);
  });

  it('awards point to player 1', () => {
    useTennisStore.getState().awardPoint('p1');
    expect(useTennisStore.getState().p1Points).toBe(1);
    expect(useTennisStore.getState().matchStatus).toBe('point_over');
    expect(useTennisStore.getState().lastCall).toBe('¡PUNTO JUGADOR 1!');
  });

  it('records first fault and then double fault awarding point to receiver', () => {
    // 1st fault
    useTennisStore.getState().recordFault();
    expect(useTennisStore.getState().faultCount).toBe(1);
    expect(useTennisStore.getState().lastCall).toContain('SEGUNDO SERVICIO');

    // 2nd fault -> Double fault!
    useTennisStore.getState().recordFault();
    expect(useTennisStore.getState().faultCount).toBe(0);
    expect(useTennisStore.getState().p2Points).toBe(1); // Receiver CPU gets point
    expect(useTennisStore.getState().lastCall).toContain('DOBLE FALTA');
  });
});
