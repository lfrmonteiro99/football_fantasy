import React, { useMemo } from 'react';
import type { BallTrail, EventOverlay } from '../../hooks/useSequencePlayer';

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
  /** Separate ball transition duration when ball speed differs from player speed. */
  ballTransitionMs?: number;
  onPlayerClick?: (playerId: number) => void;
  className?: string;
  highlightedPlayerId?: number | null;
  /** Ball height 0-1 for aerial balls; renders shadow + lift. */
  ballHeight?: number;
  /** Ball carrier id — renders possession indicator. */
  ballCarrierId?: number | null;
  /** Recent ball trails (pass/shot lines). */
  trails?: BallTrail[];
  /** Event overlays (goal flash, cards, fouls). */
  overlays?: EventOverlay[];
  /** Per-player direction + speed. */
  directionVectors?: Map<number, { dx: number; dy: number; speed: number }>;
}

// Map 0-100 coordinate to SVG viewBox units
const toSvgX = (v: number): number => (v / 100) * 105;
const toSvgY = (v: number): number => (v / 100) * 68;

const OVERLAY_LIFETIME_MS = 2500;

const Pitch2D: React.FC<Pitch2DProps> = ({
  players = [],
  ball = null,
  homeColor = '#3b82f6',
  awayColor = '#ef4444',
  animated = false,
  transitionDurationMs = 400,
  ballTransitionMs,
  onPlayerClick,
  className = '',
  highlightedPlayerId = null,
  ballHeight = 0,
  ballCarrierId = null,
  trails = [],
  overlays = [],
  directionVectors,
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

  const playerTransitionSec = (transitionDurationMs / 1000).toFixed(2);
  const ballTransitionSec = ((ballTransitionMs ?? transitionDurationMs) / 1000).toFixed(2);
  const transitionCss = animated
    ? `all ${playerTransitionSec}s ease`
    : 'none';
  const ballTransitionCss = animated
    ? `all ${ballTransitionSec}s ease`
    : 'none';

  // Filter active overlays
  const now = Date.now();
  const activeOverlays = useMemo(
    () => overlays.filter((o) => now - o.createdAt < OVERLAY_LIFETIME_MS),
    [overlays, now],
  );

  // Aerial ball: offset + shadow
  const ballLift = ballHeight * 4; // max lift in SVG units
  const ballShadowOpacity = ballHeight * 0.4; // stronger shadow at peak

  return (
    <svg
      viewBox="0 0 105 68"
      xmlns="http://www.w3.org/2000/svg"
      className={`w-full h-auto ${className}`}
      style={{ maxHeight: '100%' }}
      role="img"
      aria-label="Football pitch"
    >
      {/* ---- SVG defs (filters, gradients) ---- */}
      <defs>
        {/* Goal flash glow */}
        <radialGradient id="goalFlash" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#facc15" stopOpacity="0.8" />
          <stop offset="100%" stopColor="#facc15" stopOpacity="0" />
        </radialGradient>
        {/* Ball glow for carrier */}
        <radialGradient id="ballGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="white" stopOpacity="0.6" />
          <stop offset="100%" stopColor="white" stopOpacity="0" />
        </radialGradient>
      </defs>

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
        <rect x="0" y={34 - 20.15} width="16.5" height="40.3" />
        <rect x="0" y={34 - 9.16} width="5.5" height="18.32" />
        <circle cx="11" cy="34" r="0.4" fill="white" />
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

      {/* ---- Ball Trails (pass/shot lines) ---- */}
      {trails.map((trail, idx) => {
        const age = now - trail.createdAt;
        const fade = Math.max(0, 1 - age / 2500);
        if (fade <= 0) return null;
        const color = trail.team === 'home' ? homeColor : awayColor;
        return (
          <line
            key={`trail-${idx}`}
            x1={toSvgX(trail.startX)}
            y1={toSvgY(trail.startY)}
            x2={toSvgX(trail.endX)}
            y2={toSvgY(trail.endY)}
            stroke={color}
            strokeWidth="0.3"
            strokeDasharray="1,0.8"
            opacity={fade * 0.5}
          />
        );
      })}

      {/* ---- Players ---- */}
      {mappedPlayers.map((p) => {
        const color = p.team === 'home' ? homeColor : awayColor;
        const isHighlighted = highlightedPlayerId === p.id;
        const isCarrier = ballCarrierId === p.id;
        const dirVec = directionVectors?.get(p.id);
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

            {/* Ball carrier glow ring */}
            {isCarrier && (
              <circle
                cx={0}
                cy={0}
                r={3}
                fill="url(#ballGlow)"
                opacity="0.6"
              />
            )}

            {/* Direction indicator (movement wedge) */}
            {dirVec && dirVec.speed > 1.5 && (
              <polygon
                points={(() => {
                  const len = Math.min(dirVec.speed * 0.4, 2.5);
                  const tipX = dirVec.dx * (2 + len);
                  const tipY = dirVec.dy * (2 + len);
                  const perpX = -dirVec.dy * 0.6;
                  const perpY = dirVec.dx * 0.6;
                  return `${dirVec.dx * 2 + perpX},${dirVec.dy * 2 + perpY} ${tipX},${tipY} ${dirVec.dx * 2 - perpX},${dirVec.dy * 2 - perpY}`;
                })()}
                fill={color}
                opacity="0.5"
              />
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

      {/* ---- Ball Shadow (for aerial balls) ---- */}
      {ballSvg && ballHeight > 0.05 && (
        <ellipse
          cx={ballSvg.x}
          cy={ballSvg.y + 0.5}
          rx={1.2 + ballHeight * 0.5}
          ry={0.5 + ballHeight * 0.2}
          fill="rgba(0,0,0,0.3)"
          opacity={ballShadowOpacity}
          style={{ transition: ballTransitionCss }}
        />
      )}

      {/* ---- Ball ---- */}
      {ballSvg && (
        <circle
          cx={ballSvg.x}
          cy={ballSvg.y - ballLift}
          r={1.2 + ballHeight * 0.3}
          fill="white"
          stroke="#222"
          strokeWidth="0.3"
          style={{ transition: ballTransitionCss }}
        />
      )}

      {/* ---- Event Overlays ---- */}
      {activeOverlays.map((overlay, idx) => {
        const age = now - overlay.createdAt;
        const fade = Math.max(0, 1 - age / OVERLAY_LIFETIME_MS);
        const ox = toSvgX(overlay.x);
        const oy = toSvgY(overlay.y);

        if (overlay.type === 'goal_flash') {
          return (
            <g key={`overlay-${idx}`} opacity={fade}>
              <circle
                cx={ox}
                cy={oy}
                r={8}
                fill="url(#goalFlash)"
              >
                <animate
                  attributeName="r"
                  values="4;10;4"
                  dur="0.8s"
                  repeatCount="3"
                />
              </circle>
              <text
                x={ox}
                y={oy - 5}
                textAnchor="middle"
                fill="#facc15"
                fontSize="4"
                fontWeight="bold"
                fontFamily="sans-serif"
                opacity={fade}
              >
                GOAL!
              </text>
            </g>
          );
        }

        if (overlay.type === 'yellow_card') {
          return (
            <g key={`overlay-${idx}`} opacity={fade}>
              <rect
                x={ox - 1}
                y={oy - 5}
                width="2"
                height="3"
                fill="#facc15"
                rx="0.3"
              />
            </g>
          );
        }

        if (overlay.type === 'red_card') {
          return (
            <g key={`overlay-${idx}`} opacity={fade}>
              <rect
                x={ox - 1}
                y={oy - 5}
                width="2"
                height="3"
                fill="#ef4444"
                rx="0.3"
              />
            </g>
          );
        }

        if (overlay.type === 'foul_marker') {
          return (
            <g key={`overlay-${idx}`} opacity={fade * 0.7}>
              <circle
                cx={ox}
                cy={oy}
                r={2}
                fill="none"
                stroke="#f59e0b"
                strokeWidth="0.4"
                strokeDasharray="0.8,0.4"
              />
            </g>
          );
        }

        return null;
      })}
    </svg>
  );
};

export default Pitch2D;
