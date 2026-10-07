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
 * Organic, rounded 3D tennis athlete model with realistic articulated kinematics:
 * - Alternating leg gait & running footwork (hip pivot, knee flexion, ankle stride)
 * - Coordinated arm counter-swing and tennis split-step ready bounce
 * - Authentic tennis stroke biomechanics (unit turn, contact drive, high follow-through)
 * - Service motion (toss extension and trophy pose smash)
 * - Organic anatomical shapes: smooth capsules, spheres, and toruses (zero sharp box cubes)
 */
export const Player3D: React.FC<Player3DProps> = ({
  position,
  isOpponent = false,
  isControlled = false,
}) => {
  const groupRef = useRef<Group>(null);
  const torsoGroupRef = useRef<Group>(null);
  const leftArmRef = useRef<Group>(null);
  const rightArmRef = useRef<Group>(null);
  const leftLegRef = useRef<Group>(null);
  const rightLegRef = useRef<Group>(null);
  const racketGroupRef = useRef<Group>(null);

  const keys = useKeyboardControls();

  // Position and velocity vectors
  const currentPos = useRef(new Vector3(position[0], position[1], position[2]));
  const velocity = useRef(new Vector3(0, 0, 0));
  const currentTilt = useRef({ roll: 0, pitch: 0 });

  // Kinematic gait cycle progress
  const stepProgress = useRef(0);

  // Stroke & service animation state
  const swingProgress = useRef(0);
  const isSwinging = useRef(false);
  const lastCpuSwingTrigger = useRef(0);

  const lastMatchStatus = useRef<string>('');
  const lastServeSide = useRef<string>('');

  useFrame((state, delta) => {
    if (!groupRef.current) return;

    const t = state.clock.getElapsedTime();
    const matchStatus = useTennisStore.getState().matchStatus;
    const serveSide = useTennisStore.getState().serveSide;

    // =========================================================================
    // 1. POSITION & VELOCITY UPDATES (CONTROLLED PLAYER vs CPU OPPONENT)
    // =========================================================================
    if (isControlled) {
      // If returning to serve_prep or changing serve side, initialize server to valid spot
      if (
        matchStatus === 'serve_prep' &&
        (lastMatchStatus.current !== 'serve_prep' || lastServeSide.current !== serveSide)
      ) {
        const defaultX = serveSide === 'deuce' ? 1.8 : -1.8;
        currentPos.current.x = defaultX;
        currentPos.current.z = 12.35;
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

      // Playable boundaries & Tennis Regulation Serve Restrictions:
      if (matchStatus === 'serve_prep' || matchStatus === 'serving') {
        // 1. Must be strictly outside/behind the baseline (Z >= 12.05m, up to 14.5m)
        currentPos.current.z = Math.max(12.05, Math.min(14.5, currentPos.current.z));

        // 2. Must be strictly within the designated section (cannot cross center mark or sideline)
        if (serveSide === 'deuce') {
          // Deuce section: Right side of center mark (X in [0.15, 4.115])
          currentPos.current.x = Math.max(0.15, Math.min(4.115, currentPos.current.x));
        } else {
          // Ad section: Left side of center mark (X in [-4.115, -0.15])
          currentPos.current.x = Math.max(-4.115, Math.min(-0.15, currentPos.current.x));
        }
      } else {
        // Regular rally boundaries across entire court
        currentPos.current.x = Math.max(-6.2, Math.min(6.2, currentPos.current.x));
        currentPos.current.z = Math.max(3.8, Math.min(15.5, currentPos.current.z));
      }

      // Tilt
      const targetRoll = (-velocity.current.x / 8.8) * 0.18;
      const targetPitch = (-velocity.current.z / 8.8) * 0.12;
      currentTilt.current.roll = MathUtils.lerp(currentTilt.current.roll, targetRoll, 0.15);
      currentTilt.current.pitch = MathUtils.lerp(currentTilt.current.pitch, targetPitch, 0.15);

      useTennisStore.getState().p1Pos = [currentPos.current.x, currentPos.current.y, currentPos.current.z];

      // Swing action
      if (keys.current.action && !isSwinging.current) {
        isSwinging.current = true;
        swingProgress.current = 1.0;
      }
    } else if (isOpponent) {
      // CPU AI predictive movement
      const ball = useTennisStore.getState().ballPos;
      const ballV = useTennisStore.getState().ballVel;
      const status = useTennisStore.getState().matchStatus;
      const cpuSwingTrigger = useTennisStore.getState().cpuSwingTrigger;

      let targetX = 0;
      let targetZ = -12.2;

      if (status === 'playing' || status === 'serving') {
        const isBallIncoming = ballV[2] < 0;

        if (isBallIncoming) {
          const timeToReach = Math.max(0.1, (ball[2] - (-12.0)) / Math.max(0.5, -ballV[2]));
          const predictedX = ball[0] + ballV[0] * timeToReach;
          targetX = Math.max(-5.5, Math.min(5.5, predictedX + 0.2));
          targetZ = Math.max(-13.0, Math.min(-9.0, ball[2] < -8.5 ? ball[2] - 0.5 : -12.0));
        } else {
          targetX = 0;
          targetZ = -12.2;
        }
      } else {
        // In serve_prep, CPU stands ready in the diagonal return position
        const currentServeSide = useTennisStore.getState().serveSide;
        targetX = currentServeSide === 'deuce' ? -2.2 : 2.2;
        targetZ = -12.35;
      }

      const diffX = targetX - currentPos.current.x;
      const diffZ = targetZ - currentPos.current.z;
      const dist = Math.hypot(diffX, diffZ);
      const isMoving = dist > 0.08;

      const cpuSpeed = 7.5;
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

      const targetRoll = isMoving ? -(diffX / dist) * 0.15 : 0;
      currentTilt.current.roll = MathUtils.lerp(currentTilt.current.roll, targetRoll, 0.15);

      useTennisStore.getState().cpuPos = [currentPos.current.x, currentPos.current.y, currentPos.current.z];

      if (cpuSwingTrigger !== lastCpuSwingTrigger.current) {
        lastCpuSwingTrigger.current = cpuSwingTrigger;
        isSwinging.current = true;
        swingProgress.current = 1.0;
      }
    }

    // =========================================================================
    // 2. REALISTIC ARTICULATED LIMB KINEMATICS (LEGS, FEET, ARMS, HANDS)
    // =========================================================================
    const speed = Math.hypot(velocity.current.x, velocity.current.z);
    const isRunning = speed > 0.45;

    // Advance running gait cycle with cadence proportional to velocity
    if (isRunning) {
      stepProgress.current += delta * Math.min(speed * 2.4, 20.0);
    }

    const gaitPhase = stepProgress.current;

    // Running foot bounce vs idle ready split-step bounce
    const verticalBob = isRunning
      ? Math.abs(Math.sin(gaitPhase)) * 0.065
      : Math.sin(t * 7.0) * 0.022;

    groupRef.current.position.set(
      currentPos.current.x,
      position[1] + verticalBob,
      currentPos.current.z
    );

    groupRef.current.rotation.set(
      currentTilt.current.pitch,
      isOpponent ? 0 : Math.PI,
      currentTilt.current.roll
    );

    // --- LEGS & FEET KINEMATICS ---
    if (leftLegRef.current && rightLegRef.current) {
      if (isRunning) {
        // Alternating leg swing (hip flexion & extension)
        const leftHipSwing = Math.sin(gaitPhase) * 0.65;
        const rightHipSwing = -Math.sin(gaitPhase) * 0.65;

        // Knee bends as leg swings back, extends forward for foot plant
        const leftKneeFlex = Math.max(0, -Math.sin(gaitPhase)) * 0.6;
        const rightKneeFlex = Math.max(0, Math.sin(gaitPhase)) * 0.6;

        // Lateral foot spread
        const lateralSway = (-velocity.current.x / 8.8) * 0.12;

        leftLegRef.current.rotation.set(leftHipSwing + leftKneeFlex * 0.3, lateralSway, 0.05);
        rightLegRef.current.rotation.set(rightHipSwing + rightKneeFlex * 0.3, lateralSway, -0.05);
      } else {
        // Ready stance: athletic knee flexion, wide springy base
        const readyKneeBend = 0.14 + Math.sin(t * 7.0) * 0.04;
        leftLegRef.current.rotation.set(readyKneeBend, 0, 0.08);
        rightLegRef.current.rotation.set(readyKneeBend, 0, -0.08);
      }
    }

    // --- ARMS, HANDS & RACKET KINEMATICS ---
    // Handle swing stroke progress
    if (isSwinging.current) {
      swingProgress.current -= delta * 3.6;
      if (swingProgress.current <= 0) {
        swingProgress.current = 0;
        isSwinging.current = false;
      }
    }

    const isServingToss = !isOpponent && matchStatus === 'serving';
    const isServePrep = !isOpponent && matchStatus === 'serve_prep';

    if (torsoGroupRef.current && leftArmRef.current && rightArmRef.current && racketGroupRef.current) {
      if (isSwinging.current) {
        // FULL BIOMECHANICAL TENNIS STROKE (UNIT TURN -> ACCELERATION -> FOLLOW-THROUGH)
        const strokePhase = 1 - swingProgress.current; // 0 to 1

        // Unit turn & torso uncoiling
        const torsoTwist = Math.sin(strokePhase * Math.PI) * (isOpponent ? -0.55 : 0.55);
        torsoGroupRef.current.rotation.set(0, torsoTwist, 0);

        // Right arm forward stroke arc and high follow-through wrap over shoulder
        const armForwardArc = Math.sin(strokePhase * Math.PI) * 1.5;
        const armElevate = (strokePhase - 0.5) * 1.2;
        rightArmRef.current.rotation.set(
          -0.2 + armForwardArc * 0.8 + armElevate * 0.4,
          0.3 + armForwardArc * 0.9,
          -0.3 - armForwardArc * 0.5
        );

        // Racket rollover with topspin
        const racketRoll = strokePhase * Math.PI * 1.2;
        racketGroupRef.current.rotation.set(0.5, 0.2 + racketRoll, -0.3 - racketRoll * 0.8);

        // Left arm counter-balance & tucking
        leftArmRef.current.rotation.set(
          Math.sin(strokePhase * Math.PI) * -0.6,
          -0.3,
          0.2
        );
      } else if (isServingToss) {
        // SERVICE TOSS POSE: Left arm reaches straight UP into the sky, right arm in Trophy Pose
        torsoGroupRef.current.rotation.set(-0.15, 0.2, 0);
        leftArmRef.current.rotation.set(-2.6, -0.15, 0.2); // Pointing up to sky
        rightArmRef.current.rotation.set(-1.6, 0.5, -0.7); // Trophy pose behind head
        racketGroupRef.current.rotation.set(0.8, -0.2, 0.4);
      } else if (isServePrep) {
        // SERVE PREPARATION POSE: Left hand holds ball out front, right arm relaxed
        torsoGroupRef.current.rotation.set(0, 0.15, 0);
        leftArmRef.current.rotation.set(-0.75, -0.15, 0.15);
        rightArmRef.current.rotation.set(-0.25, 0.25, -0.2);
        racketGroupRef.current.rotation.set(0.5, 0.2, -0.3);
      } else if (isRunning) {
        // RUNNING ARM COUNTER-SWING
        torsoGroupRef.current.rotation.set(0, 0, 0);
        const leftArmSwing = -Math.sin(gaitPhase) * 0.55;
        const rightArmPump = Math.sin(gaitPhase) * 0.35;

        leftArmRef.current.rotation.set(leftArmSwing, -0.1, 0.1);
        rightArmRef.current.rotation.set(0.2 + rightArmPump * 0.4, 0.2, -0.25);
        racketGroupRef.current.rotation.set(0.5, 0.2, -0.3);
      } else {
        // READY WAITING POSE: Active athletic readiness with hands forward
        torsoGroupRef.current.rotation.set(0.05, 0, 0);
        const readyHandPulse = Math.sin(t * 7.0) * 0.03;

        leftArmRef.current.rotation.set(-0.45 + readyHandPulse, -0.2, 0.15);
        rightArmRef.current.rotation.set(-0.35 + readyHandPulse, 0.25, -0.2);
        racketGroupRef.current.rotation.set(0.5, 0.2, -0.3);
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
      {/* Dynamic Ground Contact Shadow (matching reference image) */}
      <mesh position={[0, 0.012, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.38, 24]} />
        <meshBasicMaterial color="#000000" transparent opacity={0.36} />
      </mesh>

      {/* ====================================================================
          1. TORSO & HEAD SKELETON GROUP (Pivots, twists and tilts with spine)
          ==================================================================== */}
      <group ref={torsoGroupRef}>
        {/* Neck */}
        <mesh position={[0, 1.48, 0]} castShadow>
          <cylinderGeometry args={[0.075, 0.085, 0.14, 16]} />
          <meshStandardMaterial color={skinColor} roughness={0.6} />
        </mesh>

        {/* Head Cranium */}
        <mesh position={[0, 1.66, 0]} castShadow>
          <sphereGeometry args={[0.17, 24, 24]} />
          <meshStandardMaterial color={skinColor} roughness={0.55} />
        </mesh>

        {/* 3D Hair (Rounded dome & back volume) */}
        <mesh position={[0, 1.71, -0.02]} castShadow>
          <sphereGeometry args={[0.175, 20, 20]} />
          <meshStandardMaterial color={hairColor} roughness={0.8} />
        </mesh>

        {/* Seamless Round Elastic Headband */}
        <mesh position={[0, 1.68, 0]} rotation={[Math.PI / 2, 0, 0]} castShadow>
          <torusGeometry args={[0.173, 0.022, 16, 32]} />
          <meshStandardMaterial color={headbandColor} roughness={0.4} />
        </mesh>

        {/* Eyes (if opponent facing camera) */}
        {isOpponent && (
          <group position={[0, 1.66, 0.15]}>
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

        {/* Polo Ribbed Collar */}
        <mesh position={[0, 1.43, 0]} rotation={[Math.PI / 2.3, 0, 0]}>
          <torusGeometry args={[0.11, 0.02, 16, 24]} />
          <meshStandardMaterial color={isOpponent ? '#ffffff' : '#e2e8f0'} />
        </mesh>

        {/* Athletic Muscular Torso (Curved Capsule) */}
        <mesh position={[0, 1.18, 0]} castShadow>
          <capsuleGeometry args={[0.21, 0.36, 16, 24]} />
          <meshStandardMaterial color={shirtColor} roughness={0.5} />
        </mesh>

        {/* Left Rounded Shoulder Cap (Deltoid) */}
        <mesh position={[-0.24, 1.34, 0]} castShadow>
          <sphereGeometry args={[0.09, 16, 16]} />
          <meshStandardMaterial color={shirtColor} roughness={0.5} />
        </mesh>

        {/* Right Rounded Shoulder Cap (Deltoid) */}
        <mesh position={[0.24, 1.34, 0]} castShadow>
          <sphereGeometry args={[0.09, 16, 16]} />
          <meshStandardMaterial color={shirtColor} roughness={0.5} />
        </mesh>

        {/* ====================================================================
            2. ARTICULATED LEFT ARM (Pivots at shoulder)
            ==================================================================== */}
        <group ref={leftArmRef} position={[-0.25, 1.34, 0]}>
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
        <group ref={rightArmRef} position={[0.25, 1.34, 0]}>
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
          4. PELVIS & SHORTS
          ==================================================================== */}
      <mesh position={[0, 0.88, 0]} castShadow>
        <sphereGeometry args={[0.22, 20, 20]} />
        <meshStandardMaterial color={shortsColor} roughness={0.6} />
      </mesh>
      <mesh position={[-0.13, 0.76, 0.02]} rotation={[0.08, 0, 0.08]} castShadow>
        <cylinderGeometry args={[0.11, 0.12, 0.22, 20]} />
        <meshStandardMaterial color={shortsColor} roughness={0.6} />
      </mesh>
      <mesh position={[0.13, 0.76, 0.02]} rotation={[0.08, 0, -0.08]} castShadow>
        <cylinderGeometry args={[0.11, 0.12, 0.22, 20]} />
        <meshStandardMaterial color={shortsColor} roughness={0.6} />
      </mesh>

      {/* ====================================================================
          5. ARTICULATED LEFT LEG & SHOE (Pivots at hip [-0.14, 0.76, 0])
          ==================================================================== */}
      <group ref={leftLegRef} position={[-0.14, 0.76, 0]}>
        {/* Left Thigh */}
        <mesh position={[0, -0.16, 0.02]} rotation={[0.06, 0, 0.04]} castShadow>
          <capsuleGeometry args={[0.075, 0.24, 12, 16]} />
          <meshStandardMaterial color={skinColor} roughness={0.6} />
        </mesh>
        {/* Left Knee */}
        <mesh position={[0, -0.32, 0.04]}>
          <sphereGeometry args={[0.07, 14, 14]} />
          <meshStandardMaterial color={skinColor} roughness={0.6} />
        </mesh>
        {/* Left Calf */}
        <mesh position={[0, -0.48, 0.02]} castShadow>
          <capsuleGeometry args={[0.068, 0.24, 12, 16]} />
          <meshStandardMaterial color={skinColor} roughness={0.6} />
        </mesh>
        {/* Left White Sock */}
        <mesh position={[0, -0.62, 0]}>
          <cylinderGeometry args={[0.068, 0.068, 0.12, 16]} />
          <meshStandardMaterial color="#ffffff" roughness={0.8} />
        </mesh>
        {/* Left Tennis Shoe */}
        <group position={[0, -0.7, 0.03]}>
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

      {/* ====================================================================
          6. ARTICULATED RIGHT LEG & SHOE (Pivots at hip [0.14, 0.76, 0])
          ==================================================================== */}
      <group ref={rightLegRef} position={[0.14, 0.76, 0]}>
        {/* Right Thigh */}
        <mesh position={[0, -0.16, 0.02]} rotation={[0.06, 0, -0.04]} castShadow>
          <capsuleGeometry args={[0.075, 0.24, 12, 16]} />
          <meshStandardMaterial color={skinColor} roughness={0.6} />
        </mesh>
        {/* Right Knee */}
        <mesh position={[0, -0.32, 0.04]}>
          <sphereGeometry args={[0.07, 14, 14]} />
          <meshStandardMaterial color={skinColor} roughness={0.6} />
        </mesh>
        {/* Right Calf */}
        <mesh position={[0, -0.48, 0.02]} castShadow>
          <capsuleGeometry args={[0.068, 0.24, 12, 16]} />
          <meshStandardMaterial color={skinColor} roughness={0.6} />
        </mesh>
        {/* Right White Sock */}
        <mesh position={[0, -0.62, 0]}>
          <cylinderGeometry args={[0.068, 0.068, 0.12, 16]} />
          <meshStandardMaterial color="#ffffff" roughness={0.8} />
        </mesh>
        {/* Right Tennis Shoe */}
        <group position={[0, -0.7, 0.03]}>
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
  );
};
