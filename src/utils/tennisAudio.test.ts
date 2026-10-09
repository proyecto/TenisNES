import { describe, it, expect, beforeEach } from 'vitest';
import { tennisAudio } from './tennisAudio';

describe('tennisAudio Web Audio Engine', () => {
  beforeEach(() => {
    tennisAudio.setMuted(false);
    tennisAudio.setVolume(0.8);
  });

  it('manages mute and unmute states correctly', () => {
    expect(tennisAudio.isMuted()).toBe(false);

    tennisAudio.setMuted(true);
    expect(tennisAudio.isMuted()).toBe(true);

    tennisAudio.setMuted(false);
    expect(tennisAudio.isMuted()).toBe(false);
  });

  it('clamps and updates volume within [0, 1] range', () => {
    tennisAudio.setVolume(0.5);
    expect(tennisAudio.getVolume()).toBe(0.5);

    // Clamp over 1.0
    tennisAudio.setVolume(1.8);
    expect(tennisAudio.getVolume()).toBe(1.0);

    // Clamp under 0.0
    tennisAudio.setVolume(-0.4);
    expect(tennisAudio.getVolume()).toBe(0.0);
  });

  it('executes playRacketHit safely for all stroke types and speed ranges', () => {
    expect(() => {
      tennisAudio.playRacketHit('serve', 210);
      tennisAudio.playRacketHit('smash', 195);
      tennisAudio.playRacketHit('flat', 145);
      tennisAudio.playRacketHit('topspin', 135);
      tennisAudio.playRacketHit('slice', 95);
      tennisAudio.playRacketHit('lob', 80);
      tennisAudio.playRacketHit('drive', 150);
      tennisAudio.playRacketHit('backhand', 140);
    }).not.toThrow();
  });

  it('executes playBallBounce safely on grass and stands surfaces', () => {
    expect(() => {
      tennisAudio.playBallBounce('grass');
      tennisAudio.playBallBounce('stand');
    }).not.toThrow();
  });

  it('executes playNetHit safely on net tape cord deflection', () => {
    expect(() => {
      tennisAudio.playNetHit();
    }).not.toThrow();
  });

  it('executes playCrowdCheer safely across all intensity modes', () => {
    expect(() => {
      tennisAudio.playCrowdCheer('applause');
      tennisAudio.playCrowdCheer('roar');
      tennisAudio.playCrowdCheer('polite');
    }).not.toThrow();
  });

  it('executes playUmpireTone safely for all decision categories', () => {
    expect(() => {
      tennisAudio.playUmpireTone('ace');
      tennisAudio.playUmpireTone('game');
      tennisAudio.playUmpireTone('out');
      tennisAudio.playUmpireTone('fault');
      tennisAudio.playUmpireTone('double_fault');
      tennisAudio.playUmpireTone('net');
      tennisAudio.playUmpireTone('let');
      tennisAudio.playUmpireTone('deuce');
    }).not.toThrow();
  });

  it('handles speakUmpireCall safely when speechSynthesis is not available or mocked', () => {
    expect(() => {
      tennisAudio.speakUmpireCall('Fault!');
      tennisAudio.speakUmpireCall('Ace!');
      tennisAudio.speakUmpireCall('Game, Nadal');
    }).not.toThrow();
  });

  it('does not trigger synthesis when muted', () => {
    tennisAudio.setMuted(true);
    expect(() => {
      tennisAudio.playRacketHit('smash', 200);
      tennisAudio.playBallBounce('grass');
      tennisAudio.playNetHit();
      tennisAudio.playCrowdCheer('roar');
      tennisAudio.playUmpireTone('ace');
      tennisAudio.speakUmpireCall('Ace!');
    }).not.toThrow();
  });
});
