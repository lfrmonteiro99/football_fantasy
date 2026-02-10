import React, { useEffect, useState } from 'react';
import { getPlayerAttributes } from '../../api/endpoints';
import type { PlayerAttributesByCategory, Player } from '../../types';
import { formatCurrency } from '../../utils/helpers';
import AttributeRadar from './AttributeRadar';
import Spinner from '../common/Spinner';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface PlayerDetailProps {
  playerId: number;
  onClose: () => void;
}

// ---------------------------------------------------------------------------
// Attribute category config
// ---------------------------------------------------------------------------

interface AttrCategory {
  label: string;
  keys: string[];
}

const ATTRIBUTE_CATEGORIES: AttrCategory[] = [
  {
    label: 'Technical',
    keys: [
      'finishing',
      'first_touch',
      'heading',
      'long_shots',
      'passing',
      'technique',
      'dribbling',
      'crossing',
      'free_kick_taking',
      'corners',
      'penalty_taking',
    ],
  },
  {
    label: 'Mental',
    keys: [
      'composure',
      'vision',
      'decisions',
      'anticipation',
      'positioning',
      'concentration',
      'leadership',
      'aggression',
      'work_rate',
      'determination',
      'teamwork',
      'flair',
      'off_the_ball',
      'bravery',
    ],
  },
  {
    label: 'Physical',
    keys: [
      'pace',
      'acceleration',
      'stamina',
      'strength',
      'agility',
      'jumping_reach',
      'balance',
      'natural_fitness',
    ],
  },
  {
    label: 'Goalkeeping',
    keys: [
      'reflexes',
      'handling',
      'command_of_area',
      'aerial_reach',
      'kicking',
      'one_on_ones',
      'throwing',
      'rushing_out',
    ],
  },
];

// ---------------------------------------------------------------------------
// Attribute bar coloring
// ---------------------------------------------------------------------------

function attrBarColor(value: number): string {
  if (value >= 15) return 'bg-green-500';
  if (value >= 10) return 'bg-yellow-500';
  return 'bg-red-500';
}

function attrTextColor(value: number): string {
  if (value >= 15) return 'text-green-700';
  if (value >= 10) return 'text-yellow-700';
  return 'text-red-700';
}

function formatAttrName(key: string): string {
  return key
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const PlayerDetail: React.FC<PlayerDetailProps> = ({ playerId, onClose }) => {
  const [data, setData] = useState<PlayerAttributesByCategory | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    getPlayerAttributes(playerId)
      .then((result) => {
        if (!cancelled) {
          setData(result);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err?.response?.data?.message || err.message || 'Failed to load player');
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [playerId]);

  // Merge all attributes into a flat map for the radar
  const allAttrs: Record<string, number> = data
    ? { ...data.technical, ...data.mental, ...data.physical, ...data.goalkeeping }
    : {};

  const player: Player | undefined = data?.player;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Overlay */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Slide-out panel */}
      <div className="relative w-full max-w-lg bg-white shadow-modal overflow-y-auto animate-slide-in-right">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-lg hover:bg-gray-100 text-gray-500 z-10 transition-colors duration-150"
          aria-label="Close"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {loading && (
          <div className="flex items-center justify-center h-64">
            <Spinner color="brand" />
          </div>
        )}

        {error && (
          <div className="p-6 text-center text-red-600">
            <p className="font-medium">Error loading player</p>
            <p className="text-body-sm mt-1">{error}</p>
          </div>
        )}

        {data && player && (
          <div className="p-6">
            {/* Header */}
            <div className="mb-6">
              <div className="flex items-center gap-3 mb-2">
                {player.shirt_number != null && (
                  <span className="flex items-center justify-center w-10 h-10 rounded-xl bg-brand-600 text-white text-lg font-bold">
                    {player.shirt_number}
                  </span>
                )}
                <div>
                  <h2 className="text-heading-2 text-gray-900">
                    {player.full_name}
                  </h2>
                  <p className="text-body-sm text-gray-500">
                    {player.primary_position?.name ?? 'Unknown Position'}
                    {player.team?.name ? ` \u2022 ${player.team.name}` : ''}
                  </p>
                </div>
              </div>

              {/* Overall ratings */}
              <div className="flex gap-4 mt-3">
                <div className="px-3 py-1.5 bg-brand-50 rounded-xl text-center">
                  <div className="text-caption text-gray-500">Current</div>
                  <div className="text-lg font-bold text-brand-700">
                    {data.overall_ratings.current_ability}
                  </div>
                </div>
                <div className="px-3 py-1.5 bg-blue-50 rounded-xl text-center">
                  <div className="text-caption text-gray-500">Potential</div>
                  <div className="text-lg font-bold text-blue-700">
                    {data.overall_ratings.potential_ability}
                  </div>
                </div>
              </div>
            </div>

            {/* Info grid */}
            <div className="grid grid-cols-3 gap-3 mb-6">
              {[
                { label: 'Age', value: player.age },
                { label: 'Height', value: `${player.height_cm} cm` },
                { label: 'Weight', value: `${player.weight_kg} kg` },
                { label: 'Nationality', value: player.nationality },
                { label: 'Foot', value: player.preferred_foot.charAt(0).toUpperCase() + player.preferred_foot.slice(1) },
                { label: 'Value', value: formatCurrency(player.market_value) },
              ].map((item) => (
                <div key={item.label} className="bg-gray-50 rounded-xl px-3 py-2">
                  <div className="text-caption text-gray-500">{item.label}</div>
                  <div className="text-body-sm font-medium text-gray-900">{item.value}</div>
                </div>
              ))}
            </div>

            {/* Radar chart */}
            <div className="mb-6">
              <h3 className="text-body-sm font-semibold text-gray-700 mb-2">
                Key Attributes
              </h3>
              <div className="flex justify-center">
                <AttributeRadar
                  attributes={allAttrs}
                  positionCategory={player.primary_position?.category}
                  size={280}
                />
              </div>
            </div>

            {/* Attribute tables grouped by category */}
            {ATTRIBUTE_CATEGORIES.map((cat) => {
              const catMap =
                cat.label === 'Technical'
                  ? data.technical
                  : cat.label === 'Mental'
                  ? data.mental
                  : cat.label === 'Physical'
                  ? data.physical
                  : data.goalkeeping;

              // Only show categories with data
              const availableKeys = cat.keys.filter((k) => catMap[k] !== undefined);
              if (availableKeys.length === 0) return null;

              return (
                <div key={cat.label} className="mb-5">
                  <h3 className="text-body-sm font-semibold text-gray-700 mb-2">
                    {cat.label}
                  </h3>
                  <div className="space-y-1.5">
                    {availableKeys.map((key) => {
                      const val = catMap[key];
                      const pct = (val / 20) * 100;
                      return (
                        <div key={key} className="flex items-center gap-2">
                          <span className="text-caption text-gray-600 w-28 truncate">
                            {formatAttrName(key)}
                          </span>
                          <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${attrBarColor(val)}`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <span
                            className={`text-caption font-semibold w-6 text-right ${attrTextColor(val)}`}
                          >
                            {val}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

    </div>
  );
};

export default PlayerDetail;
