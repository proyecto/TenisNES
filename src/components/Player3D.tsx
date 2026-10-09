/**
 * @file Player3D.tsx
 * @description Highly detailed 3D tennis player rig with full biomechanical kinematics:
 * - Left-hand ball toss for service with trophy pose transition.
 * - Dynamic forehand whip, two-handed backhand drive, smash overhead, and high lob arcs.
 * - Procedural running gait cycle, sprint leaning, split-step crouching, and racket follow-through.
 * - CPU autonomous AI with trajectory prediction, deep baseline rally, and net approach on drop shots.
 */

import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Group, Vector3, MathUtils } from 'three';
import { useKeyboardControls } from '../hooks/useKeyboardControls';
import { useTennisStore } from '../store/useTennisStore';
import { determineCpuTargetPosition } from '../utils/tennisCpuAI';

interface Player3DProps {
  position: [number, number, number];
  isOpponent?: boolean;
  isControlled?: boolean;
}

/**
 * Modern Grand Slam Tour Athlete ("Estilo Tour Moderno"):
 * - High-definition anatomical styling: sculpted athletic V-taper physique, detailed polo jersey,
 *   turn-down collar, technical vents, defined deltoids/arms, terrycloth sweatbands,
 *   and articulated hands with fingers and thumb.
 * - Stylized athletic head with facial profile, focused eyes, layered hair, and tour headband with fluttering ribbons.
 * - Pro tour tennis sneakers with EVA midsole cushion, laces, and herringbone tread.
 * - Pro graphite racket with octagonal grip wrap, open split V-throat, elliptical head, bumper guard, and strings grid.
 *
 * Authentic Tennis Kinematics:
 * 1. Left-Hand Serve Toss:
 *    - In serve_prep: Left hand cradles the ball in the palm at waist level.
 *    - In serving (<0.42s): Left arm extends straight up, carrying the ball up to the 2.05m release point.
 *      Meanwhile, the right arm coils smoothly into the Trophy Pose (elbow at 90° behind head, racket behind neck).
 *    - In serving (>=0.42s): Left hand releases ball; left arm stays extended pointing straight up at the ascending ball
 *      to align shoulders while right arm holds the Trophy Pose ready for the overhead smash.
 * 2. Right-Hand Smash:
 *    - Explosive overhead smash strike with the right arm uncoiling from above, snapping downward with pronation,
 *      while the left arm tucks into the ribs for rotational torque.
 * 3. Forehand (Drive - Right Hand):
 *    - Visibly more velocity, power and whip: right arm loops into deep lag, unleashes explosive topspin whip
 *      with high follow-through wrapping over the left shoulder, left arm opens out wide for balance.
 * 4. Backhand (Revés - Two-Handed):
 *    - Controlled, compact drive with both hands on the grip, tighter flatter swing path, wrapping over right shoulder.
 */
export const Player3D: React.FC<Player3DProps> = ({
  position,
  isOpponent = false,
  isControlled = false,
}) => {
  const groupRef = useRef<Group>(null);
  const pelvisGroupRef = useRef<Group>(null);
  const torsoGroupRef = useRef<Group>(null);
  const headGroupRef = useRef<Group>(null);
  const headbandRibbonRef = useRef<Group>(null);
  const leftArmRef = useRef<Group>(null);
  const rightArmRef = useRef<Group>(null);
  const leftLegRef = useRef<Group>(null);
  const rightLegRef = useRef<Group>(null);
  const leftKneeRef = useRef<Group>(null);
  const rightKneeRef = useRef<Group>(null);
  const racketGroupRef = useRef<Group>(null);

  const keys = useKeyboardControls();

  // Position and velocity vectors
  const currentPos = useRef(new Vector3(position[0], position[1], position[2]));
  const velocity = useRef(new Vector3(0, 0, 0));
  const currentTilt = useRef({ roll: 0, pitch: 0 });

  // Body orientation angle (facing direction)
  const currentFacingAngle = useRef(isOpponent ? 0 : Math.PI);

  // Smooth squat blend factor (1.0 = deep squat cuclillas, 0.0 = upright sprint)
  const squatAmount = useRef(1.0);

  // Kinematic gait cycle progress
  const stepProgress = useRef(0);

  // Stroke & service animation state
  const currentShotType = useRef<'drive' | 'backhand' | 'smash' | 'lob' | 'slice'>('drive');
  const swingProgress = useRef(0);
  const isSwinging = useRef(false);
  const lastCpuSwingTrigger = useRef(0);
  const lastP1SwingTrigger = useRef(0);
  const currentHeadYaw = useRef(0);
  const currentHeadPitch = useRef(0);

  const lastMatchStatus = useRef<string>('');
  const lastServeSide = useRef<string>('');

  useFrame((state, delta) => {
    if (!groupRef.current) return;

    const t = state.clock.getElapsedTime();
    const matchStatus = useTennisStore.getState().matchStatus;
    const serveSide = useTennisStore.getState().serveSide;
    const server = useTennisStore.getState().server;
    const serveTossTime = useTennisStore.getState().serveTossTime;
    const p1SwingTrigger = useTennisStore.getState().p1SwingTrigger;
    const cpuSwingTrigger = useTennisStore.getState().cpuSwingTrigger;

    // =========================================================================
    // 1. POSITION & VELOCITY UPDATES
    // =========================================================================
    if (isControlled) {
      if (
        matchStatus === 'serve_prep' &&
        (lastMatchStatus.current !== 'serve_prep' || lastServeSide.current !== serveSide)
      ) {
        if (server === 'p1') {
          const defaultX = serveSide === 'deuce' ? 1.8 : -1.8;
          currentPos.current.x = defaultX;
          currentPos.current.z = 12.35;
        } else {
          // P1 is receiver against CPU serve
          const defaultX = serveSide === 'deuce' ? 2.2 : -2.2;
          currentPos.current.x = defaultX;
          currentPos.current.z = 12.35;
        }
        velocity.current.set(0, 0, 0);
      }
      lastMatchStatus.current = matchStatus;
      lastServeSide.current = serveSide;

      // Directional inputs
      let dx = 0;
      let dz = 0;

      // When player presses space or is swinging, player stops translating:
      // directional keys are dedicated to directing the shot rather than body movement!
      // Once the player tosses the ball in the air (matchStatus === 'serving' && server === 'p1'),
      // the server is locked in position to aim the serve!
      const isServerLockedDuringToss = matchStatus === 'serving' && server === 'p1';
      const isLockedInSwing =
        isSwinging.current || (keys.current.action && matchStatus !== 'serve_prep') || isServerLockedDuringToss;

      if (!isLockedInSwing) {
        if (keys.current.left) dx -= 1;
        if (keys.current.right) dx += 1;
        if (keys.current.forward) dz -= 1;
        if (keys.current.backward) dz += 1; // Downward baseline recovery
      }

      const isMoving = dx !== 0 || dz !== 0;

      if (isMoving) {
        const len = Math.sqrt(dx * dx + dz * dz);
        dx /= len;
        dz /= len;

        const moveSpeed = 8.8; // m/s sprint speed
        velocity.current.x = MathUtils.lerp(velocity.current.x, dx * moveSpeed, 0.25);
        velocity.current.z = MathUtils.lerp(velocity.current.z, dz * moveSpeed, 0.25);
      } else {
        velocity.current.x = MathUtils.lerp(velocity.current.x, 0, 0.28);
        velocity.current.z = MathUtils.lerp(velocity.current.z, 0, 0.28);
      }

      currentPos.current.x += velocity.current.x * delta;
      currentPos.current.z += velocity.current.z * delta;

      // Regulation Serve Restrictions & Court Boundaries
      if (matchStatus === 'serve_prep' || matchStatus === 'serving') {
        if (server === 'p1') {
          currentPos.current.z = Math.max(12.05, Math.min(14.5, currentPos.current.z));
          if (serveSide === 'deuce') {
            currentPos.current.x = Math.max(0.15, Math.min(4.115, currentPos.current.x));
          } else {
            currentPos.current.x = Math.max(-4.115, Math.min(-0.15, currentPos.current.x));
          }
        } else {
          // P1 is receiver: free baseline positioning
          currentPos.current.x = Math.max(-5.5, Math.min(5.5, currentPos.current.x));
          currentPos.current.z = Math.max(10.0, Math.min(14.5, currentPos.current.z));
        }
      } else {
        currentPos.current.x = Math.max(-6.2, Math.min(6.2, currentPos.current.x));
        currentPos.current.z = Math.max(3.8, Math.min(15.5, currentPos.current.z));
      }

      // Update coordinates in place to eliminate garbage collection pauses
      const sP1 = useTennisStore.getState().p1Pos;
      sP1[0] = currentPos.current.x;
      sP1[1] = currentPos.current.y;
      sP1[2] = currentPos.current.z;

      // Swing action listener (keyboard or ball hit trigger)
      if (p1SwingTrigger !== lastP1SwingTrigger.current) {
        lastP1SwingTrigger.current = p1SwingTrigger;
        currentShotType.current = useTennisStore.getState().p1ShotType;
        isSwinging.current = true;
        swingProgress.current = 1.0;
      } else if ((keys.current.action || keys.current.lob) && !isSwinging.current && matchStatus !== 'serve_prep') {
        const ball = useTennisStore.getState().ballPos;
        const isRight = ball[0] >= currentPos.current.x;
        const isOverhead = ball[1] >= 1.65;
        const isLobInput = keys.current.lob;
        const isSliceInput = keys.current.backward && !keys.current.lob && keys.current.action;

        if (isLobInput) {
          currentShotType.current = 'lob';
        } else if (isSliceInput) {
          currentShotType.current = 'slice';
        } else if (matchStatus === 'serving' || isOverhead) {
          currentShotType.current = 'smash';
        } else {
          currentShotType.current = isRight ? 'drive' : 'backhand';
        }
        isSwinging.current = true;
        swingProgress.current = 1.0;
      }
    } else if (isOpponent) {
      // ADVANCED CPU TENNIS AI (Tactical positioning & No Man's Land elimination)
      const ball = useTennisStore.getState().ballPos;
      const ballV = useTennisStore.getState().ballVel;
      const status = useTennisStore.getState().matchStatus;
      const server = useTennisStore.getState().server;
      const serveSide = useTennisStore.getState().serveSide;
      const rallyCount = useTennisStore.getState().rallyCount;
      const isServeIncoming = server === 'p1' && (status === 'serving' || (status === 'playing' && rallyCount === 0));

      const { targetX, targetZ, desiredSpeed } = determineCpuTargetPosition(
        [currentPos.current.x, currentPos.current.y, currentPos.current.z],
        ball,
        ballV,
        status,
        server,
        serveSide,
        0,
        isServeIncoming
      );

      const diffX = targetX - currentPos.current.x;
      const diffZ = targetZ - currentPos.current.z;
      const dist = Math.hypot(diffX, diffZ);
      const isMoving = dist > 0.05;

      if (isMoving) {
        // Tight deceleration curve: FULL speed when dist >= 0.20m to eliminate sluggish crawl
        const actualSpeed = dist < 0.20 ? (dist / 0.20) * desiredSpeed : desiredSpeed;
        const vx = (diffX / dist) * actualSpeed;
        const vz = (diffZ / dist) * actualSpeed;
        velocity.current.x = vx;
        velocity.current.z = vz;
        currentPos.current.x += vx * delta;
        currentPos.current.z += vz * delta;
      } else {
        velocity.current.x = 0;
        velocity.current.z = 0;
      }

      // Restrict CPU within physical court limits
      currentPos.current.x = Math.max(-5.5, Math.min(5.5, currentPos.current.x));
      currentPos.current.z = Math.max(-14.2, Math.min(-1.5, currentPos.current.z));

      // Update coordinates in place to eliminate garbage collection pauses
      const sCpu = useTennisStore.getState().cpuPos;
      sCpu[0] = currentPos.current.x;
      sCpu[1] = currentPos.current.y;
      sCpu[2] = currentPos.current.z;

      if (cpuSwingTrigger !== lastCpuSwingTrigger.current) {
        lastCpuSwingTrigger.current = cpuSwingTrigger;
        currentShotType.current = useTennisStore.getState().cpuShotType;
        isSwinging.current = true;
        swingProgress.current = 1.0;
      }
    }

    // =========================================================================
    // 2. DIRECTIONAL TURNING & SPRINT ORIENTATION
    // =========================================================================
    const speed = Math.hypot(velocity.current.x, velocity.current.z);
    const isRunning = speed > 0.45;

    if (isRunning) {
      stepProgress.current += delta * Math.min(speed * 2.8, 22.0);
    }
    const gaitPhase = stepProgress.current;

    let targetFacing = isOpponent ? 0 : Math.PI;

    if (isSwinging.current) {
      const isBackhand = currentShotType.current === 'backhand';
      const isDrive = currentShotType.current === 'drive';
      if (isOpponent) {
        targetFacing = isBackhand ? 0.28 : isDrive ? -0.28 : 0;
      } else {
        targetFacing = isBackhand ? Math.PI + 0.28 : isDrive ? Math.PI - 0.28 : Math.PI;
      }
    } else if (isRunning) {
      targetFacing = Math.atan2(velocity.current.x, velocity.current.z);
    } else {
      targetFacing = isOpponent ? 0 : Math.PI;
    }

    let angleDiff = targetFacing - currentFacingAngle.current;
    while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
    while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
    currentFacingAngle.current += angleDiff * Math.min(1.0, delta * 12.0);

    const targetRoll = isRunning ? (-velocity.current.x / 8.8) * 0.32 : 0;
    const forwardVel = isOpponent ? -velocity.current.z : velocity.current.z;
    const targetPitch = isRunning ? MathUtils.clamp(forwardVel * 0.035 + 0.12, -0.15, 0.30) : 0;
    currentTilt.current.roll = MathUtils.lerp(currentTilt.current.roll, targetRoll, 0.22);
    currentTilt.current.pitch = MathUtils.lerp(currentTilt.current.pitch, targetPitch, 0.22);

    const readyPulse = Math.sin(t * 7.5);

    const targetSquat = isRunning ? 0.0 : isSwinging.current ? 0.85 : 1.0;
    squatAmount.current = MathUtils.lerp(squatAmount.current, targetSquat, delta * 10.0);
    const sq = squatAmount.current;

    const strokePhase = isSwinging.current ? 1 - swingProgress.current : 0;
    const isSmash = currentShotType.current === 'smash';
    // Explosive airborne vertical jump on overhead smashes & serves
    const smashJumpHeight = isSmash && isSwinging.current
      ? Math.sin(strokePhase * Math.PI) * 0.45
      : 0;

    const verticalBob = isRunning
      ? Math.abs(Math.sin(gaitPhase)) * 0.055
      : readyPulse * 0.018 * sq;

    groupRef.current.position.set(
      currentPos.current.x,
      position[1] + verticalBob + smashJumpHeight,
      currentPos.current.z
    );

    groupRef.current.rotation.set(
      currentTilt.current.pitch,
      currentFacingAngle.current,
      currentTilt.current.roll
    );

    // Dynamic headband ribbons fluttering in wind/cadence
    if (headbandRibbonRef.current) {
      const flutter = Math.sin(t * 12.0 + gaitPhase) * 0.25 + (isRunning ? 0.4 : 0.1);
      headbandRibbonRef.current.rotation.x = flutter;
      headbandRibbonRef.current.rotation.y = Math.cos(t * 8.0) * 0.15;
    }

    // =========================================================================
    // 3. UNIFIED SKELETON: PELVIS POSITION & PARALLEL LEGS KINEMATICS
    // =========================================================================
    if (
      pelvisGroupRef.current &&
      leftLegRef.current &&
      rightLegRef.current &&
      leftKneeRef.current &&
      rightKneeRef.current &&
      torsoGroupRef.current &&
      headGroupRef.current
    ) {
      // 1. Pelvis height and depth (athletic center of gravity: hips down & back)
      const currentHipY = MathUtils.lerp(0.82, 0.56 + readyPulse * 0.02, sq);
      const currentHipZ = MathUtils.lerp(0.0, -0.16, sq);
      pelvisGroupRef.current.position.set(0, currentHipY, currentHipZ);

      // 2. Head ball-tracking orientation: player looks toward incoming tennis ball
      const ball = useTennisStore.getState().ballPos;
      const relX = ball[0] - currentPos.current.x;
      const relZ = ball[2] - currentPos.current.z;
      const relY = ball[1] - (currentPos.current.y + 1.55);
      const isBallAhead = isOpponent ? relZ > 0 : relZ < 0;
      let targetYaw = 0;
      let targetHeadPitchVal = 0;
      if (isBallAhead && !isSwinging.current) {
        targetYaw = MathUtils.clamp(Math.atan2(relX, isOpponent ? relZ : -relZ) * 0.55, -0.7, 0.7);
        targetHeadPitchVal = MathUtils.clamp(Math.atan2(relY, Math.hypot(relX, relZ)) * 0.65, -0.4, 0.45);
      }
      currentHeadYaw.current = MathUtils.lerp(currentHeadYaw.current, targetYaw, delta * 14.0);
      currentHeadPitch.current = MathUtils.lerp(currentHeadPitch.current, targetHeadPitchVal, delta * 14.0);

      // Torso athletic forward hinge & Head counter-rotation + Ball Look
      const torsoLean = MathUtils.lerp(0.12, 0.56, sq);
      torsoGroupRef.current.rotation.x = torsoLean;
      headGroupRef.current.rotation.x = -torsoLean * 0.82 + currentHeadPitch.current;
      headGroupRef.current.rotation.y = currentHeadYaw.current;

      // 3. LEGS: STRICTLY PARALLEL sagittal kinematics with airborne scissors kick during smash jump
      if (smashJumpHeight > 0.05) {
        const jumpNorm = Math.sin(strokePhase * Math.PI);
        leftLegRef.current.rotation.set(-0.75 * jumpNorm, 0, 0);
        rightLegRef.current.rotation.set(0.45 * jumpNorm, 0, 0);
        leftKneeRef.current.rotation.set(-0.55 * jumpNorm, 0, 0);
        rightKneeRef.current.rotation.set(-1.85 * jumpNorm, 0, 0);
      } else if (isRunning) {
        // Parallel-track sprint gait
        const leftHipSwing = Math.sin(gaitPhase) * 0.82;
        const rightHipSwing = -Math.sin(gaitPhase) * 0.82;

        const leftKneeBend = -Math.max(0.12, -Math.sin(gaitPhase)) * 1.15;
        const rightKneeBend = -Math.max(0.12, Math.sin(gaitPhase)) * 1.15;

        leftLegRef.current.rotation.set(leftHipSwing, 0, 0);
        rightLegRef.current.rotation.set(rightHipSwing, 0, 0);

        leftKneeRef.current.rotation.set(leftKneeBend, 0, 0);
        rightKneeRef.current.rotation.set(rightKneeBend, 0, 0);
      } else {
        // Parallel-track deep squat ready stance
        const thighFlex = MathUtils.lerp(0.1, 0.82 - readyPulse * 0.035, sq);
        const kneeFlex = MathUtils.lerp(-0.15, -1.48 + readyPulse * 0.07, sq);

        leftLegRef.current.rotation.set(thighFlex, 0, 0);
        rightLegRef.current.rotation.set(thighFlex, 0, 0);

        leftKneeRef.current.rotation.set(kneeFlex, 0, 0);
        rightKneeRef.current.rotation.set(kneeFlex, 0, 0);
      }
    }

    // =========================================================================
    // 4. UPPER BODY, ARMS & STROKE KINEMATICS (SMASH / DRIVE / BACKHAND / TOSS)
    // =========================================================================
    if (isSwinging.current) {
      const swingSpeed =
        currentShotType.current === 'backhand'
          ? 2.2
          : currentShotType.current === 'smash'
          ? 2.8
          : currentShotType.current === 'lob'
          ? 2.6
          : 3.4;
      swingProgress.current -= delta * swingSpeed;
      if (swingProgress.current <= 0) {
        swingProgress.current = 0;
        isSwinging.current = false;
      }
    }

    const isCurrentServer = (!isOpponent && server === 'p1') || (isOpponent && server === 'cpu');
    const isServingToss = isCurrentServer && matchStatus === 'serving';
    const isServePrep = isCurrentServer && matchStatus === 'serve_prep';

    if (torsoGroupRef.current && leftArmRef.current && rightArmRef.current && racketGroupRef.current) {
      if (isSwinging.current) {
        const strokePhase = 1 - swingProgress.current; // 0.0 -> 1.0
        const isBackhand = currentShotType.current === 'backhand';
        const isSmash = currentShotType.current === 'smash';
        const isLob = currentShotType.current === 'lob';
        const isSlice = currentShotType.current === 'slice';

        if (isLob) {
          // ===================================================================
          // GLOBO: MOVIMIENTO DE CUCHARA DE ABAJO A ARRIBA (UNDERHAND LIFT)
          // La raqueta desciende abierta hasta la rodilla y barre hacia el cielo
          // ===================================================================
          if (strokePhase < 0.35) {
            // Fase 1: Carga baja (preparación de cuchara por debajo de la bola)
            const p = strokePhase / 0.35;
            torsoGroupRef.current.rotation.set(
              MathUtils.lerp(0.12, 0.28, p),
              MathUtils.lerp(0, -0.45, p) * (isOpponent ? -1 : 1),
              0
            );

            // Brazo derecho baja hacia la rodilla derecha
            rightArmRef.current.position.set(
              MathUtils.lerp(-0.25, -0.42, p),
              MathUtils.lerp(0.38, 0.12, p),
              MathUtils.lerp(0, -0.22, p)
            );
            rightArmRef.current.rotation.set(
              MathUtils.lerp(-0.55, -0.15, p),
              MathUtils.lerp(-0.28, -1.25, p),
              MathUtils.lerp(0.22, 1.45, p)
            );
            // Raqueta abierta mirando al cielo
            racketGroupRef.current.rotation.set(-0.35, -0.95, 1.15);

            leftArmRef.current.position.set(0.28, 0.32, 0.1);
            leftArmRef.current.rotation.set(-0.45, 0.45, -0.35);
          } else if (strokePhase < 0.70) {
            // Fase 2: Elevación enérgica hacia arriba (cuchareo al cielo)
            const p = (strokePhase - 0.35) / 0.35;
            torsoGroupRef.current.rotation.set(
              MathUtils.lerp(0.28, -0.18, p),
              MathUtils.lerp(-0.45, 0.35, p) * (isOpponent ? -1 : 1),
              0
            );

            // Brazo derecho sube desde la rodilla hasta por encima del hombro
            rightArmRef.current.position.set(
              MathUtils.lerp(-0.42, -0.30, p),
              MathUtils.lerp(0.12, 0.52, p),
              MathUtils.lerp(-0.22, 0.30, p)
            );
            rightArmRef.current.rotation.set(
              MathUtils.lerp(-0.15, -2.10, p),
              MathUtils.lerp(-1.25, 0.15, p),
              MathUtils.lerp(1.45, 0.35, p)
            );
            racketGroupRef.current.rotation.set(
              MathUtils.lerp(-0.35, 0.65, p),
              0.1,
              0.2
            );

            leftArmRef.current.position.set(0.32, 0.36, -0.1);
            leftArmRef.current.rotation.set(-0.65, 0.2, -0.25);
          } else {
            // Fase 3: Terminación alta apuntando al cielo y recuperación
            const p = (strokePhase - 0.70) / 0.30;
            torsoGroupRef.current.rotation.set(
              MathUtils.lerp(-0.18, 0.12, p),
              MathUtils.lerp(0.35, 0, p) * (isOpponent ? -1 : 1),
              0
            );

            rightArmRef.current.position.set(
              MathUtils.lerp(-0.30, -0.25, p),
              MathUtils.lerp(0.52, 0.38, p),
              MathUtils.lerp(0.30, 0, p)
            );
            rightArmRef.current.rotation.set(
              MathUtils.lerp(-2.10, -0.55, p),
              MathUtils.lerp(0.15, -0.28, p),
              MathUtils.lerp(0.35, 0.22, p)
            );
            racketGroupRef.current.rotation.set(
              MathUtils.lerp(0.65, 0.55, p),
              -0.1,
              0.25
            );

            leftArmRef.current.position.set(0.25, 0.38, 0);
            leftArmRef.current.rotation.set(-0.68, 0.28, -0.28);
          }
        } else if (isSmash) {
          // ===================================================================
          // 1. SMASH / SAQUE: A UNA MANO, POR ENCIMA DE LA CABEZA (OVERHEAD VERTICAL)
          // "Como si fuera un drive, pero en lugar de a la derecha, hacia arriba."
          // ===================================================================
          const jumpExtension = Math.sin(strokePhase * Math.PI) * 0.22;
          if (pelvisGroupRef.current) {
            pelvisGroupRef.current.position.y += jumpExtension;
          }

          if (strokePhase < 0.32) {
            // Reaching straight up into the sky above cranium
            const p = strokePhase / 0.32;
            torsoGroupRef.current.rotation.set(MathUtils.lerp(0.12, -0.28, p), 0.15, 0);

            // Right arm points straight UP into the sky (overhead, one hand)
            rightArmRef.current.position.set(-0.25, 0.38 + p * 0.12, 0);
            rightArmRef.current.rotation.set(
              MathUtils.lerp(-1.75, -2.95, p), // Straight UP into the sky!
              MathUtils.lerp(-0.48, -0.05, p),
              MathUtils.lerp(0.68, 0.05, p)
            );
            // Racket extends vertically high above cranium
            racketGroupRef.current.rotation.set(
              MathUtils.lerp(0.85, 0.1, p),
              0,
              0
            );
            leftArmRef.current.position.set(0.25, 0.38, 0);
            leftArmRef.current.rotation.set(
              MathUtils.lerp(-2.75, -1.2, p),
              0.12,
              -0.15
            );
          } else if (strokePhase < 0.68) {
            // Violent overhead hammer strike downward
            const p = (strokePhase - 0.32) / 0.36;
            torsoGroupRef.current.rotation.set(MathUtils.lerp(-0.28, 0.52, p), 0.05, 0);

            rightArmRef.current.position.set(-0.25, 0.50 - p * 0.12, 0);
            rightArmRef.current.rotation.set(
              MathUtils.lerp(-2.95, 1.25, p),
              MathUtils.lerp(-0.05, 0.32, p),
              MathUtils.lerp(0.05, -0.22, p)
            );
            racketGroupRef.current.rotation.set(
              MathUtils.lerp(0.1, 1.75, p),
              -0.12,
              0.25
            );
            leftArmRef.current.position.set(0.25, 0.38, 0);
            leftArmRef.current.rotation.set(
              MathUtils.lerp(-1.2, -0.35, p),
              0.25,
              -0.28
            );
          } else {
            // Follow-through across left hip & recover
            const p = (strokePhase - 0.68) / 0.32;
            torsoGroupRef.current.rotation.set(MathUtils.lerp(0.52, 0.15, p), 0, 0);

            rightArmRef.current.position.set(-0.25, 0.38, 0);
            rightArmRef.current.rotation.set(
              MathUtils.lerp(1.25, -0.62, p),
              MathUtils.lerp(0.32, -0.26, p),
              MathUtils.lerp(-0.22, 0.2, p)
            );
            racketGroupRef.current.rotation.set(
              MathUtils.lerp(1.75, 0.55, p),
              -0.18,
              0.25
            );
            leftArmRef.current.position.set(0.25, 0.38, 0);
            leftArmRef.current.rotation.set(
              MathUtils.lerp(-0.35, -0.68, p),
              0.28,
              -0.28
            );
          }
        } else if (isBackhand) {
          // ===================================================================
          // 2. REVÉS: A DOS MANOS (CORTO, COMPACTO, AMBAS MANOS EN EL MANGO)
          // "Si pasa por su izquierda... de revés, como si la está agarrando con
          //  las dos manos... un golpe más corto, porque lo da con las dos manos."
          // ===================================================================
          if (strokePhase < 0.32) {
            // Fase 1: Carga cerrada a dos manos hacia la izquierda (X local positivo)
            const p = strokePhase / 0.32;
            const twist = MathUtils.lerp(0, 1.15, p) * (isOpponent ? -1 : 1);
            torsoGroupRef.current.rotation.y = twist;

            // AMBAS MANOS CONVERGEN JUNTAS EN EL MANGO EN EL LADO IZQUIERDO DEL CUERPO
            rightArmRef.current.position.set(
              MathUtils.lerp(-0.25, -0.06, p),
              MathUtils.lerp(0.38, 0.30, p),
              MathUtils.lerp(0, 0.18, p)
            );
            leftArmRef.current.position.set(
              MathUtils.lerp(0.25, 0.08, p),
              MathUtils.lerp(0.38, 0.32, p),
              MathUtils.lerp(0, 0.20, p)
            );

            // Codos flexionados, ambas manos unidas al mango en el costado izquierdo
            rightArmRef.current.rotation.set(
              MathUtils.lerp(-0.62, -0.92, p),
              MathUtils.lerp(-0.26, 0.85, p),
              MathUtils.lerp(0.2, -0.72, p)
            );
            leftArmRef.current.rotation.set(
              MathUtils.lerp(-0.68, -0.98, p),
              MathUtils.lerp(0.28, 0.78, p),
              MathUtils.lerp(-0.28, -0.65, p)
            );
            racketGroupRef.current.rotation.set(
              MathUtils.lerp(0.55, 0.35, p),
              MathUtils.lerp(-0.18, 1.05, p),
              MathUtils.lerp(0.25, -0.72, p)
            );
          } else if (strokePhase < 0.68) {
            // Fase 2: Impacto coordinado a dos manos (recorrido corto y compacto)
            const p = (strokePhase - 0.32) / 0.36;
            const twist = MathUtils.lerp(1.15, -0.68, p) * (isOpponent ? -1 : 1);
            torsoGroupRef.current.rotation.y = twist;

            // AMBAS MANOS CONTINÚAN PEGADAS AL MANGO IMPULSANDO LA RAQUETA
            rightArmRef.current.position.set(
              MathUtils.lerp(-0.06, -0.08, p),
              MathUtils.lerp(0.30, 0.34, p),
              MathUtils.lerp(0.18, 0.24, p)
            );
            leftArmRef.current.position.set(
              MathUtils.lerp(0.08, 0.04, p),
              MathUtils.lerp(0.32, 0.36, p),
              MathUtils.lerp(0.20, 0.26, p)
            );

            rightArmRef.current.rotation.set(
              MathUtils.lerp(-0.92, 0.82, p),
              MathUtils.lerp(0.85, -0.55, p),
              MathUtils.lerp(-0.72, 0.45, p)
            );
            leftArmRef.current.rotation.set(
              MathUtils.lerp(-0.98, 0.75, p),
              MathUtils.lerp(0.78, -0.62, p),
              MathUtils.lerp(-0.65, 0.38, p)
            );
            racketGroupRef.current.rotation.set(
              MathUtils.lerp(0.35, 0.82, p),
              MathUtils.lerp(1.05, -0.52, p),
              MathUtils.lerp(-0.72, 0.35, p)
            );
          } else {
            // Fase 3: Terminación a dos manos envolviendo sobre el hombro derecho
            const p = (strokePhase - 0.68) / 0.32;
            const twist = MathUtils.lerp(-0.68, 0, p) * (isOpponent ? -1 : 1);
            torsoGroupRef.current.rotation.y = twist;

            // AMBAS MANOS SUBEN JUNTAS AL HOMBRO DERECHO ANTES DE SEPARARSE
            rightArmRef.current.position.set(
              MathUtils.lerp(-0.08, -0.25, p),
              MathUtils.lerp(0.34, 0.38, p),
              MathUtils.lerp(0.24, 0, p)
            );
            leftArmRef.current.position.set(
              MathUtils.lerp(0.04, 0.25, p),
              MathUtils.lerp(0.36, 0.38, p),
              MathUtils.lerp(0.26, 0, p)
            );

            rightArmRef.current.rotation.set(
              MathUtils.lerp(0.82, -0.62, p),
              MathUtils.lerp(-0.55, -0.26, p),
              MathUtils.lerp(0.45, 0.2, p)
            );
            leftArmRef.current.rotation.set(
              MathUtils.lerp(0.75, -0.68, p),
              MathUtils.lerp(-0.62, 0.28, p),
              MathUtils.lerp(0.38, -0.28, p)
            );
            racketGroupRef.current.rotation.set(
              MathUtils.lerp(0.82, 0.55, p),
              MathUtils.lerp(-0.52, -0.18, p),
              MathUtils.lerp(0.35, 0.25, p)
            );
          }
        } else if (isSlice) {
          // ===================================================================
          // 3. SLICE / DEJADA: RECORRIDO DESCENDENTE DE ARRIBA A ABAJO
          // High-to-low chop with open racket face and firm wrist
          // ===================================================================
          if (strokePhase < 0.30) {
            // Fase 1: Carga alta (preparación por encima del hombro derecho)
            const p = strokePhase / 0.30;
            torsoGroupRef.current.rotation.set(
              MathUtils.lerp(0.12, 0.05, p),
              MathUtils.lerp(0, -0.55, p) * (isOpponent ? -1 : 1),
              0
            );
            rightArmRef.current.position.set(
              MathUtils.lerp(-0.25, -0.48, p),
              MathUtils.lerp(0.38, 0.55, p),
              MathUtils.lerp(0, -0.15, p)
            );
            rightArmRef.current.rotation.set(
              MathUtils.lerp(-0.62, -1.35, p),
              MathUtils.lerp(-0.26, -0.85, p),
              MathUtils.lerp(0.2, 0.95, p)
            );
            racketGroupRef.current.rotation.set(-0.45, -0.55, 0.75);

            leftArmRef.current.position.set(0.32, 0.35, 0.1);
            leftArmRef.current.rotation.set(-0.35, 0.35, -0.25);
          } else if (strokePhase < 0.68) {
            // Fase 2: Tajo descendente cortando la bola
            const p = (strokePhase - 0.30) / 0.38;
            torsoGroupRef.current.rotation.set(
              MathUtils.lerp(0.05, 0.22, p),
              MathUtils.lerp(-0.55, 0.25, p) * (isOpponent ? -1 : 1),
              0
            );
            rightArmRef.current.position.set(
              MathUtils.lerp(-0.48, -0.38, p),
              MathUtils.lerp(0.55, 0.28, p),
              MathUtils.lerp(-0.15, 0.25, p)
            );
            rightArmRef.current.rotation.set(
              MathUtils.lerp(-1.35, 0.45, p),
              MathUtils.lerp(-0.85, 0.25, p),
              MathUtils.lerp(0.95, -0.35, p)
            );
            racketGroupRef.current.rotation.set(0.45, -0.25, 0.35);

            leftArmRef.current.position.set(0.35, 0.38, -0.15);
            leftArmRef.current.rotation.set(-0.65, 0.45, -0.35);
          } else {
            // Fase 3: Terminación baja y equilibrada
            const p = (strokePhase - 0.68) / 0.32;
            torsoGroupRef.current.rotation.set(
              MathUtils.lerp(0.22, 0.12, p),
              MathUtils.lerp(0.25, 0, p) * (isOpponent ? -1 : 1),
              0
            );
            rightArmRef.current.position.set(
              MathUtils.lerp(-0.38, -0.25, p),
              MathUtils.lerp(0.28, 0.38, p),
              MathUtils.lerp(0.25, 0, p)
            );
            rightArmRef.current.rotation.set(
              MathUtils.lerp(0.45, -0.62, p),
              MathUtils.lerp(0.25, -0.26, p),
              MathUtils.lerp(-0.35, 0.2, p)
            );
            racketGroupRef.current.rotation.set(0.55, -0.18, 0.25);

            leftArmRef.current.position.set(0.25, 0.38, 0);
            leftArmRef.current.rotation.set(-0.68, 0.28, -0.28);
          }
        } else {
          // ===================================================================
          // 4. DRIVE: A UNA MANO, A LA DERECHA, Y LLEGA MÁS LEJOS (ALCANCE AMPLIO)
          // "Si pasa por la derecha... golpe a una mano claramente... más alcance"
          // ===================================================================
          if (strokePhase < 0.28) {
            // Fase 1: Apertura amplia a una mano hacia la derecha (X local negativo)
            const prepP = strokePhase / 0.28;
            const torsoTwist = MathUtils.lerp(0, -0.95, prepP) * (isOpponent ? -1 : 1);
            torsoGroupRef.current.rotation.y = torsoTwist;

            // BRAZO DERECHO EXTENDIDO BIEN LEJOS A LA DERECHA (X local llega a -0.65m!)
            rightArmRef.current.position.set(
              MathUtils.lerp(-0.25, -0.65, prepP),
              MathUtils.lerp(0.38, 0.32, prepP),
              MathUtils.lerp(0, -0.28, prepP)
            );
            rightArmRef.current.rotation.set(
              MathUtils.lerp(-0.55, -0.38, prepP),
              MathUtils.lerp(-0.28, -1.62, prepP),
              MathUtils.lerp(0.22, 1.05, prepP)
            );
            racketGroupRef.current.rotation.set(0.20, -1.35, 0.85);

            // BRAZO IZQUIERDO COMPLETAMENTE LIBRE, APUNTANDO A LA IZQUIERDA (EQUILIBRIO, >1m de distancia)
            leftArmRef.current.position.set(
              MathUtils.lerp(0.25, 0.45, prepP),
              MathUtils.lerp(0.38, 0.40, prepP),
              MathUtils.lerp(0, 0.18, prepP)
            );
            leftArmRef.current.rotation.set(
              MathUtils.lerp(-0.65, -1.15, prepP),
              MathUtils.lerp(0.28, 0.75, prepP),
              MathUtils.lerp(-0.28, -0.65, prepP)
            );
          } else if (strokePhase < 0.62) {
            // Fase 2: Latigazo horizontal amplio a una mano por la derecha
            const strikeP = (strokePhase - 0.28) / 0.34;
            const torsoTwist = MathUtils.lerp(-0.95, 0.85, strikeP) * (isOpponent ? -1 : 1);
            torsoGroupRef.current.rotation.y = torsoTwist;

            // El brazo derecho barre a gran distancia por la derecha (X local = -0.58m)
            rightArmRef.current.position.set(
              MathUtils.lerp(-0.65, -0.58, strikeP),
              MathUtils.lerp(0.32, 0.36, strikeP),
              MathUtils.lerp(-0.28, 0.35, strikeP)
            );
            rightArmRef.current.rotation.set(
              MathUtils.lerp(-0.38, 0.95, strikeP),
              MathUtils.lerp(-1.62, 0.45, strikeP),
              MathUtils.lerp(1.05, -0.55, strikeP)
            );
            racketGroupRef.current.rotation.set(
              MathUtils.lerp(0.20, 0.90, strikeP),
              MathUtils.lerp(-1.35, 0.35, strikeP),
              MathUtils.lerp(0.85, -0.52, strikeP)
            );

            // Brazo izquierdo se mantiene libre al costado izquierdo
            leftArmRef.current.position.set(0.35, 0.36, -0.05);
            leftArmRef.current.rotation.set(-0.45, 0.25, -0.20);
          } else {
            // Fase 3: Terminación alta a una mano envolviendo sobre el hombro izquierdo
            const wrapP = (strokePhase - 0.62) / 0.38;
            const torsoTwist = MathUtils.lerp(0.85, 0, wrapP) * (isOpponent ? -1 : 1);
            torsoGroupRef.current.rotation.y = torsoTwist;

            // El brazo derecho solo envuelve sobre el hombro izquierdo
            rightArmRef.current.position.set(
              MathUtils.lerp(-0.58, -0.25, wrapP),
              MathUtils.lerp(0.36, 0.38, wrapP),
              MathUtils.lerp(0.35, 0, wrapP)
            );
            rightArmRef.current.rotation.set(
              MathUtils.lerp(0.95, -0.62, wrapP),
              MathUtils.lerp(0.45, -0.26, wrapP),
              MathUtils.lerp(-0.55, 0.2, wrapP)
            );
            racketGroupRef.current.rotation.set(
              MathUtils.lerp(0.90, 0.55, wrapP),
              MathUtils.lerp(0.35, -0.18, wrapP),
              MathUtils.lerp(-0.52, 0.25, wrapP)
            );

            leftArmRef.current.position.set(0.25, 0.38, 0);
            leftArmRef.current.rotation.set(-0.68, 0.28, -0.28);
          }
        }
      } else {
        // RESET DEFAULT SHOULDER SOCKET POSITIONS WHEN NOT SWINGING (Right Arm at -0.25, Left Arm at +0.25)
        rightArmRef.current.position.set(-0.25, 0.38, 0);
        leftArmRef.current.position.set(0.25, 0.38, 0);

        if (isServingToss) {
          // AUTHENTIC LEFT-HAND SERVICE TOSS ELEVATION & TROPHY POSE COILING
          const timeSinceToss = t - serveTossTime;

          if (timeSinceToss < 0.42) {
            const p = Math.min(1.0, Math.max(0.0, timeSinceToss / 0.42));
            const liftEase = Math.sin((p * Math.PI) / 2);

            leftArmRef.current.rotation.set(
              MathUtils.lerp(-0.75, -2.75, liftEase),
              MathUtils.lerp(0.15, 0.12, liftEase),
              MathUtils.lerp(-0.15, -0.18, liftEase)
            );
            rightArmRef.current.rotation.set(
              MathUtils.lerp(-0.25, -1.75, liftEase),
              MathUtils.lerp(-0.25, -0.48, liftEase),
              MathUtils.lerp(0.2, 0.68, liftEase)
            );
            racketGroupRef.current.rotation.set(
              MathUtils.lerp(0.5, 0.85, liftEase),
              MathUtils.lerp(-0.2, 0.22, liftEase),
              MathUtils.lerp(0.3, -0.42, liftEase)
            );
            torsoGroupRef.current.rotation.set(
              MathUtils.lerp(0.12, -0.18, liftEase),
              MathUtils.lerp(-0.15, -0.28, liftEase),
              MathUtils.lerp(0, 0.12, liftEase)
            );
          } else {
            // Ball is in free flight ascending to apex
            leftArmRef.current.rotation.set(-2.75, 0.12, -0.18);
            rightArmRef.current.rotation.set(-1.75, -0.48, 0.68);
            racketGroupRef.current.rotation.set(0.85, 0.22, -0.42);
            torsoGroupRef.current.rotation.set(-0.18, -0.28, 0.12);
          }
        } else if (isServePrep) {
          torsoGroupRef.current.rotation.set(0.12, -0.22, 0);
          leftArmRef.current.rotation.set(-0.75, 0.15, -0.15);
          rightArmRef.current.rotation.set(-0.25, -0.25, 0.2);
          racketGroupRef.current.rotation.set(0.5, -0.2, 0.3);
        } else if (isRunning) {
          torsoGroupRef.current.rotation.y = 0;
          const leftArmSwing = -Math.sin(gaitPhase) * 0.75;
          const rightArmPump = Math.sin(gaitPhase) * 0.4;

          leftArmRef.current.rotation.set(leftArmSwing, 0.1, -0.15);
          rightArmRef.current.rotation.set(-0.25 + rightArmPump, -0.25, 0.2);
          racketGroupRef.current.rotation.set(0.6, -0.2, 0.25);
        } else {
          torsoGroupRef.current.rotation.y = 0;
          rightArmRef.current.rotation.set(
            -0.62 + readyPulse * 0.03,
            -0.26,
            0.2
          );
          racketGroupRef.current.rotation.set(0.55, -0.18, 0.25);
          leftArmRef.current.rotation.set(
            -0.68 + readyPulse * 0.03,
            0.28,
            -0.28
          );
        }
      }
    }
  });

  // Modern Tour Color Palette
  const skinColor = '#d99e69';
  const shirtColor = isOpponent ? '#1d4ed8' : '#ffffff';
  const shirtAccentColor = isOpponent ? '#ffffff' : '#0284c7';
  const shortsColor = isOpponent ? '#0f172a' : '#f8fafc';
  const shortsPipingColor = isOpponent ? '#38bdf8' : '#0284c7';
  const headbandColor = isOpponent ? '#ffffff' : '#00b4d8';
  const hairColor = isOpponent ? '#292524' : '#78350f';
  const racketFrameColor = isOpponent ? '#1e40af' : '#0284c7';

  return (
    <group ref={groupRef} rotation={[0, isOpponent ? 0 : Math.PI, 0]}>
      {/* Dynamic Court Ground Shadow */}
      <mesh position={[0, 0.012, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.58, 32]} />
        <meshBasicMaterial color="#000000" transparent opacity={0.38} />
      </mesh>

      {/* ====================================================================
          UNIFIED SKELETON ROOT: PELVIS / HIPS
          ==================================================================== */}
      <group ref={pelvisGroupRef} position={[0, 0.82, 0]}>
        {/* Core Pelvic Base */}
        <mesh position={[0, 0.02, 0]} castShadow>
          <sphereGeometry args={[0.22, 24, 24]} />
          <meshStandardMaterial color={shortsColor} roughness={0.65} />
        </mesh>

        {/* Elastic Waistband */}
        <mesh position={[0, 0.12, 0]}>
          <cylinderGeometry args={[0.21, 0.22, 0.05, 24]} />
          <meshStandardMaterial color={shortsPipingColor} roughness={0.7} />
        </mesh>

        {/* Left Shorts Leg with Tour Flare */}
        <group position={[-0.18, -0.08, 0]}>
          <mesh castShadow>
            <cylinderGeometry args={[0.13, 0.155, 0.24, 24]} />
            <meshStandardMaterial color={shortsColor} roughness={0.65} />
          </mesh>
          {/* Side Technical Contrast Piping */}
          <mesh position={[-0.145, 0, 0]} rotation={[0, 0, 0.08]}>
            <boxGeometry args={[0.018, 0.24, 0.05]} />
            <meshStandardMaterial color={shortsPipingColor} roughness={0.5} />
          </mesh>
        </group>

        {/* Right Shorts Leg with Tour Flare */}
        <group position={[0.18, -0.08, 0]}>
          <mesh castShadow>
            <cylinderGeometry args={[0.13, 0.155, 0.24, 24]} />
            <meshStandardMaterial color={shortsColor} roughness={0.65} />
          </mesh>
          {/* Side Technical Contrast Piping */}
          <mesh position={[0.145, 0, 0]} rotation={[0, 0, -0.08]}>
            <boxGeometry args={[0.018, 0.24, 0.05]} />
            <meshStandardMaterial color={shortsPipingColor} roughness={0.5} />
          </mesh>
        </group>

        {/* ====================================================================
            1. TORSO & HEAD HIERARCHY
            ==================================================================== */}
        <group ref={torsoGroupRef} position={[0, 0.16, 0]}>
          {/* Athletic Torso / Fitted Tour Jersey */}
          <mesh position={[0, 0.22, 0]} castShadow>
            <capsuleGeometry args={[0.215, 0.36, 20, 28]} />
            <meshStandardMaterial color={shirtColor} roughness={0.5} />
          </mesh>

          {/* Athletic Pectoral Muscle Contour */}
          <mesh position={[-0.08, 0.28, 0.12]} rotation={[0.15, -0.1, 0]}>
            <sphereGeometry args={[0.09, 16, 16]} />
            <meshStandardMaterial color={shirtColor} roughness={0.5} />
          </mesh>
          <mesh position={[0.08, 0.28, 0.12]} rotation={[0.15, 0.1, 0]}>
            <sphereGeometry args={[0.09, 16, 16]} />
            <meshStandardMaterial color={shirtColor} roughness={0.5} />
          </mesh>

          {/* Technical Side Flank Panels */}
          <mesh position={[-0.2, 0.2, 0]} rotation={[0, 0, 0.05]}>
            <boxGeometry args={[0.035, 0.28, 0.14]} />
            <meshStandardMaterial color={shirtAccentColor} roughness={0.6} />
          </mesh>
          <mesh position={[0.2, 0.2, 0]} rotation={[0, 0, -0.05]}>
            <boxGeometry args={[0.035, 0.28, 0.14]} />
            <meshStandardMaterial color={shirtAccentColor} roughness={0.6} />
          </mesh>

          {/* Ribbed Turn-Down Polo Collar */}
          <mesh position={[0, 0.46, 0]} rotation={[Math.PI / 2.3, 0, 0]}>
            <torusGeometry args={[0.115, 0.024, 16, 32]} />
            <meshStandardMaterial color={shirtAccentColor} roughness={0.4} />
          </mesh>

          {/* Front Button Placket & Buttons */}
          <mesh position={[0, 0.38, 0.21]} rotation={[-0.1, 0, 0]}>
            <boxGeometry args={[0.04, 0.12, 0.012]} />
            <meshStandardMaterial color={shirtAccentColor} roughness={0.4} />
          </mesh>
          <mesh position={[0, 0.41, 0.22]}>
            <sphereGeometry args={[0.008, 8, 8]} />
            <meshStandardMaterial color="#ffffff" roughness={0.3} />
          </mesh>
          <mesh position={[0, 0.36, 0.22]}>
            <sphereGeometry args={[0.008, 8, 8]} />
            <meshStandardMaterial color="#ffffff" roughness={0.3} />
          </mesh>

          {/* Tour Athlete Chest Badge */}
          <mesh position={[-0.1, 0.34, 0.2]}>
            <cylinderGeometry args={[0.02, 0.02, 0.005, 16]} />
            <meshStandardMaterial color={shirtAccentColor} metalness={0.6} roughness={0.3} />
          </mesh>

          {/* Left Sleeve Trim & Rounded Deltoid Cap (Anatomical Left: +0.25) */}
          <group position={[0.25, 0.38, 0]}>
            <mesh castShadow>
              <sphereGeometry args={[0.095, 20, 20]} />
              <meshStandardMaterial color={shirtColor} roughness={0.5} />
            </mesh>
            <mesh position={[0.02, -0.05, 0]} rotation={[0, 0, -0.2]}>
              <cylinderGeometry args={[0.088, 0.088, 0.025, 20]} />
              <meshStandardMaterial color={shirtAccentColor} roughness={0.4} />
            </mesh>
          </group>

          {/* Right Sleeve Trim & Rounded Deltoid Cap (Anatomical Right: -0.25) */}
          <group position={[-0.25, 0.38, 0]}>
            <mesh castShadow>
              <sphereGeometry args={[0.095, 20, 20]} />
              <meshStandardMaterial color={shirtColor} roughness={0.5} />
            </mesh>
            <mesh position={[-0.02, -0.05, 0]} rotation={[0, 0, 0.2]}>
              <cylinderGeometry args={[0.088, 0.088, 0.025, 20]} />
              <meshStandardMaterial color={shirtAccentColor} roughness={0.4} />
            </mesh>
          </group>

          {/* ====================================================================
              HEAD, ATHLETIC FACE, HAIR & TOUR HEADBAND
              ==================================================================== */}
          <group ref={headGroupRef} position={[0, 0.5, 0]}>
            {/* Muscular Neck */}
            <mesh position={[0, 0.04, 0]} castShadow>
              <cylinderGeometry args={[0.078, 0.088, 0.14, 20]} />
              <meshStandardMaterial color={skinColor} roughness={0.58} />
            </mesh>

            {/* Cranium & Sculpted Jawline */}
            <mesh position={[0, 0.2, 0]} castShadow>
              <sphereGeometry args={[0.17, 28, 28]} />
              <meshStandardMaterial color={skinColor} roughness={0.55} />
            </mesh>
            <mesh position={[0, 0.12, 0.06]} castShadow>
              <boxGeometry args={[0.13, 0.1, 0.12]} />
              <meshStandardMaterial color={skinColor} roughness={0.55} />
            </mesh>

            {/* Nose Bridge */}
            <mesh position={[0, 0.18, 0.18]} rotation={[0.2, 0, 0]}>
              <coneGeometry args={[0.022, 0.06, 12]} />
              <meshStandardMaterial color={skinColor} roughness={0.55} />
            </mesh>

            {/* Expressive Athletic Eyes */}
            <group position={[0, 0.21, 0.155]}>
              {/* Left Eye */}
              <mesh position={[0.055, 0, 0]}>
                <sphereGeometry args={[0.022, 12, 12]} />
                <meshStandardMaterial color="#ffffff" roughness={0.2} />
              </mesh>
              <mesh position={[0.055, 0, 0.015]}>
                <sphereGeometry args={[0.012, 10, 10]} />
                <meshStandardMaterial color="#1e293b" />
              </mesh>
              {/* Right Eye */}
              <mesh position={[-0.055, 0, 0]}>
                <sphereGeometry args={[0.022, 12, 12]} />
                <meshStandardMaterial color="#ffffff" roughness={0.2} />
              </mesh>
              <mesh position={[-0.055, 0, 0.015]}>
                <sphereGeometry args={[0.012, 10, 10]} />
                <meshStandardMaterial color="#1e293b" />
              </mesh>
            </group>

            {/* Layered Textured Athletic Hair */}
            <mesh position={[0, 0.26, -0.02]} castShadow>
              <sphereGeometry args={[0.178, 24, 24]} />
              <meshStandardMaterial color={hairColor} roughness={0.85} />
            </mesh>
            <mesh position={[0, 0.32, 0.03]} castShadow>
              <sphereGeometry args={[0.13, 16, 16]} />
              <meshStandardMaterial color={hairColor} roughness={0.85} />
            </mesh>
            <mesh position={[-0.12, 0.22, -0.02]} castShadow>
              <sphereGeometry args={[0.07, 12, 12]} />
              <meshStandardMaterial color={hairColor} roughness={0.85} />
            </mesh>
            <mesh position={[0.12, 0.22, -0.02]} castShadow>
              <sphereGeometry args={[0.07, 12, 12]} />
              <meshStandardMaterial color={hairColor} roughness={0.85} />
            </mesh>

            {/* Seamless Elastic Tour Headband */}
            <mesh position={[0, 0.23, 0]} rotation={[Math.PI / 2, 0, 0]} castShadow>
              <torusGeometry args={[0.175, 0.024, 16, 36]} />
              <meshStandardMaterial color={headbandColor} roughness={0.35} />
            </mesh>

            {/* Bandana Knot & Fluttering Ribbons at Back of Head */}
            <group ref={headbandRibbonRef} position={[0, 0.23, -0.18]}>
              <mesh>
                <sphereGeometry args={[0.025, 12, 12]} />
                <meshStandardMaterial color={headbandColor} roughness={0.35} />
              </mesh>
              <mesh position={[-0.03, -0.08, -0.02]} rotation={[0.2, -0.1, -0.3]}>
                <boxGeometry args={[0.024, 0.14, 0.006]} />
                <meshStandardMaterial color={headbandColor} roughness={0.35} />
              </mesh>
              <mesh position={[0.03, -0.08, -0.02]} rotation={[0.25, 0.1, 0.3]}>
                <boxGeometry args={[0.024, 0.14, 0.006]} />
                <meshStandardMaterial color={headbandColor} roughness={0.35} />
              </mesh>
            </group>
          </group>

          {/* ====================================================================
              2. ARTICULATED LEFT ARM & HAND (Holding / Tossing Ball - Positioned at +0.25)
              ==================================================================== */}
          <group ref={leftArmRef} position={[0.25, 0.38, 0]}>
            {/* Left Bicep */}
            <mesh position={[0.03, -0.14, 0.02]} rotation={[0.2, 0, -0.3]} castShadow>
              <capsuleGeometry args={[0.058, 0.2, 16, 20]} />
              <meshStandardMaterial color={skinColor} roughness={0.58} />
            </mesh>
            {/* Left Elbow Joint */}
            <mesh position={[0.05, -0.27, 0.04]}>
              <sphereGeometry args={[0.054, 14, 14]} />
              <meshStandardMaterial color={skinColor} roughness={0.58} />
            </mesh>
            {/* Left Forearm */}
            <mesh position={[0.04, -0.38, 0.08]} rotation={[-0.3, 0, -0.1]} castShadow>
              <capsuleGeometry args={[0.05, 0.18, 16, 20]} />
              <meshStandardMaterial color={skinColor} roughness={0.58} />
            </mesh>
            {/* Terrycloth Sweatband */}
            <mesh position={[0.03, -0.46, 0.1]} rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[0.054, 0.054, 0.045, 20]} />
              <meshStandardMaterial color="#ffffff" roughness={0.9} />
            </mesh>
            {/* Left Hand: Modeled Palm & Fingers for Holding/Releasing Ball */}
            <group position={[0.03, -0.51, 0.11]}>
              <mesh castShadow>
                <boxGeometry args={[0.055, 0.05, 0.025]} />
                <meshStandardMaterial color={skinColor} roughness={0.58} />
              </mesh>
              {/* Opposed Thumb */}
              <mesh position={[-0.025, 0.01, 0.015]} rotation={[0, -0.4, -0.2]}>
                <capsuleGeometry args={[0.012, 0.03, 8, 8]} />
                <meshStandardMaterial color={skinColor} roughness={0.58} />
              </mesh>
              {/* Cupped Fingers */}
              <mesh position={[0.005, -0.032, 0.01]} rotation={[-0.3, 0, 0]}>
                <boxGeometry args={[0.048, 0.035, 0.015]} />
                <meshStandardMaterial color={skinColor} roughness={0.58} />
              </mesh>
            </group>
          </group>

          {/* ====================================================================
              3. ARTICULATED RIGHT ARM, HAND & PRO GRAPHITE RACKET (Positioned at -0.25)
              ==================================================================== */}
          <group ref={rightArmRef} position={[-0.25, 0.38, 0]}>
            {/* Right Bicep */}
            <mesh position={[-0.03, -0.14, 0.04]} rotation={[-0.4, 0, 0.2]} castShadow>
              <capsuleGeometry args={[0.062, 0.2, 16, 20]} />
              <meshStandardMaterial color={skinColor} roughness={0.58} />
            </mesh>
            {/* Right Elbow Joint */}
            <mesh position={[-0.05, -0.27, 0.08]}>
              <sphereGeometry args={[0.056, 14, 14]} />
              <meshStandardMaterial color={skinColor} roughness={0.58} />
            </mesh>
            {/* Right Forearm */}
            <mesh position={[-0.04, -0.2, 0.22]} rotation={[-1.1, 0, -0.1]} castShadow>
              <capsuleGeometry args={[0.052, 0.18, 16, 20]} />
              <meshStandardMaterial color={skinColor} roughness={0.58} />
            </mesh>
            {/* Terrycloth Sweatband */}
            <mesh position={[-0.03, -0.13, 0.3]} rotation={[0.4, 0, 0]}>
              <cylinderGeometry args={[0.056, 0.056, 0.045, 20]} />
              <meshStandardMaterial color="#ffffff" roughness={0.9} />
            </mesh>
            {/* Right Hand Wrapping Tightly Around Handle */}
            <group position={[-0.02, -0.08, 0.35]}>
              <mesh castShadow>
                <boxGeometry args={[0.058, 0.052, 0.028]} />
                <meshStandardMaterial color={skinColor} roughness={0.58} />
              </mesh>
              {/* Opposed Thumb wrapped around grip */}
              <mesh position={[0.028, 0.01, 0.015]} rotation={[0, 0.5, 0.3]}>
                <capsuleGeometry args={[0.013, 0.034, 8, 8]} />
                <meshStandardMaterial color={skinColor} roughness={0.58} />
              </mesh>
              {/* Wrapped Fingers */}
              <mesh position={[-0.01, -0.02, 0.025]} rotation={[0.6, 0, 0]}>
                <capsuleGeometry args={[0.018, 0.048, 8, 8]} />
                <meshStandardMaterial color={skinColor} roughness={0.58} />
              </mesh>
            </group>

            {/* PRO GRAPHITE TENNIS RACKET */}
            <group ref={racketGroupRef} position={[-0.02, -0.06, 0.38]} rotation={[0.5, -0.2, 0.3]}>
              {/* Branded Butt Cap */}
              <mesh position={[0, -0.165, 0]}>
                <cylinderGeometry args={[0.026, 0.028, 0.02, 16]} />
                <meshStandardMaterial color="#0f172a" metalness={0.7} roughness={0.3} />
              </mesh>

              {/* Octagonal Handle with Overgrip Wrapping Ridges */}
              <mesh position={[0, 0, 0]} castShadow>
                <cylinderGeometry args={[0.022, 0.024, 0.32, 16]} />
                <meshStandardMaterial color="#ffffff" roughness={0.8} />
              </mesh>
              {/* Grip Finishing Tape */}
              <mesh position={[0, 0.15, 0]}>
                <cylinderGeometry args={[0.023, 0.023, 0.02, 16]} />
                <meshStandardMaterial color="#0f172a" />
              </mesh>

              {/* Aerodynamic Open Split V-Throat (Dual-Prong Yoke) */}
              <group position={[0, 0.24, 0]}>
                {/* Left Prong */}
                <mesh position={[-0.032, 0, 0]} rotation={[0, 0, -0.28]} castShadow>
                  <cylinderGeometry args={[0.012, 0.014, 0.16, 12]} />
                  <meshStandardMaterial color={racketFrameColor} metalness={0.85} roughness={0.2} />
                </mesh>
                {/* Right Prong */}
                <mesh position={[0.032, 0, 0]} rotation={[0, 0, 0.28]} castShadow>
                  <cylinderGeometry args={[0.012, 0.014, 0.16, 12]} />
                  <meshStandardMaterial color={racketFrameColor} metalness={0.85} roughness={0.2} />
                </mesh>
                {/* Horizontal Bridge / Crossbar */}
                <mesh position={[0, 0.065, 0]} rotation={[0, 0, Math.PI / 2]}>
                  <cylinderGeometry args={[0.01, 0.01, 0.08, 12]} />
                  <meshStandardMaterial color={racketFrameColor} metalness={0.85} roughness={0.2} />
                </mesh>
              </group>

              {/* Elliptical Graphite Head Frame */}
              <mesh position={[0, 0.48, 0]} scale={[1.0, 1.38, 1.0]} castShadow>
                <torusGeometry args={[0.18, 0.016, 16, 36]} />
                <meshStandardMaterial color={racketFrameColor} metalness={0.9} roughness={0.15} />
              </mesh>

              {/* Protective Bumper Guard Along Frame Tip */}
              <mesh position={[0, 0.64, 0]} scale={[0.85, 0.35, 1.0]}>
                <torusGeometry args={[0.18, 0.018, 12, 24, Math.PI]} />
                <meshStandardMaterial color="#0f172a" roughness={0.7} />
              </mesh>

              {/* High-Tension String Bed */}
              <mesh position={[0, 0.48, 0]} scale={[1.0, 1.38, 1.0]}>
                <cylinderGeometry args={[0.17, 0.17, 0.004, 32]} />
                <meshStandardMaterial color="#f8fafc" transparent opacity={0.4} roughness={0.1} />
              </mesh>
            </group>
          </group>
        </group>

        {/* ====================================================================
            5. ARTICULATED LEFT LEG & PRO TOUR SNEAKER (Strictly Parallel Track)
            ==================================================================== */}
        <group ref={leftLegRef} position={[0.28, -0.08, 0]}>
          {/* Muscular Thigh */}
          <mesh position={[0, -0.16, 0]} castShadow>
            <capsuleGeometry args={[0.08, 0.25, 16, 20]} />
            <meshStandardMaterial color={skinColor} roughness={0.58} />
          </mesh>

          {/* Left Knee Group */}
          <group ref={leftKneeRef} position={[0, -0.32, 0]}>
            {/* Patella Joint */}
            <mesh position={[0, 0, 0.01]}>
              <sphereGeometry args={[0.072, 16, 16]} />
              <meshStandardMaterial color={skinColor} roughness={0.58} />
            </mesh>
            {/* Muscular Calf */}
            <mesh position={[0, -0.16, 0]} castShadow>
              <capsuleGeometry args={[0.07, 0.25, 16, 20]} />
              <meshStandardMaterial color={skinColor} roughness={0.58} />
            </mesh>
            {/* Crew Tennis Sock with Dual Stripes */}
            <group position={[0, -0.3, 0]}>
              <mesh>
                <cylinderGeometry args={[0.07, 0.07, 0.13, 20]} />
                <meshStandardMaterial color="#ffffff" roughness={0.8} />
              </mesh>
              <mesh position={[0, 0.04, 0]}>
                <torusGeometry args={[0.071, 0.005, 8, 24]} />
                <meshStandardMaterial color={shirtAccentColor} />
              </mesh>
              <mesh position={[0, 0.02, 0]}>
                <torusGeometry args={[0.071, 0.005, 8, 24]} />
                <meshStandardMaterial color={shirtAccentColor} />
              </mesh>
            </group>

            {/* Pro Tour Tennis Sneaker */}
            <group position={[0, -0.38, 0.04]}>
              {/* Heel Counter */}
              <mesh position={[0, 0.02, -0.06]} castShadow>
                <sphereGeometry args={[0.07, 16, 16]} />
                <meshStandardMaterial color="#ffffff" roughness={0.35} />
              </mesh>
              {/* Main Shoe Body & Forefoot */}
              <mesh position={[0, 0.02, 0.04]} rotation={[Math.PI / 2, 0, 0]} castShadow>
                <capsuleGeometry args={[0.066, 0.16, 16, 20]} />
                <meshStandardMaterial color="#ffffff" roughness={0.35} />
              </mesh>
              {/* Cushioned EVA Midsole */}
              <mesh position={[0, -0.02, 0.01]} rotation={[Math.PI / 2, 0, 0]}>
                <capsuleGeometry args={[0.07, 0.18, 14, 18]} />
                <meshStandardMaterial color={shirtAccentColor} roughness={0.5} />
              </mesh>
              {/* Outsole Base / Herringbone Rubber */}
              <mesh position={[0, -0.038, 0.01]} rotation={[Math.PI / 2, 0, 0]}>
                <capsuleGeometry args={[0.072, 0.185, 12, 16]} />
                <meshStandardMaterial color="#334155" roughness={0.9} />
              </mesh>
              {/* Tongue & Laces */}
              <mesh position={[0, 0.055, 0.02]} rotation={[-0.4, 0, 0]}>
                <boxGeometry args={[0.045, 0.08, 0.02]} />
                <meshStandardMaterial color="#f1f5f9" roughness={0.5} />
              </mesh>
            </group>
          </group>
        </group>

        {/* ====================================================================
            6. ARTICULATED RIGHT LEG & PRO TOUR SNEAKER (Strictly Parallel Track)
            ==================================================================== */}
        <group ref={rightLegRef} position={[-0.28, -0.08, 0]}>
          {/* Muscular Thigh */}
          <mesh position={[0, -0.16, 0]} castShadow>
            <capsuleGeometry args={[0.08, 0.25, 16, 20]} />
            <meshStandardMaterial color={skinColor} roughness={0.58} />
          </mesh>

          {/* Right Knee Group */}
          <group ref={rightKneeRef} position={[0, -0.32, 0]}>
            {/* Patella Joint */}
            <mesh position={[0, 0, 0.01]}>
              <sphereGeometry args={[0.072, 16, 16]} />
              <meshStandardMaterial color={skinColor} roughness={0.58} />
            </mesh>
            {/* Muscular Calf */}
            <mesh position={[0, -0.16, 0]} castShadow>
              <capsuleGeometry args={[0.07, 0.25, 16, 20]} />
              <meshStandardMaterial color={skinColor} roughness={0.58} />
            </mesh>
            {/* Crew Tennis Sock with Dual Stripes */}
            <group position={[0, -0.3, 0]}>
              <mesh>
                <cylinderGeometry args={[0.07, 0.07, 0.13, 20]} />
                <meshStandardMaterial color="#ffffff" roughness={0.8} />
              </mesh>
              <mesh position={[0, 0.04, 0]}>
                <torusGeometry args={[0.071, 0.005, 8, 24]} />
                <meshStandardMaterial color={shirtAccentColor} />
              </mesh>
              <mesh position={[0, 0.02, 0]}>
                <torusGeometry args={[0.071, 0.005, 8, 24]} />
                <meshStandardMaterial color={shirtAccentColor} />
              </mesh>
            </group>

            {/* Pro Tour Tennis Sneaker */}
            <group position={[0, -0.38, 0.04]}>
              {/* Heel Counter */}
              <mesh position={[0, 0.02, -0.06]} castShadow>
                <sphereGeometry args={[0.07, 16, 16]} />
                <meshStandardMaterial color="#ffffff" roughness={0.35} />
              </mesh>
              {/* Main Shoe Body & Forefoot */}
              <mesh position={[0, 0.02, 0.04]} rotation={[Math.PI / 2, 0, 0]} castShadow>
                <capsuleGeometry args={[0.066, 0.16, 16, 20]} />
                <meshStandardMaterial color="#ffffff" roughness={0.35} />
              </mesh>
              {/* Cushioned EVA Midsole */}
              <mesh position={[0, -0.02, 0.01]} rotation={[Math.PI / 2, 0, 0]}>
                <capsuleGeometry args={[0.07, 0.18, 14, 18]} />
                <meshStandardMaterial color={shirtAccentColor} roughness={0.5} />
              </mesh>
              {/* Outsole Base / Herringbone Rubber */}
              <mesh position={[0, -0.038, 0.01]} rotation={[Math.PI / 2, 0, 0]}>
                <capsuleGeometry args={[0.072, 0.185, 12, 16]} />
                <meshStandardMaterial color="#334155" roughness={0.9} />
              </mesh>
              {/* Tongue & Laces */}
              <mesh position={[0, 0.055, 0.02]} rotation={[-0.4, 0, 0]}>
                <boxGeometry args={[0.045, 0.08, 0.02]} />
                <meshStandardMaterial color="#f1f5f9" roughness={0.5} />
              </mesh>
            </group>
          </group>
        </group>
      </group>
    </group>
  );
};
