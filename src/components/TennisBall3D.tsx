import React, { useRef, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { RigidBody, RapierRigidBody } from '@react-three/rapier';
import { Mesh } from 'three';
import { useTennisStore } from '../store/useTennisStore';
import { useKeyboardControls } from '../hooks/useKeyboardControls';
import { calculateShotVelocity } from '../utils/tennisBallistics';
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

  // Track previous space key state to detect single keydown presses
  const prevActionPressed = useRef(false);
  const lastHitTime = useRef(0);
  const serveTossTime = useRef(0);
  const lastBounceTime = useRef(0);
  const bouncesSinceHit = useRef(0);
  const pointResolved = useRef(false);
  const isServeShot = useRef(false);

  // Reset ball position when serve_prep begins
  useEffect(() => {
    if (matchStatus === 'serve_prep' && ballBodyRef.current) {
      const p1 = useTennisStore.getState().p1Pos;
      ballBodyRef.current.setTranslation({ x: p1[0] - 0.2, y: 1.15, z: p1[2] - 0.3 }, true);
      ballBodyRef.current.setLinvel({ x: 0, y: 0, z: 0 }, true);
      ballBodyRef.current.setAngvel({ x: 0, y: 0, z: 0 }, true);
      bouncesSinceHit.current = 0;
      pointResolved.current = false;
      isServeShot.current = false;
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
    const p1 = useTennisStore.getState().p1Pos;

    // Sync current ball position and velocity transiently
    useTennisStore.getState().ballPos = [ballPos.x, ballPos.y, ballPos.z];
    useTennisStore.getState().ballVel = [ballVel.x, ballVel.y, ballVel.z];

    // =========================================================================
    // 1. SERVE PREPARATION: Ball floats in server's hand, waiting for toss
    // =========================================================================
    if (matchStatus === 'serve_prep') {
      const handX = p1[0] - 0.22;
      const handY = 1.15 + Math.sin(t * 3.5) * 0.02;
      const handZ = p1[2] - 0.32;

      ballBodyRef.current.setTranslation({ x: handX, y: handY, z: handZ }, true);
      ballBodyRef.current.setLinvel({ x: 0, y: 0, z: 0 }, true);

      if (isActionJustPressed) {
        // Toss the ball higher up for a generous arc and realistic travel window
        serveTossTime.current = t;
        useTennisStore.getState().setLastCall(null);
        setMatchStatus('serving');
        ballBodyRef.current.setLinvel({ x: 0.04, y: 7.2, z: -0.22 }, true);
      }
      return;
    }

    // =========================================================================
    // 2. SERVING: Ball is in flight after toss. Player hits at chosen height!
    // =========================================================================
    if (matchStatus === 'serving') {
      const timeSinceToss = t - serveTossTime.current;

      // Detect serve hit while ball is in the air (between 1.7m and 3.8m)
      if (isActionJustPressed && ballPos.y >= 1.65 && timeSinceToss > 0.15) {
        const steeringX = (keys.current.right ? 1 : 0) - (keys.current.left ? 1 : 0);
        const serveSide = useTennisStore.getState().serveSide;

        // Calculate toss progress / recorrido:
        // Struck at high apex (~3.4m - 3.7m) -> Maximum power & goes farther into opponent's box (lejos)
        // Struck earlier/lower (~1.8m - 2.5m) -> Shorter placement closer to net (cerca)
        const hitHeight = Math.max(1.7, Math.min(3.7, ballPos.y));
        const recorridoFactor = (hitHeight - 1.7) / (3.7 - 1.7); // 0.0 (cerca) to 1.0 (lejos)

        // Regulation service box depth spans Z in [0, -6.40m]:
        // Lower hit -> lands closer to net (-2.4m)
        // High apex hit -> lands deep in service box (-5.6m, near regulation service line)
        const targetZ = -2.4 - recorridoFactor * 3.2;

        // Regulation diagonal service box lateral placement:
        // Deuce serve (right) -> aims to left box [-4.115, 0], center = -2.05m
        // Ad serve (left) -> aims to right box [0, 4.115], center = +2.05m
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
        setLastHitter('p1');
        setMatchStatus('playing');
        lastHitTime.current = t;
        bouncesSinceHit.current = 0;
        pointResolved.current = false;
        isServeShot.current = true;
        return;
      }

      // If toss is missed and ball hits ground, reset serve
      if (timeSinceToss > 1.6 && ballPos.y < 0.4) {
        resetServe();
        return;
      }
    }

    // =========================================================================
    // 3. IN-PLAY RALLY: Player 1 Hits Ball (Forehand / Backhand)
    // =========================================================================
    if (matchStatus === 'playing') {
      const distToP1 = Math.hypot(ballPos.x - p1[0], ballPos.z - p1[2]);
      const isBallInFrontOfP1 = ballPos.z <= p1[2] + 0.8 && ballPos.z >= p1[2] - 2.4;
      const canHit =
        distToP1 <= 2.5 &&
        isBallInFrontOfP1 &&
        ballPos.y <= 2.2 &&
        t - lastHitTime.current > 0.45;

      if (isActionJustPressed && canHit) {
        const steeringX = (keys.current.right ? 1 : 0) - (keys.current.left ? 1 : 0);
        const shot = calculateShotVelocity({
          fromPos: [ballPos.x, ballPos.y, ballPos.z],
          targetZ: -9.5,
          steeringX,
          isServe: false,
        });

        ballBodyRef.current.setLinvel(shot, true);
        ballBodyRef.current.setAngvel({ x: 10, y: steeringX * -4, z: 0 }, true);
        setLastHitter('p1');
        incrementRally();
        lastHitTime.current = t;
        bouncesSinceHit.current = 0;
        pointResolved.current = false;
        isServeShot.current = false;
      }

      // =======================================================================
      // 4. INTELLIGENT CPU OPPONENT RETURN:
      // =======================================================================
      const cpuPos = useTennisStore.getState().cpuPos;
      const distToCpu = Math.hypot(ballPos.x - cpuPos[0], ballPos.z - cpuPos[2]);
      const isApproachingCpu = ballPos.z < -6.0 && ballVel.z < 0;

      if (isApproachingCpu && distToCpu < 2.8 && ballPos.y < 2.2 && t - lastHitTime.current > 0.55) {
        // Smart placement: aim away from Player 1's position to test player agility
        const p1X = useTennisStore.getState().p1Pos[0];
        const preferredSide = p1X < 0 ? 1 : -1;
        const targetX = preferredSide * (1.8 + Math.random() * 2.0);

        const cpuShot = calculateShotVelocity({
          fromPos: [ballPos.x, ballPos.y, ballPos.z],
          targetZ: 10.2, // Deep baseline towards Player 1
          targetX,
          steeringX: 0,
          isServe: false,
        });

        ballBodyRef.current.setLinvel(cpuShot, true);
        ballBodyRef.current.setAngvel({ x: -8, y: preferredSide * 3, z: 0 }, true);
        useTennisStore.getState().triggerCpuSwing();
        setLastHitter('cpu');
        incrementRally();
        lastHitTime.current = t;
        bouncesSinceHit.current = 0;
        pointResolved.current = false;
        isServeShot.current = false;
      }

      // =======================================================================
      // 5. BOUNCE EVALUATION & TENNIS COURT BOUNDARIES (IN / OUT / FAULT)
      // =======================================================================
      const isGroundContact = ballPos.y <= 0.16 && ballVel.y <= 0.2;
      const isDebouncedBounce = t - lastBounceTime.current > 0.22;

      if (isGroundContact && isDebouncedBounce) {
        lastBounceTime.current = t;
        bouncesSinceHit.current += 1;
        onBounce?.();

        const hitter = useTennisStore.getState().lastHitter;

        // 5a. First Bounce Check (Line In / Out / Service Box)
        if (bouncesSinceHit.current === 1 && !pointResolved.current && hitter) {
          const serveSide = useTennisStore.getState().serveSide;
          const evaluation = evaluateBounce({
            x: ballPos.x,
            z: ballPos.z,
            isServe: isServeShot.current,
            serveSide,
            hitter,
          });

          if (evaluation.isFault) {
            pointResolved.current = true;
            recordFault();
            setTimeout(() => resetServe(), 1500);
          } else if (!evaluation.isInBounds) {
            pointResolved.current = true;
            const winner = hitter === 'p1' ? 'cpu' : 'p1';
            awardPoint(winner);
            setTimeout(() => resetServe(), 1800);
          }
        }

        // 5b. Second Bounce Check (Double Bounce -> Hitter wins point)
        if (bouncesSinceHit.current >= 2 && !pointResolved.current && hitter) {
          pointResolved.current = true;
          awardPoint(hitter);
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
        const winner = hitter === 'p1' ? 'cpu' : 'p1';
        awardPoint(winner);
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
