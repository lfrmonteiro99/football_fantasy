import React from 'react';

// ---------------------------------------------------------------------------
// MatchClock — Large minute display with phase indicator
// ---------------------------------------------------------------------------

export interface MatchClockProps {
  minute: number;
  phase: string;
  isRunning: boolean;
}

/** Map simulation phase to display label */
function phaseLabel(phase: string): string {
  switch (phase) {
    case 'kickoff':
      return 'Kick Off';
    case 'half_time':
      return 'HT';
    case 'full_time':
      return 'FT';
    default: {
      // open_play, attack_home, attack_away, set_piece
      if (phase.includes('half_time')) return 'HT';
      if (phase.includes('full_time')) return 'FT';
      // Determine half from minute
      return ''; // Will be filled by the component
    }
  }
}

function halfLabel(minute: number, phase: string): string {
  const label = phaseLabel(phase);
  if (label) return label;
  if (minute <= 45) return '1st Half';
  return '2nd Half';
}

const MatchClock: React.FC<MatchClockProps> = ({
  minute,
  phase,
  isRunning,
}) => {
  const displayPhase = halfLabel(minute, phase);
  const isHalfTime = phase === 'half_time';
  const isFullTime = phase === 'full_time';

  // Determine clock text
  let clockText: string;
  if (isHalfTime) {
    clockText = 'HT';
  } else if (isFullTime) {
    clockText = 'FT';
  } else {
    clockText = `${minute}'`;
  }

  // Phase badge color
  let phaseColorClass = 'text-gray-400';
  if (isHalfTime) {
    phaseColorClass = 'text-amber-400';
  } else if (isFullTime) {
    phaseColorClass = 'text-red-400';
  }

  return (
    <div className="flex flex-col items-center justify-center py-3">
      {/* Main minute display */}
      <div className="relative">
        <span
          className={`text-5xl md:text-6xl font-extrabold tabular-nums ${
            isFullTime
              ? 'text-red-400'
              : isHalfTime
                ? 'text-amber-400'
                : 'text-white'
          }`}
        >
          {clockText}
        </span>

        {/* Pulsing dot when running */}
        {isRunning && !isHalfTime && !isFullTime && (
          <span className="absolute -top-1 -right-3 flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500" />
          </span>
        )}
      </div>

      {/* Phase label */}
      <span className={`mt-1 text-sm font-medium ${phaseColorClass}`}>
        {displayPhase}
      </span>
    </div>
  );
};

export default MatchClock;
