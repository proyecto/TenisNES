import React from 'react';
import { RigidBody } from '@react-three/rapier';
import { useTennisStore } from '../store/useTennisStore';

/**
 * Standard regulation tennis court dimensions (in meters):
 * Total length = 23.77m (±11.885m from center net)
 * Singles width = 8.23m (±4.115m from center)
 * Doubles width = 10.97m (±5.485m from center)
 * Service line = 6.40m from net (±6.40m)
 * Net height = 0.914m in center, 1.07m at posts
 */
export const Court3D: React.FC = () => {
  const matchStatus = useTennisStore((state) => state.matchStatus);
  const server = useTennisStore((state) => state.server);
  const serveSide = useTennisStore((state) => state.serveSide);

  // Generate alternating lawn mower stripes
  const stripesCount = 24;
  const stripeWidth = 1.6;

  const isServingMode = matchStatus === 'serve_prep' || matchStatus === 'serving';

  // Server section indicator coordinates
  const isP1Server = server === 'p1';
  const serverBoxX = isP1Server
    ? (serveSide === 'deuce' ? 2.15 : -2.15)
    : (serveSide === 'deuce' ? -2.15 : 2.15);
  const serverBoxZ = isP1Server ? 13.2 : -13.2;

  // Target diagonal service box coordinates
  const targetBoxX = isP1Server
    ? (serveSide === 'deuce' ? -2.057 : 2.057)
    : (serveSide === 'deuce' ? 2.057 : -2.057);
  const targetBoxZ = isP1Server ? -3.2 : 3.2;

  return (
    <group>
      {/* 1. Ground Physics Collider & Full-Field Lush Lawn */}
      <RigidBody type="fixed" friction={0.65} restitution={0.80}>
        {/* Deep base ground */}
        <mesh position={[0, -0.1, 0]} receiveShadow>
          <boxGeometry args={[38, 0.2, 54]} />
          <meshStandardMaterial color="#5ea800" roughness={0.8} />
        </mesh>
      </RigidBody>

      {/* Alternating Wimbledon Lawnmower Stripes across the grass */}
      <group position={[0, 0.005, 0]}>
        {Array.from({ length: stripesCount }).map((_, i) => {
          const xPos = (i - stripesCount / 2 + 0.5) * stripeWidth;
          const isLight = i % 2 === 0;
          return (
            <mesh key={i} position={[xPos, 0, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
              <planeGeometry args={[stripeWidth, 52]} />
              <meshStandardMaterial
                color={isLight ? '#7ec800' : '#6eb500'}
                roughness={0.75}
              />
            </mesh>
          );
        })}
      </group>

      {/* 2. Court Regulation White Lines (Painted directly on lawn) */}
      <group position={[0, 0.015, 0]}>
        {/* Baselines (Z = ±11.89m, Width = 10.97m) */}
        <mesh position={[0, 0, 11.89]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[10.97, 0.1]} />
          <meshBasicMaterial color="#ffffff" />
        </mesh>
        <mesh position={[0, 0, -11.89]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[10.97, 0.1]} />
          <meshBasicMaterial color="#ffffff" />
        </mesh>

        {/* Center Baseline Hash Marks (10cm x 50cm) */}
        <mesh position={[0, 0, 11.64]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[0.08, 0.5]} />
          <meshBasicMaterial color="#ffffff" />
        </mesh>
        <mesh position={[0, 0, -11.64]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[0.08, 0.5]} />
          <meshBasicMaterial color="#ffffff" />
        </mesh>

        {/* Doubles Sidelines (X = ±5.485m, Length = 23.77m) */}
        <mesh position={[5.485, 0, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[0.09, 23.77]} />
          <meshBasicMaterial color="#ffffff" />
        </mesh>
        <mesh position={[-5.485, 0, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[0.09, 23.77]} />
          <meshBasicMaterial color="#ffffff" />
        </mesh>

        {/* Singles Sidelines (X = ±4.115m, Length = 23.77m) */}
        <mesh position={[4.115, 0, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[0.08, 23.77]} />
          <meshBasicMaterial color="#ffffff" />
        </mesh>
        <mesh position={[-4.115, 0, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[0.08, 23.77]} />
          <meshBasicMaterial color="#ffffff" />
        </mesh>

        {/* Service Lines (Z = ±6.40m, Width = 8.23m) */}
        <mesh position={[0, 0, 6.4]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[8.23, 0.08]} />
          <meshBasicMaterial color="#ffffff" />
        </mesh>
        <mesh position={[0, 0, -6.4]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[8.23, 0.08]} />
          <meshBasicMaterial color="#ffffff" />
        </mesh>

        {/* Center Service Line (X = 0, Z between -6.40 and +6.40) */}
        <mesh position={[0, 0, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[0.08, 12.8]} />
          <meshBasicMaterial color="#ffffff" />
        </mesh>
      </group>

      {/* 2b. Tennis Rule Visual Guides (Serving Area & Diagonal Target Box) */}
      {isServingMode && (
        <group position={[0, 0.018, 0]}>
          {/* Active Server Legal Zone (Behind Baseline, Strictly in Active Section) */}
          <group position={[serverBoxX, 0, serverBoxZ]}>
            {/* Soft illuminated fill */}
            <mesh rotation={[-Math.PI / 2, 0, 0]}>
              <planeGeometry args={[3.85, 2.4]} />
              <meshBasicMaterial color="#ccff00" transparent opacity={0.15} />
            </mesh>
            {/* Boundary border lines */}
            <mesh position={[0, 0, -1.2]} rotation={[-Math.PI / 2, 0, 0]}>
              <planeGeometry args={[3.85, 0.04]} />
              <meshBasicMaterial color="#ccff00" transparent opacity={0.6} />
            </mesh>
            <mesh position={[0, 0, 1.2]} rotation={[-Math.PI / 2, 0, 0]}>
              <planeGeometry args={[3.85, 0.04]} />
              <meshBasicMaterial color="#ccff00" transparent opacity={0.6} />
            </mesh>
            <mesh position={[-1.92, 0, 0]} rotation={[-Math.PI / 2, 0, 0]}>
              <planeGeometry args={[0.04, 2.4]} />
              <meshBasicMaterial color="#ccff00" transparent opacity={0.6} />
            </mesh>
            <mesh position={[1.92, 0, 0]} rotation={[-Math.PI / 2, 0, 0]}>
              <planeGeometry args={[0.04, 2.4]} />
              <meshBasicMaterial color="#ccff00" transparent opacity={0.6} />
            </mesh>
          </group>

          {/* Diagonally Opposite Target Service Box (Must land inside this box) */}
          <group position={[targetBoxX, 0, targetBoxZ]}>
            {/* Glowing target fill */}
            <mesh rotation={[-Math.PI / 2, 0, 0]}>
              <planeGeometry args={[4.115, 6.4]} />
              <meshBasicMaterial color="#00e5ff" transparent opacity={0.16} />
            </mesh>
            {/* Target perimeter outline */}
            <mesh position={[0, 0, -3.18]} rotation={[-Math.PI / 2, 0, 0]}>
              <planeGeometry args={[4.115, 0.05]} />
              <meshBasicMaterial color="#00e5ff" transparent opacity={0.6} />
            </mesh>
            <mesh position={[0, 0, 3.18]} rotation={[-Math.PI / 2, 0, 0]}>
              <planeGeometry args={[4.115, 0.05]} />
              <meshBasicMaterial color="#00e5ff" transparent opacity={0.6} />
            </mesh>
            <mesh position={[-2.04, 0, 0]} rotation={[-Math.PI / 2, 0, 0]}>
              <planeGeometry args={[0.05, 6.4]} />
              <meshBasicMaterial color="#00e5ff" transparent opacity={0.6} />
            </mesh>
            <mesh position={[2.04, 0, 0]} rotation={[-Math.PI / 2, 0, 0]}>
              <planeGeometry args={[0.05, 6.4]} />
              <meshBasicMaterial color="#00e5ff" transparent opacity={0.6} />
            </mesh>
          </group>
        </group>
      )}

      {/* 3. Net Drop Shadow on the Grass (as in reference image) */}
      <mesh position={[0, 0.012, 0.2]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[11.6, 0.4]} />
        <meshBasicMaterial color="#000000" transparent opacity={0.4} />
      </mesh>

      {/* 4. Tennis Net with Physics Collider */}
      <RigidBody type="fixed" friction={0.8} restitution={0.15}>
        {/* Net mesh body with solid 16cm physical collision depth */}
        <mesh position={[0, 0.48, 0]} castShadow receiveShadow>
          <boxGeometry args={[11.5, 0.96, 0.16]} />
          <meshStandardMaterial
            color="#111827"
            roughness={0.9}
            transparent
            opacity={0.7}
          />
        </mesh>

        {/* Top white tape band with tense cord deflection volume */}
        <mesh position={[0, 0.97, 0]} castShadow>
          <boxGeometry args={[11.5, 0.08, 0.18]} />
          <meshStandardMaterial color="#ffffff" roughness={0.3} />
        </mesh>

        {/* Center white adjustment strap */}
        <mesh position={[0, 0.46, 0.02]} castShadow>
          <boxGeometry args={[0.08, 0.96, 0.02]} />
          <meshStandardMaterial color="#ffffff" roughness={0.3} />
        </mesh>
      </RigidBody>

      {/* 5. Iconic Yellow Net Posts with Black Collars (from reference image) */}
      {/* Left Post */}
      <group position={[-5.7, 0, 0]}>
        {/* Black metal base collar */}
        <mesh position={[0, 0.04, 0]}>
          <cylinderGeometry args={[0.09, 0.1, 0.08, 16]} />
          <meshStandardMaterial color="#1e2418" roughness={0.7} />
        </mesh>
        {/* Yellow post column */}
        <mesh position={[0, 0.55, 0]} castShadow>
          <cylinderGeometry args={[0.065, 0.065, 1.08, 16]} />
          <meshStandardMaterial color="#eab308" metalness={0.4} roughness={0.3} />
        </mesh>
      </group>

      {/* Right Post */}
      <group position={[5.7, 0, 0]}>
        {/* Black metal base collar */}
        <mesh position={[0, 0.04, 0]}>
          <cylinderGeometry args={[0.09, 0.1, 0.08, 16]} />
          <meshStandardMaterial color="#1e2418" roughness={0.7} />
        </mesh>
        {/* Yellow post column */}
        <mesh position={[0, 0.55, 0]} castShadow>
          <cylinderGeometry args={[0.065, 0.065, 1.08, 16]} />
          <meshStandardMaterial color="#eab308" metalness={0.4} roughness={0.3} />
        </mesh>
      </group>
    </group>
  );
};
