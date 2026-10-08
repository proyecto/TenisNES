import React, { useRef, useMemo, useLayoutEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { WimbledonScoreboard3D } from './WimbledonScoreboard3D';

/**
 * British Tournament Stadium Atmosphere:
 * - DARK, NON-GLARING STANDS: Dark slate concrete bleachers (#27272a, #334155) and deep classic tournament green seats (#14532d, #166534).
 * - BALANCED SPECTATOR PALETTE: Natural darks, navies, burgundies, slates, and muted tones (NO distracting white glare).
 * - ROUNDED CONTINUOUS CORNERS: 10 tiers of curved radial wedges seamlessly closing the corners with zero gaps.
 * - FAKE CITY SKYLINE BACKDROP: Stylized urban city buildings (brick towers, office blocks, flat roofs, water towers, antennas, window grids) completely filling the horizon behind the grandstands. NO tall round trees!
 * - HIGH PERFORMANCE: 1,400+ spectators rendered via Three.js InstancedMesh at 60 FPS.
 * - TOURNAMENT PERSONNEL: Chair umpire in high chair, 6 ball kids, 7 line judges, and player rest benches.
 */

// Deterministic pseudo-random number generator for consistent procedural placement
function pseudoRand(seed: number) {
  const x = Math.sin(seed * 9301 + 49297) * 233280;
  return x - Math.floor(x);
}

export const StadiumAtmosphere3D: React.FC = () => {
  const crowdGroupRef = useRef<THREE.Group>(null);
  const umpireHeadRef = useRef<THREE.Group>(null);

  // Instanced meshes for ultra-performant 1,400+ spectator rendering
  const torsoRef = useRef<THREE.InstancedMesh>(null);
  const headRef = useRef<THREE.InstancedMesh>(null);
  const legRef = useRef<THREE.InstancedMesh>(null);
  const hatRef = useRef<THREE.InstancedMesh>(null);

  // Umpire head tracking and subtle crowd cheer wave
  useFrame((state) => {
    const t = state.clock.getElapsedTime();

    if (umpireHeadRef.current) {
      umpireHeadRef.current.rotation.y = Math.sin(t * 1.1) * 0.32;
    }

    if (crowdGroupRef.current) {
      // Subtle collective breathing pulse
      crowdGroupRef.current.position.y = Math.sin(t * 2.2) * 0.015;
    }
  });

  // Balanced, dark & muted crowd clothing palette (avoids bright white glare)
  const shirtPalette = [
    '#1e3a8a', '#1e40af', '#1e293b', '#334155', '#475569',
    '#14532d', '#166534', '#064e3b', '#7f1d1d', '#991b1b',
    '#b45309', '#9a3412', '#c2410c', '#0f766e', '#0369a1',
    '#2563eb', '#374151', '#4b5563', '#64748b', '#78716c',
    '#57534e', '#3f6212', '#0f172a', '#d6d3d1', '#94a3b8'
  ];

  const skinTones = ['#f8d7b8', '#e0ac69', '#c68642', '#8d5524', '#ffdbac'];
  const pantsPalette = ['#0f172a', '#1e293b', '#18181b', '#27272a', '#1e3a8a', '#3f3f46'];

  // Procedural generation of ~1,400 spectators across North, West, East and the 2 rounded corners
  const { spectators, hats } = useMemo(() => {
    const specList: Array<{
      x: number;
      y: number;
      z: number;
      shirt: string;
      skin: string;
      pants: string;
      rotY: number;
      leanX: number;
      scaleX: number;
      scaleY: number;
      scaleZ: number;
    }> = [];

    const hatList: Array<{
      x: number;
      y: number;
      z: number;
      rotY: number;
      color: string;
      scaleX: number;
      scaleY: number;
      scaleZ: number;
    }> = [];

    let seed = 100;

    // 1. NORTH GRANDSTAND (Back): 10 rows x 38 people = 380 spectators
    // Center width spans from X = -11.8 to +11.8
    for (let row = 0; row < 10; row++) {
      const y = row * 0.62 + 0.45;
      const z = -16.5 - row * 0.88;
      for (let col = 0; col < 38; col++) {
        seed++;
        const jitterX = (pseudoRand(seed * 1) - 0.5) * 0.16;
        const jitterZ = (pseudoRand(seed * 2) - 0.5) * 0.10;
        const jitterY = (pseudoRand(seed * 3) - 0.5) * 0.05;

        const x = (col - 18.5) * 0.63 + jitterX;
        const rotY = (pseudoRand(seed * 4) - 0.5) * 0.25;
        const leanX = (pseudoRand(seed * 5) - 0.5) * 0.12;

        const shirt = shirtPalette[Math.floor(pseudoRand(seed * 6) * shirtPalette.length)];
        const skin = skinTones[Math.floor(pseudoRand(seed * 7) * skinTones.length)];
        const pants = pantsPalette[Math.floor(pseudoRand(seed * 8) * pantsPalette.length)];

        const scaleY = 0.92 + pseudoRand(seed * 9) * 0.16;
        const specY = y + jitterY;
        const specZ = z + jitterZ;

        specList.push({
          x,
          y: specY,
          z: specZ,
          shirt,
          skin,
          pants,
          rotY,
          leanX,
          scaleX: 1,
          scaleY,
          scaleZ: 1,
        });

        const hasHat = pseudoRand(seed * 10) > 0.55;
        if (hasHat) {
          const isStraw = pseudoRand(seed * 11) > 0.5;
          hatList.push({
            x,
            y: specY,
            z: specZ,
            rotY,
            color: isStraw ? '#a8a29e' : shirt,
            scaleX: isStraw ? 1.05 : 0.95,
            scaleY: isStraw ? 1.0 : 0.85,
            scaleZ: isStraw ? 1.05 : 0.95,
          });
        }
      }
    }

    // 2. WEST GRANDSTAND (Left): 10 rows x 35 people = 350 spectators
    // Starts at Z = -12.0 and extends toward Z = +14.0
    for (let row = 0; row < 10; row++) {
      const y = row * 0.62 + 0.45;
      const x = -16.5 - row * 0.88;
      for (let col = 0; col < 35; col++) {
        seed++;
        const jitterZ = (pseudoRand(seed * 1) - 0.5) * 0.16;
        const jitterX = (pseudoRand(seed * 2) - 0.5) * 0.10;
        const jitterY = (pseudoRand(seed * 3) - 0.5) * 0.05;

        const z = -12.0 + col * 0.74 + jitterZ;
        const rotY = Math.PI / 2 + (pseudoRand(seed * 4) - 0.5) * 0.25;
        const leanX = (pseudoRand(seed * 5) - 0.5) * 0.12;

        const shirt = shirtPalette[Math.floor(pseudoRand(seed * 6) * shirtPalette.length)];
        const skin = skinTones[Math.floor(pseudoRand(seed * 7) * skinTones.length)];
        const pants = pantsPalette[Math.floor(pseudoRand(seed * 8) * pantsPalette.length)];
        const scaleY = 0.92 + pseudoRand(seed * 9) * 0.16;
        const specX = x + jitterX;
        const specY = y + jitterY;

        specList.push({
          x: specX,
          y: specY,
          z,
          shirt,
          skin,
          pants,
          rotY,
          leanX,
          scaleX: 1,
          scaleY,
          scaleZ: 1,
        });

        if (pseudoRand(seed * 10) > 0.55) {
          const isStraw = pseudoRand(seed * 11) > 0.5;
          hatList.push({
            x: specX,
            y: specY,
            z,
            rotY,
            color: isStraw ? '#a8a29e' : shirt,
            scaleX: isStraw ? 1.05 : 0.95,
            scaleY: isStraw ? 1.0 : 0.85,
            scaleZ: isStraw ? 1.05 : 0.95,
          });
        }
      }
    }

    // 3. EAST GRANDSTAND (Right): 10 rows x 35 people = 350 spectators
    // Starts at Z = -12.0 and extends toward Z = +14.0
    for (let row = 0; row < 10; row++) {
      const y = row * 0.62 + 0.45;
      const x = 16.5 + row * 0.88;
      for (let col = 0; col < 35; col++) {
        seed++;
        const jitterZ = (pseudoRand(seed * 1) - 0.5) * 0.16;
        const jitterX = (pseudoRand(seed * 2) - 0.5) * 0.10;
        const jitterY = (pseudoRand(seed * 3) - 0.5) * 0.05;

        const z = -12.0 + col * 0.74 + jitterZ;
        const rotY = -Math.PI / 2 + (pseudoRand(seed * 4) - 0.5) * 0.25;
        const leanX = (pseudoRand(seed * 5) - 0.5) * 0.12;

        const shirt = shirtPalette[Math.floor(pseudoRand(seed * 6) * shirtPalette.length)];
        const skin = skinTones[Math.floor(pseudoRand(seed * 7) * skinTones.length)];
        const pants = pantsPalette[Math.floor(pseudoRand(seed * 8) * pantsPalette.length)];
        const scaleY = 0.92 + pseudoRand(seed * 9) * 0.16;
        const specX = x + jitterX;
        const specY = y + jitterY;

        specList.push({
          x: specX,
          y: specY,
          z,
          shirt,
          skin,
          pants,
          rotY,
          leanX,
          scaleX: 1,
          scaleY,
          scaleZ: 1,
        });

        if (pseudoRand(seed * 10) > 0.55) {
          const isStraw = pseudoRand(seed * 11) > 0.5;
          hatList.push({
            x: specX,
            y: specY,
            z,
            rotY,
            color: isStraw ? '#a8a29e' : shirt,
            scaleX: isStraw ? 1.05 : 0.95,
            scaleY: isStraw ? 1.0 : 0.85,
            scaleZ: isStraw ? 1.05 : 0.95,
          });
        }
      }
    }

    // 4. NORTH-WEST ROUNDED CORNER: 10 rows x 18 people = 180 spectators
    // Seamlessly curves from theta = 0 (meeting North stand at X=-12.5) to theta = PI/2 (meeting West stand at Z=-12.5)
    for (let row = 0; row < 10; row++) {
      const y = row * 0.62 + 0.45;
      const cornerRadius = 4.0 + row * 0.88;
      const numCornerSpecs = 18;
      for (let c = 0; c < numCornerSpecs; c++) {
        seed++;
        // Continuous angle spanning full 0 to PI/2 without any gap at edges
        const angle = (c / (numCornerSpecs - 1)) * (Math.PI / 2);
        const jitterAngle = (pseudoRand(seed * 1) - 0.5) * 0.03;
        const effAngle = Math.max(0, Math.min(Math.PI / 2, angle + jitterAngle));

        const x = -12.5 - Math.sin(effAngle) * cornerRadius;
        const z = -12.5 - Math.cos(effAngle) * cornerRadius;
        const rotY = Math.atan2(-x, -z);
        const leanX = (pseudoRand(seed * 2) - 0.5) * 0.12;

        const shirt = shirtPalette[Math.floor(pseudoRand(seed * 3) * shirtPalette.length)];
        const skin = skinTones[Math.floor(pseudoRand(seed * 4) * skinTones.length)];
        const pants = pantsPalette[Math.floor(pseudoRand(seed * 5) * pantsPalette.length)];
        const scaleY = 0.92 + pseudoRand(seed * 6) * 0.16;

        specList.push({
          x,
          y,
          z,
          shirt,
          skin,
          pants,
          rotY,
          leanX,
          scaleX: 1,
          scaleY,
          scaleZ: 1,
        });

        if (pseudoRand(seed * 7) > 0.55) {
          const isStraw = pseudoRand(seed * 8) > 0.5;
          hatList.push({
            x,
            y,
            z,
            rotY,
            color: isStraw ? '#a8a29e' : shirt,
            scaleX: isStraw ? 1.05 : 0.95,
            scaleY: isStraw ? 1.0 : 0.85,
            scaleZ: isStraw ? 1.05 : 0.95,
          });
        }
      }
    }

    // 5. NORTH-EAST ROUNDED CORNER: 10 rows x 18 people = 180 spectators
    // Seamlessly curves from theta = 0 (meeting North stand at X=12.5) to theta = PI/2 (meeting East stand at Z=-12.5)
    for (let row = 0; row < 10; row++) {
      const y = row * 0.62 + 0.45;
      const cornerRadius = 4.0 + row * 0.88;
      const numCornerSpecs = 18;
      for (let c = 0; c < numCornerSpecs; c++) {
        seed++;
        const angle = (c / (numCornerSpecs - 1)) * (Math.PI / 2);
        const jitterAngle = (pseudoRand(seed * 1) - 0.5) * 0.03;
        const effAngle = Math.max(0, Math.min(Math.PI / 2, angle + jitterAngle));

        const x = 12.5 + Math.sin(effAngle) * cornerRadius;
        const z = -12.5 - Math.cos(effAngle) * cornerRadius;
        const rotY = Math.atan2(-x, -z);
        const leanX = (pseudoRand(seed * 2) - 0.5) * 0.12;

        const shirt = shirtPalette[Math.floor(pseudoRand(seed * 3) * shirtPalette.length)];
        const skin = skinTones[Math.floor(pseudoRand(seed * 4) * skinTones.length)];
        const pants = pantsPalette[Math.floor(pseudoRand(seed * 5) * pantsPalette.length)];
        const scaleY = 0.92 + pseudoRand(seed * 6) * 0.16;

        specList.push({
          x,
          y,
          z,
          shirt,
          skin,
          pants,
          rotY,
          leanX,
          scaleX: 1,
          scaleY,
          scaleZ: 1,
        });

        if (pseudoRand(seed * 7) > 0.55) {
          const isStraw = pseudoRand(seed * 8) > 0.5;
          hatList.push({
            x,
            y,
            z,
            rotY,
            color: isStraw ? '#a8a29e' : shirt,
            scaleX: isStraw ? 1.05 : 0.95,
            scaleY: isStraw ? 1.0 : 0.85,
            scaleZ: isStraw ? 1.05 : 0.95,
          });
        }
      }
    }

    return { spectators: specList, hats: hatList };
  }, []);

  // Populate InstancedMesh transforms and instance colors
  useLayoutEffect(() => {
    if (!torsoRef.current || !headRef.current || !legRef.current) return;

    const dummy = new THREE.Object3D();
    const tempColor = new THREE.Color();

    spectators.forEach((spec, i) => {
      // 1. Torso
      dummy.position.set(spec.x, spec.y + 0.22, spec.z);
      dummy.rotation.set(spec.leanX, spec.rotY, 0);
      dummy.scale.set(0.38, 0.44 * spec.scaleY, 0.28);
      dummy.updateMatrix();
      torsoRef.current?.setMatrixAt(i, dummy.matrix);
      tempColor.set(spec.shirt);
      torsoRef.current?.setColorAt(i, tempColor);

      // 2. Head
      dummy.position.set(spec.x, spec.y + 0.52 * spec.scaleY, spec.z);
      dummy.rotation.set(0, spec.rotY, 0);
      dummy.scale.set(0.14, 0.14, 0.14);
      dummy.updateMatrix();
      headRef.current?.setMatrixAt(i, dummy.matrix);
      tempColor.set(spec.skin);
      headRef.current?.setColorAt(i, tempColor);

      // 3. Lower Body / Seated legs
      dummy.position.set(spec.x, spec.y - 0.04, spec.z);
      dummy.rotation.set(Math.PI / 2, spec.rotY, 0);
      dummy.scale.set(0.32, 0.32, 0.22);
      dummy.updateMatrix();
      legRef.current?.setMatrixAt(i, dummy.matrix);
      tempColor.set(spec.pants);
      legRef.current?.setColorAt(i, tempColor);
    });

    torsoRef.current.instanceMatrix.needsUpdate = true;
    if (torsoRef.current.instanceColor) torsoRef.current.instanceColor.needsUpdate = true;

    headRef.current.instanceMatrix.needsUpdate = true;
    if (headRef.current.instanceColor) headRef.current.instanceColor.needsUpdate = true;

    legRef.current.instanceMatrix.needsUpdate = true;
    if (legRef.current.instanceColor) legRef.current.instanceColor.needsUpdate = true;

    // 4. Hats / Caps
    if (hatRef.current && hats.length > 0) {
      hats.forEach((hat, i) => {
        dummy.position.set(hat.x, hat.y + 0.63, hat.z);
        dummy.rotation.set(0, hat.rotY, 0);
        dummy.scale.set(hat.scaleX * 0.16, hat.scaleY * 0.12, hat.scaleZ * 0.16);
        dummy.updateMatrix();
        hatRef.current?.setMatrixAt(i, dummy.matrix);
        tempColor.set(hat.color);
        hatRef.current?.setColorAt(i, tempColor);
      });
      hatRef.current.instanceMatrix.needsUpdate = true;
      if (hatRef.current.instanceColor) hatRef.current.instanceColor.needsUpdate = true;
    }
  }, [spectators, hats]);

  // Dark, elegant, non-glaring stadium materials:
  // - Concrete bleachers: dark slate grey (#27272a, #334155)
  // - Seats: deep classic tournament green (#14532d, #166534)
  const tierConcrete = '#27272a';
  const tierConcreteAlt = '#334155';
  const seatDarkGreen = '#14532d';
  const seatDarkGreenAlt = '#166534';

  // Fake City Buildings data across the horizon (Z = -34 to -38)
  const cityBuildings = [
    { x: -33, w: 7.5, h: 21, d: 6.5, color: '#334155', roofFeature: 'tank' },
    { x: -26, w: 6.5, h: 26, d: 6.0, color: '#1e293b', roofFeature: 'antenna' },
    { x: -19.5, w: 6.2, h: 18, d: 5.5, color: '#7c2d12', roofFeature: 'parapet' }, // Brick building
    { x: -13.5, w: 5.8, h: 24, d: 6.0, color: '#475569', roofFeature: 'ac' },
    { x: -8.0, w: 5.2, h: 28, d: 5.8, color: '#1e293b', roofFeature: 'spire' }, // Tall tower
    { x: -3.0, w: 5.0, h: 20, d: 5.5, color: '#9a3412', roofFeature: 'tank' }, // Terracotta brick
    { x: 2.2, w: 5.5, h: 25, d: 6.0, color: '#334155', roofFeature: 'antenna' },
    { x: 7.5, w: 5.2, h: 29, d: 5.8, color: '#0f172a', roofFeature: 'spire' }, // Tallest central skyscraper
    { x: 13.0, w: 6.0, h: 22, d: 5.5, color: '#64748b', roofFeature: 'parapet' },
    { x: 19.0, w: 6.2, h: 27, d: 6.0, color: '#1e293b', roofFeature: 'ac' },
    { x: 25.2, w: 6.5, h: 19, d: 5.5, color: '#7c2d12', roofFeature: 'tank' }, // Brick block
    { x: 32.0, w: 7.5, h: 24, d: 6.5, color: '#334155', roofFeature: 'antenna' },
  ];

  return (
    <group>
      {/* ====================================================================
          1. FAKE CITY SKYLINE BACKDROP (No round trees, realistic urban city!)
          ==================================================================== */}
      <group position={[0, 0, -35]}>
        {/* Distant background silhouette layer for atmospheric depth */}
        <mesh position={[0, 14, -12]}>
          <planeGeometry args={[100, 28]} />
          <meshStandardMaterial color="#0f172a" roughness={0.9} />
        </mesh>

        {/* Dense skyline of urban buildings spanning the entire horizon */}
        {cityBuildings.map((b, idx) => {
          const halfH = b.h / 2;
          return (
            <group key={`building-${idx}`} position={[b.x, halfH, (idx % 2) * -1.5]}>
              {/* Main Building Structure */}
              <mesh castShadow receiveShadow>
                <boxGeometry args={[b.w, b.h, b.d]} />
                <meshStandardMaterial color={b.color} roughness={0.7} />
              </mesh>

              {/* Window Grids on the facade */}
              {[-halfH + 3, -halfH + 7, -halfH + 11, -halfH + 15, -halfH + 19].map((winY, wRow) => {
                if (winY > halfH - 2) return null;
                return (
                  <group key={`winrow-${idx}-${wRow}`} position={[0, winY, b.d / 2 + 0.05]}>
                    {[-b.w / 3, 0, b.w / 3].map((winX, wCol) => (
                      <mesh key={`win-${wCol}`} position={[winX, 0, 0]}>
                        <planeGeometry args={[1.1, 1.4]} />
                        <meshStandardMaterial
                          color={(idx + wRow + wCol) % 3 === 0 ? '#38bdf8' : '#090d16'}
                          emissive={(idx + wRow + wCol) % 3 === 0 ? '#0284c7' : '#000000'}
                          emissiveIntensity={(idx + wRow + wCol) % 3 === 0 ? 0.3 : 0}
                          roughness={0.3}
                        />
                      </mesh>
                    ))}
                  </group>
                );
              })}

              {/* Rooftop Urban Features (Water tanks, antennas, AC units, elevator bulkheads) */}
              <group position={[0, halfH, 0]}>
                {/* Roof Parapet Rim */}
                <mesh position={[0, 0.25, 0]}>
                  <boxGeometry args={[b.w + 0.2, 0.5, b.d + 0.2]} />
                  <meshStandardMaterial color="#0f172a" roughness={0.8} />
                </mesh>

                {/* Elevator Bulkhead Housing */}
                <mesh position={[b.w / 4, 1.2, -b.d / 4]}>
                  <boxGeometry args={[2.0, 2.4, 2.0]} />
                  <meshStandardMaterial color="#1e293b" />
                </mesh>

                {b.roofFeature === 'tank' && (
                  /* Rooftop Wooden/Steel Water Tank */
                  <group position={[-b.w / 4, 1.6, b.d / 4]}>
                    <mesh position={[0, 0.8, 0]}>
                      <cylinderGeometry args={[0.9, 0.9, 1.6, 12]} />
                      <meshStandardMaterial color="#78350f" roughness={0.8} />
                    </mesh>
                    <mesh position={[0, 1.8, 0]}>
                      <coneGeometry args={[1.0, 0.6, 12]} />
                      <meshStandardMaterial color="#451a03" />
                    </mesh>
                    {/* Tank Legs */}
                    <mesh position={[0, -0.4, 0]}>
                      <boxGeometry args={[1.4, 0.8, 1.4]} />
                      <meshStandardMaterial color="#1e293b" />
                    </mesh>
                  </group>
                )}

                {b.roofFeature === 'antenna' && (
                  /* Rooftop Communications Antenna Mast */
                  <group position={[0, 0, 0]}>
                    <mesh position={[0, 3.5, 0]}>
                      <cylinderGeometry args={[0.06, 0.12, 7.0, 8]} />
                      <meshStandardMaterial color="#94a3b8" metalness={0.8} />
                    </mesh>
                    {/* Red Aviation Warning Beacon on top */}
                    <mesh position={[0, 7.1, 0]}>
                      <sphereGeometry args={[0.2, 8, 8]} />
                      <meshStandardMaterial color="#ef4444" emissive="#ef4444" emissiveIntensity={0.8} />
                    </mesh>
                  </group>
                )}

                {b.roofFeature === 'spire' && (
                  /* Skyscraper Architectural Spire Crown */
                  <group position={[0, 0, 0]}>
                    <mesh position={[0, 1.8, 0]}>
                      <boxGeometry args={[2.5, 3.6, 2.5]} />
                      <meshStandardMaterial color="#1e293b" />
                    </mesh>
                    <mesh position={[0, 5.5, 0]}>
                      <coneGeometry args={[0.8, 4.0, 8]} />
                      <meshStandardMaterial color="#cbd5e1" metalness={0.7} />
                    </mesh>
                  </group>
                )}

                {b.roofFeature === 'ac' && (
                  /* Industrial AC Chiller Units & Ducts */
                  <group position={[-b.w / 4, 0.6, 0]}>
                    <mesh position={[0, 0, 0]}>
                      <boxGeometry args={[1.8, 1.2, 2.2]} />
                      <meshStandardMaterial color="#64748b" metalness={0.5} roughness={0.4} />
                    </mesh>
                    <mesh position={[1.4, 0, 0]}>
                      <boxGeometry args={[1.2, 1.2, 1.6]} />
                      <meshStandardMaterial color="#475569" metalness={0.5} roughness={0.4} />
                    </mesh>
                  </group>
                )}
              </group>
            </group>
          );
        })}
      </group>

      {/* ====================================================================
          2. CONTINUOUS ENCLOSED STADIUM BOWL (DARK SLATE CONCRETE & GREEN SEATS)
          ==================================================================== */}
      {/* A. NORTH GRANDSTAND (Back) */}
      <group position={[0, 0, 0]}>
        {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((tier) => (
          <group key={`n-tier-${tier}`} position={[0, tier * 0.62 + 0.31, -16.5 - tier * 0.88]}>
            {/* Dark Slate Concrete Step - width 25.4m overlaps 20cm into corner wedges at X=-12.5 and X=+12.5 */}
            <mesh receiveShadow>
              <boxGeometry args={[25.4, 0.62, 1.15]} />
              <meshStandardMaterial color={tier % 2 === 0 ? tierConcrete : tierConcreteAlt} roughness={0.8} />
            </mesh>
            {/* Continuous Row of Deep Tournament Green Folding Seats */}
            <mesh position={[0, 0.28, -0.22]}>
              <boxGeometry args={[25.0, 0.36, 0.44]} />
              <meshStandardMaterial color={tier % 2 === 0 ? seatDarkGreen : seatDarkGreenAlt} roughness={0.7} />
            </mesh>
            {/* Gangway Walkway Steps at Center & Sides */}
            {[-7.0, 0, 7.0].map((stairX, sIdx) => (
              <mesh key={`n-stair-${tier}-${sIdx}`} position={[stairX, 0.32, 0]}>
                <boxGeometry args={[0.9, 0.04, 1.05]} />
                <meshStandardMaterial color="#1e293b" roughness={0.6} />
              </mesh>
            ))}
          </group>
        ))}

        {/* Back Enclosing Wall & Safety Railing */}
        <mesh position={[0, 6.8, -25.0]}>
          <boxGeometry args={[25.4, 1.4, 0.3]} />
          <meshStandardMaterial color="#18181b" roughness={0.8} />
        </mesh>
        {/* Gold railing along the left/center section of the top wall (stops cleanly before the scoreboard) */}
        <mesh position={[-4.0, 7.6, -25.0]}>
          <boxGeometry args={[17.4, 0.08, 0.08]} />
          <meshStandardMaterial color="#ca8a04" metalness={0.7} />
        </mesh>

        {/* AUTHENTIC WIMBLEDON ELECTRONIC COURT SCOREBOARD */}
        <WimbledonScoreboard3D position={[10.2, 9.4, -24.2]} rotation={[0.07, -0.19, 0]} scale={1.2} />

        {/* Tournament Flags fluttering along the top rear wall (left/center only to keep scoreboard completely clear) */}
        {[-11, -7, -3].map((flagX, idx) => (
          <group key={`top-flag-${idx}`} position={[flagX, 7.5, -25.0]}>
            <mesh position={[0, 0.8, 0]}>
              <cylinderGeometry args={[0.03, 0.03, 1.8, 8]} />
              <meshStandardMaterial color="#ca8a04" metalness={0.8} />
            </mesh>
            <mesh position={[0.45, 1.3, 0]}>
              <planeGeometry args={[0.9, 0.55]} />
              <meshStandardMaterial color={idx % 2 === 0 ? '#1d4ed8' : '#b91c1c'} roughness={0.5} />
            </mesh>
          </group>
        ))}
      </group>

      {/* B. WEST GRANDSTAND (Left) */}
      <group position={[0, 0, 0]}>
        {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((tier) => (
          <group key={`w-tier-${tier}`} position={[-16.5 - tier * 0.88, tier * 0.62 + 0.31, 1.0]}>
            {/* Dark Slate Concrete Step - length 27.4m overlaps 20cm into corner wedge at Z=-12.5 */}
            <mesh receiveShadow>
              <boxGeometry args={[1.15, 0.62, 27.4]} />
              <meshStandardMaterial color={tier % 2 === 0 ? tierConcrete : tierConcreteAlt} roughness={0.8} />
            </mesh>
            <mesh position={[-0.22, 0.28, 0]}>
              <boxGeometry args={[0.44, 0.36, 27.0]} />
              <meshStandardMaterial color={seatDarkGreen} roughness={0.7} />
            </mesh>
          </group>
        ))}

        {/* WEST STAND CANTILEVER CANOPY ROOF (Dark slate / deep green, non-glaring) */}
        <group position={[-21.5, 12.0, 1.0]}>
          <mesh rotation={[0, 0, -0.18]}>
            <boxGeometry args={[10.5, 0.22, 29.5]} />
            <meshStandardMaterial color="#1e293b" roughness={0.6} />
          </mesh>
          {/* Steel Stanchion Support Pillars */}
          {[-10, 0, 10].map((pillarZ, pIdx) => (
            <mesh key={`w-pillar-${pIdx}`} position={[-3.8, -4.5, pillarZ]}>
              <cylinderGeometry args={[0.16, 0.16, 9.0, 12]} />
              <meshStandardMaterial color="#0f172a" metalness={0.6} roughness={0.4} />
            </mesh>
          ))}
        </group>
      </group>

      {/* C. EAST GRANDSTAND (Right) */}
      <group position={[0, 0, 0]}>
        {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((tier) => (
          <group key={`e-tier-${tier}`} position={[16.5 + tier * 0.88, tier * 0.62 + 0.31, 1.0]}>
            {/* Dark Slate Concrete Step - length 27.4m overlaps 20cm into corner wedge at Z=-12.5 */}
            <mesh receiveShadow>
              <boxGeometry args={[1.15, 0.62, 27.4]} />
              <meshStandardMaterial color={tier % 2 === 0 ? tierConcrete : tierConcreteAlt} roughness={0.8} />
            </mesh>
            <mesh position={[0.22, 0.28, 0]}>
              <boxGeometry args={[0.44, 0.36, 27.0]} />
              <meshStandardMaterial color={seatDarkGreen} roughness={0.7} />
            </mesh>
          </group>
        ))}
      </group>

      {/* D. NORTH-WEST ROUNDED CORNER WEDGES (Seamlessly joins North & West with ZERO GAPS!) */}
      <group position={[-12.5, 0, -12.5]}>
        {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((tier) => {
          const y = tier * 0.62 + 0.31;
          const cornerRadius = 4.0 + tier * 0.88;
          // 7 radial wedges covering full 0° to 90° with slight overlap
          return (
            <group key={`nw-corner-tier-${tier}`} position={[0, y, 0]}>
              {[6.5, 19.5, 32.5, 45.5, 58.5, 71.5, 84.5].map((deg, wedgeIdx) => {
                const rad = (deg * Math.PI) / 180;
                const wx = -Math.sin(rad) * cornerRadius;
                const wz = -Math.cos(rad) * cornerRadius;
                const arcW = cornerRadius * (16 * Math.PI / 180) * 1.05;
                return (
                  <group key={`nw-wedge-${tier}-${wedgeIdx}`} position={[wx, 0, wz]} rotation={[0, rad, 0]}>
                    <mesh receiveShadow>
                      <boxGeometry args={[arcW, 0.62, 1.15]} />
                      <meshStandardMaterial color={tier % 2 === 0 ? tierConcrete : tierConcreteAlt} roughness={0.8} />
                    </mesh>
                    <mesh position={[0, 0.28, -0.2]}>
                      <boxGeometry args={[arcW * 0.96, 0.36, 0.44]} />
                      <meshStandardMaterial color={seatDarkGreen} roughness={0.7} />
                    </mesh>
                  </group>
                );
              })}
            </group>
          );
        })}
      </group>

      {/* E. NORTH-EAST ROUNDED CORNER WEDGES (Seamlessly joins North & East with ZERO GAPS!) */}
      <group position={[12.5, 0, -12.5]}>
        {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((tier) => {
          const y = tier * 0.62 + 0.31;
          const cornerRadius = 4.0 + tier * 0.88;
          return (
            <group key={`ne-corner-tier-${tier}`} position={[0, y, 0]}>
              {[6.5, 19.5, 32.5, 45.5, 58.5, 71.5, 84.5].map((deg, wedgeIdx) => {
                const rad = (deg * Math.PI) / 180;
                const wx = Math.sin(rad) * cornerRadius;
                const wz = -Math.cos(rad) * cornerRadius;
                const arcW = cornerRadius * (16 * Math.PI / 180) * 1.05;
                return (
                  <group key={`ne-wedge-${tier}-${wedgeIdx}`} position={[wx, 0, wz]} rotation={[0, -rad, 0]}>
                    <mesh receiveShadow>
                      <boxGeometry args={[arcW, 0.62, 1.15]} />
                      <meshStandardMaterial color={tier % 2 === 0 ? tierConcrete : tierConcreteAlt} roughness={0.8} />
                    </mesh>
                    <mesh position={[0, 0.28, -0.2]}>
                      <boxGeometry args={[arcW * 0.96, 0.36, 0.44]} />
                      <meshStandardMaterial color={seatDarkGreen} roughness={0.7} />
                    </mesh>
                  </group>
                );
              })}
            </group>
          );
        })}
      </group>

      {/* ====================================================================
          3. HIGH-PERFORMANCE INSTANCED SPECTATOR CROWD (~1,400+ FANS!)
          ==================================================================== */}
      <group ref={crowdGroupRef}>
        {/* Instanced Torsos (1 draw call) */}
        <instancedMesh
          ref={torsoRef}
          args={[undefined, undefined, spectators.length]}
          castShadow
        >
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial roughness={0.7} />
        </instancedMesh>

        {/* Instanced Heads (1 draw call) */}
        <instancedMesh
          ref={headRef}
          args={[undefined, undefined, spectators.length]}
        >
          <sphereGeometry args={[1, 8, 8]} />
          <meshStandardMaterial roughness={0.6} />
        </instancedMesh>

        {/* Instanced Lower Bodies (1 draw call) */}
        <instancedMesh
          ref={legRef}
          args={[undefined, undefined, spectators.length]}
        >
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial roughness={0.8} />
        </instancedMesh>

        {/* Instanced Hats & Caps (1 draw call) */}
        <instancedMesh
          ref={hatRef}
          args={[undefined, undefined, hats.length]}
        >
          <cylinderGeometry args={[1, 1.25, 0.8, 8]} />
          <meshStandardMaterial roughness={0.7} />
        </instancedMesh>
      </group>

      {/* ====================================================================
          4. COURT PERIMETER BARRIERS: DARK TOURNAMENT GREEN HOARDINGS
          ==================================================================== */}
      <group position={[0, 0, 0]}>
        {/* North Perimeter Barrier Wall (Z = -15.5m) */}
        <group position={[0, 0.7, -15.5]}>
          <mesh castShadow receiveShadow>
            <boxGeometry args={[25.4, 1.4, 0.35]} />
            <meshStandardMaterial color="#064e3b" roughness={0.7} />
          </mesh>
          {/* Main Tournament Banner */}
          <mesh position={[0, 0.1, 0.19]}>
            <planeGeometry args={[15.5, 0.75]} />
            <meshStandardMaterial color="#022c22" roughness={0.5} />
          </mesh>
          {/* Gold Trim Lines */}
          <mesh position={[0, 0.52, 0.2]}>
            <planeGeometry args={[15.6, 0.035]} />
            <meshStandardMaterial color="#ca8a04" metalness={0.7} />
          </mesh>
          <mesh position={[0, -0.32, 0.2]}>
            <planeGeometry args={[15.6, 0.035]} />
            <meshStandardMaterial color="#ca8a04" metalness={0.7} />
          </mesh>
        </group>

        {/* East Perimeter Barrier (X = 12.7m) */}
        <group position={[12.7, 0.7, 0]}>
          <mesh rotation={[0, -Math.PI / 2, 0]} castShadow receiveShadow>
            <boxGeometry args={[27.0, 1.4, 0.35]} />
            <meshStandardMaterial color="#064e3b" roughness={0.7} />
          </mesh>
          <mesh position={[-0.19, 0.1, 0]} rotation={[0, -Math.PI / 2, 0]}>
            <planeGeometry args={[14.0, 0.7]} />
            <meshStandardMaterial color="#022c22" roughness={0.5} />
          </mesh>
        </group>

        {/* West Perimeter Barrier (X = -12.7m) */}
        <group position={[-12.7, 0.7, 0]}>
          <mesh rotation={[0, Math.PI / 2, 0]} castShadow receiveShadow>
            <boxGeometry args={[27.0, 1.4, 0.35]} />
            <meshStandardMaterial color="#064e3b" roughness={0.7} />
          </mesh>
          <mesh position={[0.19, 0.1, 0]} rotation={[0, Math.PI / 2, 0]}>
            <planeGeometry args={[14.0, 0.7]} />
            <meshStandardMaterial color="#022c22" roughness={0.5} />
          </mesh>
        </group>
      </group>

      {/* ====================================================================
          5. CHAIR UMPIRE IN HIGH CHAIR (Árbitro Principal en la Silla Alta)
          ==================================================================== */}
      <group position={[-7.4, 0, 0]}>
        {/* A-Frame Metallic Tubular Ladder */}
        <mesh position={[-0.35, 1.25, 0.45]} rotation={[0.15, 0, -0.15]} castShadow>
          <cylinderGeometry args={[0.03, 0.035, 2.6, 10]} />
          <meshStandardMaterial color="#064e3b" metalness={0.6} roughness={0.3} />
        </mesh>
        <mesh position={[0.35, 1.25, 0.45]} rotation={[0.15, 0, 0.15]} castShadow>
          <cylinderGeometry args={[0.03, 0.035, 2.6, 10]} />
          <meshStandardMaterial color="#064e3b" metalness={0.6} roughness={0.3} />
        </mesh>
        <mesh position={[-0.35, 1.25, -0.45]} rotation={[-0.15, 0, -0.15]} castShadow>
          <cylinderGeometry args={[0.03, 0.035, 2.6, 10]} />
          <meshStandardMaterial color="#064e3b" metalness={0.6} roughness={0.3} />
        </mesh>
        <mesh position={[0.35, 1.25, -0.45]} rotation={[-0.15, 0, 0.15]} castShadow>
          <cylinderGeometry args={[0.03, 0.035, 2.6, 10]} />
          <meshStandardMaterial color="#064e3b" metalness={0.6} roughness={0.3} />
        </mesh>

        {/* Climbing Ladder Rungs */}
        {[0.5, 0.9, 1.3, 1.7, 2.1].map((stepY, idx) => (
          <mesh key={`rung-${idx}`} position={[0, stepY, 0.45]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.02, 0.02, 0.75, 8]} />
            <meshStandardMaterial color="#94a3b8" roughness={0.5} />
          </mesh>
        ))}

        {/* Elevated Umpire Floor Platform */}
        <mesh position={[0, 2.35, 0]} castShadow>
          <boxGeometry args={[0.95, 0.08, 0.95]} />
          <meshStandardMaterial color="#064e3b" metalness={0.5} roughness={0.4} />
        </mesh>

        {/* Safety Guard Railing */}
        <mesh position={[0, 2.75, -0.42]}>
          <boxGeometry args={[0.9, 0.75, 0.04]} />
          <meshStandardMaterial color="#94a3b8" roughness={0.4} />
        </mesh>
        <mesh position={[-0.42, 2.75, 0]}>
          <boxGeometry args={[0.04, 0.75, 0.85]} />
          <meshStandardMaterial color="#94a3b8" roughness={0.4} />
        </mesh>

        {/* Umpire Padded Bucket Chair */}
        <group position={[0.05, 2.45, 0]}>
          <mesh position={[0, 0.18, 0]}>
            <boxGeometry args={[0.55, 0.12, 0.52]} />
            <meshStandardMaterial color="#1e293b" roughness={0.6} />
          </mesh>
          <mesh position={[-0.24, 0.52, 0]} rotation={[0, 0, 0.1]}>
            <boxGeometry args={[0.08, 0.62, 0.52]} />
            <meshStandardMaterial color="#1e293b" roughness={0.6} />
          </mesh>
        </group>

        {/* Desk & Scoring Tablet Bracket */}
        <group position={[0.38, 2.85, 0]}>
          <mesh>
            <boxGeometry args={[0.16, 0.04, 0.42]} />
            <meshStandardMaterial color="#0f172a" />
          </mesh>
          <mesh position={[0, 0.04, 0]} rotation={[-0.3, 0, 0]}>
            <boxGeometry args={[0.12, 0.015, 0.2]} />
            <meshStandardMaterial color="#38bdf8" emissive="#38bdf8" emissiveIntensity={0.6} />
          </mesh>
          <mesh position={[0, 0.18, 0.15]} rotation={[0.4, 0, 0]}>
            <cylinderGeometry args={[0.008, 0.008, 0.35, 8]} />
            <meshStandardMaterial color="#64748b" />
          </mesh>
        </group>

        {/* Canopy Roof in Tournament Dark Green */}
        <mesh position={[0, 3.55, 0]} rotation={[0, 0, -0.05]} castShadow>
          <boxGeometry args={[1.3, 0.06, 1.25]} />
          <meshStandardMaterial color="#064e3b" roughness={0.6} />
        </mesh>

        {/* CHAIR UMPIRE FIGURE */}
        <group position={[0.05, 2.65, 0]}>
          <mesh position={[0, 0.35, 0]} castShadow>
            <boxGeometry args={[0.42, 0.5, 0.32]} />
            <meshStandardMaterial color="#1e3a8a" roughness={0.6} />
          </mesh>
          <mesh position={[0.18, 0.48, 0]}>
            <boxGeometry args={[0.06, 0.14, 0.1]} />
            <meshStandardMaterial color="#ffffff" />
          </mesh>
          <mesh position={[0.2, 0.44, 0]}>
            <boxGeometry args={[0.02, 0.12, 0.03]} />
            <meshStandardMaterial color="#b91c1c" />
          </mesh>

          {/* Umpire Head with tracking motion */}
          <group ref={umpireHeadRef} position={[0, 0.72, 0]}>
            <mesh>
              <sphereGeometry args={[0.14, 12, 12]} />
              <meshStandardMaterial color="#e0ac69" roughness={0.5} />
            </mesh>
            <mesh position={[-0.02, 0.06, 0]}>
              <sphereGeometry args={[0.142, 10, 10]} />
              <meshStandardMaterial color="#475569" roughness={0.7} />
            </mesh>
            <mesh position={[0, 0.08, 0]} rotation={[0, 0, Math.PI / 2]}>
              <torusGeometry args={[0.145, 0.015, 8, 16, Math.PI]} />
              <meshStandardMaterial color="#0f172a" />
            </mesh>
          </group>

          <mesh position={[0.18, 0.08, 0]} rotation={[0, 0, Math.PI / 2]}>
            <boxGeometry args={[0.28, 0.38, 0.36]} />
            <meshStandardMaterial color="#334155" roughness={0.7} />
          </mesh>
        </group>
      </group>

      {/* ====================================================================
          6. BALL KIDS (Recogepelotas del Torneo)
          ==================================================================== */}
      {/* 2 Net Ball Kids (Crouched near net posts) */}
      <group position={[-6.8, 0, 2.2]} rotation={[0, Math.PI / 4, 0]}>
        <mesh position={[0, 0.32, 0]} castShadow>
          <boxGeometry args={[0.32, 0.42, 0.28]} />
          <meshStandardMaterial color="#1e40af" roughness={0.5} />
        </mesh>
        <mesh position={[0, 0.62, 0]}>
          <sphereGeometry args={[0.12, 8, 8]} />
          <meshStandardMaterial color="#e0ac69" />
        </mesh>
        <mesh position={[0, 0.7, 0.02]}>
          <sphereGeometry args={[0.125, 8, 8]} />
          <meshStandardMaterial color="#1e40af" />
        </mesh>
        <mesh position={[0, 0.12, -0.08]} rotation={[0.4, 0, 0]}>
          <boxGeometry args={[0.28, 0.24, 0.34]} />
          <meshStandardMaterial color="#334155" />
        </mesh>
      </group>

      <group position={[6.8, 0, -2.2]} rotation={[0, -Math.PI / 1.3, 0]}>
        <mesh position={[0, 0.32, 0]} castShadow>
          <boxGeometry args={[0.32, 0.42, 0.28]} />
          <meshStandardMaterial color="#1e40af" roughness={0.5} />
        </mesh>
        <mesh position={[0, 0.62, 0]}>
          <sphereGeometry args={[0.12, 8, 8]} />
          <meshStandardMaterial color="#e0ac69" />
        </mesh>
        <mesh position={[0, 0.7, 0.02]}>
          <sphereGeometry args={[0.125, 8, 8]} />
          <meshStandardMaterial color="#1e40af" />
        </mesh>
        <mesh position={[0, 0.12, -0.08]} rotation={[0.4, 0, 0]}>
          <boxGeometry args={[0.28, 0.24, 0.34]} />
          <meshStandardMaterial color="#334155" />
        </mesh>
      </group>

      {/* 4 Corner Ball Kids (Standing behind baselines) */}
      {[
        { x: -7.6, z: -14.6, rot: 0 },
        { x: 7.6, z: -14.6, rot: 0 },
        { x: -7.6, z: 14.6, rot: Math.PI },
        { x: 7.6, z: 14.6, rot: Math.PI },
      ].map((bk, idx) => (
        <group key={`ballkid-corner-${idx}`} position={[bk.x, 0, bk.z]} rotation={[0, bk.rot, 0]}>
          <mesh position={[0, 0.75, 0]} castShadow>
            <boxGeometry args={[0.34, 0.48, 0.26]} />
            <meshStandardMaterial color="#1e40af" roughness={0.5} />
          </mesh>
          <mesh position={[0, 1.1, 0]}>
            <sphereGeometry args={[0.12, 8, 8]} />
            <meshStandardMaterial color="#e0ac69" />
          </mesh>
          <mesh position={[0, 1.18, 0.02]}>
            <sphereGeometry args={[0.125, 8, 8]} />
            <meshStandardMaterial color="#1e40af" />
          </mesh>
          <mesh position={[0, 1.16, 0.12]}>
            <boxGeometry args={[0.16, 0.02, 0.12]} />
            <meshStandardMaterial color="#1e40af" />
          </mesh>
          <mesh position={[0, 0.38, 0]}>
            <boxGeometry args={[0.3, 0.38, 0.24]} />
            <meshStandardMaterial color="#334155" />
          </mesh>
        </group>
      ))}

      {/* ====================================================================
          7. LINE JUDGES (Árbitros de Línea)
          ==================================================================== */}
      {[
        { x: -5.8, z: -15.0, rot: 0 },
        { x: 5.8, z: -15.0, rot: 0 },
        { x: 0, z: -15.2, rot: 0 },
        { x: -5.8, z: 15.0, rot: Math.PI },
        { x: 5.8, z: 15.0, rot: Math.PI },
        { x: -8.8, z: -6.4, rot: Math.PI / 2 },
        { x: -8.8, z: 6.4, rot: Math.PI / 2 },
      ].map((judge, idx) => (
        <group key={`line-judge-${idx}`} position={[judge.x, 0, judge.z]} rotation={[0, judge.rot, 0]}>
          {/* Folding Chair */}
          <group position={[0, 0, 0]}>
            <mesh position={[0, 0.42, 0]}>
              <boxGeometry args={[0.45, 0.06, 0.45]} />
              <meshStandardMaterial color="#78350f" roughness={0.7} />
            </mesh>
            <mesh position={[0, 0.72, -0.2]}>
              <boxGeometry args={[0.42, 0.55, 0.05]} />
              <meshStandardMaterial color="#78350f" roughness={0.7} />
            </mesh>
            <mesh position={[-0.18, 0.21, 0]}>
              <cylinderGeometry args={[0.02, 0.02, 0.42, 8]} />
              <meshStandardMaterial color="#334155" />
            </mesh>
            <mesh position={[0.18, 0.21, 0]}>
              <cylinderGeometry args={[0.02, 0.02, 0.42, 8]} />
              <meshStandardMaterial color="#334155" />
            </mesh>
          </group>

          {/* Seated Judge in Tournament Navy/Green Blazer */}
          <group position={[0, 0.45, 0]}>
            <mesh position={[0, 0.32, 0]} castShadow>
              <boxGeometry args={[0.38, 0.46, 0.3]} />
              <meshStandardMaterial color="#064e3b" roughness={0.6} />
            </mesh>
            <mesh position={[0, 0.05, 0.16]} rotation={[Math.PI / 2, 0, 0]}>
              <boxGeometry args={[0.32, 0.32, 0.22]} />
              <meshStandardMaterial color="#334155" roughness={0.7} />
            </mesh>
            <mesh position={[0, 0.65, 0]}>
              <sphereGeometry args={[0.13, 8, 8]} />
              <meshStandardMaterial color="#e0ac69" />
            </mesh>
            <mesh position={[0, 0.74, 0]}>
              <cylinderGeometry args={[0.18, 0.22, 0.08, 10]} />
              <meshStandardMaterial color="#78716c" roughness={0.8} />
            </mesh>
          </group>
        </group>
      ))}

      {/* ====================================================================
          8. PLAYERS' REST BENCH & COURT ACCESSORIES
          ==================================================================== */}
      <group position={[7.5, 0, 0]}>
        <group position={[0, 0, -1.2]}>
          <mesh position={[0, 0.32, 0]} castShadow>
            <boxGeometry args={[0.7, 0.08, 1.4]} />
            <meshStandardMaterial color="#1e293b" roughness={0.5} />
          </mesh>
          <mesh position={[0.3, 0.62, 0]} rotation={[0, 0, -0.1]}>
            <boxGeometry args={[0.08, 0.55, 1.4]} />
            <meshStandardMaterial color="#1e293b" roughness={0.5} />
          </mesh>
          <mesh position={[-0.1, 0.38, 0.2]}>
            <boxGeometry args={[0.35, 0.04, 0.4]} />
            <meshStandardMaterial color="#cbd5e1" roughness={0.9} />
          </mesh>
        </group>

        <group position={[0, 0, 1.2]}>
          <mesh position={[0, 0.32, 0]} castShadow>
            <boxGeometry args={[0.7, 0.08, 1.4]} />
            <meshStandardMaterial color="#1e293b" roughness={0.5} />
          </mesh>
          <mesh position={[0.3, 0.62, 0]} rotation={[0, 0, -0.1]}>
            <boxGeometry args={[0.08, 0.55, 1.4]} />
            <meshStandardMaterial color="#1e293b" roughness={0.5} />
          </mesh>
          <mesh position={[-0.1, 0.42, -0.15]} rotation={[0, 0.2, 0.15]}>
            <capsuleGeometry args={[0.16, 0.5, 8, 12]} />
            <meshStandardMaterial color="#0284c7" roughness={0.4} />
          </mesh>
        </group>

        <mesh position={[0.2, 0.25, 0]} castShadow>
          <boxGeometry args={[0.45, 0.45, 0.5]} />
          <meshStandardMaterial color="#059669" roughness={0.4} />
        </mesh>
      </group>
    </group>
  );
};
