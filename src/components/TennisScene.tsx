import React from 'react';
import { Canvas } from '@react-three/fiber';
import { Sky, Environment } from '@react-three/drei';
import { Physics } from '@react-three/rapier';
import { Court3D } from './Court3D';
import { TennisBall3D } from './TennisBall3D';
import { Player3D } from './Player3D';
import { StadiumAtmosphere3D } from './StadiumAtmosphere3D';

/**
 * 3D Tennis Scene with FIXED broadcast TV perspective matching the reference image:
 * - High-angle telephoto broadcast camera from behind near baseline
 * - Camera is completely static (no orbit drag/zoom)
 * - 1 Human Player vs CPU Opponent
 * - Grand Slam Stadium Atmosphere: Grandstands, crowd, umpire in high chair, ball kids & line judges
 */
export const TennisScene: React.FC = () => {
  return (
    <Canvas
      shadows
      camera={{
        position: [0, 14.5, 27.5],
        fov: 45,
      }}
      onCreated={({ camera }) => {
        // High-angle broadcast perspective covering both players and court atmosphere
        camera.lookAt(0, 0.6, -1.2);
      }}
      style={{ width: '100%', height: '100%', background: '#60a5fa' }}
    >
      {/* 1. Sunlight & Stadium Atmosphere */}
      <ambientLight intensity={0.7} />
      <directionalLight
        position={[8, 24, 12]}
        intensity={1.3}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-left={-20}
        shadow-camera-right={20}
        shadow-camera-top={26}
        shadow-camera-bottom={-26}
      />
      <Sky sunPosition={[80, 50, 80]} turbidity={2} rayleigh={0.5} />
      <Environment preset="park" />

      {/* 2. Grand Slam Stadium Atmosphere (Grandstands, crowd, umpire chair, ball kids, line judges) */}
      <StadiumAtmosphere3D />

      {/* 3. Rapier 3D Physics Simulation */}
      <Physics gravity={[0, -9.81, 0]}>
        {/* Full-field lawn, lines, yellow posts, and physical net */}
        <Court3D />

        {/* Dynamic Tennis Ball with Serve and Rally Physics */}
        <TennisBall3D />

        {/* Single Player (Player 1) at near baseline - Controlled via WASD / Arrows */}
        <Player3D position={[0.8, 0, 12.2]} isControlled />

        {/* CPU Opponent at far baseline in athletic stance */}
        <Player3D position={[0, 0, -12.2]} isOpponent />
      </Physics>

      {/* Note: Camera is completely static per user request (no OrbitControls) */}
    </Canvas>
  );
};
