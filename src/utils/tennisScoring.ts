/**
 * Tennis scoring rules and in-bounds court boundary detection.
 * Regulation singles dimensions:
 * - Net at Z = 0
 * - Singles sidelines: X = ±4.115m
 * - Baselines: Z = ±11.89m
 * - Service lines: Z = ±6.40m
 * - Center service line: X = 0
 */

export interface CourtBoundsCheck {
  x: number;
  z: number;
  isServe: boolean;
  serveSide: 'deuce' | 'ad';
  hitter: 'p1' | 'cpu';
}

export interface BounceEvaluation {
  isInBounds: boolean;
  isFault: boolean;
  callMessage: string;
}

export const COURT_LIMITS = {
  SINGLES_WIDTH: 4.115,
  BASELINE_DEPTH: 11.89,
  SERVICE_DEPTH: 6.40,
};

/**
 * Checks if a ball bounce is legally in-bounds according to tennis rules
 */
export function evaluateBounce({
  x,
  z,
  isServe,
  serveSide,
  hitter,
}: CourtBoundsCheck): BounceEvaluation {
  const { SINGLES_WIDTH, BASELINE_DEPTH, SERVICE_DEPTH } = COURT_LIMITS;

  // Margin of line thickness (tennis balls touching the line are in)
  const LINE_TOLERANCE = 0.08;

  if (isServe) {
    // For serve:
    // If P1 serves from deuce side (right), target is CPU deuce box: X in [-SINGLES_WIDTH, 0], Z in [-SERVICE_DEPTH, 0]
    // If P1 serves from ad side (left), target is CPU ad box: X in [0, SINGLES_WIDTH], Z in [-SERVICE_DEPTH, 0]
    if (hitter === 'p1') {
      const inDepth = z >= -SERVICE_DEPTH - LINE_TOLERANCE && z <= 0;
      let inWidth = false;

      if (serveSide === 'deuce') {
        inWidth = x >= -SINGLES_WIDTH - LINE_TOLERANCE && x <= LINE_TOLERANCE;
      } else {
        inWidth = x >= -LINE_TOLERANCE && x <= SINGLES_WIDTH + LINE_TOLERANCE;
      }

      if (inDepth && inWidth) {
        return { isInBounds: true, isFault: false, callMessage: '¡BUEN SAQUE!' };
      } else {
        return { isInBounds: false, isFault: true, callMessage: '¡FALTA DE SAQUE!' };
      }
    }
  }

  // Regular rally bounce evaluation:
  // Must land on opponent's half
  if (hitter === 'p1') {
    // P1 hit the ball, must land on CPU side (Z < 0)
    const onOpponentSide = z <= 0 && z >= -BASELINE_DEPTH - LINE_TOLERANCE;
    const withinWidth = Math.abs(x) <= SINGLES_WIDTH + LINE_TOLERANCE;

    if (onOpponentSide && withinWidth) {
      return { isInBounds: true, isFault: false, callMessage: 'DENTRO' };
    } else {
      return { isInBounds: false, isFault: false, callMessage: '¡FUERA!' };
    }
  } else {
    // CPU hit the ball, must land on P1 side (Z > 0)
    const onPlayerSide = z >= 0 && z <= BASELINE_DEPTH + LINE_TOLERANCE;
    const withinWidth = Math.abs(x) <= SINGLES_WIDTH + LINE_TOLERANCE;

    if (onPlayerSide && withinWidth) {
      return { isInBounds: true, isFault: false, callMessage: 'DENTRO' };
    } else {
      return { isInBounds: false, isFault: false, callMessage: '¡FUERA!' };
    }
  }
}

export interface ScoreStatePoints {
  p1Points: number;
  p2Points: number;
  p1Games: number;
  p2Games: number;
}

export interface PointAwardResult {
  p1Points: number;
  p2Points: number;
  p1Games: number;
  p2Games: number;
  gameWon: 'p1' | 'cpu' | null;
  announcement: string;
}

/**
 * Updates tennis score following standard 15, 30, 40, Deuce, Advantage, Game progression
 */
export function calculatePointProgression(
  current: ScoreStatePoints,
  winner: 'p1' | 'cpu'
): PointAwardResult {
  let { p1Points, p2Points, p1Games, p2Games } = current;

  const isP1 = winner === 'p1';

  if (isP1) {
    if (p1Points < 3) {
      p1Points += 1;
      return {
        p1Points,
        p2Points,
        p1Games,
        p2Games,
        gameWon: null,
        announcement: '¡PUNTO JUGADOR 1!',
      };
    }

    // P1 is at 40 (index 3)
    if (p2Points < 3) {
      // P1 wins game!
      p1Games += 1;
      return {
        p1Points: 0,
        p2Points: 0,
        p1Games,
        p2Games,
        gameWon: 'p1',
        announcement: '¡JUEGO PARA EL JUGADOR 1!',
      };
    }

    // Both at 40 (Deuce)
    if (p1Points === 3 && p2Points === 3) {
      p1Points = 4; // Advantage P1
      return {
        p1Points,
        p2Points,
        p1Games,
        p2Games,
        gameWon: null,
        announcement: '¡VENTAJA JUGADOR 1!',
      };
    }

    if (p2Points === 4) {
      // P2 had advantage, back to Deuce
      p2Points = 3;
      return {
        p1Points: 3,
        p2Points: 3,
        p1Games,
        p2Games,
        gameWon: null,
        announcement: '¡IGUALES (DEUCE)!',
      };
    }

    if (p1Points === 4) {
      // P1 had advantage and wins game!
      p1Games += 1;
      return {
        p1Points: 0,
        p2Points: 0,
        p1Games,
        p2Games,
        gameWon: 'p1',
        announcement: '¡JUEGO PARA EL JUGADOR 1!',
      };
    }
  } else {
    // CPU won point
    if (p2Points < 3) {
      p2Points += 1;
      return {
        p1Points,
        p2Points,
        p1Games,
        p2Games,
        gameWon: null,
        announcement: '¡PUNTO CPU!',
      };
    }

    // CPU is at 40
    if (p1Points < 3) {
      p2Games += 1;
      return {
        p1Points: 0,
        p2Points: 0,
        p1Games,
        p2Games,
        gameWon: 'cpu',
        announcement: '¡JUEGO PARA LA CPU!',
      };
    }

    if (p1Points === 3 && p2Points === 3) {
      p2Points = 4; // Advantage CPU
      return {
        p1Points,
        p2Points,
        p1Games,
        p2Games,
        gameWon: null,
        announcement: '¡VENTAJA CPU!',
      };
    }

    if (p1Points === 4) {
      p1Points = 3; // Back to Deuce
      return {
        p1Points: 3,
        p2Points: 3,
        p1Games,
        p2Games,
        gameWon: null,
        announcement: '¡IGUALES (DEUCE)!',
      };
    }

    if (p2Points === 4) {
      p2Games += 1;
      return {
        p1Points: 0,
        p2Points: 0,
        p1Games,
        p2Games,
        gameWon: 'cpu',
        announcement: '¡JUEGO PARA LA CPU!',
      };
    }
  }

  return {
    p1Points,
    p2Points,
    p1Games,
    p2Games,
    gameWon: null,
    announcement: isP1 ? '¡PUNTO JUGADOR 1!' : '¡PUNTO CPU!',
  };
}
