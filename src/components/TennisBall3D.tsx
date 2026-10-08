import React, { useRef, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { RigidBody, RapierRigidBody } from '@react-three/rapier';
import { Mesh } from 'three';
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
  const lastHitTime = useRef(0);
  const serveTossTime = useRef(0);
  const servePrepEnteredTime = useRef(0);
  const lastBounceTime = useRef(0);
  const bouncesSinceHit = useRef(0);
  const pointResolved = useRef(false);
  const isServeShot = useRef(false);
  const serveTouchedNet = useRef(false);
  const serveLandedInBox = useRef(false);
  const p1SwingAttemptTime = useRef(0);

  // Reset ball position when serve_prep begins
  useEffect(() => {
    if (matchStatus === 'serve_prep' && ballBodyRef.current) {
      const { server, p1Pos, cpuPos } = useTennisStore.getState();
      const serverPos = server === 'p1' ? p1Pos : cpuPos;
      const handOffsetX = server === 'p1' ? -0.22 : 0.22;
      const handOffsetZ = server === 'p1' ? -0.32 : 0.32;

      ballBodyRef.current.setTranslation({ x: serverPos[0] + handOffsetX, y: 1.15, z: serverPos[2] + handOffsetZ }, true);
      ballBodyRef.current.setLinvel({ x: 0, y: 0, z: 0 }, true);
      ballBodyRef.current.setAngvel({ x: 0, y: 0, z: 0 }, true);
      bouncesSinceHit.current = 0;
      pointResolved.current = false;
      isServeShot.current = false;
      serveTouchedNet.current = false;
      serveLandedInBox.current = false;
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

    const ballPos = ballBodyRef.current.translation();
    const ballVel = ballBodyRef.current.linvel();
    const { p1Pos: p1, cpuPos, server, serveSide } = useTennisStore.getState();

    // Sync current ball position and velocity transiently
    useTennisStore.getState().ballPos = [ballPos.x, ballPos.y, ballPos.z];
    useTennisStore.getState().ballVel = [ballVel.x, ballVel.y, ballVel.z];

    // Net contact detection for serve
    if (isServeShot.current && Math.abs(ballPos.z) < 0.22 && ballPos.y <= 1.05) {
      serveTouchedNet.current = true;
    }

    // =========================================================================
    // 1. SERVE PREPARATION: Ball floats in server's hand (P1 or CPU)
    // =========================================================================
    if (matchStatus === 'serve_prep') {
      if (server === 'p1') {
        const handX = p1[0] - 0.22;
        const handY = 1.15 + Math.sin(t * 3.5) * 0.02;
        const handZ = p1[2] - 0.32;

        ballBodyRef.current.setTranslation({ x: handX, y: handY, z: handZ }, true);
        ballBodyRef.current.setLinvel({ x: 0, y: 0, z: 0 }, true);

        if (isActionJustPressed) {
          // Player 1 tosses ball up
          serveTossTime.current = t;
          useTennisStore.getState().setLastCall(null);
          setMatchStatus('serving');
          ballBodyRef.current.setLinvel({ x: 0.04, y: 7.2, z: -0.22 }, true);
        }
      } else {
        // CPU Serve Preparation
        const handX = cpuPos[0] + 0.22;
        const handY = 1.15 + Math.sin(t * 3.5) * 0.02;
        const handZ = cpuPos[2] + 0.32;

        ballBodyRef.current.setTranslation({ x: handX, y: handY, z: handZ }, true);
        ballBodyRef.current.setLinvel({ x: 0, y: 0, z: 0 }, true);

        // CPU pauses realistically then tosses ball
        const timeInPrep = (performance.now() / 1000) - servePrepEnteredTime.current;
        if (timeInPrep > 1.25) {
          serveTossTime.current = t;
          useTennisStore.getState().setLastCall(null);
          setMatchStatus('serving');
          ballBodyRef.current.setLinvel({ x: -0.04, y: 7.0, z: 0.22 }, true);
        }
      }
      return;
    }

    // =========================================================================
    // 2. SERVING: Ball in flight after toss. Server executes smash serve!
    // =========================================================================
    if (matchStatus === 'serving') {
      const timeSinceToss = t - serveTossTime.current;

      if (server === 'p1') {
        // Player 1 hits serve at selected height
        if (isActionJustPressed && ballPos.y >= 1.65 && timeSinceToss > 0.15) {
          const steeringX = (keys.current.right ? 1 : 0) - (keys.current.left ? 1 : 0);

          const hitHeight = Math.max(1.7, Math.min(3.7, ballPos.y));
          const recorridoFactor = (hitHeight - 1.7) / (3.7 - 1.7);
          const targetZ = -2.4 - recorridoFactor * 3.2;

          const baseTargetX = serveSide === 'deuce' ? -2.05 : 2.05;
          const targetX = baseTargetX + steeringX * 1.35;

          const shot = calculateShotVelocity({
            fromPos: [ballPos.x, ballPos.y, ballPos.z],
            targetZ,
            targetX,
            steeringX,
            isServe: true,
          });

          ballBodyRef.current.setLinvel(shot, true);
          ballBodyRef.current.setAngvel({ x: 10 + recorridoFactor * 6, y: steeringX * -3, z: 0 }, true);
          useTennisStore.getState().triggerP1Swing('smash');
          setLastHitter('p1');
          setMatchStatus('playing');
          lastHitTime.current = t;
          bouncesSinceHit.current = 0;
          pointResolved.current = false;
          isServeShot.current = true;
          serveTouchedNet.current = false;
          return;
        }

        // Missed toss reset
        if (timeSinceToss > 1.6 && ballPos.y < 0.4) {
          resetServe();
          return;
        }
      } else {
        // CPU automatically smashes serve down near toss apex
        if (timeSinceToss > 0.62 && ballPos.y >= 2.4 && !isServeShot.current) {
          // Deuce serve (CPU right / X < 0) -> aims to P1 Deuce box [0, 4.115] (center = +2.05m)
          // Ad serve (CPU left / X > 0) -> aims to P1 Ad box [-4.115, 0] (center = -2.05m)
          const baseTargetX = serveSide === 'deuce' ? 2.05 : -2.05;
          const targetX = baseTargetX + (Math.random() - 0.5) * 1.3;
          const targetZ = 3.2 + Math.random() * 2.2; // Inside P1 service box (0 to 6.4m)

          const cpuServeShot = calculateShotVelocity({
            fromPos: [ballPos.x, ballPos.y, ballPos.z],
            targetZ,
            targetX,
            steeringX: 0,
            isServe: true,
          });

          ballBodyRef.current.setLinvel(cpuServeShot, true);
          ballBodyRef.current.setAngvel({ x: -14, y: 0, z: 0 }, true);
          useTennisStore.getState().triggerCpuSwing('smash');
          setLastHitter('cpu');
          setMatchStatus('playing');
          lastHitTime.current = t;
          bouncesSinceHit.current = 0;
          pointResolved.current = false;
          isServeShot.current = true;
          serveTouchedNet.current = false;
          return;
        }

        if (timeSinceToss > 1.6 && ballPos.y < 0.4) {
          resetServe();
          return;
        }
      }
    }

    // =========================================================================
    // 3. IN-PLAY RALLY: Player 1 Hits Ball (Drive vs Revés)
    // =========================================================================
    if (matchStatus === 'playing') {
      const reach = evaluateHitReach(p1, [ballPos.x, ballPos.y, ballPos.z], false);
      const shotType = reach.shotType; // 'drive' (derecha) o 'backhand' (revés)

      // When player presses SPACE, execute swing animation immediately
      if (isActionJustPressed) {
        p1SwingAttemptTime.current = t;
        useTennisStore.getState().triggerP1Swing(shotType);
      }

      // ITF Rule 17: Returner must let serve bounce in service box before hitting!
      const isReturnerVolleyingServe = isServeShot.current && bouncesSinceHit.current === 0;

      // Ball is struck ONLY if the player actively pressed Space within swing window (0.35s)
      const isSwingActive = t - p1SwingAttemptTime.current <= 0.35;
      const shouldHit =
        !isReturnerVolleyingServe &&
        reach.canHit &&
        isSwingActive &&
        t - lastHitTime.current > 0.38;

      if (shouldHit) {
        // Consume the swing attempt so each Space press strikes once
        p1SwingAttemptTime.current = 0;

        const steeringX = (keys.current.right ? 1 : 0) - (keys.current.left ? 1 : 0);

        const shot = calculateShotVelocity({
          fromPos: [ballPos.x, ballPos.y, ballPos.z],
          targetZ: -9.5,
          steeringX,
          isServe: false,
          shotType,
        });

        ballBodyRef.current.setLinvel(shot, true);
        const spinX = shotType === 'drive' ? 12 : 7;
        const spinY = steeringX * (shotType === 'drive' ? -5 : -2);
        ballBodyRef.current.setAngvel({ x: spinX, y: spinY, z: 0 }, true);

        setLastHitter('p1');
        incrementRally();
        lastHitTime.current = t;
        bouncesSinceHit.current = 0;
        pointResolved.current = false;
        isServeShot.current = false;
      }

      // =======================================================================
      // 4. INTELLIGENT CPU OPPONENT RETURN (Drive vs Revés):
      // =======================================================================
      const isCpuVolleyingServe = isServeShot.current && bouncesSinceHit.current === 0;
      const cpuReach = evaluateHitReach(cpuPos, [ballPos.x, ballPos.y, ballPos.z], true);
      const isApproachingCpu = ballPos.z < -6.0 && ballVel.z < 0;

      if (
        !isCpuVolleyingServe &&
        isApproachingCpu &&
        cpuReach.canHit &&
        t - lastHitTime.current > 0.52
      ) {
        const shotType = cpuReach.shotType;
        const p1X = useTennisStore.getState().p1Pos[0];
        const preferredSide = p1X < 0 ? 1 : -1;
        const targetX = preferredSide * (shotType === 'drive' ? (2.0 + Math.random() * 2.2) : (1.4 + Math.random() * 1.4));

        const cpuShot = calculateShotVelocity({
          fromPos: [ballPos.x, ballPos.y, ballPos.z],
          targetZ: 10.2, // Deep baseline towards Player 1
          targetX,
          steeringX: 0,
          isServe: false,
          shotType,
        });

        ballBodyRef.current.setLinvel(cpuShot, true);
        ballBodyRef.current.setAngvel({ x: shotType === 'drive' ? -10 : -6, y: preferredSide * 3, z: 0 }, true);
        useTennisStore.getState().triggerCpuSwing(shotType);
        setLastHitter('cpu');
        incrementRally();
        lastHitTime.current = t;
        bouncesSinceHit.current = 0;
        pointResolved.current = false;
        isServeShot.current = false;
      }

      // =======================================================================
      // 5. BOUNCE EVALUATION & TENNIS COURT BOUNDARIES (IN / OUT / FAULT / LET)
      // =======================================================================
      const isGroundContact = ballPos.y <= 0.16 && ballVel.y <= 0.2;
      const isDebouncedBounce = t - lastBounceTime.current > 0.22;

      if (isGroundContact && isDebouncedBounce) {
        lastBounceTime.current = t;
        bouncesSinceHit.current += 1;
        onBounce?.();

        const hitter = useTennisStore.getState().lastHitter;

        // 5a. First Bounce Check (Line In / Out / Service Box / Let)
        if (bouncesSinceHit.current === 1 && !pointResolved.current && hitter) {
          const evaluation = evaluateBounce({
            x: ballPos.x,
            z: ballPos.z,
            isServe: isServeShot.current,
            serveSide,
            hitter,
          });

          // Check Service Let (ITF Rule 22: touches net and lands in legal box)
          if (isServeShot.current && serveTouchedNet.current && evaluation.isInBounds && !evaluation.isFault) {
            pointResolved.current = true;
            recordLet();
            setTimeout(() => resetServe(), 1800);
          } else if (evaluation.isFault) {
            pointResolved.current = true;
            recordFault();
            setTimeout(() => resetServe(), 1500);
          } else if (!evaluation.isInBounds) {
            pointResolved.current = true;
            const winner = hitter === 'p1' ? 'cpu' : 'p1';
            awardPoint(winner);
            setTimeout(() => resetServe(), 1800);
          } else if (isServeShot.current) {
            // Serve landed legally in the target box!
            serveLandedInBox.current = true;
          }
        }

        // 5b. Second Bounce Check (Double Bounce -> Hitter wins point; If untouched serve -> ACE!)
        if (bouncesSinceHit.current >= 2 && !pointResolved.current && hitter) {
          pointResolved.current = true;
          const isAce = isServeShot.current && serveLandedInBox.current;
          awardPoint(hitter, isAce);
          setTimeout(() => resetServe(), 1800);
        }
      }

      // =======================================================================
      // 6. BALL OUT OF COURT RUN-OFF
      // =======================================================================
      if (
        (ballPos.y < -1.0 || Math.abs(ballPos.z) > 20 || Math.abs(ballPos.x) > 10) &&
        !pointResolved.current
      ) {
        pointResolved.current = true;
        const hitter = useTennisStore.getState().lastHitter || 'p1';
        if (bouncesSinceHit.current >= 1) {
          // Ball bounced legally in opponent's court, then escaped off-court without return:
          // Hitter wins point! If it was an untouched serve -> ACE!
          const isAce = isServeShot.current && serveLandedInBox.current;
          awardPoint(hitter, isAce);
        } else {
          // Ball flew out directly without bouncing in-bounds: Opponent wins point
          const winner = hitter === 'p1' ? 'cpu' : 'p1';
          awardPoint(winner);
        }
        setTimeout(() => resetServe(), 1500);
      }
    }
  });

  return (
    <RigidBody
      ref={ballBodyRef}
      colliders="ball"
      restitution={0.82}
      friction={0.65}
      linearDamping={0.02}
      angularDamping={0.1}
      onCollisionEnter={() => {
        onBounce?.();
      }}
    >
      {/* 3D Tennis Ball Sphere */}
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
  );
};
