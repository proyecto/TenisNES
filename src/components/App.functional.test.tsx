import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, act, fireEvent } from '@testing-library/react';
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
      isMuted: false,
      difficulty: 'pro',
      isMenuOpen: true,
      isPaused: true,
    });
  });

  it('renders 3D Tennis Scene and Wimbledon TV Broadcast HUD', () => {
    render(<App />);

    // 3D Scene canvas container
    expect(screen.getByTestId('tennis-scene-canvas')).toBeInTheDocument();

    // Wimbledon TV Scorebug header
    expect(screen.getAllByText(/THE CHAMPIONSHIPS • WIMBLEDON/i).length).toBeGreaterThanOrEqual(1);
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

  it('updates match duration timer every second when match is active', () => {
    render(<App />);

    // Unpause / start match so stopwatch runs
    act(() => {
      useTennisStore.getState().setMenuOpen(false);
    });

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

  it('toggles audio mute when audio button is clicked', () => {
    render(<App />);

    const audioBtn = screen.getByTestId('audio-toggle-btn');
    expect(audioBtn).toHaveTextContent('AUDIO');
    expect(useTennisStore.getState().isMuted).toBe(false);

    act(() => {
      fireEvent.click(audioBtn);
    });

    expect(audioBtn).toHaveTextContent('MUTED');
    expect(useTennisStore.getState().isMuted).toBe(true);

    act(() => {
      fireEvent.click(audioBtn);
    });

    expect(audioBtn).toHaveTextContent('AUDIO');
    expect(useTennisStore.getState().isMuted).toBe(false);
  });

  it('toggles audio mute when pressing M key', () => {
    render(<App />);

    expect(useTennisStore.getState().isMuted).toBe(false);

    act(() => {
      fireEvent.keyDown(window, { key: 'm' });
    });

    expect(useTennisStore.getState().isMuted).toBe(true);

    act(() => {
      fireEvent.keyDown(window, { key: 'M' });
    });

    expect(useTennisStore.getState().isMuted).toBe(false);
  });

  it('opens Game Menu initially on page load/reload and allows closing/opening via HUD button and Escape key', () => {
    render(<App />);

    // Menu MUST be rendered initially on page reload/mount
    expect(screen.getByTestId('game-menu-overlay')).toBeInTheDocument();
    expect(screen.getByText(/MENÚ DE PARTIDO & CONFIGURACIÓN/i)).toBeInTheDocument();
    expect(screen.getByText(/EMPEZAR PARTIDO/i)).toBeInTheDocument();
    expect(useTennisStore.getState().isMenuOpen).toBe(true);
    expect(useTennisStore.getState().isPaused).toBe(true);

    // Clicking "Empezar Partido" closes the menu and resumes play
    const resumeBtn = screen.getByTestId('resume-match-btn');
    act(() => {
      fireEvent.click(resumeBtn);
    });
    expect(screen.queryByTestId('game-menu-overlay')).not.toBeInTheDocument();
    expect(useTennisStore.getState().isMenuOpen).toBe(false);

    // Click on HUD Menu button opens it again
    const menuBtn = screen.getByTestId('menu-toggle-btn');
    act(() => {
      fireEvent.click(menuBtn);
    });
    expect(screen.getByTestId('game-menu-overlay')).toBeInTheDocument();

    // Pressing 'Escape' closes the menu
    act(() => {
      fireEvent.keyDown(window, { key: 'Escape' });
    });
    expect(screen.queryByTestId('game-menu-overlay')).not.toBeInTheDocument();

    // Pressing 'Escape' opens the menu again
    act(() => {
      fireEvent.keyDown(window, { key: 'Escape' });
    });
    expect(screen.getByTestId('game-menu-overlay')).toBeInTheDocument();
  });

  it('allows changing CPU difficulty in Game Menu', () => {
    render(<App />);

    // Open menu
    act(() => {
      useTennisStore.getState().setMenuOpen(true);
    });

    expect(screen.getByTestId('game-menu-overlay')).toBeInTheDocument();
    expect(useTennisStore.getState().difficulty).toBe('pro');

    // Select amateur
    const amateurBtn = screen.getByTestId('difficulty-amateur');
    act(() => {
      fireEvent.click(amateurBtn);
    });
    expect(useTennisStore.getState().difficulty).toBe('amateur');

    // Select legend
    const legendBtn = screen.getByTestId('difficulty-legend');
    act(() => {
      fireEvent.click(legendBtn);
    });
    expect(useTennisStore.getState().difficulty).toBe('legend');
  });

  it('restarts match from Game Menu button', () => {
    render(<App />);

    // Simulate mid-game score
    act(() => {
      useTennisStore.setState({
        p1Points: 3,
        p2Points: 2,
        rallyCount: 5,
        isMenuOpen: true,
      });
    });

    const restartBtn = screen.getByTestId('restart-match-btn');
    act(() => {
      fireEvent.click(restartBtn);
    });

    // Score and rally should be reset to 0, menu closed
    expect(useTennisStore.getState().p1Points).toBe(0);
    expect(useTennisStore.getState().p2Points).toBe(0);
    expect(useTennisStore.getState().rallyCount).toBe(0);
    expect(useTennisStore.getState().isMenuOpen).toBe(false);
  });

  it('renders MatchFinishOverlay with Winner and SlamTracker stats when match is over', () => {
    render(<App />);

    // P1 wins 2 sets to 0 with aces and serve speeds
    act(() => {
      useTennisStore.setState({
        matchStatus: 'game_over',
        p1Sets: 2,
        p2Sets: 0,
        p1Games: 6,
        p2Games: 3,
        p1Aces: 5,
        p2Aces: 2,
        maxServeSpeedP1: 218,
        maxServeSpeedCpu: 204,
      });
    });

    // Check finish overlay and winner
    expect(screen.getByTestId('match-finish-overlay')).toBeInTheDocument();
    const winnerTitle = screen.getByTestId('winner-title');
    expect(winnerTitle).toHaveTextContent(/R\. NADAL \(ESP\) CAMPEÓN!/i);

    // Verify stats
    expect(screen.getByText(/ESTADÍSTICAS OFICIALES SLAMTRACKER/i)).toBeInTheDocument();
    expect(screen.getByText('218 km/h')).toBeInTheDocument();
    expect(screen.getByText('204 km/h')).toBeInTheDocument();

    // Click "Jugar nuevo partido" resets the match
    const newMatchBtn = screen.getByTestId('new-match-btn');
    act(() => {
      fireEvent.click(newMatchBtn);
    });

    expect(useTennisStore.getState().matchStatus).toBe('serve_prep');
    expect(screen.queryByTestId('match-finish-overlay')).not.toBeInTheDocument();
  });
});
