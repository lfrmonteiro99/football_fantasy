import React, { useState, useCallback, useRef } from 'react';
import type { SquadPlayer } from '../../types';
import { POSITION_COLORS } from '../../utils/constants';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface PitchPosition {
  position: string;
  x: number;
  y: number;
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
// Pitch dimensions (SVG viewBox)
// ---------------------------------------------------------------------------

const PITCH_W = 105;
const PITCH_H = 68;
const DOT_RADIUS = 2.4;
const MARGIN = 1;

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

  // Convert client coordinates to SVG coordinates
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
      // Convert SVG coords (0-105, 0-68) to normalized (0-100)
      const nx = Math.max(MARGIN, Math.min(100 - MARGIN, (svgPt.x / PITCH_W) * 100));
      const ny = Math.max(MARGIN, Math.min(100 - MARGIN, (svgPt.y / PITCH_H) * 100));
      return { x: nx, y: ny };
    },
    [],
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
      // Only treat as a click if we didn't just finish dragging
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

  // Map normalized x/y (0-100) to SVG coordinates
  const toSvgX = (v: number) => (v / 100) * PITCH_W;
  const toSvgY = (v: number) => (v / 100) * PITCH_H;

  const getPositionColor = (pos: string): string => {
    return POSITION_COLORS[pos] || '#6b7280';
  };

  return (
    <div className={className}>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${PITCH_W} ${PITCH_H}`}
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-auto select-none"
        style={{ maxHeight: '100%' }}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onClick={handlePitchClick}
      >
        {/* ---- Pitch background ---- */}
        <rect x="0" y="0" width={PITCH_W} height={PITCH_H} fill="#2d6a2e" rx="1" />

        {/* Grass stripes */}
        {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) => (
          <rect
            key={`stripe-${i}`}
            x={i * 10.5}
            y="0"
            width="10.5"
            height={PITCH_H}
            fill={i % 2 === 0 ? '#2d6a2e' : '#327334'}
            opacity="0.5"
          />
        ))}

        {/* ---- Pitch markings ---- */}
        <g stroke="white" strokeWidth="0.3" fill="none" opacity="0.85">
          <rect x="0" y="0" width={PITCH_W} height={PITCH_H} />
          {/* Halfway line */}
          <line x1="52.5" y1="0" x2="52.5" y2={PITCH_H} />
          {/* Centre circle */}
          <circle cx="52.5" cy="34" r="9.15" />
          <circle cx="52.5" cy="34" r="0.4" fill="white" />
          {/* Left penalty area */}
          <rect x="0" y={34 - 20.15} width="16.5" height="40.3" />
          <rect x="0" y={34 - 9.16} width="5.5" height="18.32" />
          <circle cx="11" cy="34" r="0.4" fill="white" />
          <path d={`M 16.5 ${34 - 8.7} A 9.15 9.15 0 0 1 16.5 ${34 + 8.7}`} />
          {/* Right penalty area */}
          <rect x={PITCH_W - 16.5} y={34 - 20.15} width="16.5" height="40.3" />
          <rect x={PITCH_W - 5.5} y={34 - 9.16} width="5.5" height="18.32" />
          <circle cx="94" cy="34" r="0.4" fill="white" />
          <path d={`M ${PITCH_W - 16.5} ${34 - 8.7} A 9.15 9.15 0 0 0 ${PITCH_W - 16.5} ${34 + 8.7}`} />
          {/* Corner arcs */}
          <path d="M 0 1 A 1 1 0 0 0 1 0" />
          <path d="M 0 67 A 1 1 0 0 1 1 68" />
          <path d="M 105 1 A 1 1 0 0 1 104 0" />
          <path d="M 105 67 A 1 1 0 0 0 104 68" />
          {/* Goals */}
          <rect x="-2" y={34 - 3.66} width="2" height="7.32" strokeWidth="0.2" opacity="0.5" />
          <rect x={PITCH_W} y={34 - 3.66} width="2" height="7.32" strokeWidth="0.2" opacity="0.5" />
        </g>

        {/* ---- Position dots ---- */}
        {positions.map((pos, idx) => {
          const cx = toSvgX(pos.x);
          const cy = toSvgY(pos.y);
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
                transform: `translate(${cx}px, ${cy}px)`,
              }}
              onMouseDown={(e) => handleMouseDown(idx, e)}
              onClick={(e) => handlePositionClick(idx, e)}
            >
              {/* Selection ring */}
              {isSelected && (
                <circle
                  cx={0}
                  cy={0}
                  r={DOT_RADIUS + 1}
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

              {/* Dot background */}
              <circle
                cx={0}
                cy={0}
                r={DOT_RADIUS}
                fill={color}
                stroke="white"
                strokeWidth={isActive ? '0.5' : '0.3'}
                opacity={0.95}
              />

              {/* Position label */}
              <text
                x={0}
                y={0.6}
                textAnchor="middle"
                fill="white"
                fontSize="1.8"
                fontWeight="bold"
                fontFamily="sans-serif"
                style={{ pointerEvents: 'none' }}
              >
                {pos.position}
              </text>

              {/* Player name below */}
              <text
                x={0}
                y={DOT_RADIUS + 2}
                textAnchor="middle"
                fill="white"
                fontSize="1.5"
                fontFamily="sans-serif"
                opacity={0.85}
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
