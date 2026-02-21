interface Pitch2DPlayer {
  id: number;
  name: string;
  shirtNumber: number;
  x: number; // 0-100
  y: number; // 0-68
  team: 'home' | 'away';
  position?: string;
}

interface Pitch2DProps {
  players?: Pitch2DPlayer[];
  ball?: { x: number; y: number } | null;
  animated?: boolean;
  compact?: boolean;
  homeColor?: string;
  awayColor?: string;
  onPlayerTap?: (player: Pitch2DPlayer) => void;
}

export default function Pitch2D({
  players = [],
  ball,
  animated = false,
  compact = false,
  homeColor = '#16a34a',
  awayColor = '#345084',
  onPlayerTap,
}: Pitch2DProps) {
  const h = compact ? 160 : 220;

  return (
    <div className="w-full" style={{ height: `${h}px` }}>
      <svg
        viewBox="0 0 105 68"
        className="w-full h-full"
        preserveAspectRatio="xMidYMid meet"
        style={{ filter: 'drop-shadow(0 2px 8px rgba(0,0,0,0.3))' }}
      >
        {/* Pitch background with stripes */}
        <defs>
          <pattern id="grass" width="10.5" height="68" patternUnits="userSpaceOnUse">
            <rect width="5.25" height="68" fill="#2d8a4e" />
            <rect x="5.25" width="5.25" height="68" fill="#278a47" />
          </pattern>
        </defs>
        <rect x="0" y="0" width="105" height="68" fill="url(#grass)" rx="1" />

        {/* Pitch markings */}
        <g stroke="rgba(255,255,255,0.35)" strokeWidth="0.3" fill="none">
          {/* Outline */}
          <rect x="0.5" y="0.5" width="104" height="67" rx="0.5" />
          {/* Halfway line */}
          <line x1="52.5" y1="0.5" x2="52.5" y2="67.5" />
          {/* Center circle */}
          <circle cx="52.5" cy="34" r="9.15" />
          <circle cx="52.5" cy="34" r="0.5" fill="rgba(255,255,255,0.4)" />
          {/* Penalty areas */}
          <rect x="0.5" y="13.85" width="16.5" height="40.3" />
          <rect x="88" y="13.85" width="16.5" height="40.3" />
          {/* Goal areas */}
          <rect x="0.5" y="24.85" width="5.5" height="18.3" />
          <rect x="99" y="24.85" width="5.5" height="18.3" />
          {/* Penalty spots */}
          <circle cx="11" cy="34" r="0.4" fill="rgba(255,255,255,0.4)" />
          <circle cx="94" cy="34" r="0.4" fill="rgba(255,255,255,0.4)" />
          {/* Corner arcs */}
          <path d="M 0.5 2.5 A 2 2 0 0 1 2.5 0.5" />
          <path d="M 102.5 0.5 A 2 2 0 0 1 104.5 2.5" />
          <path d="M 0.5 65.5 A 2 2 0 0 0 2.5 67.5" />
          <path d="M 104.5 65.5 A 2 2 0 0 1 102.5 67.5" />
          {/* Goals */}
          <rect x="-1.5" y="29.5" width="2" height="9" stroke="rgba(255,255,255,0.5)" strokeWidth="0.4" />
          <rect x="104.5" y="29.5" width="2" height="9" stroke="rgba(255,255,255,0.5)" strokeWidth="0.4" />
        </g>

        {/* Players */}
        {players.map((p) => {
          const color = p.team === 'home' ? homeColor : awayColor;
          const px = (p.x / 100) * 105;
          const py = (p.y / 68) * 68;
          return (
            <g
              key={p.id}
              style={animated ? { transition: 'transform 0.4s ease-out' } : undefined}
              transform={`translate(${px}, ${py})`}
              onClick={() => onPlayerTap?.(p)}
            >
              {/* Shadow */}
              <ellipse cx="0" cy="1.2" rx="2" ry="0.6" fill="rgba(0,0,0,0.3)" />
              {/* Body */}
              <circle cx="0" cy="0" r="2.2" fill={color} stroke="rgba(255,255,255,0.6)" strokeWidth="0.3" />
              {/* Number */}
              <text
                x="0" y="0.7"
                textAnchor="middle"
                fontSize="2.2"
                fontWeight="700"
                fill="white"
                style={{ pointerEvents: 'none' }}
              >
                {p.shirtNumber}
              </text>
            </g>
          );
        })}

        {/* Ball */}
        {ball && (
          <g style={animated ? { transition: 'transform 0.3s ease-out' } : undefined}
             transform={`translate(${(ball.x / 100) * 105}, ${(ball.y / 68) * 68})`}>
            <circle cx="0" cy="0.8" rx="1" ry="0.5" fill="rgba(0,0,0,0.3)" />
            <circle cx="0" cy="0" r="1" fill="white" stroke="#333" strokeWidth="0.15" />
          </g>
        )}
      </svg>
    </div>
  );
}

export type { Pitch2DPlayer, Pitch2DProps };
