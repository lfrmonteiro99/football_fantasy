import React from 'react';

// ---------------------------------------------------------------------------
// ScoreBar — Horizontal match score header
// ---------------------------------------------------------------------------

export interface ScoreBarProps {
  homeTeam: string;
  awayTeam: string;
  homeScore: number;
  awayScore: number;
  homeFormation?: string;
  awayFormation?: string;
  homeColor?: string;
  awayColor?: string;
}

const ScoreBar: React.FC<ScoreBarProps> = ({
  homeTeam,
  awayTeam,
  homeScore,
  awayScore,
  homeFormation,
  awayFormation,
  homeColor = '#3b82f6',
  awayColor = '#ef4444',
}) => {
  return (
    <div className="bg-gray-900 rounded-lg px-6 py-4 shadow-lg">
      <div className="flex items-center justify-between">
        {/* Home team */}
        <div className="flex-1 text-right">
          <h2
            className="text-xl md:text-2xl font-bold truncate"
            style={{ color: homeColor }}
          >
            {homeTeam}
          </h2>
          {homeFormation && (
            <p className="text-sm text-gray-400 mt-0.5">({homeFormation})</p>
          )}
        </div>

        {/* Score */}
        <div className="flex-shrink-0 mx-6 md:mx-10 text-center">
          <div className="flex items-center gap-3">
            <span className="text-4xl md:text-5xl font-extrabold text-white tabular-nums">
              {homeScore}
            </span>
            <span className="text-2xl md:text-3xl font-light text-gray-500">
              -
            </span>
            <span className="text-4xl md:text-5xl font-extrabold text-white tabular-nums">
              {awayScore}
            </span>
          </div>
        </div>

        {/* Away team */}
        <div className="flex-1 text-left">
          <h2
            className="text-xl md:text-2xl font-bold truncate"
            style={{ color: awayColor }}
          >
            {awayTeam}
          </h2>
          {awayFormation && (
            <p className="text-sm text-gray-400 mt-0.5">({awayFormation})</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default ScoreBar;
