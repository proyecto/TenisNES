import React from 'react';
import { useTennisStore } from '../store/useTennisStore';

interface MatchFinishOverlayProps {
  matchElapsedSeconds: number;
  onRestartMatch?: () => void;
}

export const MatchFinishOverlay: React.FC<MatchFinishOverlayProps> = ({
  matchElapsedSeconds,
  onRestartMatch,
}) => {
  const {
    matchStatus,
    p1Sets,
    p2Sets,
    p1Games,
    p2Games,
    p1Aces,
    p2Aces,
    maxServeSpeedP1,
    maxServeSpeedCpu,
    difficulty,
    resetMatch,
    setMenuOpen,
  } = useTennisStore();

  if (matchStatus !== 'game_over') return null;

  const isP1Winner = p1Sets >= 2 || p1Sets > p2Sets;
  const winnerName = isP1Winner ? 'R. NADAL (ESP)' : 'A. MURRAY (GBR)';
  const runnerUpName = isP1Winner ? 'A. MURRAY (GBR)' : 'R. NADAL (ESP)';

  const formatMatchTime = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const rem = secs % 60;
    return `${mins.toString().padStart(2, '0')}:${rem.toString().padStart(2, '0')}`;
  };

  const handleRestart = () => {
    resetMatch();
    if (onRestartMatch) {
      onRestartMatch();
    }
  };

  const handleOpenMenu = () => {
    setMenuOpen(true);
  };

  return (
    <div
      data-testid="match-finish-overlay"
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(2, 10, 6, 0.88)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: 20,
        fontFamily: "'Segoe UI', -apple-system, BlinkMacSystemFont, Roboto, sans-serif",
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 680,
          background: 'linear-gradient(160deg, rgba(10, 46, 26, 0.98) 0%, rgba(26, 10, 48, 0.98) 100%)',
          border: '2.5px solid #facc15', // Wimbledon Gold
          borderRadius: 24,
          boxShadow: '0 25px 70px rgba(0, 0, 0, 0.85), 0 0 50px rgba(250, 204, 21, 0.25)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          color: '#f8fafc',
          textAlign: 'center',
        }}
      >
        {/* Championship Header */}
        <div
          style={{
            padding: '30px 24px 20px',
            background: 'linear-gradient(180deg, rgba(212, 175, 55, 0.25) 0%, transparent 100%)',
            borderBottom: '1px solid rgba(212, 175, 55, 0.3)',
          }}
        >
          <div style={{ fontSize: 50, marginBottom: 8, filter: 'drop-shadow(0 0 16px rgba(250, 204, 21, 0.6))' }}>
            🏆
          </div>
          <div
            style={{
              fontSize: 13,
              fontWeight: 800,
              letterSpacing: 3,
              color: '#facc15',
              textTransform: 'uppercase',
              marginBottom: 6,
            }}
          >
            THE CHAMPIONSHIPS • WIMBLEDON CENTRE COURT
          </div>
          <h1
            data-testid="winner-title"
            style={{
              margin: 0,
              fontSize: 32,
              fontWeight: 900,
              letterSpacing: 2,
              color: '#ffffff',
              textShadow: '0 2px 10px rgba(0,0,0,0.7)',
            }}
          >
            ¡{winnerName} CAMPEÓN!
          </h1>
          <div style={{ fontSize: 13, color: '#a7f3d0', marginTop: 6, fontWeight: 600 }}>
            Nivel: {difficulty.toUpperCase()} • Subcampeón: {runnerUpName}
          </div>
        </div>

        {/* Content & Stats */}
        <div style={{ padding: '24px 32px', display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Sets and Games Banner */}
          <div
            style={{
              background: 'rgba(15, 23, 42, 0.7)',
              border: '1.5px solid rgba(212, 175, 55, 0.35)',
              borderRadius: 16,
              padding: '14px 24px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-around',
            }}
          >
            <div>
              <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 800, letterSpacing: 1 }}>SETS FINALES</div>
              <div style={{ fontSize: 28, fontWeight: 900, color: '#facc15' }}>
                {p1Sets} - {p2Sets}
              </div>
            </div>
            <div style={{ width: 1, height: 40, background: 'rgba(255, 255, 255, 0.15)' }} />
            <div>
              <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 800, letterSpacing: 1 }}>JUEGOS TOTALES</div>
              <div style={{ fontSize: 28, fontWeight: 900, color: '#e2e8f0' }}>
                {p1Games} - {p2Games}
              </div>
            </div>
            <div style={{ width: 1, height: 40, background: 'rgba(255, 255, 255, 0.15)' }} />
            <div>
              <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 800, letterSpacing: 1 }}>DURACIÓN</div>
              <div style={{ fontSize: 28, fontWeight: 900, color: '#38bdf8' }}>
                {formatMatchTime(matchElapsedSeconds)}
              </div>
            </div>
          </div>

          {/* IBM SlamTracker Match Statistics Table */}
          <div
            style={{
              background: 'rgba(15, 23, 42, 0.6)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: 16,
              padding: '16px 20px',
            }}
          >
            <div
              style={{
                fontSize: 11,
                fontWeight: 900,
                color: '#facc15',
                letterSpacing: 2,
                textTransform: 'uppercase',
                marginBottom: 12,
              }}
            >
              ESTADÍSTICAS OFICIALES SLAMTRACKER
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {/* Header row */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 140px 1fr',
                  fontSize: 11,
                  fontWeight: 800,
                  color: '#94a3b8',
                  borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
                  paddingBottom: 6,
                }}
              >
                <div style={{ textAlign: 'left' }}>R. NADAL (P1)</div>
                <div>PARÁMETRO</div>
                <div style={{ textAlign: 'right' }}>A. MURRAY (CPU)</div>
              </div>

              {/* Aces */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 140px 1fr', fontSize: 13, fontWeight: 700 }}>
                <div style={{ textAlign: 'left', color: isP1Winner ? '#facc15' : '#fff' }}>{p1Aces}</div>
                <div style={{ color: '#94a3b8', fontSize: 11 }}>Aces (Saques directos)</div>
                <div style={{ textAlign: 'right', color: !isP1Winner ? '#facc15' : '#fff' }}>{p2Aces}</div>
              </div>

              {/* Fastest Serve */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 140px 1fr', fontSize: 13, fontWeight: 700 }}>
                <div style={{ textAlign: 'left', color: '#38bdf8' }}>
                  {maxServeSpeedP1 > 0 ? `${maxServeSpeedP1} km/h` : '-'}
                </div>
                <div style={{ color: '#94a3b8', fontSize: 11 }}>Servicio más rápido</div>
                <div style={{ textAlign: 'right', color: '#38bdf8' }}>
                  {maxServeSpeedCpu > 0 ? `${maxServeSpeedCpu} km/h` : '-'}
                </div>
              </div>

              {/* Sets Won */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 140px 1fr', fontSize: 13, fontWeight: 700 }}>
                <div style={{ textAlign: 'left', color: isP1Winner ? '#10b981' : '#fff' }}>{p1Sets}</div>
                <div style={{ color: '#94a3b8', fontSize: 11 }}>Sets Ganados</div>
                <div style={{ textAlign: 'right', color: !isP1Winner ? '#10b981' : '#fff' }}>{p2Sets}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div
          style={{
            padding: '20px 32px 28px',
            borderTop: '1px solid rgba(212, 175, 55, 0.3)',
            background: 'rgba(8, 20, 14, 0.7)',
            display: 'flex',
            justifyContent: 'center',
            gap: 16,
          }}
        >
          <button
            onClick={handleOpenMenu}
            data-testid="finish-menu-btn"
            style={{
              background: 'rgba(255, 255, 255, 0.1)',
              border: '1.5px solid rgba(255, 255, 255, 0.25)',
              color: '#e2e8f0',
              padding: '12px 22px',
              borderRadius: 12,
              fontSize: 13,
              fontWeight: 800,
              letterSpacing: 1,
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
          >
            ⚙️ MENÚ / DIFICULTAD
          </button>
          <button
            onClick={handleRestart}
            data-testid="new-match-btn"
            style={{
              background: 'linear-gradient(135deg, #facc15 0%, #10b981 100%)',
              border: 'none',
              color: '#062c1a',
              padding: '12px 32px',
              borderRadius: 12,
              fontSize: 13,
              fontWeight: 900,
              letterSpacing: 1.5,
              cursor: 'pointer',
              boxShadow: '0 6px 20px rgba(250, 204, 21, 0.45)',
              transition: 'all 0.2s',
            }}
          >
            🏆 JUGAR NUEVO PARTIDO
          </button>
        </div>
      </div>
    </div>
  );
};
