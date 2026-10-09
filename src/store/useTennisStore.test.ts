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
    // 1st serve NET / LET
    useTennisStore.setState({ faultCount: 0 });
    useTennisStore.getState().recordLet();
    let state = useTennisStore.getState();
    expect(state.lastCall).toContain('NET');
    expect(state.lastCall).toContain('1º SERVICIO');
    expect(state.faultCount).toBe(0);

    // 2nd serve NET / LET: repeats 2nd serve without losing point
    useTennisStore.setState({ faultCount: 1 });
    useTennisStore.getState().recordLet();
    state = useTennisStore.getState();
    expect(state.lastCall).toContain('NET');
    expect(state.lastCall).toContain('2º SERVICIO');
    expect(state.faultCount).toBe(1);
  });

  it('records net fault (ball touches net and lands out) correctly', () => {
    // 1st serve touches net and lands out -> advances to 2nd serve
    useTennisStore.setState({ faultCount: 0 });
    useTennisStore.getState().recordFault(true);
    let state = useTennisStore.getState();
    expect(state.faultCount).toBe(1);
    expect(state.lastCall).toContain('RED Y FUERA');
    expect(state.lastCall).toContain('2º SERVICIO');

    // 2nd serve touches net and lands out -> double fault, receiver wins point
    useTennisStore.getState().recordFault(true);
    state = useTennisStore.getState();
    expect(state.faultCount).toBe(0);
    expect(state.p2Points).toBe(1);
    expect(state.lastCall).toContain('RED Y FUERA');
    expect(state.lastCall).toContain('DOBLE FALTA');
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

  it('tracks shot speed in kmh, mph, and updates max serve records', () => {
    useTennisStore.setState({ maxServeSpeedP1: 0, maxServeSpeedCpu: 0 });

    // Normal rally shot (not a serve)
    useTennisStore.getState().recordShotSpeed(140, 'DRIVE POTENTE', 'p1', false);
    let state = useTennisStore.getState();
    expect(state.lastSpeedKmh).toBe(140);
    expect(state.lastSpeedMph).toBe(87); // Math.round(140 * 0.621371)
    expect(state.lastSpeedLabel).toBe('DRIVE POTENTE');
    expect(state.lastSpeedHitter).toBe('p1');
    expect(state.maxServeSpeedP1).toBe(0); // Not a serve

    // P1 Serve shot
    useTennisStore.getState().recordShotSpeed(205, '1º SAQUE PLANO', 'p1', true);
    state = useTennisStore.getState();
    expect(state.lastSpeedKmh).toBe(205);
    expect(state.maxServeSpeedP1).toBe(205);

    // CPU Serve shot
    useTennisStore.getState().recordShotSpeed(195, '1º SAQUE CPU', 'cpu', true);
    state = useTennisStore.getState();
    expect(state.maxServeSpeedCpu).toBe(195);
  });

  it('records Hawk-Eye bounce locations and distance to line', () => {
    useTennisStore.getState().recordBounceLocation(3.95, -11.5, true, 8, 12345);
    const state = useTennisStore.getState();
    expect(state.lastBouncePos).toEqual([3.95, -11.5]);
    expect(state.lastBounceInBounds).toBe(true);
    expect(state.lastBounceDistanceCm).toBe(8);
    expect(state.lastBounceTime).toBe(12345);
  });

  it('triggers P1 and CPU swing triggers with shot type', () => {
    useTennisStore.setState({ p1SwingTrigger: 0, cpuSwingTrigger: 0 });

    useTennisStore.getState().triggerP1Swing('lob');
    let state = useTennisStore.getState();
    expect(state.p1SwingTrigger).toBe(1);
    expect(state.p1ShotType).toBe('lob');

    useTennisStore.getState().triggerCpuSwing('smash');
    state = useTennisStore.getState();
    expect(state.cpuSwingTrigger).toBe(1);
    expect(state.cpuShotType).toBe('smash');
  });

  it('resets serve state and coordinates on resetServe and resetPoint', () => {
    useTennisStore.setState({
      matchStatus: 'point_over',
      lastHitter: 'p1',
      lastCall: 'PUNTO',
      rallyCount: 5,
    });

    useTennisStore.getState().resetServe();
    let state = useTennisStore.getState();
    expect(state.matchStatus).toBe('serve_prep');
    expect(state.lastHitter).toBeNull();
    expect(state.lastCall).toBeNull();

    useTennisStore.getState().resetPoint();
    state = useTennisStore.getState();
    expect(state.rallyCount).toBe(0);
  });

  it('updates player positions via setP1Pos and setCpuPos', () => {
    useTennisStore.getState().setP1Pos([1.5, 0, 11.0]);
    useTennisStore.getState().setCpuPos([-1.5, 0, -11.0]);

    const state = useTennisStore.getState();
    expect(state.p1Pos).toEqual([1.5, 0, 11.0]);
    expect(state.cpuPos).toEqual([-1.5, 0, -11.0]);
  });

  it('manages audio mute and volume controls in store', () => {
    useTennisStore.setState({ isMuted: false, volume: 0.8 });

    useTennisStore.getState().toggleMute();
    expect(useTennisStore.getState().isMuted).toBe(true);

    useTennisStore.getState().toggleMute();
    expect(useTennisStore.getState().isMuted).toBe(false);

    useTennisStore.getState().setVolume(0.4);
    expect(useTennisStore.getState().volume).toBe(0.4);
  });

  it('manages difficulty, pause state, and tournament menu open/close', () => {
    expect(useTennisStore.getState().difficulty).toBe('pro');
    expect(useTennisStore.getState().isMenuOpen).toBe(true);
    expect(useTennisStore.getState().isPaused).toBe(true);

    useTennisStore.getState().setDifficulty('legend');
    expect(useTennisStore.getState().difficulty).toBe('legend');

    useTennisStore.getState().setDifficulty('amateur');
    expect(useTennisStore.getState().difficulty).toBe('amateur');

    // Opening menu also automatically pauses gameplay
    useTennisStore.getState().setMenuOpen(true);
    expect(useTennisStore.getState().isMenuOpen).toBe(true);
    expect(useTennisStore.getState().isPaused).toBe(true);

    useTennisStore.getState().setMenuOpen(false);
    expect(useTennisStore.getState().isMenuOpen).toBe(false);
    expect(useTennisStore.getState().isPaused).toBe(false);

    useTennisStore.getState().setPaused(true);
    expect(useTennisStore.getState().isPaused).toBe(true);
  });

  it('fully resets match state via resetMatch', () => {
    useTennisStore.setState({
      p1Points: 3,
      p2Points: 2,
      p1Games: 5,
      p2Games: 4,
      p1Sets: 1,
      p2Sets: 1,
      p1Aces: 4,
      p2Aces: 3,
      matchStatus: 'game_over',
      rallyCount: 12,
      isMenuOpen: true,
      isPaused: true,
      maxServeSpeedP1: 215,
      maxServeSpeedCpu: 208,
    });

    useTennisStore.getState().resetMatch();

    const state = useTennisStore.getState();
    expect(state.p1Points).toBe(0);
    expect(state.p2Points).toBe(0);
    expect(state.p1Games).toBe(0);
    expect(state.p2Games).toBe(0);
    expect(state.p1Sets).toBe(0);
    expect(state.p2Sets).toBe(0);
    expect(state.p1Aces).toBe(0);
    expect(state.p2Aces).toBe(0);
    expect(state.rallyCount).toBe(0);
    expect(state.matchStatus).toBe('serve_prep');
    expect(state.isMenuOpen).toBe(false);
    expect(state.isPaused).toBe(false);
    expect(state.maxServeSpeedP1).toBe(0);
    expect(state.maxServeSpeedCpu).toBe(0);
  });
});
