import React, { useState, useCallback, useRef } from 'react';
import type { SquadPlayer } from '../../types';
import { POSITION_COLORS } from '../../utils/constants';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface PitchPosition {
  position: string;
  x: number; // 0-100: depth (0 = own goal line, 100 = opponent goal)
  y: number; // 0-100: width (0 = left touchline, 100 = right touchline)
  playerId?: number;
  playerName?: string;
}

interface PitchEditorProps {
  positions: PitchPosition[];
  availablePlayers: SquadPlayer[];
  onPositionChange: (index: number, x: number, y: number) => void;
  onPlayerAssign: (positionIndex: number, playerId: number) => void;
  onPositionSelect?: (index: number | null) => void;
  className?: string;
}

// ---------------------------------------------------------------------------
// Vertical half-pitch dimensions (SVG viewBox)
//
//   Real half-pitch: 68m wide × 52.5m deep.
//   We add ~3.5m below the goal line for the net graphic.
//   ViewBox: 0 0 68 56
//
//   Orientation:  midfield at top (y ≈ 0), own goal at bottom (y = 52.5)
//   Mapping:      formation x (width 0-100)  → SVG x (horizontal)
//                 formation y (depth 0-100)   → SVG y (inverted)
// ---------------------------------------------------------------------------

const VP_W = 68;
const VP_H = 56;
const GOAL_LINE_Y = 52.5; // real half-pitch depth
const CENTER_X = VP_W / 2; // 34
const DOT_RADIUS = 2.6;
const MARGIN = 2;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const PitchEditor: React.FC<PitchEditorProps> = ({
  positions,
  availablePlayers,
  onPositionChange,
  onPlayerAssign,
  onPositionSelect,
  className = '',
}) => {
  const [dragging, setDragging] = useState<number | null>(null);
  const [selectedPosition, setSelectedPosition] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  // --- Coordinate conversion ---
  // Formation coords (0-100) ↔ SVG coords on the vertical half-pitch

  const formationToSvg = useCallback(
    (posX: number, posY: number): { svgX: number; svgY: number } => ({
      svgX: (posX / 100) * VP_W,                        // x = horizontal spread → SVG x
      svgY: GOAL_LINE_Y - (posY / 100) * GOAL_LINE_Y,   // y = depth from goal → SVG y (inverted)
    }),
    [],
  );

  const svgToFormation = useCallback(
    (svgX: number, svgY: number): { x: number; y: number } => ({
      x: Math.max(MARGIN, Math.min(100 - MARGIN, (svgX / VP_W) * 100)),
      y: Math.max(MARGIN, Math.min(100 - MARGIN, ((GOAL_LINE_Y - svgY) / GOAL_LINE_Y) * 100)),
    }),
    [],
  );

  // Convert client (mouse) coordinates to SVG coordinates
  const clientToSvg = useCallback(
    (clientX: number, clientY: number): { x: number; y: number } | null => {
      const svg = svgRef.current;
      if (!svg) return null;
      const pt = svg.createSVGPoint();
      pt.x = clientX;
      pt.y = clientY;
      const ctm = svg.getScreenCTM();
      if (!ctm) return null;
      const svgPt = pt.matrixTransform(ctm.inverse());
      return svgToFormation(svgPt.x, svgPt.y);
    },
    [svgToFormation],
  );

  const handleMouseDown = useCallback(
    (index: number, e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDragging(index);
    },
    [],
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      if (dragging === null) return;
      const pt = clientToSvg(e.clientX, e.clientY);
      if (pt) {
        onPositionChange(dragging, pt.x, pt.y);
      }
    },
    [dragging, clientToSvg, onPositionChange],
  );

  const handleMouseUp = useCallback(() => {
    setDragging(null);
  }, []);

  const handlePositionClick = useCallback(
    (index: number, e: React.MouseEvent) => {
      if (dragging !== null) return;
      e.stopPropagation();
      setSelectedPosition((prev) => {
        const next = prev === index ? null : index;
        onPositionSelect?.(next);
        return next;
      });
    },
    [dragging, onPositionSelect],
  );

  const handlePitchClick = useCallback(() => {
    if (dragging === null) {
      setSelectedPosition(null);
      onPositionSelect?.(null);
    }
  }, [dragging, onPositionSelect]);

  const getPositionColor = (pos: string): string => {
    return POSITION_COLORS[pos] || '#6b7280';
  };

  return (
    <div className={className}>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${VP_W} ${VP_H}`}
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-auto select-none"
        style={{ maxHeight: '100%' }}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onClick={handlePitchClick}
      >
        {/* ---- Background ---- */}
        <rect x="0" y="0" width={VP_W} height={VP_H} fill="#1a472a" rx="1" />

        {/* Grass stripes (horizontal on this vertical pitch) */}
        {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
          <rect
            key={`stripe-${i}`}
            x="0"
            y={i * 7}
            width={VP_W}
            height={7}
            fill={i % 2 === 0 ? '#1f5432' : '#236138'}
            opacity="0.6"
          />
        ))}

        {/* ---- Pitch markings ---- */}
        <g stroke="rgba(255,255,255,0.75)" strokeWidth="0.25" fill="none">
          {/* Playing area boundary */}
          <rect x="0" y="0" width={VP_W} height={GOAL_LINE_Y} />

          {/* Midfield line (top edge of half-pitch) */}
          <line x1="0" y1="0" x2={VP_W} y2="0" strokeWidth="0.35" />

          {/* Half center circle (arc going downward from midfield) */}
          <path d={`M ${CENTER_X - 9.15} 0 A 9.15 9.15 0 0 1 ${CENTER_X + 9.15} 0`} />

          {/* Center spot on midfield line */}
          <circle cx={CENTER_X} cy="0" r="0.35" fill="rgba(255,255,255,0.75)" />

          {/* Penalty area: 16.5m deep, 40.3m wide */}
          <rect
            x={CENTER_X - 20.15}
            y={GOAL_LINE_Y - 16.5}
            width={40.3}
            height={16.5}
          />

          {/* Goal area: 5.5m deep, 18.32m wide */}
          <rect
            x={CENTER_X - 9.16}
            y={GOAL_LINE_Y - 5.5}
            width={18.32}
            height={5.5}
          />

          {/* Penalty spot: 11m from goal line */}
          <circle cx={CENTER_X} cy={GOAL_LINE_Y - 11} r="0.35" fill="rgba(255,255,255,0.75)" />

          {/* Penalty arc (above penalty area box) */}
          <path
            d={`M ${CENTER_X - 8.7} ${GOAL_LINE_Y - 16.5} A 9.15 9.15 0 0 1 ${CENTER_X + 8.7} ${GOAL_LINE_Y - 16.5}`}
          />

          {/* Corner arcs (bottom corners of the half-pitch) */}
          <path d={`M 0 ${GOAL_LINE_Y - 1} A 1 1 0 0 0 1 ${GOAL_LINE_Y}`} />
          <path d={`M ${VP_W} ${GOAL_LINE_Y - 1} A 1 1 0 0 1 ${VP_W - 1} ${GOAL_LINE_Y}`} />

          {/* Goal (below goal line) */}
          <rect
            x={CENTER_X - 3.66}
            y={GOAL_LINE_Y}
            width={7.32}
            height={2.2}
            strokeWidth="0.2"
            opacity="0.5"
          />
        </g>

        {/* ---- Goal net texture ---- */}
        <g opacity="0.15" stroke="white" strokeWidth="0.1">
          {[0, 1, 2, 3, 4, 5, 6].map((i) => (
            <line
              key={`net-v-${i}`}
              x1={CENTER_X - 3.66 + i * 1.22}
              y1={GOAL_LINE_Y}
              x2={CENTER_X - 3.66 + i * 1.22}
              y2={GOAL_LINE_Y + 2.2}
            />
          ))}
          {[0, 1, 2].map((i) => (
            <line
              key={`net-h-${i}`}
              x1={CENTER_X - 3.66}
              y1={GOAL_LINE_Y + i * 0.73}
              x2={CENTER_X + 3.66}
              y2={GOAL_LINE_Y + i * 0.73}
            />
          ))}
        </g>

        {/* ---- Position dots ---- */}
        {positions.map((pos, idx) => {
          const { svgX, svgY } = formationToSvg(pos.x, pos.y);
          const color = getPositionColor(pos.position);
          const isActive = dragging === idx;
          const isSelected = selectedPosition === idx;
          const displayName = pos.playerName
            ? pos.playerName.split(' ').pop()
            : pos.position;

          return (
            <g
              key={idx}
              style={{
                cursor: isActive ? 'grabbing' : 'grab',
                transform: `translate(${svgX}px, ${svgY}px)`,
                transition: isActive ? 'none' : 'transform 0.15s ease-out',
              }}
              onMouseDown={(e) => handleMouseDown(idx, e)}
              onClick={(e) => handlePositionClick(idx, e)}
            >
              {/* Selection ring */}
              {isSelected && (
                <circle
                  cx={0}
                  cy={0}
                  r={DOT_RADIUS + 1.2}
                  fill="none"
                  stroke="#22c55e"
                  strokeWidth="0.5"
                  strokeDasharray="1.5 0.8"
                >
                  <animate
                    attributeName="stroke-dashoffset"
                    values="0;4.6"
                    dur="1s"
                    repeatCount="indefinite"
                  />
                </circle>
              )}

              {/* Shadow */}
              <circle
                cx={0.3}
                cy={0.3}
                r={DOT_RADIUS}
                fill="rgba(0,0,0,0.3)"
              />

              {/* Player dot */}
              <circle
                cx={0}
                cy={0}
                r={DOT_RADIUS}
                fill={color}
                stroke="white"
                strokeWidth={isActive ? '0.5' : '0.3'}
                opacity={0.95}
              />

              {/* Position abbreviation */}
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
                {pos.position}
              </text>

              {/* Player name below */}
              <text
                x={0}
                y={DOT_RADIUS + 2.2}
                textAnchor="middle"
                fill="white"
                fontSize="1.7"
                fontFamily="sans-serif"
                opacity={0.9}
                fontWeight="600"
                style={{ pointerEvents: 'none' }}
              >
                {displayName}
              </text>
            </g>
          );
        })}
      </svg>

      {/* Selected position indicator */}
      {selectedPosition !== null && (
        <div className="mt-2 p-2 bg-green-50 border border-green-200 rounded-lg text-sm text-green-800">
          <span className="font-medium">
            {positions[selectedPosition]?.position}
          </span>
          {' '} &mdash; Click a player below to assign them to this position.
          {positions[selectedPosition]?.playerName && (
            <span className="text-gray-600 ml-1">
              (Current: {positions[selectedPosition].playerName})
            </span>
          )}
        </div>
      )}
    </div>
  );
};

export default PitchEditor;
