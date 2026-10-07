import React from 'react';
import { TennisScene } from './components/TennisScene';
import { useTennisStore } from './store/useTennisStore';

export const App: React.FC = () => {
  const {
    p1Points,
    p2Points,
    p1Games,
    p2Games,
    rallyCount,
    matchStatus,
    server,
    serveSide,
    faultCount,
    lastCall,
    lastCallColor,
    setLastCall,
  } = useTennisStore();

  // Auto-dismiss the decision announcement banner after 2.2 seconds
  React.useEffect(() => {
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

  const getStatusMessage = () => {
    switch (matchStatus) {
      case 'serve_prep':
        const targetSide = serveSide === 'deuce' ? 'CUADRO IZQUIERDO' : 'CUADRO DERECHO';
        const currentSideName = serveSide === 'deuce' ? 'DERECHA (Deuce)' : 'IZQUIERDA (Ventaja)';
        return {
          badge: faultCount === 1 ? '2º SERVICIO' : '1º SERVICIO',
          color: faultCount === 1 ? '#f59e0b' : '#ccff00',
          text: `Saque: ${currentSideName} ➔ Objetivo: ${targetSide} • Muévete detrás de la línea y pulsa [ESPACIO]`,
        };
      case 'serving':
        return {
          badge: '¡GOLPEA EL SAQUE!',
          color: '#ffea00',
          text: 'Golpea en el punto más alto para saque profundo (lejos) o antes para saque corto (cerca) • [ESPACIO]',
        };
      case 'playing':
        return {
          badge: 'EN JUEGO',
          color: '#00e5ff',
          text: 'Acércate a la bola y pulsa [ESPACIO] para golpear • Usa A/D para dirigir',
        };
      case 'point_over':
        return {
          badge: 'PUNTO FINALIZADO',
          color: '#f43f5e',
          text: 'Preparando siguiente punto...',
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
      {/* 3D WebGL Canvas with Fixed Camera */}
      <TennisScene />

      {/* Modern Broadcast Scoreboard Overlay */}
      <div
        style={{
          position: 'absolute',
          top: 20,
          left: 24,
          background: 'rgba(10, 15, 26, 0.88)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          border: '1px solid rgba(255, 255, 255, 0.15)',
          borderRadius: 14,
          padding: '12px 18px',
          boxShadow: '0 16px 36px rgba(0, 0, 0, 0.6)',
          minWidth: 300,
          pointerEvents: 'none',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: 11,
            fontWeight: 800,
            letterSpacing: 1.5,
            color: '#ccff00',
            textTransform: 'uppercase',
            marginBottom: 8,
            borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
            paddingBottom: 4,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span>🎾</span> GRAND SLAM 3D • 1P VS CPU
          </div>
          {faultCount === 1 && (
            <span
              style={{
                background: 'rgba(245, 158, 11, 0.25)',
                color: '#fbbf24',
                padding: '1px 6px',
                borderRadius: 4,
                fontSize: 10,
                border: '1px solid rgba(245, 158, 11, 0.4)',
              }}
            >
              2º SERVICIO
            </span>
          )}
        </div>

        {/* Player 1 Row */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 6,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, fontSize: 14 }}>
            <span>🇪🇸</span>
            <span>JUGADOR 1</span>
            {server === 'p1' && <span style={{ fontSize: 11, color: '#ccff00' }}>●</span>}
          </div>
          <div style={{ display: 'flex', gap: 6, fontFamily: 'Teko, sans-serif', fontSize: 20 }}>
            <span
              style={{
                background: 'rgba(0, 180, 216, 0.2)',
                color: '#00e5ff',
                padding: '0 8px',
                borderRadius: 4,
              }}
            >
              {p1Games}
            </span>
            <span
              style={{
                background: 'rgba(204, 255, 0, 0.2)',
                color: '#ccff00',
                padding: '0 8px',
                borderRadius: 4,
                minWidth: 28,
                textAlign: 'center',
              }}
            >
              {formatPoints(p1Points)}
            </span>
          </div>
        </div>

        {/* Player 2 / CPU Row */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 8,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, fontSize: 14 }}>
            <span>🌍</span>
            <span>CPU</span>
            {server === 'cpu' && <span style={{ fontSize: 11, color: '#ccff00' }}>●</span>}
          </div>
          <div style={{ display: 'flex', gap: 6, fontFamily: 'Teko, sans-serif', fontSize: 20 }}>
            <span
              style={{
                background: 'rgba(0, 180, 216, 0.2)',
                color: '#00e5ff',
                padding: '0 8px',
                borderRadius: 4,
              }}
            >
              {p2Games}
            </span>
            <span
              style={{
                background: 'rgba(204, 255, 0, 0.2)',
                color: '#ccff00',
                padding: '0 8px',
                borderRadius: 4,
                minWidth: 28,
                textAlign: 'center',
              }}
            >
              {formatPoints(p2Points)}
            </span>
          </div>
        </div>

        {/* Rally & Service Side indicator */}
        <div
          style={{
            fontSize: 10,
            color: '#94a3b8',
            fontWeight: 700,
            display: 'flex',
            justifyContent: 'space-between',
            borderTop: '1px solid rgba(255, 255, 255, 0.08)',
            paddingTop: 6,
          }}
        >
          <span>
            SAQUE:{' '}
            <span style={{ color: '#ccff00' }}>
              {serveSide === 'deuce' ? 'DEUCE (DCH ➔ IZQ)' : 'VENTAJA (IZQ ➔ DCH)'}
            </span>
          </span>
          <span>
            PELOTEO: <span style={{ color: '#00e5ff', fontWeight: 800 }}>{rallyCount}</span>
          </span>
        </div>
      </div>

      {/* Prominent TV Broadcast Decision Banner */}
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

      {/* Dynamic Interactive HUD Guide */}
      <div
        style={{
          position: 'absolute',
          bottom: 24,
          left: '50%',
          transform: 'translateX(-50%)',
          background: 'rgba(10, 15, 26, 0.88)',
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
