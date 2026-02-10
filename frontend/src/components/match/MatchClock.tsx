import React from 'react';

export interface MatchClockProps {
  minute: number;
  phase: string;
  isRunning: boolean;
}

function phaseLabel(phase: string): string {
  switch (phase) {
    case 'kickoff':
      return 'Kick Off';
    case 'half_time':
      return 'HT';
    case 'full_time':
      return 'FT';
    default: {
      if (phase.includes('half_time')) return 'HT';
      if (phase.includes('full_time')) return 'FT';
      return '';
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

  let clockText: string;
  if (isHalfTime) {
    clockText = 'HT';
  } else if (isFullTime) {
    clockText = 'FT';
  } else {
    clockText = `${minute}'`;
  }

  let phaseColorClass = 'text-gray-400';
  if (isHalfTime) {
    phaseColorClass = 'text-amber-400';
  } else if (isFullTime) {
    phaseColorClass = 'text-red-400';
  }

  return (
    <div className="flex flex-col items-center justify-center py-4">
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

        {isRunning && !isHalfTime && !isFullTime && (
          <span className="absolute -top-1 -right-3 flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500" />
          </span>
        )}
      </div>

      <span className={`mt-1 text-body font-medium ${phaseColorClass}`}>
        {displayPhase}
      </span>
    </div>
  );
};

export default MatchClock;
