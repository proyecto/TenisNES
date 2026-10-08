import React, { useState, useEffect } from 'react';
import { TennisScene } from './components/TennisScene';
import { useTennisStore } from './store/useTennisStore';

export const App: React.FC = () => {
  const {
    p1Points,
    p2Points,
    p1Games,
    p2Games,
    p1Sets,
    p2Sets,
    p1Aces,
    p2Aces,
    rallyCount,
    matchStatus,
    server,
    serveSide,
    faultCount,
    lastCall,
    lastCallColor,
    setLastCall,
    lastSpeedKmh,
    lastSpeedMph,
    lastSpeedLabel,
    lastSpeedHitter,
    maxServeSpeedP1,
    maxServeSpeedCpu,
    lastBounceDistanceCm,
    lastBounceInBounds,
    lastBounceTime,
  } = useTennisStore();

  // Match duration stopwatch in seconds
  const [matchElapsedSeconds, setMatchElapsedSeconds] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setMatchElapsedSeconds((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const formatMatchTime = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const rem = secs % 60;
    return `${mins.toString().padStart(2, '0')}:${rem.toString().padStart(2, '0')}`;
  };

  // Auto-dismiss the decision announcement banner after 2.2 seconds
  useEffect(() => {
    if (lastCall) {
      const timer = setTimeout(() => {
        setLastCall(null);
      }, 2200);
      return () => clearTimeout(timer);
    }
  }, [lastCall, setLastCall]);

  const formatPoints = (pts: number) => {
    switch (pts) {
      case 0:
        return '00';
      case 1:
        return '15';
      case 2:
        return '30';
      case 3:
        return '40';
      default:
        return 'AD';
    }
  };

  // Detect Break Point situation
  const isBreakPoint =
    (server === 'p1' && ((p2Points === 3 && p1Points < 3) || (p2Points > 3 && p2Points > p1Points))) ||
    (server === 'cpu' && ((p1Points === 3 && p2Points < 3) || (p1Points > 3 && p1Points > p2Points)));

  // Detect Deuce
  const isDeuce = p1Points === 3 && p2Points === 3;

  // Hawk-Eye recent close call check (under 18cm from line within last 2.4s)
  const [nowTime, setNowTime] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setNowTime(performance.now() / 1000), 200);
    return () => clearInterval(t);
  }, []);

  const isRecentCloseCall =
    lastBounceDistanceCm !== null &&
    lastBounceDistanceCm <= 18 &&
    lastBounceTime > 0 &&
    nowTime - lastBounceTime < 2.5;

  const getStatusMessage = () => {
    const isP1Serving = server === 'p1';
    switch (matchStatus) {
      case 'serve_prep':
        const targetSide = serveSide === 'deuce' ? 'CUADRO IZQUIERDO' : 'CUADRO DERECHO';
        const currentSideName = serveSide === 'deuce' ? 'DERECHA (Deuce)' : 'IZQUIERDA (Ventaja)';
        if (isP1Serving) {
          return {
            badge: faultCount === 1 ? '2º SERVICIO P1' : '1º SERVICIO P1',
            color: faultCount === 1 ? '#f59e0b' : '#ccff00',
            text: `Saque: ${currentSideName} ➔ Objetivo: ${targetSide} • Pulsa [ESPACIO] para lanzar con izq. y rematar Smash`,
          };
        } else {
          return {
            badge: faultCount === 1 ? 'RESTO (2º SAQUE CPU)' : 'RESTO (1º SAQUE CPU)',
            color: '#38bdf8',
            text: `Al Resto: CPU saca desde ${currentSideName} • Espera al bote legal en tu cuadro antes de golpear`,
          };
        }
      case 'serving':
        if (isP1Serving) {
          return {
            badge: '¡SMASH DE SAQUE!',
            color: '#ffea00',
            text: 'Smash: pulsa [ESPACIO] en el punto alto • [W]: Potente • [S]: Corto a red • [A/D]: Ángulo',
          };
        } else {
          return {
            badge: 'SAQUE CPU EN VUELO',
            color: '#ffea00',
            text: '¡Deja botar la pelota en tu cuadro antes de golpear! (Regla ITF 17: No se permite volea de saque)',
          };
        }
      case 'playing':
        return {
          badge: 'EN JUEGO',
          color: '#00e5ff',
          text: 'Golpea con [ESPACIO] • [DERECHA]: Drive a 1 mano • [IZQUIERDA]: Revés a 2 manos • [W/S]: Profundidad',
        };
      case 'point_over':
        return {
          badge: 'PUNTO FINALIZADO',
          color: '#f43f5e',
          text: 'Preparando siguiente punto...',
        };
      case 'game_over':
        return {
          badge: 'PARTIDO FINALIZADO',
          color: '#fbbf24',
          text: '¡Fin del partido!',
        };
      default:
        return {
          badge: 'LISTO',
          color: '#ccff00',
          text: 'Mueve con WASD / Flechas y golpea con ESPACIO',
        };
    }
  };

  const statusInfo = getStatusMessage();

  return (
    <div style={{ position: 'relative', width: '100vw', height: '100vh', overflow: 'hidden' }}>
      {/* 3D WebGL Canvas with Fixed Broadcast Camera */}
      <TennisScene />

      {/* =======================================================================
          1. WIMBLEDON CHAMPIONSHIPS OFFICIAL BROADCAST SCOREBOARD (TOP-LEFT)
          ======================================================================= */}
      <div
        style={{
          position: 'absolute',
          top: 18,
          left: 20,
          background: 'linear-gradient(180deg, rgba(38, 9, 63, 0.94) 0%, rgba(10, 36, 21, 0.94) 100%)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          border: '1.5px solid rgba(212, 175, 55, 0.45)', // Wimbledon Gold Trim
          borderRadius: 14,
          padding: '12px 18px',
          boxShadow: '0 18px 40px rgba(0, 0, 0, 0.75), 0 0 25px rgba(212, 175, 55, 0.15)',
          minWidth: 320,
          pointerEvents: 'none',
          userSelect: 'none',
        }}
      >
        {/* Wimbledon Header Ribbon */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: 10,
            fontWeight: 800,
            letterSpacing: 1.8,
            color: '#f3e8ff',
            textTransform: 'uppercase',
            marginBottom: 8,
            borderBottom: '1px solid rgba(212, 175, 55, 0.25)',
            paddingBottom: 5,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#facc15' }}>
            <span>🏆</span> THE CHAMPIONSHIPS • WIMBLEDON
          </div>
          <div style={{ color: '#cbd5e1', fontSize: 10, fontWeight: 700, letterSpacing: 1 }}>
            ⏱ {formatMatchTime(matchElapsedSeconds)}
          </div>
        </div>

        {/* Dynamic Special Situations Banner (Break Point / Deuce / 2nd Serve) */}
        {(isBreakPoint || isDeuce || faultCount === 1) && (
          <div
            style={{
              display: 'flex',
              gap: 6,
              marginBottom: 8,
              fontSize: 10,
              fontWeight: 800,
              letterSpacing: 1,
            }}
          >
            {faultCount === 1 && (
              <span
                style={{
                  background: 'rgba(245, 158, 11, 0.3)',
                  color: '#fbbf24',
                  padding: '2px 8px',
                  borderRadius: 4,
                  border: '1px solid rgba(245, 158, 11, 0.5)',
                }}
              >
                2º SERVICIO
              </span>
            )}
            {isBreakPoint && (
              <span
                style={{
                  background: 'rgba(239, 68, 68, 0.3)',
                  color: '#f87171',
                  padding: '2px 8px',
                  borderRadius: 4,
                  border: '1px solid rgba(239, 68, 68, 0.6)',
                  animation: 'pulse 1.5s infinite',
                }}
              >
                PUNTO DE BREAK
              </span>
            )}
            {isDeuce && !isBreakPoint && (
              <span
                style={{
                  background: 'rgba(56, 189, 248, 0.25)',
                  color: '#38bdf8',
                  padding: '2px 8px',
                  borderRadius: 4,
                  border: '1px solid rgba(56, 189, 248, 0.4)',
                }}
              >
                IGUALES (DEUCE)
              </span>
            )}
          </div>
        )}

        {/* Score Column Headers */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 12,
            fontSize: 9,
            fontWeight: 800,
            color: '#94a3b8',
            letterSpacing: 1.2,
            paddingRight: 6,
            marginBottom: 3,
          }}
        >
          <span style={{ width: 28, textAlign: 'center' }}>SETS</span>
          <span style={{ width: 28, textAlign: 'center' }}>JUEGOS</span>
          <span style={{ width: 34, textAlign: 'center' }}>PUNTOS</span>
        </div>

        {/* Player 1 Row (R. NADAL / P1) */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 6,
            background: server === 'p1' ? 'rgba(0, 90, 50, 0.35)' : 'transparent',
            padding: '3px 6px',
            borderRadius: 6,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, fontSize: 13, color: '#ffffff' }}>
            <span>🇪🇸</span>
            <span>R. NADAL (P1)</span>
            {server === 'p1' && (
              <span style={{ fontSize: 12, color: '#ccff00', filter: 'drop-shadow(0 0 4px #ccff00)' }}>
                🎾
              </span>
            )}
          </div>
          <div style={{ display: 'flex', gap: 6, fontFamily: 'Teko, sans-serif', fontSize: 22, lineHeight: '22px' }}>
            {/* Sets */}
            <span
              style={{
                background: 'rgba(212, 175, 55, 0.25)',
                color: '#facc15',
                padding: '1px 8px',
                borderRadius: 4,
                minWidth: 28,
                textAlign: 'center',
                fontWeight: 700,
                border: '1px solid rgba(212, 175, 55, 0.35)',
              }}
            >
              {p1Sets}
            </span>
            {/* Games */}
            <span
              style={{
                background: 'rgba(0, 180, 216, 0.22)',
                color: '#38bdf8',
                padding: '1px 8px',
                borderRadius: 4,
                minWidth: 28,
                textAlign: 'center',
                border: '1px solid rgba(56, 189, 248, 0.3)',
              }}
            >
              {p1Games}
            </span>
            {/* Points */}
            <span
              style={{
                background: 'rgba(204, 255, 0, 0.22)',
                color: '#ccff00',
                padding: '1px 8px',
                borderRadius: 4,
                minWidth: 34,
                textAlign: 'center',
                fontWeight: 700,
                border: '1px solid rgba(204, 255, 0, 0.4)',
              }}
            >
              {formatPoints(p1Points)}
            </span>
          </div>
        </div>

        {/* Player 2 Row (A. MURRAY / CPU) */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 8,
            background: server === 'cpu' ? 'rgba(0, 90, 50, 0.35)' : 'transparent',
            padding: '3px 6px',
            borderRadius: 6,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, fontSize: 13, color: '#ffffff' }}>
            <span>🇬🇧</span>
            <span>A. MURRAY (CPU)</span>
            {server === 'cpu' && (
              <span style={{ fontSize: 12, color: '#ccff00', filter: 'drop-shadow(0 0 4px #ccff00)' }}>
                🎾
              </span>
            )}
          </div>
          <div style={{ display: 'flex', gap: 6, fontFamily: 'Teko, sans-serif', fontSize: 22, lineHeight: '22px' }}>
            {/* Sets */}
            <span
              style={{
                background: 'rgba(212, 175, 55, 0.25)',
                color: '#facc15',
                padding: '1px 8px',
                borderRadius: 4,
                minWidth: 28,
                textAlign: 'center',
                fontWeight: 700,
                border: '1px solid rgba(212, 175, 55, 0.35)',
              }}
            >
              {p2Sets}
            </span>
            {/* Games */}
            <span
              style={{
                background: 'rgba(0, 180, 216, 0.22)',
                color: '#38bdf8',
                padding: '1px 8px',
                borderRadius: 4,
                minWidth: 28,
                textAlign: 'center',
                border: '1px solid rgba(56, 189, 248, 0.3)',
              }}
            >
              {p2Games}
            </span>
            {/* Points */}
            <span
              style={{
                background: 'rgba(204, 255, 0, 0.22)',
                color: '#ccff00',
                padding: '1px 8px',
                borderRadius: 4,
                minWidth: 34,
                textAlign: 'center',
                fontWeight: 700,
                border: '1px solid rgba(204, 255, 0, 0.4)',
              }}
            >
              {formatPoints(p2Points)}
            </span>
          </div>
        </div>

        {/* Footer: Service Side & Match Stats */}
        <div
          style={{
            fontSize: 10,
            color: '#94a3b8',
            fontWeight: 700,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            borderTop: '1px solid rgba(255, 255, 255, 0.1)',
            paddingTop: 6,
          }}
        >
          <span>
            SAQUE:{' '}
            <span style={{ color: '#ccff00' }}>
              {serveSide === 'deuce' ? 'DEUCE' : 'VENTAJA'}
            </span>
          </span>
          <span>
            ACES: <span style={{ color: '#facc15' }}>{p1Aces}</span> - <span style={{ color: '#facc15' }}>{p2Aces}</span>
          </span>
          <span>
            PELOTEO: <span style={{ color: '#00e5ff', fontWeight: 800 }}>{rallyCount}</span>
          </span>
        </div>
      </div>

      {/* =======================================================================
          2. SLAMTRACKER SERVE SPEED RADAR (TOP-RIGHT)
          ======================================================================= */}
      <div
        style={{
          position: 'absolute',
          top: 18,
          right: 20,
          background: 'linear-gradient(135deg, rgba(10, 36, 21, 0.94) 0%, rgba(38, 9, 63, 0.94) 100%)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          border: '1.5px solid rgba(204, 255, 0, 0.35)',
          borderRadius: 14,
          padding: '12px 18px',
          boxShadow: '0 18px 40px rgba(0, 0, 0, 0.75), 0 0 20px rgba(204, 255, 0, 0.15)',
          minWidth: 260,
          pointerEvents: 'none',
          userSelect: 'none',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: 10,
            fontWeight: 800,
            letterSpacing: 1.5,
            color: '#ccff00',
            textTransform: 'uppercase',
            marginBottom: 6,
            borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
            paddingBottom: 4,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span>📡</span> RADAR SLAMTRACKER
          </div>
          <span style={{ fontSize: 9, color: '#94a3b8' }}>
            {lastSpeedHitter === 'p1' ? 'P1' : lastSpeedHitter === 'cpu' ? 'CPU' : 'EN ESPERA'}
          </span>
        </div>

        {/* Speed Readout */}
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 4 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
            <span
              style={{
                fontFamily: 'Teko, sans-serif',
                fontSize: 38,
                lineHeight: '36px',
                fontWeight: 700,
                color: lastSpeedKmh >= 190 ? '#f43f5e' : lastSpeedKmh >= 150 ? '#facc15' : '#ccff00',
                letterSpacing: 1,
              }}
            >
              {lastSpeedKmh > 0 ? lastSpeedKmh : '--'}
            </span>
            <span style={{ fontSize: 13, fontWeight: 800, color: '#cbd5e1' }}>KM/H</span>
          </div>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#94a3b8' }}>
            {lastSpeedMph > 0 ? `${lastSpeedMph} MPH` : '-- MPH'}
          </div>
        </div>

        {/* Dynamic Speed Gauge Bar */}
        <div
          style={{
            width: '100%',
            height: 5,
            background: 'rgba(255, 255, 255, 0.12)',
            borderRadius: 3,
            overflow: 'hidden',
            marginBottom: 6,
          }}
        >
          <div
            style={{
              width: `${Math.min(100, Math.max(0, (lastSpeedKmh / 220) * 100))}%`,
              height: '100%',
              background:
                lastSpeedKmh >= 190
                  ? 'linear-gradient(90deg, #facc15, #f43f5e)'
                  : 'linear-gradient(90deg, #00e5ff, #ccff00)',
              transition: 'width 0.3s ease',
            }}
          />
        </div>

        {/* Shot Label Badge & Match Serve Records */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 10 }}>
          <span
            style={{
              color: '#38bdf8',
              fontWeight: 800,
              letterSpacing: 0.5,
              textTransform: 'uppercase',
            }}
          >
            {lastSpeedLabel || 'PREPARADO'}
          </span>
          <span style={{ color: '#94a3b8', fontSize: 9 }}>
            RÉCORD: <span style={{ color: '#facc15', fontWeight: 800 }}>{Math.max(maxServeSpeedP1, maxServeSpeedCpu)} KM/H</span>
          </span>
        </div>
      </div>

      {/* =======================================================================
          3. HAWK-EYE OJO DE HALCÓN BROADCAST RIBBON (NEAR LINE CALLOUT)
          ======================================================================= */}
      {isRecentCloseCall && (
        <div
          style={{
            position: 'absolute',
            top: 130,
            right: 20,
            background: 'rgba(15, 23, 42, 0.94)',
            backdropFilter: 'blur(16px)',
            border: `1.5px solid ${lastBounceInBounds ? '#ccff00' : '#f43f5e'}`,
            borderRadius: 10,
            padding: '8px 16px',
            boxShadow: `0 12px 28px rgba(0,0,0,0.7), 0 0 16px ${lastBounceInBounds ? '#ccff0044' : '#f43f5e44'}`,
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            animation: 'fadeIn 0.3s ease',
            pointerEvents: 'none',
          }}
        >
          <div
            style={{
              background: lastBounceInBounds ? '#15803d' : '#be123c',
              color: '#ffffff',
              fontWeight: 900,
              fontSize: 12,
              padding: '2px 8px',
              borderRadius: 6,
              letterSpacing: 1,
            }}
          >
            {lastBounceInBounds ? 'IN' : 'OUT'}
          </div>
          <div>
            <div style={{ fontSize: 9, fontWeight: 800, color: '#94a3b8', letterSpacing: 1 }}>
              HAWK-EYE • OJO DE HALCÓN
            </div>
            <div style={{ fontSize: 12, fontWeight: 800, color: '#ffffff' }}>
              {lastBounceInBounds
                ? `En línea: a ${lastBounceDistanceCm} cm`
                : `Fuera: por ${lastBounceDistanceCm} cm`}
            </div>
          </div>
        </div>
      )}

      {/* =======================================================================
          4. PROMINENT TV DECISION BANNER (ACE / FALTA / OUT / GAME)
          ======================================================================= */}
      {lastCall && (
        <div
          style={{
            position: 'absolute',
            top: '32%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            background: 'rgba(10, 15, 26, 0.94)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            border: `2px solid ${lastCallColor}`,
            boxShadow: `0 24px 60px rgba(0, 0, 0, 0.8), 0 0 40px ${lastCallColor}44`,
            borderRadius: 20,
            padding: '16px 40px',
            textAlign: 'center',
            pointerEvents: 'none',
            zIndex: 100,
          }}
        >
          <div
            style={{
              fontSize: 12,
              fontWeight: 800,
              color: '#94a3b8',
              letterSpacing: 2.5,
              textTransform: 'uppercase',
              marginBottom: 4,
            }}
          >
            DECISIÓN DEL JUEZ ÁRBITRO
          </div>
          <div
            style={{
              fontSize: 26,
              fontWeight: 900,
              color: lastCallColor,
              letterSpacing: 1.5,
            }}
          >
            {lastCall}
          </div>
        </div>
      )}

      {/* =======================================================================
          5. DYNAMIC INTERACTIVE CONTROLS HUD (BOTTOM)
          ======================================================================= */}
      <div
        style={{
          position: 'absolute',
          bottom: 24,
          left: '50%',
          transform: 'translateX(-50%)',
          background: 'rgba(10, 15, 26, 0.90)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          border: '1px solid rgba(255, 255, 255, 0.15)',
          borderRadius: 30,
          padding: '10px 24px',
          boxShadow: '0 12px 32px rgba(0, 0, 0, 0.6)',
          display: 'flex',
          alignItems: 'center',
          gap: 14,
          fontSize: 13,
          fontWeight: 600,
          color: '#f8fafc',
          pointerEvents: 'none',
          userSelect: 'none',
          transition: 'all 0.3s ease',
        }}
      >
        <span
          style={{
            background: `${statusInfo.color}22`,
            color: statusInfo.color,
            border: `1px solid ${statusInfo.color}55`,
            padding: '3px 10px',
            borderRadius: 20,
            fontSize: 11,
            fontWeight: 800,
            letterSpacing: 0.5,
          }}
        >
          {statusInfo.badge}
        </span>
        <span style={{ color: '#e2e8f0' }}>{statusInfo.text}</span>
      </div>
    </div>
  );
};

export default App;

