/**
 * @file tennisScoring.ts
 * @description Official International Tennis Federation (ITF) scoring engine and court geometry bounds.
 *
 * ## ITF Regulation Singles Geometry:
 * - Court Length: 23.77m (Baselines at Z = ±11.885m / rounded ±11.89m)
 * - Singles Width: 8.23m (Sidelines at X = ±4.115m)
 * - Service Line: 6.40m from net (Z = ±6.40m)
 * - Center Service Line: X = 0 (divides deuce and ad service boxes)
 * - Net: Located at Z = 0 with height 0.914m at center and 1.07m at posts.
 *
 * ## Serving & Scoring Rules:
 * - Server alternates after each completed game.
 * - Every new game starts with a serve from the DEUCE court (right of center mark).
 * - Within a game, serve side alternates every point (even score points = Deuce, odd = Ad).
 * - A serve must bounce diagonally within the opponent's correct service box before being struck.
 * - Let (ITF Rule 22): If a serve clips the net tape and lands legally in the target box, it is replayed.
 */

/**
 * Parameters for court boundary check.
 */
export interface CourtBoundsCheck {
  /** X coordinate of bounce in meters */
  x: number;
  /** Z coordinate of bounce in meters */
  z: number;
  /** True if the stroke was an initial serve */
  isServe: boolean;
  /** Current court side for the serve ('deuce' or 'ad') */
  serveSide: 'deuce' | 'ad';
  /** Player who hit the ball ('p1' or 'cpu') */
  hitter: 'p1' | 'cpu';
}

/**
 * Result of bounce evaluation against court geometry and active game rules.
 */
export interface BounceEvaluation {
  /** True if the ball landed inside legal boundaries */
  isInBounds: boolean;
  /** True if the bounce constitutes a serve fault */
  isFault: boolean;
  /** Official umpire message corresponding to the bounce */
  callMessage: string;
}

/**
 * Official ITF court geometric limits (in meters).
 */
export const COURT_LIMITS = {
  /** Half-width of singles court (meters from center line) */
  SINGLES_WIDTH: 4.115,
  /** Distance from net to baseline (meters) */
  BASELINE_DEPTH: 11.89,
  /** Distance from net to service line (meters) */
  SERVICE_DEPTH: 6.40,
};

/**
 * Checks if a ball bounce is legally in-bounds according to ITF tennis rules.
 * Handles both P1 serves and CPU serves diagonally.
 */
export function evaluateBounce({
  x,
  z,
  isServe,
  serveSide,
  hitter,
}: CourtBoundsCheck): BounceEvaluation {
  const { SINGLES_WIDTH, BASELINE_DEPTH, SERVICE_DEPTH } = COURT_LIMITS;
  const LINE_TOLERANCE = 0.08; // Tennis balls touching the line are in

  if (isServe) {
    if (hitter === 'p1') {
      // P1 serves from baseline Z > 0 towards CPU side (Z < 0)
      const inDepth = z >= -SERVICE_DEPTH - LINE_TOLERANCE && z <= LINE_TOLERANCE;
      let inWidth = false;

      if (serveSide === 'deuce') {
        // P1 on right serves to CPU's left service box [-4.115, 0]
        inWidth = x >= -SINGLES_WIDTH - LINE_TOLERANCE && x <= LINE_TOLERANCE;
      } else {
        // P1 on left serves to CPU's right service box [0, 4.115]
        inWidth = x >= -LINE_TOLERANCE && x <= SINGLES_WIDTH + LINE_TOLERANCE;
      }

      if (inDepth && inWidth) {
        return { isInBounds: true, isFault: false, callMessage: '¡BUEN SAQUE!' };
      } else {
        return { isInBounds: false, isFault: true, callMessage: '¡FALTA DE SAQUE!' };
      }
    } else {
      // CPU serves from baseline Z < 0 towards P1 side (Z > 0)
      const inDepth = z >= -LINE_TOLERANCE && z <= SERVICE_DEPTH + LINE_TOLERANCE;
      let inWidth = false;

      if (serveSide === 'deuce') {
        // CPU on its right (X < 0) serves to P1's deuce service box [0, 4.115]
        inWidth = x >= -LINE_TOLERANCE && x <= SINGLES_WIDTH + LINE_TOLERANCE;
      } else {
        // CPU on its left (X > 0) serves to P1's ad service box [-4.115, 0]
        inWidth = x >= -SINGLES_WIDTH - LINE_TOLERANCE && x <= LINE_TOLERANCE;
      }

      if (inDepth && inWidth) {
        return { isInBounds: true, isFault: false, callMessage: '¡BUEN SAQUE!' };
      } else {
        return { isInBounds: false, isFault: true, callMessage: '¡FALTA DE SAQUE!' };
      }
    }
  }

  // Regular rally bounce evaluation:
  // Must land on opponent's half within the singles lines
  if (hitter === 'p1') {
    // P1 hit the ball -> must land on CPU side (Z <= 0)
    const onOpponentSide = z <= LINE_TOLERANCE && z >= -BASELINE_DEPTH - LINE_TOLERANCE;
    const withinWidth = Math.abs(x) <= SINGLES_WIDTH + LINE_TOLERANCE;

    if (onOpponentSide && withinWidth) {
      return { isInBounds: true, isFault: false, callMessage: 'DENTRO' };
    } else {
      return { isInBounds: false, isFault: false, callMessage: '¡FUERA!' };
    }
  } else {
    // CPU hit the ball -> must land on P1 side (Z >= 0)
    const onPlayerSide = z >= -LINE_TOLERANCE && z <= BASELINE_DEPTH + LINE_TOLERANCE;
    const withinWidth = Math.abs(x) <= SINGLES_WIDTH + LINE_TOLERANCE;

    if (onPlayerSide && withinWidth) {
      return { isInBounds: true, isFault: false, callMessage: 'DENTRO' };
    } else {
      return { isInBounds: false, isFault: false, callMessage: '¡FUERA!' };
    }
  }
}

/**
 * Input state for point calculation containing current scores.
 */
export interface ScoreStatePoints {
  /** P1 points index (0: 0, 1: 15, 2: 30, 3: 40, 4: Ad) */
  p1Points: number;
  /** P2 / CPU points index (0: 0, 1: 15, 2: 30, 3: 40, 4: Ad) */
  p2Points: number;
  /** P1 games won in current set */
  p1Games: number;
  /** P2 games won in current set */
  p2Games: number;
  /** P1 sets won */
  p1Sets?: number;
  /** P2 sets won */
  p2Sets?: number;
  /** Current serving player */
  server?: 'p1' | 'cpu';
}

/**
 * Result of scoring a point, including updated game/set counters and server alternation.
 */
export interface PointAwardResult {
  /** Updated P1 points index */
  p1Points: number;
  /** Updated P2 points index */
  p2Points: number;
  /** Updated P1 games won */
  p1Games: number;
  /** Updated P2 games won */
  p2Games: number;
  /** Updated P1 sets won */
  p1Sets: number;
  /** Updated P2 sets won */
  p2Sets: number;
  /** Winner of the game if a game concluded, otherwise null */
  gameWon: 'p1' | 'cpu' | null;
  /** Winner of the set if a set concluded, otherwise null */
  setWon: 'p1' | 'cpu' | null;
  /** Winner of the match if a match concluded, otherwise null */
  matchWon: 'p1' | 'cpu' | null;
  /** Serving player for the next point / game */
  nextServer: 'p1' | 'cpu';
  /** Official tournament announcement string */
  announcement: string;
}

/**
 * Calculates official tennis score progression (Points 15-30-40-Deuce-Ad, Games, Sets, Server Alternation).
 *
 * Implements standard ITF rules:
 * - Advantage / Deuce logic when score reaches 40-40.
 * - Game progression and reset upon 2-point lead.
 * - Set progression with standard margin of 2 games, or 7-5 / 7-6 tiebreaks.
 * - Server switching on every completed game.
 *
 * @param current Current scoring state.
 * @param winner The player who won the point ('p1' or 'cpu').
 * @returns Resulting points, games, sets, winners, next server, and announcement.
 */
export function calculatePointProgression(
  current: ScoreStatePoints,
  winner: 'p1' | 'cpu'
): PointAwardResult {
  let { p1Points, p2Points, p1Games, p2Games } = current;
  let p1Sets = current.p1Sets || 0;
  let p2Sets = current.p2Sets || 0;
  const currentServer = current.server || 'p1';

  let gameWon: 'p1' | 'cpu' | null = null;
  let setWon: 'p1' | 'cpu' | null = null;
  let matchWon: 'p1' | 'cpu' | null = null;
  let announcement = winner === 'p1' ? '¡PUNTO JUGADOR 1!' : '¡PUNTO CPU!';

  const isP1 = winner === 'p1';

  if (isP1) {
    if (p1Points < 3) {
      p1Points += 1;
    } else if (p2Points < 3) {
      // P1 was at 40 and P2 below 40 -> P1 wins game!
      gameWon = 'p1';
    } else if (p1Points === 3 && p2Points === 3) {
      // 40-40 (Deuce) -> Advantage P1
      p1Points = 4;
      announcement = '¡VENTAJA JUGADOR 1!';
    } else if (p2Points === 4) {
      // P2 had advantage -> back to Deuce
      p2Points = 3;
      announcement = '¡IGUALES (DEUCE)!';
    } else if (p1Points === 4) {
      // P1 had advantage -> P1 wins game!
      gameWon = 'p1';
    }
  } else {
    // CPU won point
    if (p2Points < 3) {
      p2Points += 1;
    } else if (p1Points < 3) {
      // CPU was at 40 and P1 below 40 -> CPU wins game!
      gameWon = 'cpu';
    } else if (p1Points === 3 && p2Points === 3) {
      // 40-40 (Deuce) -> Advantage CPU
      p2Points = 4;
      announcement = '¡VENTAJA CPU!';
    } else if (p1Points === 4) {
      // P1 had advantage -> back to Deuce
      p1Points = 3;
      announcement = '¡IGUALES (DEUCE)!';
    } else if (p2Points === 4) {
      // CPU had advantage -> CPU wins game!
      gameWon = 'cpu';
    }
  }

  // Handle Game Win & Set Progression
  if (gameWon) {
    p1Points = 0;
    p2Points = 0;

    if (gameWon === 'p1') {
      p1Games += 1;
      announcement = '¡JUEGO PARA EL JUGADOR 1!';
    } else {
      p2Games += 1;
      announcement = '¡JUEGO PARA LA CPU!';
    }

    // Check Set Win (ITF standard: 6 games with margin >= 2, or 7-5, or 7-6)
    if (p1Games >= 6 && p1Games - p2Games >= 2) {
      setWon = 'p1';
      p1Sets += 1;
    } else if (p1Games === 7 && p2Games === 5) {
      setWon = 'p1';
      p1Sets += 1;
    } else if (p1Games === 7 && p2Games === 6) {
      setWon = 'p1';
      p1Sets += 1;
    } else if (p2Games >= 6 && p2Games - p1Games >= 2) {
      setWon = 'cpu';
      p2Sets += 1;
    } else if (p2Games === 7 && p1Games === 5) {
      setWon = 'cpu';
      p2Sets += 1;
    } else if (p2Games === 7 && p1Games === 6) {
      setWon = 'cpu';
      p2Sets += 1;
    }

    if (setWon) {
      announcement = setWon === 'p1' ? `¡SET PARA EL JUGADOR 1! (${p1Games}-${p2Games})` : `¡SET PARA LA CPU! (${p2Games}-${p1Games})`;
      p1Games = 0;
      p2Games = 0;

      // Best of 3 sets match winner (or first to 1/2 sets)
      if (p1Sets >= 2) {
        matchWon = 'p1';
        announcement = '¡JUEGO, SET Y PARTIDO PARA EL JUGADOR 1!';
      } else if (p2Sets >= 2) {
        matchWon = 'cpu';
        announcement = '¡JUEGO, SET Y PARTIDO PARA LA CPU!';
      }
    }
  }

  // Server alternation: every new game, the server switches (ITF Rule 14)
  const nextServer: 'p1' | 'cpu' = gameWon ? (currentServer === 'p1' ? 'cpu' : 'p1') : currentServer;

  return {
    p1Points,
    p2Points,
    p1Games,
    p2Games,
    p1Sets,
    p2Sets,
    gameWon,
    setWon,
    matchWon,
    nextServer,
    announcement,
  };
}
