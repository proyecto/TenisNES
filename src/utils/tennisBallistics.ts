/**
 * @file tennisBallistics.ts
 * @description Modulo de balistica y fisica de tiro para simulacion de tenis 3D.
 * Implementa el patron de diseño Strategy para el calculo de trayectorias segun el tipo de golpe:
 * - Saque (ServeStrategy)
 * - Remate en juego (RallySmashStrategy)
 * - Globo tactico/defensivo (LobStrategy)
 * - Golpes de fondo: Drive y Reves (GroundstrokeStrategy)
 */

export interface HitParameters {
  /** Posicion tridimensional de contacto raqueta-pelota [x, y, z] en metros */
  fromPos: [number, number, number];
  /** Coordenada Z de destino en el campo rival (ej. -8m a -11m) */
  targetZ: number;
  /** Coordenada X lateral de destino (opcional, por defecto centro 0) */
  targetX?: number;
  /** Modulador de direccion horizontal: -1 (izquierda), 0 (centro), +1 (derecha) */
  steeringX?: number;
  /** Modulador de profundidad y potencia: +1 (adelante/fuerte), -1 (atras/dejada), 0 (neutral) */
  steeringZ?: number;
  /** Indica si el golpe corresponde a un saque oficial */
  isServe?: boolean;
  /** Tipo de golpe seleccionado o detectado */
  shotType?: 'drive' | 'backhand' | 'smash' | 'lob';
}

export interface ShotVelocity {
  x: number;
  y: number;
  z: number;
}

export const GRAVITY = 9.81;
export const NET_Z = 0;

export interface HitReachResult {
  /** Indica si la pelota esta dentro del alcance fisico del jugador */
  canHit: boolean;
  /** Tipo de golpe sugerido segun la posicion relativa de la pelota */
  shotType: 'drive' | 'backhand' | 'smash';
  /** Desplazamiento horizontal relativo respecto al centro del cuerpo */
  dx: number;
  /** Ratio de distancia normalizada dentro de la elipse de alcance (<= 1.0 es alcanzable) */
  reachRatio: number;
  /** Indica si la pelota se encuentra a una altura superior a 1.65m (susceptible de smash) */
  isOverhead: boolean;
}

/**
 * Evalua si una pelota de tenis se encuentra dentro del alcance anatomico del tenista
 * utilizando una elipse asimetrica de reach y un umbral vertical:
 * - Lado derecho (Drive): alcance a una mano (~1.95m).
 * - Lado izquierdo (Reves): alcance a dos manos compacto (~1.15m).
 * - Bola alta (>= 1.65m): susceptible de remate overhead (Smash).
 *
 * @param playerPos Posicion [x, y, z] del jugador en la pista.
 * @param ballPos Posicion [x, y, z] actual de la pelota.
 * @param isOpponent True si el evaluado es el jugador rival (orientacion invertida).
 * @returns Resultado con alcanzabilidad, tipo de golpe sugerido y detalles biometricos.
 */
export function evaluateHitReach(
  playerPos: [number, number, number],
  ballPos: [number, number, number],
  isOpponent: boolean = false
): HitReachResult {
  const dx = ballPos[0] - playerPos[0];
  const dz = ballPos[2] - playerPos[2];

  // Para el Jugador 1 (mira a -Z): derecha es dx >= 0
  // Para el Rival (mira a +Z): derecha es dx <= 0
  const isRightHandSide = isOpponent ? dx <= 0 : dx >= 0;
  const isOverhead = ballPos[1] >= 1.65;
  const shotType: 'drive' | 'backhand' | 'smash' = isOverhead
    ? 'smash'
    : isRightHandSide
      ? 'drive'
      : 'backhand';

  // Envolvente horizontal asimetrica segun tipo de golpe
  const maxReachX = isOverhead ? 1.80 : isRightHandSide ? 1.95 : 1.15;

  // Rango de profundidad a lo largo del eje de juego
  const forwardDz = isOpponent ? dz : -dz;
  const inFront = forwardDz >= -0.45 && forwardDz <= 1.30;

  const normX = Math.abs(dx) / maxReachX;
  const normZ = forwardDz >= 0 ? forwardDz / 1.30 : Math.abs(forwardDz) / 0.45;
  const ellipseDist = Math.sqrt(normX * normX + normZ * normZ);

  // Envolvente vertical de golpeo: [0.15m, 2.45m]
  const inHeight = ballPos[1] >= 0.15 && ballPos[1] <= 2.45;
  const canHit = inFront && inHeight && ellipseDist <= 1.0;

  return {
    canHit,
    shotType,
    dx,
    reachRatio: ellipseDist,
    isOverhead,
  };
}

// =============================================================================
// PATRON DE DISEÑO: STRATEGY PATTERN PARA BALISTICA DE TIROS
// =============================================================================

export interface IShotStrategy {
  calculate(params: HitParameters): ShotVelocity;
}

/**
 * Estrategia de Saque:
 * Conecta analiticamente la altura de impacto del toss con la red y el cuadro de servicio diagonal.
 */
export class ServeStrategy implements IShotStrategy {
  calculate(params: HitParameters): ShotVelocity {
    const [x0, y0, z0] = params.fromPos;
    const targetX = params.targetX ?? 0;
    const steeringZ = params.steeringZ ?? 0;

    const dzTotal = params.targetZ - z0;
    const absDzTotal = Math.abs(dzTotal);
    const distToNet = Math.abs(z0 - NET_Z);
    const alpha = Math.max(0.15, Math.min(0.92, distToNet / Math.max(1.0, absDzTotal)));

    // La altura sobre la red depende de la altura de impacto y del steering
    let yNetTarget = 1.25;
    if (y0 < 2.15) {
      yNetTarget = 0.78 + (y0 - 1.6) * 0.25;
    } else if (steeringZ > 0) {
      yNetTarget = y0 < 2.4 ? 0.88 : 1.10;
    } else {
      yNetTarget = 1.22 + (y0 - 2.2) * 0.25;
    }

    const yLand = 0.08;
    const num = yNetTarget - (1 - alpha) * y0 - alpha * yLand;
    const den = 0.5 * GRAVITY * alpha * (1 - alpha);

    let tLand: number;
    let vy: number;

    if (num > 0.05 && den > 0.01) {
      tLand = Math.sqrt(num / den);
      tLand = Math.max(0.65, Math.min(1.15, tLand));
      vy = (yLand - y0 + 0.5 * GRAVITY * tLand * tLand) / tLand;
    } else {
      const speedZ = 19.5;
      tLand = absDzTotal / speedZ;
      const tNet = tLand * alpha;
      vy = (yNetTarget - y0 + 0.5 * GRAVITY * tNet * tNet) / Math.max(0.1, tNet);
    }

    const vz = dzTotal / tLand;
    const vx = (targetX - x0) / tLand;
    return { x: vx, y: vy, z: vz };
  }
}

/**
 * Estrategia de Remate Smash en Peloteo:
 * Martillazo descendente a gran velocidad (~28.5 m/s) que asegura superar la cinta de la red.
 */
export class RallySmashStrategy implements IShotStrategy {
  calculate(params: HitParameters): ShotVelocity {
    const [x0, y0, z0] = params.fromPos;
    const targetX = params.targetX ?? 0;
    const steeringX = params.steeringX ?? 0;
    const steeringZ = params.steeringZ ?? 0;

    const isMovingForward = params.targetZ < z0;
    const speedZ = 28.5;

    let effectiveTargetZ = isMovingForward ? -8.2 : 8.2;
    if (steeringZ > 0) {
      effectiveTargetZ = isMovingForward ? -10.2 : 10.2;
    } else if (steeringZ < 0) {
      effectiveTargetZ = isMovingForward ? -6.8 : 6.8;
    }

    const distToNet = Math.abs(z0 - NET_Z);
    const absDzTotal = Math.abs(effectiveTargetZ - z0);
    const tLand = Math.max(0.35, absDzTotal / speedZ);
    const yLand = 0.08;

    const tNet = distToNet / speedZ;
    const minNetHeight = 1.10;
    const vyNetReq = (minNetHeight - y0 + 0.5 * GRAVITY * tNet * tNet) / Math.max(0.05, tNet);
    const vyLandReq = (yLand - y0 + 0.5 * GRAVITY * tLand * tLand) / Math.max(0.05, tLand);
    const vy = Math.max(vyNetReq, vyLandReq);

    const vz = isMovingForward ? -speedZ : speedZ;
    const steerMultiplier = 2.8;
    const effectiveTargetX = targetX + steeringX * steerMultiplier;
    const vx = (effectiveTargetX - x0) / Math.max(0.1, tLand);

    return { x: vx, y: vy, z: vz };
  }
}

/**
 * Estrategia de Globo (Lob):
 * Elevacion parabolica alta (5.5m - 6.5m) que sobrepasa a rivales subidos a la red
 * y cae profundamente en la linea de fondo.
 */
export class LobStrategy implements IShotStrategy {
  calculate(params: HitParameters): ShotVelocity {
    const [x0, y0, z0] = params.fromPos;
    const targetX = params.targetX ?? 0;
    const steeringX = params.steeringX ?? 0;
    const steeringZ = params.steeringZ ?? 0;

    const isMovingForward = params.targetZ < z0;
    const speedZ = steeringZ > 0 ? 13.5 : steeringZ < 0 ? 10.2 : 11.8;
    const effectiveTargetZ = isMovingForward ? -10.6 : 10.6;
    const absDzTotal = Math.abs(effectiveTargetZ - z0);
    const flightTime = Math.max(1.3, absDzTotal / speedZ);

    const yLand = 0.08;
    const vy = (yLand - y0 + 0.5 * GRAVITY * flightTime * flightTime) / flightTime;
    const vz = isMovingForward ? -speedZ : speedZ;

    const steerMultiplier = 2.4;
    const effectiveTargetX = targetX + steeringX * steerMultiplier;
    const vx = (effectiveTargetX - x0) / flightTime;

    return { x: vx, y: vy, z: vz };
  }
}

/**
 * Estrategia de Golpes de Fondo (Drive y Reves):
 * Balistica parabolica tensa con diferenciacion de velocidad y angulo segun derecha/reves.
 */
export class GroundstrokeStrategy implements IShotStrategy {
  calculate(params: HitParameters): ShotVelocity {
    const [x0, y0, z0] = params.fromPos;
    const targetX = params.targetX ?? 0;
    const steeringX = params.steeringX ?? 0;
    const steeringZ = params.steeringZ ?? 0;
    const isDrive = params.shotType === 'drive';

    const isMovingForward = params.targetZ < z0;
    let speedZ = isDrive ? 18.0 : 14.0;
    let effectiveTargetZ = params.targetZ;

    let clearance = isDrive ? 1.30 : 1.38;

    if (steeringZ > 0) {
      speedZ = isDrive ? 22.0 : 17.0;
      effectiveTargetZ = isMovingForward ? -10.8 : 10.8;
      clearance = y0 < 0.65 ? 0.82 : 1.12;
    } else if (steeringZ < 0) {
      speedZ = isDrive ? 11.5 : 9.5;
      effectiveTargetZ = isMovingForward ? -3.2 : 3.2;
      clearance = Math.abs(z0) > 12.0 ? 0.84 : 1.25;
    } else {
      clearance = y0 < 0.50 ? 0.86 : isDrive ? 1.30 : 1.38;
    }

    const vz = isMovingForward ? -speedZ : speedZ;
    const timeToNet = Math.abs(z0 - NET_Z) / speedZ;
    const totalFlightTime = Math.abs(z0 - effectiveTargetZ) / speedZ;

    const requiredVyForNet =
      (clearance - y0 + 0.5 * GRAVITY * timeToNet * timeToNet) / Math.max(0.1, timeToNet);
    const yGround = 0.08;
    const requiredVyForLanding =
      (yGround - y0 + 0.5 * GRAVITY * totalFlightTime * totalFlightTime) / Math.max(0.1, totalFlightTime);

    let vy: number;
    if (clearance < 0.914) {
      vy = requiredVyForNet;
    } else {
      const baseMinVy = steeringZ < 0 ? 3.0 : isDrive ? 3.8 : 4.2;
      vy = Math.max(requiredVyForNet, requiredVyForLanding, baseMinVy);
    }

    const steerMultiplier = isDrive ? 3.6 : 2.0;
    const effectiveTargetX = targetX + steeringX * steerMultiplier;
    const vx = (effectiveTargetX - x0) / Math.max(0.1, totalFlightTime);

    return { x: vx, y: vy, z: vz };
  }
}

// Instancias unicas de estrategias (patron Singleton / Flyweight)
const serveStrategy = new ServeStrategy();
const rallySmashStrategy = new RallySmashStrategy();
const lobStrategy = new LobStrategy();
const groundstrokeStrategy = new GroundstrokeStrategy();

/**
 * Resuelve la estrategia adecuada de disparo segun los parametros de entrada.
 */
export function resolveShotStrategy(params: HitParameters): IShotStrategy {
  if (params.isServe) {
    return serveStrategy;
  }
  if (params.shotType === 'smash') {
    return rallySmashStrategy;
  }
  if (params.shotType === 'lob') {
    return lobStrategy;
  }
  return groundstrokeStrategy;
}

/**
 * Punto de entrada publico para calcular el vector tridimensional de velocidad inicial
 * requerido para que la pelota cumpla su trayectoria balistica.
 *
 * @param params Parametros de posicion, destino, moduladores y tipo de golpe.
 * @returns Vector tridimensional de velocidad inicial { x, y, z }.
 */
export function calculateShotVelocity(params: HitParameters): ShotVelocity {
  const strategy = resolveShotStrategy(params);
  return strategy.calculate(params);
}
