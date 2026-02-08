import React, { useState, useMemo } from 'react';
import type { SquadPlayer, PositionCategory } from '../../types';
import { formatCurrency } from '../../utils/helpers';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface PlayerListProps {
  players: SquadPlayer[];
  onPlayerClick: (playerId: number) => void;
  selectedPlayerId?: number | null;
}

// ---------------------------------------------------------------------------
// Position badge color mapping
// ---------------------------------------------------------------------------

const POSITION_CATEGORY_CLASSES: Record<PositionCategory, string> = {
  goalkeeper: 'bg-amber-100 text-amber-800',
  defender: 'bg-blue-100 text-blue-800',
  midfielder: 'bg-emerald-100 text-emerald-800',
  forward: 'bg-red-100 text-red-800',
};

const POSITION_FILTER_OPTIONS: { label: string; value: string }[] = [
  { label: 'All', value: 'all' },
  { label: 'Goalkeepers', value: 'goalkeeper' },
  { label: 'Defenders', value: 'defender' },
  { label: 'Midfielders', value: 'midfielder' },
  { label: 'Forwards', value: 'forward' },
];

// ---------------------------------------------------------------------------
// Sorting
// ---------------------------------------------------------------------------

type SortKey = 'shirt_number' | 'full_name' | 'position' | 'age' | 'nationality' | 'current_ability' | 'market_value';
type SortDir = 'asc' | 'desc';

function compareValues(a: SquadPlayer, b: SquadPlayer, key: SortKey, dir: SortDir): number {
  let aVal: string | number;
  let bVal: string | number;

  switch (key) {
    case 'shirt_number':
      aVal = a.shirt_number ?? 99;
      bVal = b.shirt_number ?? 99;
      break;
    case 'full_name':
      aVal = a.full_name.toLowerCase();
      bVal = b.full_name.toLowerCase();
      break;
    case 'position':
      aVal = a.position?.short_name ?? '';
      bVal = b.position?.short_name ?? '';
      break;
    case 'age':
      aVal = a.age;
      bVal = b.age;
      break;
    case 'nationality':
      aVal = a.nationality.toLowerCase();
      bVal = b.nationality.toLowerCase();
      break;
    case 'current_ability':
      aVal = a.current_ability;
      bVal = b.current_ability;
      break;
    case 'market_value':
      aVal = parseFloat(a.market_value) || 0;
      bVal = parseFloat(b.market_value) || 0;
      break;
    default:
      return 0;
  }

  if (aVal < bVal) return dir === 'asc' ? -1 : 1;
  if (aVal > bVal) return dir === 'asc' ? 1 : -1;
  return 0;
}

// ---------------------------------------------------------------------------
// Ability bar
// ---------------------------------------------------------------------------

function AbilityBar({ value }: { value: number }) {
  // current_ability is decimal:2 — might be 0-1 or 0-100. Normalize.
  const pct = value <= 1 ? value * 100 : Math.min(value, 100);
  const color =
    pct >= 75 ? 'bg-green-500' : pct >= 50 ? 'bg-yellow-500' : 'bg-red-500';

  return (
    <div className="flex items-center gap-2">
      <div className="w-24 h-2 bg-gray-200 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs text-gray-500 w-8 text-right">
        {pct.toFixed(0)}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const PlayerList: React.FC<PlayerListProps> = ({
  players,
  onPlayerClick,
  selectedPlayerId = null,
}) => {
  const [search, setSearch] = useState('');
  const [positionFilter, setPositionFilter] = useState('all');
  const [sortKey, setSortKey] = useState<SortKey>('shirt_number');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  const filtered = useMemo(() => {
    let list = [...players];

    // Position filter
    if (positionFilter !== 'all') {
      list = list.filter((p) => p.position?.category === positionFilter);
    }

    // Search filter
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((p) => p.full_name.toLowerCase().includes(q));
    }

    // Sort
    list.sort((a, b) => compareValues(a, b, sortKey, sortDir));

    return list;
  }, [players, positionFilter, search, sortKey, sortDir]);

  const sortIndicator = (key: SortKey) => {
    if (sortKey !== key) return null;
    return sortDir === 'asc' ? ' \u25B2' : ' \u25BC';
  };

  const headerClass =
    'px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:text-gray-700 select-none';

  return (
    <div>
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        {/* Position filter */}
        <select
          value={positionFilter}
          onChange={(e) => setPositionFilter(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 bg-white"
        >
          {POSITION_FILTER_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>

        {/* Search */}
        <div className="relative flex-1 min-w-[200px]">
          <input
            type="text"
            placeholder="Search players..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full px-3 py-2 pl-9 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
          />
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
        </div>

        <span className="text-sm text-gray-500">
          {filtered.length} player{filtered.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className={headerClass} onClick={() => handleSort('shirt_number')}>
                #{sortIndicator('shirt_number')}
              </th>
              <th className={headerClass} onClick={() => handleSort('full_name')}>
                Name{sortIndicator('full_name')}
              </th>
              <th className={headerClass} onClick={() => handleSort('position')}>
                Pos{sortIndicator('position')}
              </th>
              <th className={headerClass} onClick={() => handleSort('age')}>
                Age{sortIndicator('age')}
              </th>
              <th className={headerClass} onClick={() => handleSort('nationality')}>
                Nat{sortIndicator('nationality')}
              </th>
              <th className={headerClass} onClick={() => handleSort('current_ability')}>
                Ability{sortIndicator('current_ability')}
              </th>
              <th className={headerClass} onClick={() => handleSort('market_value')}>
                Value{sortIndicator('market_value')}
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-100">
            {filtered.map((player) => {
              const isSelected = selectedPlayerId === player.id;
              const posCategory = player.position?.category ?? 'midfielder';
              const posBadgeClass =
                POSITION_CATEGORY_CLASSES[posCategory] || 'bg-gray-100 text-gray-800';

              return (
                <tr
                  key={player.id}
                  onClick={() => onPlayerClick(player.id)}
                  className={`cursor-pointer transition-colors ${
                    isSelected
                      ? 'bg-green-50 border-l-4 border-green-500'
                      : 'hover:bg-gray-50'
                  }`}
                >
                  <td className="px-3 py-3 whitespace-nowrap text-sm font-medium text-gray-700">
                    {player.shirt_number ?? '-'}
                  </td>
                  <td className="px-3 py-3 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-900">
                        {player.full_name}
                      </span>
                      {player.is_injured && (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-bold bg-red-100 text-red-700">
                          INJ
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-3 whitespace-nowrap">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${posBadgeClass}`}
                    >
                      {player.position?.short_name ?? '??'}
                    </span>
                  </td>
                  <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-600">
                    {player.age}
                  </td>
                  <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-600">
                    {player.nationality}
                  </td>
                  <td className="px-3 py-3 whitespace-nowrap">
                    <AbilityBar value={player.current_ability} />
                  </td>
                  <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-600">
                    {formatCurrency(player.market_value)}
                  </td>
                </tr>
              );
            })}

            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="px-3 py-8 text-center text-gray-400 text-sm">
                  No players match the current filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default PlayerList;
