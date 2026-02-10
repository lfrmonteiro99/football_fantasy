import React from 'react';
import type { SquadPlayer, PositionCategory } from '../../types';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface PlayerCardProps {
  player: SquadPlayer;
  isSelected?: boolean;
  isAssigned?: boolean;
  onClick?: () => void;
  size?: 'sm' | 'md';
}

// ---------------------------------------------------------------------------
// Position badge colors
// ---------------------------------------------------------------------------

const POS_BADGE: Record<PositionCategory, string> = {
  goalkeeper: 'bg-amber-100 text-amber-800',
  defender: 'bg-blue-100 text-blue-800',
  midfielder: 'bg-emerald-100 text-emerald-800',
  forward: 'bg-red-100 text-red-800',
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const PlayerCard: React.FC<PlayerCardProps> = ({
  player,
  isSelected = false,
  isAssigned = false,
  onClick,
  size = 'md',
}) => {
  const posCategory = player.position?.category ?? 'midfielder';
  const badgeClass = POS_BADGE[posCategory] || 'bg-gray-100 text-gray-800';

  const isSm = size === 'sm';
  const abilityPct = player.current_ability <= 1
    ? player.current_ability * 100
    : Math.min(player.current_ability, 100);

  const abilityColor =
    abilityPct >= 75 ? 'bg-green-500' : abilityPct >= 50 ? 'bg-yellow-500' : 'bg-red-500';

  return (
    <div
      onClick={onClick}
      className={`
        flex items-center gap-2 rounded-xl border transition-all duration-150 cursor-pointer
        ${isSm ? 'px-2 py-1.5' : 'px-3 py-2'}
        ${isSelected
          ? 'border-brand-500 bg-brand-50 ring-2 ring-brand-300'
          : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-card'}
        ${isAssigned ? 'opacity-50' : ''}
      `}
    >
      {/* Shirt number circle */}
      <div
        className={`
          flex items-center justify-center rounded-full bg-gray-700 text-white font-bold flex-shrink-0
          ${isSm ? 'w-6 h-6 text-xs' : 'w-8 h-8 text-sm'}
        `}
      >
        {player.shirt_number ?? '-'}
      </div>

      {/* Name + position */}
      <div className="flex-1 min-w-0">
        <div className={`font-medium text-gray-900 truncate ${isSm ? 'text-caption' : 'text-body-sm'}`}>
          {player.full_name}
        </div>
        <div className="flex items-center gap-1.5">
          <span
            className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium ${badgeClass}`}
          >
            {player.position?.short_name ?? '??'}
          </span>
          {/* Mini ability bar */}
          <div className={`h-1.5 rounded-full bg-gray-200 overflow-hidden ${isSm ? 'w-10' : 'w-14'}`}>
            <div
              className={`h-full rounded-full ${abilityColor}`}
              style={{ width: `${abilityPct}%` }}
            />
          </div>
        </div>
      </div>

      {/* Injured badge */}
      {player.is_injured && (
        <span className="inline-flex items-center px-1 py-0.5 rounded text-xs font-bold bg-red-100 text-red-700 flex-shrink-0">
          INJ
        </span>
      )}
    </div>
  );
};

export default PlayerCard;
