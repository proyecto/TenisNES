import React, { useRef, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { RigidBody, RapierRigidBody } from '@react-three/rapier';
import { Mesh, MathUtils } from 'three';
import { useTennisStore } from '../store/useTennisStore';
import { useKeyboardControls } from '../hooks/useKeyboardControls';
import { calculateShotVelocity, evaluateHitReach } from '../utils/tennisBallistics';
import { evaluateBounce } from '../utils/tennisScoring';

interface TennisBall3DProps {
  onBounce?: () => void;
}

export const TennisBall3D: React.FC<TennisBall3DProps> = ({ onBounce }) => {
  const ballBodyRef = useRef<RapierRigidBody>(null);
  const ballMeshRef = useRef<Mesh>(null);
  const keys = useKeyboardControls();

  const matchStatus = useTennisStore((state) => state.matchStatus);
  const setMatchStatus = useTennisStore((state) => state.setMatchStatus);
  const incrementRally = useTennisStore((state) => state.incrementRally);
  const resetServe = useTennisStore((state) => state.resetServe);
  const setLastHitter = useTennisStore((state) => state.setLastHitter);
  const awardPoint = useTennisStore((state) => state.awardPoint);
  const recordFault = useTennisStore((state) => state.recordFault);
  const recordLet = useTennisStore((state) => state.recordLet);

  // Track previous space key state to detect single keydown presses
  const prevActionPressed = useRef(false);
  const prevLobPressed = useRef(false);
  const lastShotType = useRef<'drive' | 'backhand' | 'smash' | 'lob'>('drive');
  const lastHitTime = useRef(0);
  const serveTossTime = useRef(0);
  const servePrepEnteredTime = useRef(0);
  const hasLaunchedToss = useRef(false);
  const lastBounceTime = useRef(0);
  const bouncesSinceHit = useRef(0);
  const pointResolved = useRef(false);
  const isServeShot = useRef(false);
  const serveTouchedNet = useRef(false);
  const serveLandedInBox = useRef(false);
  const shotLegalBounceOccurred = useRef(false);
  const collisionTriggeredBounce = useRef(false);
  const lastNetDeflectionTime = useRef(0);
  const pointOverEnteredTime = useRef(0);
  const p1SwingAttemptTime = useRef(0);

  // Reset ball position when serve_prep begins
  useEffect(() => {
    if (matchStatus === 'serve_prep' && ballBodyRef.current) {
      const { server, p1Pos, cpuPos } = useTennisStore.getState();
      const serverPos = server === 'p1' ? p1Pos : cpuPos;
      const handOffsetX = server === 'p1' ? -0.22 : 0.22;
      const handOffsetZ = server === 'p1' ? -0.28 : 0.28;

      ballBodyRef.current.setTranslation({ x: serverPos[0] + handOffsetX, y: 1.05, z: serverPos[2] + handOffsetZ }, true);
      ballBodyRef.current.setLinvel({ x: 0, y: 0, z: 0 }, true);
      ballBodyRef.current.setAngvel({ x: 0, y: 0, z: 0 }, true);
      bouncesSinceHit.current = 0;
      pointResolved.current = false;
      isServeShot.current = false;
      serveTouchedNet.current = false;
      serveLandedInBox.current = false;
      shotLegalBounceOccurred.current = false;
      collisionTriggeredBounce.current = false;
      lastNetDeflectionTime.current = 0;
      hasLaunchedToss.current = false;
      pointOverEnteredTime.current = 0;
      p1SwingAttemptTime.current = 0;
      servePrepEnteredTime.current = performance.now() / 1000;
      useTennisStore.getState().setLastCall(null);
    }
  }, [matchStatus]);

  useFrame((state) => {
    if (!ballBodyRef.current) return;

    const t = state.clock.getElapsedTime();
    const isActionJustPressed = keys.current.action && !prevActionPressed.current;
    prevActionPressed.current = keys.current.action;
    const isLobJustPressed = keys.current.lob && !prevLobPressed.current;
    prevLobPressed.current = keys.current.lob;

    const ballPos = ballBodyRef.current.translation();
    const ballVel = ballBodyRef.current.linvel();
    const { p1Pos: p1, cpuPos, server, serveSide } = useTennisStore.getState();

    // Sync current ball position and velocity transiently
    useTennisStore.getState().ballPos = [ballPos.x, ballPos.y, ballPos.z];
    useTennisStore.getState().ballVel = [ballVel.x, ballVel.y, ballVel.z];

    // =========================================================================
    // PHYSICAL TENNIS NET COLLISION & DEFLECTION
    // Center net height is 0.914m; post height is 1.07m
    // =========================================================================
    const netHeightAtX = 0.914 + Math.min(1.0, Math.pow(Math.abs(ballPos.x) / 5.5, 2)) * 0.156;
    const isCrossingNetPlane = Math.abs(ballPos.z) <= 0.28;
    const isBelowNetTape = ballPos.y <= netHeightAtX + 0.04;

    if (
      isCrossingNetPlane &&
      isBelowNetTape &&
      !pointResolved.current &&
      t - lastNetDeflectionTime.current > 0.35
    ) {
      const currentV = ballBodyRef.current.linvel();
      const isMovingTowardsNet =
        (ballPos.z > 0 && currentV.z < 0) || (ballPos.z < 0 && currentV.z > 0);

      if (isMovingTowardsNet) {
        lastNetDeflectionTime.current = t;
        if (isServeShot.current) {
          serveTouchedNet.current = true;
        }

        // A. Net Tape Cord Graze (top 9cm of the tape): Lucky deflection / let
        if (ballPos.y >= netHeightAtX - 0.08) {
          // Retain strong forward momentum, pop over the tape into opponent court
          ballBodyRef.current.setLinvel(
            { x: currentV.x * 0.70, y: Math.max(1.3, Math.abs(currentV.y) * 0.5 + 0.8), z: currentV.z * 0.65 },
            true
          );
          ballBodyRef.current.setAngvel({ x: (currentV.z < 0 ? -1 : 1) * 20, y: 0, z: 0 }, true);
          onBounce?.();
        } else {
          // B. Solid Impact into Net Mesh (below tape): Rebounds and drops on hitter's side
          const reboundDir = ballPos.z > 0 ? 1 : -1;
          ballBodyRef.current.setLinvel(
            { x: currentV.x * 0.15, y: -0.5, z: reboundDir * 1.5 },
            true
          );
          ballBodyRef.current.setAngvel({ x: reboundDir * 12, y: 0, z: 0 }, true);
          onBounce?.();
        }
      }
    }

    // =========================================================================
    // 0. POINT OVER: Bulletproof automatic transition to next point
    // =========================================================================
    if (matchStatus === 'point_over') {
      if (pointOverEnteredTime.current === 0) {
        pointOverEnteredTime.current = t;
      }
      // Gently decelerate ball rolling naturally on the grass during celebration
      const curV = ballBodyRef.current.linvel();
      ballBodyRef.current.setLinvel({ x: curV.x * 0.92, y: curV.y, z: curV.z * 0.92 }, true);

      // After 1.4 seconds of display, automatically reset serve for next point!
      if (t - pointOverEnteredTime.current >= 1.4) {
        pointOverEnteredTime.current = 0;
        resetServe();
      }
      return;
    } else {
      pointOverEnteredTime.current = 0;
    }

    // =========================================================================
    // 1. SERVE PREPARATION: Ball sits in server's left hand (P1 or CPU)
    // =========================================================================
    if (matchStatus === 'serve_prep') {
      if (server === 'p1') {
        const handX = p1[0] - 0.22;
        const handY = 1.05 + Math.sin(t * 3.5) * 0.015;
        const handZ = p1[2] - 0.28;

        ballBodyRef.current.setTranslation({ x: handX, y: handY, z: handZ }, true);
        ballBodyRef.current.setLinvel({ x: 0, y: 0, z: 0 }, true);

        if (isActionJustPressed) {
          // Player 1 initiates toss motion with left hand
          serveTossTime.current = t;
          useTennisStore.getState().setServeTossTime(t);
          useTennisStore.getState().setLastCall(null);
          hasLaunchedToss.current = false;
          setMatchStatus('serving');
        }
      } else {
        // CPU Serve Preparation
        const handX = cpuPos[0] + 0.22;
        const handY = 1.05 + Math.sin(t * 3.5) * 0.015;
        const handZ = cpuPos[2] + 0.28;

        ballBodyRef.current.setTranslation({ x: handX, y: handY, z: handZ }, true);
        ballBodyRef.current.setLinvel({ x: 0, y: 0, z: 0 }, true);

        // CPU pauses realistically then tosses ball
        const timeInPrep = (performance.now() / 1000) - servePrepEnteredTime.current;
        if (timeInPrep > 1.25) {
          serveTossTime.current = t;
          useTennisStore.getState().setServeTossTime(t);
          useTennisStore.getState().setLastCall(null);
          hasLaunchedToss.current = false;
          setMatchStatus('serving');
        }
      }
      return;
    }

    // =========================================================================
    // 2. SERVING: Left-Hand Toss Elevation -> Release -> Right-Hand Smash!
    // =========================================================================
    if (matchStatus === 'serving') {
      const timeSinceToss = t - serveTossTime.current;

      // PHASE 1: Left hand lifts the ball up from waist to high release point (~0.42s)
      if (timeSinceToss < 0.42) {
        const p = timeSinceToss / 0.42;
        const liftEase = Math.sin((p * Math.PI) / 2);

        if (server === 'p1') {
          const handX = p1[0] - 0.22 + p * 0.03;
          const handY = MathUtils.lerp(1.05, 2.05, liftEase);
          const handZ = MathUtils.lerp(p1[2] - 0.28, p1[2] - 0.36, liftEase);
          ballBodyRef.current.setTranslation({ x: handX, y: handY, z: handZ }, true);
          ballBodyRef.current.setLinvel({ x: 0, y: 0, z: 0 }, true);
        } else {
          const handX = cpuPos[0] + 0.22 - p * 0.03;
          const handY = MathUtils.lerp(1.05, 2.05, liftEase);
          const handZ = MathUtils.lerp(cpuPos[2] + 0.28, cpuPos[2] + 0.36, liftEase);
          ballBodyRef.current.setTranslation({ x: handX, y: handY, z: handZ }, true);
          ballBodyRef.current.setLinvel({ x: 0, y: 0, z: 0 }, true);
        }
        return;
      }

      // PHASE 2: Left hand releases ball into free vertical flight
      if (!hasLaunchedToss.current) {
        hasLaunchedToss.current = true;
        if (server === 'p1') {
          ballBodyRef.current.setLinvel({ x: 0.02, y: 5.2, z: -0.26 }, true);
        } else {
          ballBodyRef.current.setLinvel({ x: -0.02, y: 5.0, z: 0.26 }, true);
        }
      }

      // PHASE 3: SMASH SERVE with right hand
      if (server === 'p1') {
        // Player 1 hits serve at selected height with right hand
        if (isActionJustPressed && ballPos.y >= 1.85 && timeSinceToss >= 0.42) {
          const steeringX = (keys.current.right ? 1 : 0) - (keys.current.left ? 1 : 0);
          const steeringZ = (keys.current.forward ? 1 : 0) - (keys.current.backward ? 1 : 0);

          const hitHeight = Math.max(1.85, Math.min(3.45, ballPos.y));
          const recorridoFactor = (hitHeight - 1.85) / (3.45 - 1.85);

          // Base depth: neutral serve lands inside [-3.4m, -5.6m]
          let targetZ = -3.4 - recorridoFactor * 2.2;
          if (steeringZ > 0) {
            // Arriba / Adelante: muy fuerte y profundo hacia el fondo
            targetZ -= 1.45;
          } else if (steeringZ < 0) {
            // Abajo / Atrás: saque corto que cae cerca de la red
            targetZ += 2.1;
          }

          // Lateral placement: el cuadro mide 2.057m a cada lado del centro (-2.057m deuce / +2.057m ad)
          const baseTargetX = serveSide === 'deuce' ? -2.057 : 2.057;
          const targetX = baseTargetX + steeringX * 2.35;

          const shot = calculateShotVelocity({
            fromPos: [ballPos.x, ballPos.y, ballPos.z],
            targetZ,
            targetX,
            steeringX,
            steeringZ,
            isServe: true,
            shotType: 'smash',
          });

          ballBodyRef.current.setLinvel(shot, true);
          ballBodyRef.current.setAngvel({ x: 10 + recorridoFactor * 6, y: steeringX * -3, z: 0 }, true);

          // Record serve speed in km/h for TV radar
          const speedMs = Math.hypot(shot.x, shot.y, shot.z);
          const speedKmh = Math.round(speedMs * 3.6);
          const isAcePower = speedKmh >= 195;
          useTennisStore.getState().recordShotSpeed(
            speedKmh,
            isAcePower ? '¡SAQUE AS CAÑÓN!' : '1º SAQUE PLANO',
            'p1',
            true
          );

          lastShotType.current = 'smash';
          useTennisStore.getState().triggerP1Swing('smash');
          setLastHitter('p1');
          setMatchStatus('playing');
          lastHitTime.current = t;
          bouncesSinceHit.current = 0;
          pointResolved.current = false;
          isServeShot.current = true;
          serveTouchedNet.current = false;
          serveLandedInBox.current = false;
          shotLegalBounceOccurred.current = false;
          collisionTriggeredBounce.current = false;
          return;
        }

        // Missed toss / ball hits ground without hitting
        if (timeSinceToss > 1.6 && ballPos.y < 0.35) {
          recordFault();
          return;
        }
      } else {
        // CPU automatically smashes serve down near toss apex (~0.95s, ballPos.y >= 2.8m)
        if (timeSinceToss >= 0.95 && ballPos.y >= 2.8 && !isServeShot.current) {
          const baseTargetX = serveSide === 'deuce' ? 2.05 : -2.05;
          const targetX = baseTargetX + (Math.random() - 0.5) * 1.3;
          const targetZ = 3.2 + Math.random() * 2.2; // Inside P1 service box (0 to 6.4m)

          const cpuServeShot = calculateShotVelocity({
            fromPos: [ballPos.x, ballPos.y, ballPos.z],
            targetZ,
            targetX,
            steeringX: 0,
            isServe: true,
            shotType: 'smash',
          });

          ballBodyRef.current.setLinvel(cpuServeShot, true);
          ballBodyRef.current.setAngvel({ x: -14, y: 0, z: 0 }, true);

          // Record CPU serve speed for TV radar
          const cpuSpeedMs = Math.hypot(cpuServeShot.x, cpuServeShot.y, cpuServeShot.z);
          const cpuSpeedKmh = Math.round(cpuSpeedMs * 3.6);
          useTennisStore.getState().recordShotSpeed(
            cpuSpeedKmh,
            '1º SERVICIO CPU',
            'cpu',
            true
          );

          lastShotType.current = 'smash';
          useTennisStore.getState().triggerCpuSwing('smash');
          setLastHitter('cpu');
          setMatchStatus('playing');
          lastHitTime.current = t;
          bouncesSinceHit.current = 0;
          pointResolved.current = false;
          isServeShot.current = true;
          serveTouchedNet.current = false;
          serveLandedInBox.current = false;
          shotLegalBounceOccurred.current = false;
          collisionTriggeredBounce.current = false;
          return;
        }

        if (timeSinceToss > 1.6 && ballPos.y < 0.35) {
          recordFault();
          return;
        }
      }
    }

    // =========================================================================
    // 3. IN-PLAY RALLY: Player 1 Hits Ball (Drive, Revés, Smash, Globo)
    // =========================================================================
    if (matchStatus === 'playing') {
      const reach = evaluateHitReach(p1, [ballPos.x, ballPos.y, ballPos.z], false);
      const wantsLob = keys.current.lob || (keys.current.backward && (isActionJustPressed || keys.current.action));
      const isOverhead = reach.isOverhead || ballPos.y >= 1.65;

      const currentIntentShotType: 'drive' | 'backhand' | 'smash' | 'lob' = wantsLob
        ? 'lob'
        : isOverhead
        ? 'smash'
        : reach.shotType;

      // When player presses SPACE or LOB key, execute swing animation immediately
      if (isActionJustPressed || isLobJustPressed) {
        p1SwingAttemptTime.current = t;
        useTennisStore.getState().triggerP1Swing(currentIntentShotType);
      }

      // ITF Rule 17: Returner must let serve bounce in service box before hitting!
      const isReturnerVolleyingServe = isServeShot.current && bouncesSinceHit.current === 0;

      // Ball is struck ONLY if the player actively pressed Space or Lob within swing window (0.35s)
      const isSwingActive = t - p1SwingAttemptTime.current <= 0.35;
      const shouldHit =
        !isReturnerVolleyingServe &&
        reach.canHit &&
        isSwingActive &&
        t - lastHitTime.current > 0.38;

      if (shouldHit) {
        // Consume the swing attempt so each press strikes once
        p1SwingAttemptTime.current = 0;

        const shotType = currentIntentShotType;
        lastShotType.current = shotType;

        const steeringX = (keys.current.right ? 1 : 0) - (keys.current.left ? 1 : 0);
        const steeringZ = (keys.current.forward ? 1 : 0) - (keys.current.backward ? 1 : 0);

        const shot = calculateShotVelocity({
          fromPos: [ballPos.x, ballPos.y, ballPos.z],
          targetZ: -9.5,
          steeringX,
          steeringZ,
          isServe: false,
          shotType,
        });

        ballBodyRef.current.setLinvel(shot, true);
        const baseSpin = shotType === 'smash' ? 18 : shotType === 'lob' ? -12 : shotType === 'drive' ? 12 : 7;
        const spinX = steeringZ > 0 ? baseSpin + 4 : steeringZ < 0 ? -4 : baseSpin;
        const spinY = steeringX * (shotType === 'drive' ? -5 : -2);
        ballBodyRef.current.setAngvel({ x: spinX, y: spinY, z: 0 }, true);

        // Record P1 rally shot speed for TV radar
        const p1SpeedMs = Math.hypot(shot.x, shot.y, shot.z);
        const p1SpeedKmh = Math.round(p1SpeedMs * 3.6);
        let p1Label = 'GOLPE P1';
        if (shotType === 'smash') {
          p1Label = '¡REMATE SMASH!';
        } else if (shotType === 'lob') {
          p1Label = keys.current.forward ? 'GLOBO TÁCTICO' : 'GLOBO DEFENSIVO';
        } else if (shotType === 'drive') {
          p1Label =
            steeringZ > 0
              ? 'DRIVE POTENTE 1-MANO'
              : steeringZ < 0
              ? 'DEJADA CORTA'
              : 'DRIVE A 1 MANO';
        } else {
          p1Label =
            steeringZ > 0
              ? 'REVÉS PLANO 2-MANOS'
              : steeringZ < 0
              ? 'DEJADA DE REVÉS'
              : 'REVÉS A 2 MANOS';
        }
        useTennisStore.getState().recordShotSpeed(p1SpeedKmh, p1Label, 'p1', false);

        setLastHitter('p1');
        incrementRally();
        lastHitTime.current = t;
        bouncesSinceHit.current = 0;
        pointResolved.current = false;
        isServeShot.current = false;
        serveTouchedNet.current = false;
        serveLandedInBox.current = false;
        shotLegalBounceOccurred.current = false;
        collisionTriggeredBounce.current = false;
      }

      // =======================================================================
      // 4. INTELLIGENT CPU OPPONENT RETURN (Drive, Revés, Smash, Globo Táctico):
      // =======================================================================
      const isCpuVolleyingServe = isServeShot.current && bouncesSinceHit.current === 0;
      const cpuReach = evaluateHitReach(cpuPos, [ballPos.x, ballPos.y, ballPos.z], true);
      // CPU can strike any ball on its half of the court (Z < -0.2m), including drop shots near the net!
      const isApproachingCpu =
        (ballPos.z < -0.2 && ballVel.z < 0) ||
        (ballPos.z < -0.2 && bouncesSinceHit.current === 1);

      if (
        !isCpuVolleyingServe &&
        isApproachingCpu &&
        cpuReach.canHit &&
        t - lastHitTime.current > 0.38
      ) {
        const p1X = useTennisStore.getState().p1Pos[0];
        const p1Z = useTennisStore.getState().p1Pos[2];
        const isP1AtNet = p1Z < 7.0; // Player 1 is rushing the net!

        let cpuShotType: 'drive' | 'backhand' | 'smash' | 'lob';
        if (cpuReach.isOverhead || ballPos.y >= 1.65) {
          cpuShotType = 'smash';
        } else if (isP1AtNet && Math.random() < 0.65) {
          cpuShotType = 'lob'; // Tactical lob over rushing Player 1!
        } else {
          cpuShotType = cpuReach.shotType;
        }

        lastShotType.current = cpuShotType;

        const preferredSide = p1X < 0 ? 1 : -1;
        const targetX = preferredSide * (cpuShotType === 'drive' ? (2.0 + Math.random() * 2.2) : (1.4 + Math.random() * 1.4));

        // When CPU is at the net retrieving a short ball, it drives deep into Player 1's court!
        const isCpuNearNet = cpuPos[2] > -5.5;
        const targetZ = isCpuNearNet ? 9.2 + Math.random() * 2.0 : 10.2;

        const cpuShot = calculateShotVelocity({
          fromPos: [ballPos.x, ballPos.y, ballPos.z],
          targetZ,
          targetX,
          steeringX: 0,
          isServe: false,
          shotType: cpuShotType,
        });

        ballBodyRef.current.setLinvel(cpuShot, true);
        const cpuSpinX =
          cpuShotType === 'smash'
            ? -18
            : cpuShotType === 'lob'
            ? 12
            : cpuShotType === 'drive'
            ? -10
            : -6;
        ballBodyRef.current.setAngvel({ x: cpuSpinX, y: preferredSide * 3, z: 0 }, true);

        // Record CPU rally shot speed for TV radar
        const cpuRallySpeedMs = Math.hypot(cpuShot.x, cpuShot.y, cpuShot.z);
        const cpuRallySpeedKmh = Math.round(cpuRallySpeedMs * 3.6);
        let cpuLabel = 'GOLPE CPU';
        if (cpuShotType === 'smash') {
          cpuLabel = '¡REMATE SMASH CPU!';
        } else if (cpuShotType === 'lob') {
          cpuLabel = 'GLOBO TÁCTICO CPU';
        } else if (cpuShotType === 'drive') {
          cpuLabel = 'DRIVE CPU';
        } else {
          cpuLabel = 'REVÉS A 2 MANOS CPU';
        }
        useTennisStore.getState().recordShotSpeed(cpuRallySpeedKmh, cpuLabel, 'cpu', false);

        useTennisStore.getState().triggerCpuSwing(cpuShotType);
        setLastHitter('cpu');
        incrementRally();
        lastHitTime.current = t;
        bouncesSinceHit.current = 0;
        pointResolved.current = false;
        isServeShot.current = false;
        serveTouchedNet.current = false;
        serveLandedInBox.current = false;
        shotLegalBounceOccurred.current = false;
        collisionTriggeredBounce.current = false;
      }

      // =======================================================================
      // 5. BOUNCE EVALUATION & TENNIS COURT BOUNDARIES (IN / OUT / FAULT / LET)
      // =======================================================================
      const isGroundContact =
        (ballPos.y <= 0.22 && ballVel.y <= 0.6) || (collisionTriggeredBounce.current && ballPos.y <= 0.32);
      const isDebouncedBounce = t - lastBounceTime.current > 0.18;

      if (isGroundContact && isDebouncedBounce) {
        lastBounceTime.current = t;
        collisionTriggeredBounce.current = false;
        bouncesSinceHit.current += 1;
        onBounce?.();

        // DYNAMIC TENNIS BOUNCE LIFT (First Bounce):
        // Rebounds ball upward to an athletic, natural strike height (waist to chest: 1.15m - 1.45m)
        if (bouncesSinceHit.current === 1) {
          const horizSpeed = Math.hypot(ballVel.x, ballVel.z);
          const isDropShot = horizSpeed < 12.0;
          const isServe = isServeShot.current;
          const isSmash = lastShotType.current === 'smash';
          const isLob = lastShotType.current === 'lob';

          // Rebound vertical speed:
          // - Smash: vy = 5.85 m/s -> Apex h = 1.74m (Explosive high kick!)
          // - Lob: vy = 4.85 m/s -> Apex h = 1.20m (High arching bounce)
          // - Fast Serve: vy = 5.40 m/s -> Apex h = 1.48m
          // - Normal Rally / Drive: vy = 5.15 m/s -> Apex h = 1.35m
          // - Drop Shot (dejada corta): vy = 3.85 m/s -> Apex h = 0.75m
          const targetReboundVy = isSmash
            ? 5.85
            : isLob
            ? 4.85
            : isServe
            ? 5.40
            : isDropShot
            ? 3.85
            : 5.15;

          // Maintain horizontal forward trajectory with realistic turf traction (~78% speed retention)
          const speedRetention = isSmash ? 0.84 : isLob ? 0.72 : isDropShot ? 0.65 : 0.78;
          const newVx = ballVel.x * speedRetention;
          const newVz = ballVel.z * speedRetention;

          ballBodyRef.current.setLinvel({ x: newVx, y: targetReboundVy, z: newVz }, true);

          // Add realistic forward topspin roll on the ball
          const topspinKick = (ballVel.z < 0 ? -1 : 1) * (isSmash ? 22 : isServe ? 16 : 11);
          ballBodyRef.current.setAngvel({ x: topspinKick, y: 0, z: 0 }, true);
        }

        const hitter = useTennisStore.getState().lastHitter;

        // Calculate distance to nearest legal court line for Hawk-Eye display
        const distSideline = Math.abs(Math.abs(ballPos.x) - 4.115);
        const distBaseline = Math.abs(Math.abs(ballPos.z) - 11.885);
        const distService = Math.abs(Math.abs(ballPos.z) - 6.40);
        const distCenter = Math.abs(ballPos.z) <= 6.40 ? Math.abs(ballPos.x) : 999;
        const minDist = Math.min(distSideline, distBaseline, distService, distCenter);
        const distanceCm = Math.round(minDist * 100 * 10) / 10;

        // 5a. First Bounce Check (Line In / Out / Service Box / Net / Let)
        if (bouncesSinceHit.current === 1 && !pointResolved.current && hitter) {
          const evaluation = evaluateBounce({
            x: ballPos.x,
            z: ballPos.z,
            isServe: isServeShot.current,
            serveSide,
            hitter,
          });

          // Record bounce location in store for Hawk-Eye television graphics
          useTennisStore.getState().recordBounceLocation(
            ballPos.x,
            ballPos.z,
            evaluation.isInBounds && !evaluation.isFault,
            distanceCm,
            t
          );

          if (isServeShot.current) {
            if (serveTouchedNet.current) {
              if (evaluation.isInBounds && !evaluation.isFault) {
                // ITF Rule 22: Touched net AND landed IN target service box -> ¡NET / LET!
                // Server repeats the serve without advancing faultCount
                pointResolved.current = true;
                recordLet();
              } else {
                // Touched net BUT landed outside service box / server's side -> ¡FALTA!
                pointResolved.current = true;
                recordFault(true);
              }
            } else {
              // Clean serve without touching net
              if (evaluation.isFault || !evaluation.isInBounds) {
                pointResolved.current = true;
                recordFault(false);
              } else {
                // THE FIRST BOUNCE WAS 100% LEGAL AND IN-BOUNDS!
                shotLegalBounceOccurred.current = true;
                serveLandedInBox.current = true;
              }
            }
          } else {
            // Regular in-play rally shot
            if (!evaluation.isInBounds) {
              pointResolved.current = true;
              const winner = hitter === 'p1' ? 'cpu' : 'p1';
              awardPoint(winner);
            } else {
              shotLegalBounceOccurred.current = true;
            }
          }
        }
      }

      // =======================================================================
      // 6. IMMEDIATE POINT RESOLUTION (ITF RULES & REALISTIC TENNIS MATCH PLAY)
      // =======================================================================
      const currentHitter = useTennisStore.getState().lastHitter;

      if (!pointResolved.current && currentHitter) {
        // CASE A: The ball has ALREADY bounced legally in opponent's court
        // Wait until the ball takes its SECOND BOUNCE or IMPACTS THE STANDS/WALLS!
        // This ensures the point is never called abruptly mid-air, allowing the ball to complete its natural flight.
        if (shotLegalBounceOccurred.current) {
          const isAce = isServeShot.current && serveLandedInBox.current;

          // 1. Second bounce occurred anywhere (el segundo bote en el suelo):
          const isSecondBounce = bouncesSinceHit.current >= 2;

          // 2. Impacted the stands, rear perimeter wall, or side barriers:
          // (North/South back perimeter barrier is at Z = ±15.5m; East/West side stands are at X = ±12.7m)
          const hasHitStandsOrWall =
            Math.abs(ballPos.z) >= 15.2 ||
            Math.abs(ballPos.x) >= 9.5;

          if (isSecondBounce || hasHitStandsOrWall) {
            pointResolved.current = true;
            awardPoint(currentHitter, isAce);
          }
        } else {
          // CASE B: The ball NEVER bounced legally in opponent's court
          // (Flew directly out of bounds or into stands without bouncing on the court)
          const isOutOfBoundsDirectly =
            Math.abs(ballPos.z) >= 15.0 ||
            (Math.abs(ballPos.z) > 1.0 && Math.abs(ballPos.x) >= 8.5) ||
            ballPos.y < -0.5;

          if (isOutOfBoundsDirectly) {
            pointResolved.current = true;
            if (isServeShot.current) {
              recordFault(serveTouchedNet.current);
            } else {
              const winner = currentHitter === 'p1' ? 'cpu' : 'p1';
              awardPoint(winner);
            }
          }
        }
      }
    }

    // Update Ground Shadow Disk position and depth scale directly at 60 FPS
    if (shadowMeshRef.current) {
      shadowMeshRef.current.position.set(ballPos.x, 0.014, ballPos.z);
      const height = Math.max(0, ballPos.y - 0.085);
      const radius = Math.max(0.12, Math.min(0.38, 0.16 + height * 0.06));
      shadowMeshRef.current.scale.set(radius, radius, 1);
    }
  });

  const shadowMeshRef = useRef<Mesh>(null);
  const lastBounce = useTennisStore((state) => state.lastBouncePos);
  const lastBounceInBounds = useTennisStore((state) => state.lastBounceInBounds);
  const lastBounceDistanceCm = useTennisStore((state) => state.lastBounceDistanceCm);

  return (
    <>
      {/* Dynamic 3D Ground Shadow Disk (Depth perception & bounce timing indicator) */}
      <mesh ref={shadowMeshRef} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[1, 32]} />
        <meshBasicMaterial color="#000000" transparent opacity={0.42} />
      </mesh>

      {/* 3D Chalk Mark & Concentric Hawk-Eye Bounce Ring */}
      {lastBounce && (
        <group position={[lastBounce[0], 0.016, lastBounce[1]]}>
          <mesh rotation={[-Math.PI / 2, 0, 0]}>
            <circleGeometry args={[0.07, 16]} />
            <meshBasicMaterial
              color={lastBounceDistanceCm !== null && lastBounceDistanceCm < 5.0 ? '#ffffff' : '#0f3a1f'}
              transparent
              opacity={0.7}
            />
          </mesh>
          <mesh rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[0.07, 0.11, 24]} />
            <meshBasicMaterial
              color={lastBounceInBounds ? '#ccff00' : '#f43f5e'}
              transparent
              opacity={0.65}
            />
          </mesh>
        </group>
      )}

      {/* Physics RigidBody with 3D High-Visibility Tennis Ball */}
      <RigidBody
        ref={ballBodyRef}
        colliders="ball"
        ccd
        restitution={0.82}
        friction={0.65}
        linearDamping={0.02}
        angularDamping={0.1}
        onCollisionEnter={({ other }) => {
          const otherName = other.rigidBodyObject?.name;
          if (otherName === 'tennis_net') {
            if (isServeShot.current) {
              serveTouchedNet.current = true;
            }
            onBounce?.();
          } else {
            onBounce?.();
            collisionTriggeredBounce.current = true;
          }
        }}
      >
        <mesh ref={ballMeshRef} castShadow>
          <sphereGeometry args={[0.085, 32, 32]} />
          <meshStandardMaterial
            color="#ccff00"
            roughness={0.65}
            metalness={0.05}
            emissive="#ccff00"
            emissiveIntensity={0.12}
          />
        </mesh>
      </RigidBody>
    </>
  );
};
