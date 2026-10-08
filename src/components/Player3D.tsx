import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Group, Vector3, MathUtils } from 'three';
import { useKeyboardControls } from '../hooks/useKeyboardControls';
import { useTennisStore } from '../store/useTennisStore';

interface Player3DProps {
  position: [number, number, number];
  isOpponent?: boolean;
  isControlled?: boolean;
}

/**
 * Authentic, dynamic 3D tennis athlete with realistic unified skeletal kinematics:
 * 1. Unified Pelvis-Torso Skeleton (torso is firmly attached to the hips; never breaks):
 *    - In ready stance, pelvis sinks down & back ("bajando el culo")
 *    - Torso hinges forward naturally at the lumbar spine (~32° forward lean)
 *    - Head counter-rotates upward to keep eyes locked straight ahead on the ball
 * 2. Strictly Parallel Legs ("piernas paralelas"):
 *    - Left and right legs sit on parallel tracks (X = -0.28m and X = +0.28m)
 *    - Motion is strictly in the sagittal plane (pure X-axis flexion/extension; NO crossed angles)
 *    - Deep knee flexion and parallel feet planted flat on the court
 * 3. Directional turn & running footwork ("se giran y corren en la dirección de la pelota"):
 *    - Body rotates yaw to face the movement vector
 *    - Smooth transition between deep squat stance and parallel-track sprint gait
 * 4. Open-stance direct forehand drive with right hand ("golpe directo con la mano diestra"):
 *    - Low, solid open stance base
 *    - Torso uncoils, right arm drives directly through the ball with topspin
 *    - Left arm counter-balances open (Federer style) with high follow-through
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
  const currentShotType = useRef<'drive' | 'backhand' | 'smash'>('drive');
  const swingProgress = useRef(0);
  const isSwinging = useRef(false);
  const lastCpuSwingTrigger = useRef(0);
  const lastP1SwingTrigger = useRef(0);

  const lastMatchStatus = useRef<string>('');
  const lastServeSide = useRef<string>('');

  useFrame((state, delta) => {
    if (!groupRef.current) return;

    const t = state.clock.getElapsedTime();
    const matchStatus = useTennisStore.getState().matchStatus;
    const serveSide = useTennisStore.getState().serveSide;
    const p1SwingTrigger = useTennisStore.getState().p1SwingTrigger;
    const cpuSwingTrigger = useTennisStore.getState().cpuSwingTrigger;

    // =========================================================================
    // 1. POSITION & VELOCITY UPDATES
    // =========================================================================
    if (isControlled) {
      const server = useTennisStore.getState().server;
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

      if (keys.current.left) dx -= 1;
      if (keys.current.right) dx += 1;
      if (keys.current.forward) dz -= 1;
      if (keys.current.backward) dz += 1;

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

      useTennisStore.getState().p1Pos = [currentPos.current.x, currentPos.current.y, currentPos.current.z];

      // Swing action listener (keyboard or ball hit trigger)
      if (p1SwingTrigger !== lastP1SwingTrigger.current) {
        lastP1SwingTrigger.current = p1SwingTrigger;
        currentShotType.current = useTennisStore.getState().p1ShotType;
        isSwinging.current = true;
        swingProgress.current = 1.0;
      } else if (keys.current.action && !isSwinging.current && matchStatus !== 'serve_prep') {
        const ball = useTennisStore.getState().ballPos;
        const isRight = ball[0] >= currentPos.current.x - 0.1;
        currentShotType.current = matchStatus === 'serving' ? 'smash' : isRight ? 'drive' : 'backhand';
        isSwinging.current = true;
        swingProgress.current = 1.0;
      }
    } else if (isOpponent) {
      // CPU AI predictive movement
      const ball = useTennisStore.getState().ballPos;
      const ballV = useTennisStore.getState().ballVel;
      const status = useTennisStore.getState().matchStatus;

      let targetX = 0;
      let targetZ = -12.2;

      if (status === 'playing' || status === 'serving') {
        const isBallIncoming = ballV[2] < 0;

        if (isBallIncoming) {
          const timeToReach = Math.max(0.1, (ball[2] - (-12.0)) / Math.max(0.5, -ballV[2]));
          const predictedX = ball[0] + ballV[0] * timeToReach;
          targetX = Math.max(-5.5, Math.min(5.5, predictedX + 0.25));
          targetZ = Math.max(-13.0, Math.min(-9.0, ball[2] < -8.5 ? ball[2] - 0.5 : -12.0));
        } else {
          targetX = 0;
          targetZ = -12.2;
        }
      } else {
        const server = useTennisStore.getState().server;
        const currentServeSide = useTennisStore.getState().serveSide;
        if (server === 'cpu') {
          // CPU server standing at baseline in correct serving quadrant
          targetX = currentServeSide === 'deuce' ? -1.8 : 1.8;
          targetZ = -12.35;
        } else {
          // CPU receiver ready for P1 serve
          targetX = currentServeSide === 'deuce' ? -2.2 : 2.2;
          targetZ = -12.35;
        }
      }

      const diffX = targetX - currentPos.current.x;
      const diffZ = targetZ - currentPos.current.z;
      const dist = Math.hypot(diffX, diffZ);
      const isMoving = dist > 0.08;

      const cpuSpeed = 7.6;
      if (isMoving) {
        const vx = (diffX / dist) * Math.min(dist, cpuSpeed);
        const vz = (diffZ / dist) * Math.min(dist, cpuSpeed);
        velocity.current.x = vx;
        velocity.current.z = vz;
        currentPos.current.x += vx * delta;
        currentPos.current.z += vz * delta;
      } else {
        velocity.current.x = 0;
        velocity.current.z = 0;
      }

      currentPos.current.x = Math.max(-6.2, Math.min(6.2, currentPos.current.x));
      currentPos.current.z = Math.max(-14.5, Math.min(-8.0, currentPos.current.z));

      useTennisStore.getState().cpuPos = [currentPos.current.x, currentPos.current.y, currentPos.current.z];

      if (cpuSwingTrigger !== lastCpuSwingTrigger.current) {
        lastCpuSwingTrigger.current = cpuSwingTrigger;
        currentShotType.current = useTennisStore.getState().cpuShotType;
        isSwinging.current = true;
        swingProgress.current = 1.0;
      }
    }

    // =========================================================================
    // 2. DIRECTIONAL TURNING & ORIENTATION ("SE GIRAN Y CORREN EN LA DIRECCIÓN")
    // =========================================================================
    const speed = Math.hypot(velocity.current.x, velocity.current.z);
    const isRunning = speed > 0.45;

    // Advance running gait cycle with cadence proportional to velocity
    if (isRunning) {
      stepProgress.current += delta * Math.min(speed * 2.8, 22.0);
    }
    const gaitPhase = stepProgress.current;

    // Target facing angle
    let targetFacing = isOpponent ? 0 : Math.PI;

    if (isSwinging.current) {
      targetFacing = isOpponent ? 0.18 : Math.PI - 0.18;
    } else if (isRunning) {
      targetFacing = Math.atan2(velocity.current.x, velocity.current.z);
    } else {
      targetFacing = isOpponent ? 0 : Math.PI;
    }

    // Smooth shortest-arc yaw rotation
    let angleDiff = targetFacing - currentFacingAngle.current;
    while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
    while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
    currentFacingAngle.current += angleDiff * Math.min(1.0, delta * 12.0);

    // Lateral banking tilt when sprinting
    const targetRoll = isRunning ? (-velocity.current.x / 8.8) * 0.16 : 0;
    const targetPitch = isRunning ? 0.12 : 0; // Forward sprint lean
    currentTilt.current.roll = MathUtils.lerp(currentTilt.current.roll, targetRoll, 0.2);
    currentTilt.current.pitch = MathUtils.lerp(currentTilt.current.pitch, targetPitch, 0.2);

    // Split-step active elastic ready pulse (frequency ~7.5 Hz)
    const readyPulse = Math.sin(t * 7.5);

    // Transition blend between deep squat and sprint
    const targetSquat = isRunning ? 0.0 : isSwinging.current ? 0.85 : 1.0;
    squatAmount.current = MathUtils.lerp(squatAmount.current, targetSquat, delta * 10.0);
    const sq = squatAmount.current;

    const verticalBob = isRunning
      ? Math.abs(Math.sin(gaitPhase)) * 0.055
      : readyPulse * 0.018 * sq;

    groupRef.current.position.set(
      currentPos.current.x,
      position[1] + verticalBob,
      currentPos.current.z
    );

    groupRef.current.rotation.set(
      currentTilt.current.pitch,
      currentFacingAngle.current,
      currentTilt.current.roll
    );

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
      // 1. Pelvis height and depth (low center of gravity: hips down & back)
      // When standing/sprinting: Y = 0.82m, Z = 0.0m
      // When deep squatting: Y drops to ~0.56m, Z moves back to -0.16m ("bajando el culo")
      const currentHipY = MathUtils.lerp(0.82, 0.56 + readyPulse * 0.02, sq);
      const currentHipZ = MathUtils.lerp(0.0, -0.16, sq);
      pelvisGroupRef.current.position.set(0, currentHipY, currentHipZ);

      // 2. Torso forward athletic lean & Head counter-rotation
      // Torso tilts forward from the lumbar spine (attached directly to pelvis!)
      const torsoLean = MathUtils.lerp(0.12, 0.56, sq);
      torsoGroupRef.current.rotation.x = torsoLean;
      // Head tilts up to keep eyes focused straight ahead on the ball
      headGroupRef.current.rotation.x = -torsoLean * 0.82;

      // 3. LEGS: STRICTLY PARALLEL sagittal kinematics (ZERO crossing, ZERO Y/Z twist!)
      if (isRunning) {
        // --- PARALLEL-TRACK SPRINTING GAIT ---
        // Hip flexion & extension strictly along forward/back axis
        const leftHipSwing = Math.sin(gaitPhase) * 0.82;
        const rightHipSwing = -Math.sin(gaitPhase) * 0.82;

        // Knee bends sharply on backswing (heel kicks up towards glute), extends on plant
        const leftKneeBend = -Math.max(0.12, -Math.sin(gaitPhase)) * 1.15;
        const rightKneeBend = -Math.max(0.12, Math.sin(gaitPhase)) * 1.15;

        leftLegRef.current.rotation.set(leftHipSwing, 0, 0);
        rightLegRef.current.rotation.set(rightHipSwing, 0, 0);

        leftKneeRef.current.rotation.set(leftKneeBend, 0, 0);
        rightKneeRef.current.rotation.set(rightKneeBend, 0, 0);
      } else {
        // --- PARALLEL-TRACK DEEP SQUAT / READY STANCE ---
        // Both thighs flex forward in parallel: +0.82 rad (~47° forward)
        // Both knees bend back in parallel: -1.48 rad (~85° backward bend)
        // Feet plant flat and parallel on court surface at X = -0.28m and X = +0.28m
        const thighFlex = MathUtils.lerp(0.1, 0.82 - readyPulse * 0.035, sq);
        const kneeFlex = MathUtils.lerp(-0.15, -1.48 + readyPulse * 0.07, sq);

        leftLegRef.current.rotation.set(thighFlex, 0, 0);
        rightLegRef.current.rotation.set(thighFlex, 0, 0);

        leftKneeRef.current.rotation.set(kneeFlex, 0, 0);
        rightKneeRef.current.rotation.set(kneeFlex, 0, 0);
      }
    }

    // =========================================================================
    // 4. UPPER BODY, TORSO & 3 STROKE MOVEMENTS (SMASH / DRIVE / BACKHAND)
    // =========================================================================
    // Progress swing timer (Backhand takes longer / more deliberate stroke)
    if (isSwinging.current) {
      const swingSpeed =
        currentShotType.current === 'backhand' ? 2.1 : currentShotType.current === 'smash' ? 2.6 : 3.2;
      swingProgress.current -= delta * swingSpeed;
      if (swingProgress.current <= 0) {
        swingProgress.current = 0;
        isSwinging.current = false;
      }
    }

    const isServingToss = !isOpponent && matchStatus === 'serving';
    const isServePrep = !isOpponent && matchStatus === 'serve_prep';

    if (torsoGroupRef.current && leftArmRef.current && rightArmRef.current && racketGroupRef.current) {
      if (isSwinging.current) {
        const strokePhase = 1 - swingProgress.current; // 0.0 -> 1.0
        const isBackhand = currentShotType.current === 'backhand';
        const isSmash = currentShotType.current === 'smash';

        if (isSmash) {
          // ===================================================================
          // 1. SMASH (EN EL SAQUE): Raqueta hacia arriba golpeando de arriba a abajo
          // ===================================================================
          if (strokePhase < 0.35) {
            const p = strokePhase / 0.35;
            torsoGroupRef.current.rotation.set(-0.15 + p * 0.1, 0.15, 0);
            rightArmRef.current.rotation.set(
              MathUtils.lerp(-1.6, -2.4, p), // Raqueta hacia arriba al máximo
              MathUtils.lerp(0.5, 0.1, p),
              MathUtils.lerp(-0.7, -0.15, p)
            );
            racketGroupRef.current.rotation.set(0.3, 0, 0);
            leftArmRef.current.rotation.set(-2.0 + p * 0.5, -0.1, 0.2);
          } else if (strokePhase < 0.7) {
            const p = (strokePhase - 0.35) / 0.35;
            torsoGroupRef.current.rotation.set(MathUtils.lerp(-0.05, 0.35, p), 0.1, 0);
            rightArmRef.current.rotation.set(
              MathUtils.lerp(-2.4, 0.85, p), // Golpe de arriba hacia abajo
              MathUtils.lerp(0.1, -0.2, p),
              MathUtils.lerp(-0.15, 0.1, p)
            );
            racketGroupRef.current.rotation.set(
              MathUtils.lerp(0.3, 1.4, p), // Raqueta azota descendente
              0.1,
              -0.2
            );
            leftArmRef.current.rotation.set(
              MathUtils.lerp(-1.5, -0.4, p),
              -0.2,
              0.15
            );
          } else {
            const p = (strokePhase - 0.7) / 0.3;
            torsoGroupRef.current.rotation.set(MathUtils.lerp(0.35, 0.2, p), 0, 0);
            rightArmRef.current.rotation.set(
              MathUtils.lerp(0.85, -0.62, p),
              MathUtils.lerp(-0.2, 0.26, p),
              MathUtils.lerp(0.1, -0.2, p)
            );
            racketGroupRef.current.rotation.set(
              MathUtils.lerp(1.4, 0.55, p),
              0.18,
              -0.25
            );
            leftArmRef.current.rotation.set(
              MathUtils.lerp(-0.4, -0.68, p),
              -0.28,
              0.28
            );
          }
        } else if (isBackhand) {
          // ===================================================================
          // 2. REVÉS A DOS MANOS: Ambas manos en el mango, gira a la izquierda
          // ===================================================================
          if (strokePhase < 0.34) {
            // FASE 1: CARGA A DOS MANOS A LA IZQUIERDA
            const p = strokePhase / 0.34;
            const twist = MathUtils.lerp(0, -0.65, p) * (isOpponent ? -1 : 1);
            torsoGroupRef.current.rotation.y = twist;

            rightArmRef.current.rotation.set(
              MathUtils.lerp(-0.62, -0.55, p),
              MathUtils.lerp(0.26, -0.48, p),
              MathUtils.lerp(-0.2, 0.38, p)
            );
            leftArmRef.current.rotation.set(
              MathUtils.lerp(-0.68, -0.68, p),
              MathUtils.lerp(-0.28, -0.42, p),
              MathUtils.lerp(0.28, 0.32, p)
            );
            racketGroupRef.current.rotation.set(
              MathUtils.lerp(0.55, 0.4, p),
              MathUtils.lerp(0.18, -0.65, p),
              MathUtils.lerp(-0.25, 0.45, p)
            );
          } else if (strokePhase < 0.7) {
            // FASE 2: IMPACTO COORDINADO A DOS MANOS (SWING MÁS PLANO Y RECTO)
            const p = (strokePhase - 0.34) / 0.36;
            const twist = MathUtils.lerp(-0.65, 0.48, p) * (isOpponent ? -1 : 1);
            torsoGroupRef.current.rotation.y = twist;

            rightArmRef.current.rotation.set(
              MathUtils.lerp(-0.55, 0.65, p),
              MathUtils.lerp(-0.48, 0.35, p),
              MathUtils.lerp(0.38, -0.25, p)
            );
            leftArmRef.current.rotation.set(
              MathUtils.lerp(-0.68, 0.55, p),
              MathUtils.lerp(-0.42, 0.38, p),
              MathUtils.lerp(0.32, -0.2, p)
            );
            racketGroupRef.current.rotation.set(
              MathUtils.lerp(0.4, 0.6, p),
              MathUtils.lerp(-0.65, 0.3, p),
              MathUtils.lerp(0.45, -0.2, p)
            );
          } else {
            // FASE 3: TERMINACIÓN ALTA A DOS MANOS SOBRE HOMBRO DERECHO
            const p = (strokePhase - 0.7) / 0.3;
            const twist = MathUtils.lerp(0.48, 0, p) * (isOpponent ? -1 : 1);
            torsoGroupRef.current.rotation.y = twist;

            rightArmRef.current.rotation.set(
              MathUtils.lerp(0.65, -0.62, p),
              MathUtils.lerp(0.35, 0.26, p),
              MathUtils.lerp(-0.25, -0.2, p)
            );
            leftArmRef.current.rotation.set(
              MathUtils.lerp(0.55, -0.68, p),
              MathUtils.lerp(0.38, -0.28, p),
              MathUtils.lerp(-0.2, 0.28, p)
            );
            racketGroupRef.current.rotation.set(
              MathUtils.lerp(0.6, 0.55, p),
              MathUtils.lerp(0.3, 0.18, p),
              MathUtils.lerp(-0.2, -0.25, p)
            );
          }
        } else {
          // ===================================================================
          // 3. DRIVE A UNA MANO CON LA DERECHA (Potente, amplio, estilo Federer)
          // ===================================================================
          if (strokePhase < 0.28) {
            const prepP = strokePhase / 0.28;
            const torsoTwist = MathUtils.lerp(0, 0.65, prepP) * (isOpponent ? -1 : 1);
            torsoGroupRef.current.rotation.y = torsoTwist;

            rightArmRef.current.rotation.set(
              MathUtils.lerp(-0.55, -0.65, prepP),
              MathUtils.lerp(0.28, 0.95, prepP),
              MathUtils.lerp(-0.22, -0.6, prepP)
            );
            racketGroupRef.current.rotation.set(0.4, 0.8, -0.5);

            leftArmRef.current.rotation.set(
              MathUtils.lerp(-0.65, -0.75, prepP),
              MathUtils.lerp(-0.32, 0.35, prepP),
              MathUtils.lerp(0.35, 0.25, prepP)
            );
          } else if (strokePhase < 0.62) {
            const strikeP = (strokePhase - 0.28) / 0.34;
            const torsoTwist = MathUtils.lerp(0.65, -0.45, strikeP) * (isOpponent ? -1 : 1);
            torsoGroupRef.current.rotation.y = torsoTwist;

            rightArmRef.current.rotation.set(
              MathUtils.lerp(-0.65, 0.85, strikeP),
              MathUtils.lerp(0.95, -0.25, strikeP),
              MathUtils.lerp(-0.6, 0.15, strikeP)
            );
            racketGroupRef.current.rotation.set(
              MathUtils.lerp(0.4, 0.8, strikeP),
              MathUtils.lerp(0.8, -0.2, strikeP),
              MathUtils.lerp(-0.5, 0.3, strikeP)
            );

            leftArmRef.current.rotation.set(
              MathUtils.lerp(-0.75, -0.35, strikeP),
              MathUtils.lerp(0.35, -0.85, strikeP),
              MathUtils.lerp(0.25, 0.85, strikeP)
            );
          } else {
            const wrapP = (strokePhase - 0.62) / 0.38;
            const torsoTwist = MathUtils.lerp(-0.45, 0, wrapP) * (isOpponent ? -1 : 1);
            torsoGroupRef.current.rotation.y = torsoTwist;

            rightArmRef.current.rotation.set(
              MathUtils.lerp(0.85, -0.62, wrapP),
              MathUtils.lerp(-0.25, 0.26, wrapP),
              MathUtils.lerp(0.15, -0.2, wrapP)
            );
            racketGroupRef.current.rotation.set(
              MathUtils.lerp(0.8, 0.55, wrapP),
              MathUtils.lerp(-0.2, 0.18, wrapP),
              MathUtils.lerp(0.3, -0.25, wrapP)
            );

            leftArmRef.current.rotation.set(
              MathUtils.lerp(-0.35, -0.68, wrapP),
              MathUtils.lerp(-0.85, -0.28, wrapP),
              MathUtils.lerp(0.85, 0.28, wrapP)
            );
          }
        }
      } else if (isServingToss) {
        // SERVICE TOSS POSE: Left arm reaches straight UP into the sky, right arm in Trophy Pose
        torsoGroupRef.current.rotation.y = 0.2;
        leftArmRef.current.rotation.set(-2.6, -0.15, 0.2); // Pointing up to sky
        rightArmRef.current.rotation.set(-1.6, 0.5, -0.7); // Trophy pose behind head
        racketGroupRef.current.rotation.set(0.8, -0.2, 0.4);
      } else if (isServePrep) {
        // SERVE PREPARATION POSE: Left hand holds ball out front, right arm relaxed
        torsoGroupRef.current.rotation.y = 0.15;
        leftArmRef.current.rotation.set(-0.75, -0.15, 0.15);
        rightArmRef.current.rotation.set(-0.25, 0.25, -0.2);
        racketGroupRef.current.rotation.set(0.5, 0.2, -0.3);
      } else if (isRunning) {
        // RUNNING SPRINT COUNTER-PUMP
        torsoGroupRef.current.rotation.y = 0;
        const leftArmSwing = -Math.sin(gaitPhase) * 0.75;
        const rightArmPump = Math.sin(gaitPhase) * 0.4;

        leftArmRef.current.rotation.set(leftArmSwing, -0.1, 0.15);
        rightArmRef.current.rotation.set(-0.25 + rightArmPump, 0.25, -0.2);
        racketGroupRef.current.rotation.set(0.6, 0.2, -0.25);
      } else {
        // READY WAITING STANCE: Torso centered, hands forward ready
        torsoGroupRef.current.rotation.y = 0;

        // Right hand holding racket grip forward in front of torso
        rightArmRef.current.rotation.set(
          -0.62 + readyPulse * 0.03,
          0.26,
          -0.2
        );
        racketGroupRef.current.rotation.set(0.55, 0.18, -0.25);

        // Left hand ready in front supporting / balancing
        leftArmRef.current.rotation.set(
          -0.68 + readyPulse * 0.03,
          -0.28,
          0.28
        );
      }
    }
  });

  const skinColor = '#e0ac69';
  const shirtColor = isOpponent ? '#1d4ed8' : '#ffffff';
  const shortsColor = isOpponent ? '#0f172a' : '#f8fafc';
  const headbandColor = isOpponent ? '#ffffff' : '#00b4d8';
  const hairColor = isOpponent ? '#3e2723' : '#b45309';
  const racketFrameColor = isOpponent ? '#2563eb' : '#00b4d8';

  return (
    <group ref={groupRef} rotation={[0, isOpponent ? 0 : Math.PI, 0]}>
      {/* Ground Contact Shadow */}
      <mesh position={[0, 0.012, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.55, 24]} />
        <meshBasicMaterial color="#000000" transparent opacity={0.36} />
      </mesh>

      {/* ====================================================================
          UNIFIED SKELETON ROOT: PELVIS / HIPS (Whole body articulates from here)
          ==================================================================== */}
      <group ref={pelvisGroupRef} position={[0, 0.82, 0]}>
        {/* Pelvis Core Sphere */}
        <mesh position={[0, 0, 0]} castShadow>
          <sphereGeometry args={[0.22, 20, 20]} />
          <meshStandardMaterial color={shortsColor} roughness={0.6} />
        </mesh>
        {/* Left Shorts Leg */}
        <mesh position={[-0.18, -0.08, 0]} castShadow>
          <cylinderGeometry args={[0.13, 0.15, 0.22, 20]} />
          <meshStandardMaterial color={shortsColor} roughness={0.6} />
        </mesh>
        {/* Right Shorts Leg */}
        <mesh position={[0.18, -0.08, 0]} castShadow>
          <cylinderGeometry args={[0.13, 0.15, 0.22, 20]} />
          <meshStandardMaterial color={shortsColor} roughness={0.6} />
        </mesh>

        {/* ====================================================================
            1. TORSO & HEAD HIERARCHY (Attached directly to top of pelvis)
            ==================================================================== */}
        <group ref={torsoGroupRef} position={[0, 0.16, 0]}>
          {/* Athletic Torso / Shirt */}
          <mesh position={[0, 0.22, 0]} castShadow>
            <capsuleGeometry args={[0.21, 0.36, 16, 24]} />
            <meshStandardMaterial color={shirtColor} roughness={0.5} />
          </mesh>

          {/* Polo Ribbed Collar */}
          <mesh position={[0, 0.46, 0]} rotation={[Math.PI / 2.3, 0, 0]}>
            <torusGeometry args={[0.11, 0.02, 16, 24]} />
            <meshStandardMaterial color={isOpponent ? '#ffffff' : '#e2e8f0'} />
          </mesh>

          {/* Left Rounded Shoulder Cap (Deltoid) */}
          <mesh position={[-0.24, 0.38, 0]} castShadow>
            <sphereGeometry args={[0.09, 16, 16]} />
            <meshStandardMaterial color={shirtColor} roughness={0.5} />
          </mesh>

          {/* Right Rounded Shoulder Cap (Deltoid) */}
          <mesh position={[0.24, 0.38, 0]} castShadow>
            <sphereGeometry args={[0.09, 16, 16]} />
            <meshStandardMaterial color={shirtColor} roughness={0.5} />
          </mesh>

          {/* Head & Neck Group (Pivots to track ball) */}
          <group ref={headGroupRef} position={[0, 0.5, 0]}>
            {/* Neck */}
            <mesh position={[0, 0.04, 0]} castShadow>
              <cylinderGeometry args={[0.075, 0.085, 0.14, 16]} />
              <meshStandardMaterial color={skinColor} roughness={0.6} />
            </mesh>

            {/* Head Cranium */}
            <mesh position={[0, 0.2, 0]} castShadow>
              <sphereGeometry args={[0.17, 24, 24]} />
              <meshStandardMaterial color={skinColor} roughness={0.55} />
            </mesh>

            {/* 3D Hair */}
            <mesh position={[0, 0.25, -0.02]} castShadow>
              <sphereGeometry args={[0.175, 20, 20]} />
              <meshStandardMaterial color={hairColor} roughness={0.8} />
            </mesh>

            {/* Seamless Round Elastic Headband */}
            <mesh position={[0, 0.22, 0]} rotation={[Math.PI / 2, 0, 0]} castShadow>
              <torusGeometry args={[0.173, 0.022, 16, 32]} />
              <meshStandardMaterial color={headbandColor} roughness={0.4} />
            </mesh>

            {/* Eyes (if opponent facing camera) */}
            {isOpponent && (
              <group position={[0, 0.2, 0.15]}>
                <mesh position={[-0.055, 0, 0]}>
                  <sphereGeometry args={[0.02, 12, 12]} />
                  <meshStandardMaterial color="#0f172a" />
                </mesh>
                <mesh position={[0.055, 0, 0]}>
                  <sphereGeometry args={[0.02, 12, 12]} />
                  <meshStandardMaterial color="#0f172a" />
                </mesh>
              </group>
            )}
          </group>

          {/* ====================================================================
              2. ARTICULATED LEFT ARM (Pivots at shoulder)
              ==================================================================== */}
          <group ref={leftArmRef} position={[-0.25, 0.38, 0]}>
            {/* Left Bicep */}
            <mesh position={[-0.03, -0.14, 0.02]} rotation={[0.2, 0, 0.3]} castShadow>
              <capsuleGeometry args={[0.055, 0.2, 12, 16]} />
              <meshStandardMaterial color={skinColor} roughness={0.6} />
            </mesh>
            {/* Left Elbow */}
            <mesh position={[-0.05, -0.27, 0.04]}>
              <sphereGeometry args={[0.052, 12, 12]} />
              <meshStandardMaterial color={skinColor} roughness={0.6} />
            </mesh>
            {/* Left Forearm */}
            <mesh position={[-0.04, -0.38, 0.08]} rotation={[-0.3, 0, 0.1]} castShadow>
              <capsuleGeometry args={[0.048, 0.18, 12, 16]} />
              <meshStandardMaterial color={skinColor} roughness={0.6} />
            </mesh>
            {/* Left Wristband */}
            <mesh position={[-0.03, -0.46, 0.1]} rotation={[Math.PI / 2, 0, 0]}>
              <torusGeometry args={[0.05, 0.016, 12, 20]} />
              <meshStandardMaterial color="#ffffff" />
            </mesh>
            {/* Left Hand */}
            <mesh position={[-0.03, -0.51, 0.11]} castShadow>
              <sphereGeometry args={[0.05, 12, 12]} />
              <meshStandardMaterial color={skinColor} roughness={0.6} />
            </mesh>
          </group>

          {/* ====================================================================
              3. ARTICULATED RIGHT ARM & RACKET (Pivots at shoulder)
              ==================================================================== */}
          <group ref={rightArmRef} position={[0.25, 0.38, 0]}>
            {/* Right Bicep */}
            <mesh position={[0.03, -0.14, 0.04]} rotation={[-0.4, 0, -0.2]} castShadow>
              <capsuleGeometry args={[0.058, 0.2, 12, 16]} />
              <meshStandardMaterial color={skinColor} roughness={0.6} />
            </mesh>
            {/* Right Elbow */}
            <mesh position={[0.05, -0.27, 0.08]}>
              <sphereGeometry args={[0.054, 12, 12]} />
              <meshStandardMaterial color={skinColor} roughness={0.6} />
            </mesh>
            {/* Right Forearm */}
            <mesh position={[0.04, -0.2, 0.22]} rotation={[-1.1, 0, 0.1]} castShadow>
              <capsuleGeometry args={[0.05, 0.18, 12, 16]} />
              <meshStandardMaterial color={skinColor} roughness={0.6} />
            </mesh>
            {/* Right Wristband */}
            <mesh position={[0.03, -0.13, 0.3]} rotation={[0.4, 0, 0]}>
              <torusGeometry args={[0.052, 0.016, 12, 20]} />
              <meshStandardMaterial color="#ffffff" />
            </mesh>
            {/* Right Hand gripping racket handle */}
            <mesh position={[0.02, -0.08, 0.35]} castShadow>
              <sphereGeometry args={[0.055, 12, 12]} />
              <meshStandardMaterial color={skinColor} roughness={0.6} />
            </mesh>

            {/* RACKET GROUP */}
            <group ref={racketGroupRef} position={[0.02, -0.06, 0.38]} rotation={[0.5, 0.2, -0.3]}>
              {/* Butt Cap */}
              <mesh position={[0, -0.16, 0]}>
                <sphereGeometry args={[0.025, 12, 12]} />
                <meshStandardMaterial color="#0f172a" />
              </mesh>
              {/* Grip Handle */}
              <mesh position={[0, 0, 0]} castShadow>
                <cylinderGeometry args={[0.02, 0.022, 0.32, 16]} />
                <meshStandardMaterial color="#ffffff" roughness={0.7} />
              </mesh>
              {/* Throat / Yoke */}
              <mesh position={[0, 0.21, 0]} castShadow>
                <cylinderGeometry args={[0.024, 0.018, 0.12, 12]} />
                <meshStandardMaterial color="#0f172a" metalness={0.7} roughness={0.3} />
              </mesh>
              {/* Oval Racket Hoop */}
              <mesh position={[0, 0.44, 0]} scale={[1.0, 1.35, 1.0]} castShadow>
                <torusGeometry args={[0.18, 0.016, 16, 32]} />
                <meshStandardMaterial color={racketFrameColor} metalness={0.8} roughness={0.2} />
              </mesh>
              {/* String Bed */}
              <mesh position={[0, 0.44, 0]} scale={[1.0, 1.35, 1.0]}>
                <cylinderGeometry args={[0.17, 0.17, 0.005, 32]} />
                <meshStandardMaterial color="#ffffff" transparent opacity={0.35} roughness={0.1} />
              </mesh>
            </group>
          </group>
        </group>

        {/* ====================================================================
            5. ARTICULATED LEFT LEG & SHOE (Strictly parallel track at X = -0.28m)
            ==================================================================== */}
        <group ref={leftLegRef} position={[-0.28, -0.08, 0]}>
          {/* Left Thigh */}
          <mesh position={[0, -0.16, 0]} castShadow>
            <capsuleGeometry args={[0.075, 0.24, 12, 16]} />
            <meshStandardMaterial color={skinColor} roughness={0.6} />
          </mesh>

          {/* Left Knee Joint Group */}
          <group ref={leftKneeRef} position={[0, -0.32, 0]}>
            {/* Left Knee Cap */}
            <mesh position={[0, 0, 0]}>
              <sphereGeometry args={[0.07, 14, 14]} />
              <meshStandardMaterial color={skinColor} roughness={0.6} />
            </mesh>
            {/* Left Calf */}
            <mesh position={[0, -0.16, 0]} castShadow>
              <capsuleGeometry args={[0.068, 0.24, 12, 16]} />
              <meshStandardMaterial color={skinColor} roughness={0.6} />
            </mesh>
            {/* Left White Sock */}
            <mesh position={[0, -0.3, 0]}>
              <cylinderGeometry args={[0.068, 0.068, 0.12, 16]} />
              <meshStandardMaterial color="#ffffff" roughness={0.8} />
            </mesh>
            {/* Left Tennis Shoe */}
            <group position={[0, -0.38, 0.04]}>
              <mesh position={[0, 0.02, -0.06]} castShadow>
                <sphereGeometry args={[0.068, 14, 14]} />
                <meshStandardMaterial color="#ffffff" roughness={0.4} />
              </mesh>
              <mesh position={[0, 0.02, 0.04]} rotation={[Math.PI / 2, 0, 0]} castShadow>
                <capsuleGeometry args={[0.064, 0.16, 14, 16]} />
                <meshStandardMaterial color="#ffffff" roughness={0.4} />
              </mesh>
              <mesh position={[0, -0.02, 0.01]} rotation={[Math.PI / 2, 0, 0]}>
                <capsuleGeometry args={[0.068, 0.18, 12, 16]} />
                <meshStandardMaterial color="#64748b" roughness={0.8} />
              </mesh>
            </group>
          </group>
        </group>

        {/* ====================================================================
            6. ARTICULATED RIGHT LEG & SHOE (Strictly parallel track at X = +0.28m)
            ==================================================================== */}
        <group ref={rightLegRef} position={[0.28, -0.08, 0]}>
          {/* Right Thigh */}
          <mesh position={[0, -0.16, 0]} castShadow>
            <capsuleGeometry args={[0.075, 0.24, 12, 16]} />
            <meshStandardMaterial color={skinColor} roughness={0.6} />
          </mesh>

          {/* Right Knee Joint Group */}
          <group ref={rightKneeRef} position={[0, -0.32, 0]}>
            {/* Right Knee Cap */}
            <mesh position={[0, 0, 0]}>
              <sphereGeometry args={[0.07, 14, 14]} />
              <meshStandardMaterial color={skinColor} roughness={0.6} />
            </mesh>
            {/* Right Calf */}
            <mesh position={[0, -0.16, 0]} castShadow>
              <capsuleGeometry args={[0.068, 0.24, 12, 16]} />
              <meshStandardMaterial color={skinColor} roughness={0.6} />
            </mesh>
            {/* Right White Sock */}
            <mesh position={[0, -0.3, 0]}>
              <cylinderGeometry args={[0.068, 0.068, 0.12, 16]} />
              <meshStandardMaterial color="#ffffff" roughness={0.8} />
            </mesh>
            {/* Right Tennis Shoe */}
            <group position={[0, -0.38, 0.04]}>
              <mesh position={[0, 0.02, -0.06]} castShadow>
                <sphereGeometry args={[0.068, 14, 14]} />
                <meshStandardMaterial color="#ffffff" roughness={0.4} />
              </mesh>
              <mesh position={[0, 0.02, 0.04]} rotation={[Math.PI / 2, 0, 0]} castShadow>
                <capsuleGeometry args={[0.064, 0.16, 14, 16]} />
                <meshStandardMaterial color="#ffffff" roughness={0.4} />
              </mesh>
              <mesh position={[0, -0.02, 0.01]} rotation={[Math.PI / 2, 0, 0]}>
                <capsuleGeometry args={[0.068, 0.18, 12, 16]} />
                <meshStandardMaterial color="#64748b" roughness={0.8} />
              </mesh>
            </group>
          </group>
        </group>
      </group>
    </group>
  );
};
