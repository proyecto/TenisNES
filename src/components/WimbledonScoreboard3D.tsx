import React, { useRef, useEffect, useMemo, useCallback } from 'react';
import * as THREE from 'three';
import { useTennisStore } from '../store/useTennisStore';

interface WimbledonScoreboard3DProps {
  position?: [number, number, number];
  rotation?: [number, number, number];
  scale?: number;
}

/**
 * Authentic Wimbledon Centre Court Electronic Scoreboard:
 * - High-resolution dot-matrix LED canvas texture
 * - Self-illuminated unlit material (meshBasicMaterial) for bright outdoor LED stadium visibility
 * - Accurate crossed tennis rackets Wimbledon emblems
 * - Golden Rolex coronet & serif typography
 * - Live player names (R. NADAL vs A. MURRAY) with bright solid yellow server indicator square (■)
 * - SETS, GAMES, POINTS columns mirroring live tennis score state
 */
export const WimbledonScoreboard3D: React.FC<WimbledonScoreboard3DProps> = ({
  position = [10.2, 9.4, -24.2],
  rotation = [0.07, -0.19, 0],
  scale = 1.2,
}) => {
  const p1Points = useTennisStore((state) => state.p1Points);
  const p2Points = useTennisStore((state) => state.p2Points);
  const p1Games = useTennisStore((state) => state.p1Games);
  const p2Games = useTennisStore((state) => state.p2Games);
  const p1Sets = useTennisStore((state) => state.p1Sets);
  const p2Sets = useTennisStore((state) => state.p2Sets);
  const server = useTennisStore((state) => state.server);
  const lastSpeedKmh = useTennisStore((state) => state.lastSpeedKmh);
  const rallyCount = useTennisStore((state) => state.rallyCount);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const textureRef = useRef<THREE.CanvasTexture | null>(null);

  // Format points according to official Wimbledon court scoreboard (0, 15, 30, 40, A)
  const formatScorePoints = (pts: number) => {
    switch (pts) {
      case 0:
        return '0';
      case 1:
        return '15';
      case 2:
        return '30';
      case 3:
        return '40';
      default:
        return 'A';
    }
  };

  // Draw Wimbledon Scoreboard onto offscreen canvas
  const renderCanvas = useCallback(
    (canvas: HTMLCanvasElement) => {
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const w = canvas.width;
      const h = canvas.height;

      // 1. Dark tournament chassis background (#042b1a)
      ctx.fillStyle = '#042b1a';
      ctx.fillRect(0, 0, w, h);

      // Outer bezel border
      ctx.strokeStyle = '#0b482d';
      ctx.lineWidth = 14;
      ctx.strokeRect(7, 7, w - 14, h - 14);

      // =========================================================================
      // 2. TOP BANNER: ROLEX, CLOCKS & WIMBLEDON EMBLEMS
      // =========================================================================
      const topH = 160;
      ctx.fillStyle = '#063f27';
      ctx.fillRect(20, 20, w - 40, topH);

      ctx.strokeStyle = '#021e12';
      ctx.lineWidth = 6;
      ctx.strokeRect(20, 20, w - 40, topH);

      // Helper: Draw Authentic Wimbledon Crossed Tennis Rackets Emblem
      const drawWimbledonRoundel = (cx: number, cy: number, r: number) => {
        // Outer Wimbledon Purple ring
        ctx.fillStyle = '#2e1065';
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fill();

        // White border ring
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(cx, cy, r - 3, 0, Math.PI * 2);
        ctx.stroke();

        // Inner Wimbledon Green disc
        ctx.fillStyle = '#047857';
        ctx.beginPath();
        ctx.arc(cx, cy, r - 7, 0, Math.PI * 2);
        ctx.fill();

        // Helper to draw a single tennis racket (head, neck, shaft, grip)
        const drawRacket = (angleRad: number) => {
          ctx.save();
          ctx.translate(cx, cy);
          ctx.rotate(angleRad);

          // Oval Racket Head
          ctx.strokeStyle = '#fef08a';
          ctx.lineWidth = 3.5;
          ctx.beginPath();
          ctx.ellipse(0, -r * 0.42, r * 0.22, r * 0.28, 0, 0, Math.PI * 2);
          ctx.stroke();

          // Racket Strings (simple cross grid)
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          ctx.moveTo(-r * 0.15, -r * 0.42);
          ctx.lineTo(r * 0.15, -r * 0.42);
          ctx.moveTo(0, -r * 0.62);
          ctx.lineTo(0, -r * 0.22);
          ctx.stroke();

          // Shaft & Throat
          ctx.strokeStyle = '#fef08a';
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.moveTo(-r * 0.08, -r * 0.15);
          ctx.lineTo(0, -r * 0.05);
          ctx.lineTo(r * 0.08, -r * 0.15);
          ctx.moveTo(0, -r * 0.05);
          ctx.lineTo(0, r * 0.42);
          ctx.stroke();

          // Leather Grip handle
          ctx.strokeStyle = '#ea580c';
          ctx.lineWidth = 4.5;
          ctx.beginPath();
          ctx.moveTo(0, r * 0.22);
          ctx.lineTo(0, r * 0.48);
          ctx.stroke();

          ctx.restore();
        };

        // Draw the two crossed rackets angled at 35 degrees
        drawRacket(-Math.PI / 4.5);
        drawRacket(Math.PI / 4.5);
      };

      drawWimbledonRoundel(95, 100, 50);
      drawWimbledonRoundel(w - 95, 100, 50);

      // Helper: Draw Beautiful Rolex Coronet Crown
      const drawRolexCrown = (cx: number, cy: number, s: number) => {
        ctx.fillStyle = '#facc15';

        // 5 gold jewels on tips
        const tips = [
          [-s * 1.1, -s * 0.35],
          [-s * 0.55, -s * 0.75],
          [0, -s * 0.95],
          [s * 0.55, -s * 0.75],
          [s * 1.1, -s * 0.35],
        ];
        tips.forEach(([tx, ty]) => {
          ctx.beginPath();
          ctx.arc(cx + tx, cy + ty, 4.5, 0, Math.PI * 2);
          ctx.fill();
        });

        // Crown body
        ctx.beginPath();
        ctx.moveTo(cx - s * 1.1, cy - s * 0.2);
        ctx.lineTo(cx - s * 0.95, cy + s * 0.2);
        ctx.lineTo(cx + s * 0.95, cy + s * 0.2);
        ctx.lineTo(cx + s * 1.1, cy - s * 0.2);
        ctx.lineTo(cx + s * 0.55, cy - s * 0.55);
        ctx.lineTo(cx + s * 0.25, cy + s * 0.05);
        ctx.lineTo(cx, cy - s * 0.75);
        ctx.lineTo(cx - s * 0.25, cy + s * 0.05);
        ctx.lineTo(cx - s * 0.55, cy - s * 0.55);
        ctx.closePath();
        ctx.fill();

        // Crown base ring
        ctx.fillRect(cx - s * 1.05, cy + s * 0.25, s * 2.1, 5);
      };

      // Center Rolex Title Block
      const rolexBoxW = 440;
      const rolexBoxX = (w - rolexBoxW) / 2;
      ctx.fillStyle = '#07482b';
      ctx.fillRect(rolexBoxX, 26, rolexBoxW, topH - 12);
      ctx.strokeStyle = '#0d633c';
      ctx.lineWidth = 4;
      ctx.strokeRect(rolexBoxX, 26, rolexBoxW, topH - 12);

      drawRolexCrown(w / 2 - 145, 96, 20);
      drawRolexCrown(w / 2 + 145, 96, 20);

      ctx.fillStyle = '#fef08a';
      ctx.font = '900 54px "Times New Roman", Georgia, serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('ROLEX', w / 2, 102);

      // Left Clock Digits (5.13)
      ctx.fillStyle = '#02180e';
      ctx.fillRect(175, 38, 210, topH - 36);
      ctx.strokeStyle = '#064227';
      ctx.lineWidth = 3;
      ctx.strokeRect(175, 38, 210, topH - 36);

      ctx.fillStyle = '#e8ff00';
      ctx.font = '900 76px "Courier New", monospace';
      ctx.textAlign = 'center';
      ctx.fillText('5.13', 280, 103);

      // Right Speed Radar / Clock Display
      const rightClockX = w - 400;
      ctx.fillStyle = '#02180e';
      ctx.fillRect(rightClockX, 38, 220, topH - 36);
      ctx.strokeStyle = '#064227';
      ctx.lineWidth = 3;
      ctx.strokeRect(rightClockX, 38, 220, topH - 36);

      ctx.fillStyle = '#e8ff00';
      if (lastSpeedKmh > 0) {
        ctx.font = '900 60px "Courier New", monospace';
        ctx.fillText(`${lastSpeedKmh} KMH`, rightClockX + 110, 103);
      } else {
        ctx.font = '900 76px "Courier New", monospace';
        ctx.fillText('2.26', rightClockX + 110, 103);
      }

      // =========================================================================
      // 3. MAIN SCOREBOARD DISPLAY BAYS (AUTHENTIC OLIVE-GREEN LED MATRIX)
      // =========================================================================
      const bayTop = topH + 36;
      const bayH = h - bayTop - 22;

      const bay1W = 440;
      const bay3W = 660;
      const bay2W = w - 40 - bay1W - bay3W - 32;

      const bay1X = 20;
      const bay2X = bay1X + bay1W + 16;
      const bay3X = bay2X + bay2W + 16;

      // Helper to paint Wimbledon olive-green matrix screens with visible LED grid
      const drawMatrixScreen = (x: number, y: number, bw: number, bh: number) => {
        ctx.fillStyle = '#22482c';
        ctx.fillRect(x, y, bw, bh);

        ctx.strokeStyle = '#052917';
        ctx.lineWidth = 6;
        ctx.strokeRect(x, y, bw, bh);

        // Subtle unlit LED dots pattern
        ctx.fillStyle = '#1c3e25';
        const step = 20;
        for (let px = x + 12; px < x + bw - 8; px += step) {
          for (let py = y + 12; py < y + bh - 8; py += step) {
            ctx.beginPath();
            ctx.arc(px, py, 2.2, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      };

      drawMatrixScreen(bay1X, bayTop, bay1W, bayH);
      drawMatrixScreen(bay2X, bayTop, bay2W, bayH);
      drawMatrixScreen(bay3X, bayTop, bay3W, bayH);

      // -------------------------------------------------------------------------
      // BAY 1 (LEFT): PREVIOUS SETS
      // -------------------------------------------------------------------------
      ctx.fillStyle = '#d9f99d';
      ctx.font = '900 32px "Arial Black", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('PREVIOUS SETS', bay1X + bay1W / 2, bayTop + 45);

      ctx.strokeStyle = '#143c1f';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(bay1X + 25, bayTop + 72);
      ctx.lineTo(bay1X + bay1W - 25, bayTop + 72);
      ctx.stroke();

      // Clean, readable match stats
      ctx.fillStyle = '#fef08a';
      ctx.font = '900 42px "Courier New", monospace';
      ctx.fillText('SET 1', bay1X + 110, bayTop + 195);
      ctx.fillStyle = '#d9f99d';
      ctx.fillText(`[ ${p1Games} - ${p2Games} ]`, bay1X + 280, bayTop + 195);

      ctx.fillStyle = '#94a3b8';
      ctx.font = '900 42px "Courier New", monospace';
      ctx.fillText('SET 2', bay1X + 110, bayTop + 300);
      ctx.fillText('[ - - ]', bay1X + 280, bayTop + 300);

      ctx.fillStyle = '#38bdf8';
      ctx.font = '900 34px "Arial Black", sans-serif';
      ctx.fillText(`PELOTEO: ${rallyCount}`, bay1X + bay1W / 2, bayTop + 475);

      // -------------------------------------------------------------------------
      // BAY 2 (CENTER): PLAYER NAMES & SERVER INDICATOR SQUARE
      // -------------------------------------------------------------------------
      const rowY1 = bayTop + 200;
      const rowMid = bayTop + 345;
      const rowY2 = bayTop + 490;

      // Player 1 Name: R. NADAL
      ctx.textAlign = 'left';
      ctx.font = '900 70px "Courier New", monospace';
      ctx.fillStyle = '#facc15';
      ctx.fillText('R. NADAL', bay2X + 45, rowY1);

      // Server Yellow Square (■) if P1 is serving - Solid bright yellow
      if (server === 'p1') {
        ctx.fillStyle = '#e8ff00';
        ctx.fillRect(bay2X + bay2W - 85, rowY1 - 50, 44, 44);
      }

      // Middle 'v' Divider
      ctx.fillStyle = '#cbd5e1';
      ctx.font = '900 52px "Arial Black", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('v', bay2X + bay2W / 2, rowMid);

      // Player 2 Name: A. MURRAY
      ctx.textAlign = 'left';
      ctx.font = '900 70px "Courier New", monospace';
      ctx.fillStyle = '#facc15';
      ctx.fillText('A. MURRAY', bay2X + 45, rowY2);

      // Server Yellow Square (■) if CPU is serving - Solid bright yellow
      if (server === 'cpu') {
        ctx.fillStyle = '#e8ff00';
        ctx.fillRect(bay2X + bay2W - 85, rowY2 - 50, 44, 44);
      }

      // -------------------------------------------------------------------------
      // BAY 3 (RIGHT): SETS, GAMES, POINTS COLUMNS
      // -------------------------------------------------------------------------
      const colSetsX = bay3X + 110;
      const colGamesX = bay3X + 325;
      const colPointsX = bay3X + 540;

      // Headers in green-yellow dot matrix
      ctx.fillStyle = '#d9f99d';
      ctx.font = '900 32px "Arial Black", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('SETS', colSetsX, bayTop + 45);
      ctx.fillText('GAMES', colGamesX, bayTop + 45);
      ctx.fillText('POINTS', colPointsX, bayTop + 45);

      ctx.strokeStyle = '#143c1f';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(bay3X + 25, bayTop + 72);
      ctx.lineTo(bay3X + bay3W - 25, bayTop + 72);
      ctx.stroke();

      // GIANT DOT-MATRIX NUMBERS MATCHING WIMBLEDON PHOTO
      ctx.font = '900 125px "Courier New", monospace';

      // Row 1 (Player 1 Score)
      ctx.fillStyle = '#fef08a';
      ctx.fillText(`${p1Sets}`, colSetsX, rowY1 + 18);
      ctx.fillText(`${p1Games}`, colGamesX, rowY1 + 18);
      ctx.fillText(formatScorePoints(p1Points), colPointsX, rowY1 + 18);

      // Row 2 (CPU Score)
      ctx.fillText(`${p2Sets}`, colSetsX, rowY2 + 18);
      ctx.fillText(`${p2Games}`, colGamesX, rowY2 + 18);
      ctx.fillText(formatScorePoints(p2Points), colPointsX, rowY2 + 18);
    },
    [p1Points, p2Points, p1Games, p2Games, p1Sets, p2Sets, server, lastSpeedKmh, rallyCount]
  );

  // Initialize Canvas and Three.js Texture with IMMEDIATE first paint
  const texture = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 2048;
    canvas.height = 860;
    canvasRef.current = canvas;

    renderCanvas(canvas);

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.needsUpdate = true;
    textureRef.current = tex;
    return tex;
  }, [renderCanvas]);

  // Update canvas on score/match changes
  useEffect(() => {
    if (canvasRef.current && textureRef.current) {
      renderCanvas(canvasRef.current);
      textureRef.current.needsUpdate = true;
    }
  }, [renderCanvas]);

  return (
    <group position={position} rotation={rotation} scale={scale}>
      {/* 1. Wimbledon Tournament Green Chassis Housing */}
      <mesh>
        <boxGeometry args={[9.4, 4.0, 0.4]} />
        <meshStandardMaterial color="#05331e" roughness={0.4} metalness={0.2} />
      </mesh>

      {/* 2. Top Sun Hood Visor Cowl */}
      <mesh position={[0, 2.05, 0.18]} rotation={[0.22, 0, 0]}>
        <boxGeometry args={[9.5, 0.16, 0.64]} />
        <meshStandardMaterial color="#032415" roughness={0.5} metalness={0.2} />
      </mesh>

      {/* 3. Electronic Screen Face */}
      <mesh position={[0, -0.06, 0.22]}>
        <planeGeometry args={[9.0, 3.65]} />
        <meshBasicMaterial map={texture} toneMapped={false} />
      </mesh>

      {/* 4. Steel Mounting Struts anchoring to the Wall Top */}
      {[-3.6, 3.6].map((bx, idx) => (
        <mesh key={`scoreboard-strut-${idx}`} position={[bx, -2.1, -0.1]}>
          <boxGeometry args={[0.24, 0.8, 0.3]} />
          <meshStandardMaterial color="#1e293b" metalness={0.8} roughness={0.3} />
        </mesh>
      ))}
    </group>
  );
};
