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

  it('alternates server to CPU and resets serveSide to deuce upon game win', () => {
    useTennisStore.setState({
      p1Points: 3, // 40
      p2Points: 1, // 15
      p1Games: 0,
      p2Games: 0,
      p1Sets: 0,
      p2Sets: 0,
      server: 'p1',
      serveSide: 'ad',
    });

    useTennisStore.getState().awardPoint('p1');
    const state = useTennisStore.getState();
    expect(state.p1Games).toBe(1);
    expect(state.p1Points).toBe(0);
    expect(state.p2Points).toBe(0);
    // ITF Rule 14: Server alternates to CPU
    expect(state.server).toBe('cpu');
    // ITF Rule: New game starts on DEUCE side
    expect(state.serveSide).toBe('deuce');
  });

  it('records let without penalizing the server with a fault', () => {
    useTennisStore.setState({ faultCount: 0 });
    useTennisStore.getState().recordLet();
    const state = useTennisStore.getState();
    expect(state.lastCall).toContain('LET');
    expect(state.faultCount).toBe(0);
  });

  it('awards point and increments aces counter when an Ace occurs', () => {
    useTennisStore.setState({
      p1Points: 0,
      p1Aces: 0,
    });

    useTennisStore.getState().awardPoint('p1', true);
    const state = useTennisStore.getState();
    expect(state.p1Points).toBe(1);
    expect(state.p1Aces).toBe(1);
    expect(state.lastCall).toContain('ACE');
    expect(state.lastCallColor).toBe('#fbbf24');
  });
});
