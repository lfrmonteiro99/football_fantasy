import React from 'react';
import type { TeamMatchStats } from '../../types';

export interface LiveStatsProps {
  homeStats: TeamMatchStats;
  awayStats: TeamMatchStats;
  homeColor?: string;
  awayColor?: string;
}

interface StatRow {
  label: string;
  homeValue: number;
  awayValue: number;
  isPercentage?: boolean;
}

function buildRows(home: TeamMatchStats, away: TeamMatchStats): StatRow[] {
  return [
    {
      label: 'Possession',
      homeValue: home.possession_pct,
      awayValue: away.possession_pct,
      isPercentage: true,
    },
    { label: 'Shots', homeValue: home.shots, awayValue: away.shots },
    {
      label: 'On Target',
      homeValue: home.shots_on_target,
      awayValue: away.shots_on_target,
    },
    { label: 'Corners', homeValue: home.corners, awayValue: away.corners },
    { label: 'Fouls', homeValue: home.fouls, awayValue: away.fouls },
    { label: 'Passes', homeValue: home.passes, awayValue: away.passes },
    { label: 'Tackles', homeValue: home.tackles, awayValue: away.tackles },
    { label: 'Saves', homeValue: home.saves, awayValue: away.saves },
    { label: 'Offsides', homeValue: home.offsides, awayValue: away.offsides },
    {
      label: 'Yellow Cards',
      homeValue: home.yellow_cards,
      awayValue: away.yellow_cards,
    },
    {
      label: 'Red Cards',
      homeValue: home.red_cards,
      awayValue: away.red_cards,
    },
  ];
}

function barPct(homeVal: number, awayVal: number, side: 'home' | 'away'): number {
  const total = homeVal + awayVal;
  if (total === 0) return 50;
  const val = side === 'home' ? homeVal : awayVal;
  return Math.round((val / total) * 100);
}

const StatBar: React.FC<{
  row: StatRow;
  homeColor: string;
  awayColor: string;
}> = ({ row, homeColor, awayColor }) => {
  const homePct = barPct(row.homeValue, row.awayValue, 'home');
  const awayPct = barPct(row.homeValue, row.awayValue, 'away');

  const homeDisplay = row.isPercentage
    ? `${row.homeValue}%`
    : String(row.homeValue);
  const awayDisplay = row.isPercentage
    ? `${row.awayValue}%`
    : String(row.awayValue);

  return (
    <div className="mb-3">
      <div className="flex items-center justify-between mb-1">
        <span className="text-body-sm font-semibold text-white tabular-nums w-10 text-left">
          {homeDisplay}
        </span>
        <span className="text-caption text-gray-400 uppercase tracking-wide">
          {row.label}
        </span>
        <span className="text-body-sm font-semibold text-white tabular-nums w-10 text-right">
          {awayDisplay}
        </span>
      </div>

      <div className="flex h-2.5 rounded-full overflow-hidden bg-gray-700/50 gap-0.5">
        <div
          className="rounded-l-full transition-all duration-500 ease-out"
          style={{
            width: `${homePct}%`,
            backgroundColor: homeColor,
          }}
        />
        <div
          className="rounded-r-full transition-all duration-500 ease-out"
          style={{
            width: `${awayPct}%`,
            backgroundColor: awayColor,
          }}
        />
      </div>
    </div>
  );
};

const LiveStats: React.FC<LiveStatsProps> = ({
  homeStats,
  awayStats,
  homeColor = '#3b82f6',
  awayColor = '#ef4444',
}) => {
  const rows = buildRows(homeStats, awayStats);

  return (
    <div className="bg-gray-800/80 rounded-xl border border-gray-700/40 p-4">
      <h3 className="text-overline text-gray-400 uppercase tracking-wider mb-3">
        Match Statistics
      </h3>
      {rows.map((row) => (
        <StatBar
          key={row.label}
          row={row}
          homeColor={homeColor}
          awayColor={awayColor}
        />
      ))}
    </div>
  );
};

export default LiveStats;
