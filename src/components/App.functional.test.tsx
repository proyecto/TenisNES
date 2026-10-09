import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { App } from '../App';
import { useTennisStore } from '../store/useTennisStore';

// Mock 3D Canvas Scene so jsdom can render UI without WebGL context
vi.mock('./TennisScene', () => ({
  TennisScene: () => <div data-testid="tennis-scene-canvas" />,
}));

describe('App Functional & Integration Tests', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    useTennisStore.setState({
      p1Points: 0,
      p2Points: 0,
      p1Games: 0,
      p2Games: 0,
      p1Sets: 0,
      p2Sets: 0,
      p1Aces: 0,
      p2Aces: 0,
      server: 'p1',
      serveSide: 'deuce',
      faultCount: 0,
      rallyCount: 0,
      matchStatus: 'serve_prep',
      lastHitter: null,
      lastCall: null,
      lastSpeedKmh: 0,
      lastSpeedMph: 0,
      lastSpeedLabel: '',
      lastSpeedHitter: null,
      maxServeSpeedP1: 0,
      maxServeSpeedCpu: 0,
      lastBouncePos: null,
      lastBounceInBounds: null,
      lastBounceDistanceCm: null,
      lastBounceTime: 0,
    });
  });

  it('renders 3D Tennis Scene and Wimbledon TV Broadcast HUD', () => {
    render(<App />);

    // 3D Scene canvas container
    expect(screen.getByTestId('tennis-scene-canvas')).toBeInTheDocument();

    // Wimbledon TV Scorebug header
    expect(screen.getByText(/THE CHAMPIONSHIPS • WIMBLEDON/i)).toBeInTheDocument();
    expect(screen.getByText(/R\. NADAL/i)).toBeInTheDocument();
    expect(screen.getByText(/A\. MURRAY/i)).toBeInTheDocument();

    // Radar SlamTracker
    expect(screen.getByText(/RADAR SLAMTRACKER/i)).toBeInTheDocument();

    // Controls and Status HUD
    expect(screen.getByText(/1º SERVICIO P1/i)).toBeInTheDocument();
    expect(screen.getByText(/rematar Smash/i)).toBeInTheDocument();
  });

  it('displays real-time tennis score progression functionally', () => {
    render(<App />);

    // Initial 00 - 00
    expect(screen.getAllByText('00').length).toBeGreaterThanOrEqual(2);

    // Update store to 15 - 00
    act(() => {
      useTennisStore.setState({ p1Points: 1, p2Points: 0 });
    });
    expect(screen.getByText('15')).toBeInTheDocument();

    // Update store to 30 - 15
    act(() => {
      useTennisStore.setState({ p1Points: 2, p2Points: 1 });
    });
    expect(screen.getByText('30')).toBeInTheDocument();
    expect(screen.getByText('15')).toBeInTheDocument();

    // Update store to 40 - 40 (Deuce)
    act(() => {
      useTennisStore.setState({ p1Points: 3, p2Points: 3 });
    });
    expect(screen.getAllByText('40').length).toBeGreaterThanOrEqual(2);
    // Deuce badge must appear
    expect(screen.getByText('DEUCE')).toBeInTheDocument();

    // Advantage P1
    act(() => {
      useTennisStore.setState({ p1Points: 4, p2Points: 3 });
    });
    expect(screen.getByText('AD')).toBeInTheDocument();
  });

  it('displays break point indicator when receiver has game point', () => {
    render(<App />);

    // Server is P1, but CPU has 40 and P1 has 30 -> Break Point!
    act(() => {
      useTennisStore.setState({
        server: 'p1',
        p1Points: 2, // 30
        p2Points: 3, // 40
      });
    });

    expect(screen.getByText('PUNTO DE BREAK')).toBeInTheDocument();
  });

  it('updates Radar SlamTracker with speed in km/h, mph, and shot label', () => {
    render(<App />);

    act(() => {
      useTennisStore.getState().recordShotSpeed(198, '¡SAQUE AS CAÑÓN!', 'p1', true);
    });

    expect(screen.getByText('198')).toBeInTheDocument();
    expect(screen.getByText('KM/H')).toBeInTheDocument();
    expect(screen.getByText('123 MPH')).toBeInTheDocument();
    expect(screen.getByText('¡SAQUE AS CAÑÓN!')).toBeInTheDocument();
  });

  it('displays Hawk-Eye replay ribbon on close boundary bounces', () => {
    render(<App />);

    // In-bounds ball touching line by 4 cm
    act(() => {
      useTennisStore.getState().recordBounceLocation(4.08, -10.5, true, 4, 100);
    });

    expect(screen.getByText(/HAWK-EYE • OJO DE HALCÓN/i)).toBeInTheDocument();
    expect(screen.getByText('IN')).toBeInTheDocument();
    expect(screen.getByText(/En línea: a 4 cm/i)).toBeInTheDocument();

    // Out ball by 12 cm
    act(() => {
      useTennisStore.getState().recordBounceLocation(4.24, -10.5, false, 12, 105);
    });
    expect(screen.getByText('OUT')).toBeInTheDocument();
    expect(screen.getByText(/Fuera: por 12 cm/i)).toBeInTheDocument();
  });

  it('displays umpire decision announcement banner and auto-dismisses it after timeout', () => {
    render(<App />);

    act(() => {
      useTennisStore.getState().setLastCall('⚡ ¡ACE! SAQUE DIRECTO JUGADOR 1', '#fbbf24');
    });

    expect(screen.getByText('DECISIÓN DEL JUEZ ÁRBITRO')).toBeInTheDocument();
    expect(screen.getByText('⚡ ¡ACE! SAQUE DIRECTO JUGADOR 1')).toBeInTheDocument();

    // Advance 2.3 seconds
    act(() => {
      vi.advanceTimersByTime(2300);
    });

    expect(screen.queryByText('DECISIÓN DEL JUEZ ÁRBITRO')).not.toBeInTheDocument();
  });

  it('updates match duration timer every second', () => {
    render(<App />);

    expect(screen.getByText(/00:00/)).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(65000); // 1 min 5 sec
    });

    expect(screen.getByText(/01:05/)).toBeInTheDocument();
  });

  it('displays 2nd serve badge when faultCount is 1', () => {
    render(<App />);

    act(() => {
      useTennisStore.setState({
        faultCount: 1,
      });
    });

    expect(screen.getByText('2º SERVICIO')).toBeInTheDocument();
  });

  it('displays net/let replay notification in HUD during point_over', () => {
    render(<App />);

    act(() => {
      useTennisStore.setState({
        matchStatus: 'point_over',
        lastCall: '⚠️ ¡NET! REPETICIÓN DEL SAQUE',
        faultCount: 0,
      });
    });

    expect(screen.getByText('¡NET!')).toBeInTheDocument();
    expect(screen.getByText(/se repite el 1º servicio/i)).toBeInTheDocument();
  });

  it('displays game over badge when match status is game_over', () => {
    render(<App />);

    act(() => {
      useTennisStore.setState({
        matchStatus: 'game_over',
      });
    });

    expect(screen.getByText('PARTIDO FINALIZADO')).toBeInTheDocument();
    expect(screen.getByText('¡Fin del partido!')).toBeInTheDocument();
  });
});
