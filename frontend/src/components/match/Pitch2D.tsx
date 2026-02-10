import React, { useMemo } from 'react';

// ---------------------------------------------------------------------------
// Pitch2D — Pure SVG football pitch
// ---------------------------------------------------------------------------
// Renders a standard pitch (105m x 68m) with players and ball.
// Reusable in MatchLivePage (animated=true) and MatchPreviewPage (static).
// ---------------------------------------------------------------------------

export interface Pitch2DPlayer {
  id: number;
  name: string;
  shirtNumber: number;
  x: number; // 0-100
  y: number; // 0-100
  team: 'home' | 'away';
  position?: string;
}

export interface Pitch2DProps {
  players?: Pitch2DPlayer[];
  ball?: { x: number; y: number } | null;
  homeColor?: string;
  awayColor?: string;
  animated?: boolean;
  /** Transition duration in ms — overrides the default 400ms when animated=true. */
  transitionDurationMs?: number;
  onPlayerClick?: (playerId: number) => void;
  className?: string;
  highlightedPlayerId?: number | null;
}

// Map 0-100 coordinate to SVG viewBox units
const toSvgX = (v: number): number => (v / 100) * 105;
const toSvgY = (v: number): number => (v / 100) * 68;

const Pitch2D: React.FC<Pitch2DProps> = ({
  players = [],
  ball = null,
  homeColor = '#3b82f6',
  awayColor = '#ef4444',
  animated = false,
  transitionDurationMs = 400,
  onPlayerClick,
  className = '',
  highlightedPlayerId = null,
}) => {
  // Pre-compute player SVG positions
  const mappedPlayers = useMemo(
    () =>
      players.map((p) => ({
        ...p,
        svgX: toSvgX(p.x),
        svgY: toSvgY(p.y),
      })),
    [players],
  );

  const ballSvg = useMemo(
    () =>
      ball ? { x: toSvgX(ball.x), y: toSvgY(ball.y) } : null,
    [ball],
  );

  const transitionSec = (transitionDurationMs / 1000).toFixed(2);
  const transitionCss = animated
    ? `all ${transitionSec}s ease`
    : 'none';

  return (
    <svg
      viewBox="0 0 105 68"
      xmlns="http://www.w3.org/2000/svg"
      className={`w-full h-auto ${className}`}
      style={{ maxHeight: '100%' }}
      role="img"
      aria-label="Football pitch"
    >
      {/* ---- Pitch background ---- */}
      <rect x="0" y="0" width="105" height="68" fill="#2d6a2e" rx="1" />

      {/* Grass stripes (subtle) */}
      {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) => (
        <rect
          key={`stripe-${i}`}
          x={i * 10.5}
          y="0"
          width="10.5"
          height="68"
          fill={i % 2 === 0 ? '#2d6a2e' : '#327334'}
          opacity="0.5"
        />
      ))}

      {/* ---- Pitch markings ---- */}
      <g stroke="white" strokeWidth="0.3" fill="none" opacity="0.85">
        {/* Touchlines & goal lines */}
        <rect x="0" y="0" width="105" height="68" />

        {/* Halfway line */}
        <line x1="52.5" y1="0" x2="52.5" y2="68" />

        {/* Centre circle (radius 9.15m) */}
        <circle cx="52.5" cy="34" r="9.15" />

        {/* Centre spot */}
        <circle cx="52.5" cy="34" r="0.4" fill="white" />

        {/* ---- Left penalty area (home) ---- */}
        {/* Penalty box: 16.5m deep, 40.3m wide => centered on 68/2=34 */}
        <rect x="0" y={34 - 20.15} width="16.5" height="40.3" />

        {/* Goal area: 5.5m deep, 18.32m wide */}
        <rect x="0" y={34 - 9.16} width="5.5" height="18.32" />

        {/* Penalty spot (11m from goal line) */}
        <circle cx="11" cy="34" r="0.4" fill="white" />

        {/* Penalty arc */}
        <path
          d={`M 16.5 ${34 - 8.7} A 9.15 9.15 0 0 1 16.5 ${34 + 8.7}`}
        />

        {/* ---- Right penalty area (away) ---- */}
        <rect x={105 - 16.5} y={34 - 20.15} width="16.5" height="40.3" />
        <rect x={105 - 5.5} y={34 - 9.16} width="5.5" height="18.32" />
        <circle cx="94" cy="34" r="0.4" fill="white" />
        <path
          d={`M ${105 - 16.5} ${34 - 8.7} A 9.15 9.15 0 0 0 ${105 - 16.5} ${34 + 8.7}`}
        />

        {/* ---- Corner arcs (radius 1m) ---- */}
        <path d="M 0 1 A 1 1 0 0 0 1 0" />
        <path d="M 0 67 A 1 1 0 0 1 1 68" />
        <path d="M 105 1 A 1 1 0 0 1 104 0" />
        <path d="M 105 67 A 1 1 0 0 0 104 68" />

        {/* ---- Goals (nets) ---- */}
        <rect x="-2" y={34 - 3.66} width="2" height="7.32" stroke="white" strokeWidth="0.2" fill="none" opacity="0.5" />
        <rect x="105" y={34 - 3.66} width="2" height="7.32" stroke="white" strokeWidth="0.2" fill="none" opacity="0.5" />
      </g>

      {/* ---- Players ---- */}
      {mappedPlayers.map((p) => {
        const color = p.team === 'home' ? homeColor : awayColor;
        const isHighlighted = highlightedPlayerId === p.id;
        return (
          <g
            key={p.id}
            style={{
              cursor: onPlayerClick ? 'pointer' : 'default',
              transition: transitionCss,
              transform: `translate(${p.svgX}px, ${p.svgY}px)`,
            }}
            onClick={() => onPlayerClick?.(p.id)}
          >
            {/* Highlight ring */}
            {isHighlighted && (
              <circle
                cx={0}
                cy={0}
                r={2.8}
                fill="none"
                stroke="#facc15"
                strokeWidth="0.5"
                opacity="0.9"
              >
                <animate
                  attributeName="r"
                  values="2.8;3.2;2.8"
                  dur="1s"
                  repeatCount="indefinite"
                />
              </circle>
            )}

            {/* Player dot */}
            <circle
              cx={0}
              cy={0}
              r={2}
              fill={color}
              stroke="white"
              strokeWidth="0.3"
              opacity="0.95"
            />

            {/* Shirt number */}
            <text
              x={0}
              y={0.7}
              textAnchor="middle"
              fill="white"
              fontSize="2"
              fontWeight="bold"
              fontFamily="sans-serif"
              style={{ pointerEvents: 'none' }}
            >
              {p.shirtNumber}
            </text>

            {/* Player name — shown below dot */}
            <text
              x={0}
              y={3.5}
              textAnchor="middle"
              fill="white"
              fontSize="1.6"
              fontFamily="sans-serif"
              opacity="0.8"
              style={{ pointerEvents: 'none' }}
            >
              {p.name.split(' ').pop()}
            </text>
          </g>
        );
      })}

      {/* ---- Ball ---- */}
      {ballSvg && (
        <circle
          cx={ballSvg.x}
          cy={ballSvg.y}
          r={1.2}
          fill="white"
          stroke="#222"
          strokeWidth="0.3"
          style={{ transition: transitionCss }}
        />
      )}
    </svg>
  );
};

export default Pitch2D;
