import type { TeamStats } from '../../api/tauri';

interface LiveStatsProps {
  home: TeamStats;
  away: TeamStats;
}

const statLabels: { key: keyof TeamStats; label: string }[] = [
  { key: 'possession_pct', label: 'Possession' },
  { key: 'shots', label: 'Shots' },
  { key: 'shots_on_target', label: 'On Target' },
  { key: 'corners', label: 'Corners' },
  { key: 'fouls', label: 'Fouls' },
  { key: 'yellow_cards', label: 'Yellows' },
  { key: 'saves', label: 'Saves' },
  { key: 'passes', label: 'Passes' },
  { key: 'tackles', label: 'Tackles' },
  { key: 'offsides', label: 'Offsides' },
];

export default function LiveStats({ home, away }: LiveStatsProps) {
  return (
    <div className="flex flex-col gap-2 px-1">
      {statLabels.map(({ key, label }) => {
        const hv = home[key];
        const av = away[key];
        const total = (hv + av) || 1;
        const hp = key === 'possession_pct' ? hv : (hv / total) * 100;
        const ap = key === 'possession_pct' ? av : (av / total) * 100;
        return (
          <div key={key} className="flex items-center gap-2">
            <span className="text-[11px] font-semibold text-white w-7 text-right tabular-nums">
              {key === 'possession_pct' ? `${Math.round(hv)}%` : hv}
            </span>
            <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden flex">
              <div className="h-full bg-brand-500 rounded-l-full transition-all duration-500" style={{ width: `${hp}%` }} />
              <div className="h-full bg-blue-500 rounded-r-full transition-all duration-500 ml-auto" style={{ width: `${ap}%` }} />
            </div>
            <span className="text-[11px] font-semibold text-white w-7 tabular-nums">
              {key === 'possession_pct' ? `${Math.round(av)}%` : av}
            </span>
          </div>
        );
      })}
      <div className="flex justify-between px-7">
        <span className="text-[9px] text-navy-500 uppercase tracking-wide">Home</span>
        <span className="text-[9px] text-navy-500 uppercase tracking-wide">Away</span>
      </div>
    </div>
  );
}
