interface ScoreBarProps {
  homeTeam: string;
  awayTeam: string;
  homeScore: number;
  awayScore: number;
  homeColor?: string;
  awayColor?: string;
  homeFormation?: string;
  awayFormation?: string;
  minute?: number;
  phase?: string;
}

export default function ScoreBar({
  homeTeam, awayTeam, homeScore, awayScore,
  homeColor = '#16a34a', awayColor = '#345084',
  homeFormation, awayFormation, minute, phase,
}: ScoreBarProps) {
  return (
    <div className="flex items-center justify-between px-4 py-2 bg-navy-900/80 backdrop-blur-sm">
      {/* Home */}
      <div className="flex-1 text-left">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: homeColor }} />
          <span className="text-xs font-bold text-white truncate max-w-[80px]">{homeTeam}</span>
        </div>
        {homeFormation && <span className="text-[10px] text-navy-400 ml-5">{homeFormation}</span>}
      </div>

      {/* Score */}
      <div className="flex flex-col items-center mx-4">
        <div className="flex items-center gap-2">
          <span className="text-2xl font-extrabold text-white animate-score-pop">{homeScore}</span>
          <span className="text-lg text-navy-500">-</span>
          <span className="text-2xl font-extrabold text-white animate-score-pop">{awayScore}</span>
        </div>
        {minute !== undefined && (
          <div className="flex items-center gap-1.5 mt-0.5">
            {phase !== 'full_time' && phase !== 'half_time' && (
              <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse-soft" />
            )}
            <span className="text-[10px] font-semibold text-navy-400">
              {phase === 'full_time' ? 'FT' : phase === 'half_time' ? 'HT' : `${minute}'`}
            </span>
          </div>
        )}
      </div>

      {/* Away */}
      <div className="flex-1 text-right">
        <div className="flex items-center gap-2 justify-end">
          <span className="text-xs font-bold text-white truncate max-w-[80px]">{awayTeam}</span>
          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: awayColor }} />
        </div>
        {awayFormation && <span className="text-[10px] text-navy-400 mr-5">{awayFormation}</span>}
      </div>
    </div>
  );
}

export type { ScoreBarProps };
