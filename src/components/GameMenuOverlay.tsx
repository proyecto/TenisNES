import React from 'react';
import { useTennisStore } from '../store/useTennisStore';
import type { CpuDifficulty } from '../utils/tennisCpuAI';

interface GameMenuOverlayProps {
  onRestartMatch?: () => void;
}

export const GameMenuOverlay: React.FC<GameMenuOverlayProps> = ({ onRestartMatch }) => {
  const {
    isMenuOpen,
    setMenuOpen,
    difficulty,
    setDifficulty,
    isMuted,
    toggleMute,
    volume,
    setVolume,
    resetMatch,
    p1Points,
    p2Points,
    p1Games,
    p2Games,
    p1Sets,
    p2Sets,
    rallyCount,
  } = useTennisStore();

  if (!isMenuOpen) return null;

  const isMatchStarted =
    p1Points > 0 ||
    p2Points > 0 ||
    p1Games > 0 ||
    p2Games > 0 ||
    p1Sets > 0 ||
    p2Sets > 0 ||
    rallyCount > 0;

  const handleResume = () => {
    setMenuOpen(false);
  };

  const handleRestart = () => {
    resetMatch();
    if (onRestartMatch) {
      onRestartMatch();
    }
  };

  const difficulties: Array<{ id: CpuDifficulty; label: string; tag: string; description: string; badgeColor: string }> = [
    {
      id: 'amateur',
      label: 'AMATEUR',
      tag: 'PRINCIPIANTE',
      description: 'Reacción moderada, tiros dirigidos al centro y velocidad reducida. Ideal para iniciarse.',
      badgeColor: '#10b981',
    },
    {
      id: 'pro',
      label: 'PROFESIONAL',
      tag: 'EQUILIBRADO',
      description: 'Reacción rápida, tiros profundos a esquinas y ritmo competitivo ATP Tour.',
      badgeColor: '#f59e0b',
    },
    {
      id: 'legend',
      label: 'LEYENDA',
      tag: 'CENTRE COURT',
      description: 'Velocidad máxima, busca líneas milimétricas, dejadas letales y agresividad extrema en red.',
      badgeColor: '#ef4444',
    },
  ];

  return (
    <div
      data-testid="game-menu-overlay"
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(3, 14, 8, 0.82)',
        backdropFilter: 'blur(14px)',
        WebkitBackdropFilter: 'blur(14px)',
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
          maxWidth: 620,
          background: 'linear-gradient(145deg, rgba(8, 38, 22, 0.96) 0%, rgba(22, 12, 38, 0.98) 100%)',
          border: '2px solid rgba(212, 175, 55, 0.7)', // Wimbledon Gold
          borderRadius: 20,
          boxShadow: '0 24px 60px rgba(0, 0, 0, 0.8), 0 0 40px rgba(212, 175, 55, 0.15)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          color: '#f8fafc',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '22px 28px',
            borderBottom: '1px solid rgba(212, 175, 55, 0.3)',
            background: 'linear-gradient(90deg, rgba(38, 9, 63, 0.6) 0%, rgba(10, 36, 21, 0.6) 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 26 }}>🏆</span>
            <div>
              <div
                style={{
                  fontSize: 18,
                  fontWeight: 900,
                  letterSpacing: 2.5,
                  color: '#facc15',
                  textTransform: 'uppercase',
                }}
              >
                THE CHAMPIONSHIPS • WIMBLEDON
              </div>
              <div style={{ fontSize: 12, color: '#a7f3d0', fontWeight: 600, letterSpacing: 1 }}>
                MENÚ DE PARTIDO & CONFIGURACIÓN
              </div>
            </div>
          </div>
          <button
            onClick={handleResume}
            aria-label="Cerrar menú"
            style={{
              background: 'rgba(255, 255, 255, 0.1)',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              borderRadius: '50%',
              width: 34,
              height: 34,
              color: '#fff',
              fontSize: 16,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.2s',
            }}
          >
            ✕
          </button>
        </div>

        {/* Content body */}
        <div style={{ padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: 22 }}>
          {/* Difficulty Section */}
          <div>
            <div
              style={{
                fontSize: 12,
                fontWeight: 800,
                color: '#cbd5e1',
                letterSpacing: 1.5,
                textTransform: 'uppercase',
                marginBottom: 10,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <span>🎾</span> DIFICULTAD DE LA CPU
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
              {difficulties.map((diff) => {
                const isSelected = difficulty === diff.id;
                return (
                  <button
                    key={diff.id}
                    data-testid={`difficulty-${diff.id}`}
                    onClick={() => setDifficulty(diff.id)}
                    style={{
                      background: isSelected
                        ? 'linear-gradient(135deg, rgba(212, 175, 55, 0.3) 0%, rgba(16, 185, 129, 0.3) 100%)'
                        : 'rgba(15, 23, 42, 0.65)',
                      border: isSelected
                        ? '2px solid #facc15'
                        : '1.5px solid rgba(255, 255, 255, 0.12)',
                      borderRadius: 12,
                      padding: '12px 10px',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'flex-start',
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'all 0.2s ease',
                      boxShadow: isSelected ? '0 0 16px rgba(250, 204, 21, 0.3)' : 'none',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center', marginBottom: 4 }}>
                      <span
                        style={{
                          fontSize: 13,
                          fontWeight: 800,
                          color: isSelected ? '#facc15' : '#f8fafc',
                          letterSpacing: 0.5,
                        }}
                      >
                        {diff.label}
                      </span>
                      <span
                        style={{
                          fontSize: 9,
                          fontWeight: 800,
                          padding: '2px 6px',
                          borderRadius: 8,
                          background: diff.badgeColor,
                          color: '#000',
                        }}
                      >
                        {diff.tag}
                      </span>
                    </div>
                    <span style={{ fontSize: 10.5, color: '#94a3b8', lineHeight: 1.3, marginTop: 4 }}>
                      {diff.description}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Audio & Sound Settings */}
          <div>
            <div
              style={{
                fontSize: 12,
                fontWeight: 800,
                color: '#cbd5e1',
                letterSpacing: 1.5,
                textTransform: 'uppercase',
                marginBottom: 10,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <span>🔊</span> SONIDO Y AMBIENTE
            </div>
            <div
              style={{
                background: 'rgba(15, 23, 42, 0.65)',
                border: '1.5px solid rgba(255, 255, 255, 0.12)',
                borderRadius: 12,
                padding: '12px 16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 16,
              }}
            >
              <button
                onClick={toggleMute}
                data-testid="menu-mute-btn"
                style={{
                  background: isMuted ? 'rgba(239, 68, 68, 0.25)' : 'rgba(204, 255, 0, 0.2)',
                  border: `1px solid ${isMuted ? 'rgba(239, 68, 68, 0.5)' : 'rgba(204, 255, 0, 0.4)'}`,
                  color: isMuted ? '#f87171' : '#ccff00',
                  borderRadius: 8,
                  padding: '6px 14px',
                  fontSize: 12,
                  fontWeight: 800,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <span>{isMuted ? '🔇' : '🔊'}</span>
                <span>{isMuted ? 'MUTED' : 'ACTIVADO'}</span>
              </button>

              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, maxWidth: 280 }}>
                <span style={{ fontSize: 11, color: '#94a3b8', fontWeight: 700 }}>VOL:</span>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={volume}
                  onChange={(e) => setVolume(parseFloat(e.target.value))}
                  data-testid="menu-volume-slider"
                  style={{
                    flex: 1,
                    accentColor: '#facc15',
                    cursor: 'pointer',
                  }}
                />
                <span style={{ fontSize: 11, color: '#cbd5e1', fontWeight: 800, minWidth: 32, textAlign: 'right' }}>
                  {Math.round(volume * 100)}%
                </span>
              </div>
            </div>
          </div>

          {/* Quick Controls Reference */}
          <div
            style={{
              background: 'rgba(15, 23, 42, 0.5)',
              border: '1px dashed rgba(212, 175, 55, 0.35)',
              borderRadius: 12,
              padding: '12px 16px',
            }}
          >
            <div style={{ fontSize: 11, fontWeight: 800, color: '#facc15', letterSpacing: 1, marginBottom: 6 }}>
              GUÍA RÁPIDA DE CONTROLES:
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '6px 16px', fontSize: 11, color: '#cbd5e1' }}>
              <div><strong style={{ color: '#fff' }}>[WASD] / Flechas:</strong> Movimiento por pista</div>
              <div><strong style={{ color: '#fff' }}>[ESPACIO]:</strong> Lanzar saque / Golpear / Smash</div>
              <div><strong style={{ color: '#fff' }}>[SHIFT] / [E]:</strong> Globo defensivo sobre red</div>
              <div><strong style={{ color: '#fff' }}>[S + ESPACIO]:</strong> Dejada corta si estás en red</div>
              <div><strong style={{ color: '#fff' }}>[ESC]:</strong> Pausar / Abrir menú</div>
              <div><strong style={{ color: '#fff' }}>[M]:</strong> Silenciar audio al instante</div>
            </div>
          </div>
        </div>

        {/* Action Buttons Footer */}
        <div
          style={{
            padding: '18px 28px',
            borderTop: '1px solid rgba(212, 175, 55, 0.3)',
            background: 'rgba(8, 20, 14, 0.7)',
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 12,
          }}
        >
          <button
            onClick={handleRestart}
            data-testid="restart-match-btn"
            style={{
              background: 'rgba(239, 68, 68, 0.2)',
              border: '1.5px solid rgba(239, 68, 68, 0.5)',
              color: '#fca5a5',
              padding: '10px 18px',
              borderRadius: 10,
              fontSize: 12,
              fontWeight: 800,
              letterSpacing: 1,
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
          >
            🔄 REINICIAR PARTIDO
          </button>
          <button
            onClick={handleResume}
            data-testid="resume-match-btn"
            style={{
              background: 'linear-gradient(135deg, #facc15 0%, #10b981 100%)',
              border: 'none',
              color: '#062c1a',
              padding: '10px 24px',
              borderRadius: 10,
              fontSize: 12,
              fontWeight: 900,
              letterSpacing: 1.5,
              cursor: 'pointer',
              boxShadow: '0 4px 15px rgba(250, 204, 21, 0.4)',
              transition: 'all 0.2s',
            }}
          >
            {isMatchStarted ? '▶ CONTINUAR PARTIDO' : '▶ EMPEZAR PARTIDO'}
          </button>
        </div>
      </div>
    </div>
  );
};
