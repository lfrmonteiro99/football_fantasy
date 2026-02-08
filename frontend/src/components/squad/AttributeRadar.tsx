import React, { useMemo } from 'react';
import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  ResponsiveContainer,
} from 'recharts';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface AttributeRadarProps {
  attributes: Record<string, number>;
  maxValue?: number;
  size?: number;
  /** If 'goalkeeper', uses GK-specific attributes */
  positionCategory?: string;
}

// ---------------------------------------------------------------------------
// Key attributes per position
// ---------------------------------------------------------------------------

const OUTFIELD_KEYS = [
  'finishing',
  'passing',
  'dribbling',
  'pace',
  'strength',
  'vision',
  'composure',
  'tackling',
];

const GK_KEYS = [
  'reflexes',
  'handling',
  'command_of_area',
  'aerial_reach',
  'kicking',
  'one_on_ones',
];

function formatLabel(key: string): string {
  return key
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const AttributeRadar: React.FC<AttributeRadarProps> = ({
  attributes,
  maxValue = 20,
  size = 300,
  positionCategory,
}) => {
  const data = useMemo(() => {
    const keys =
      positionCategory === 'goalkeeper' ? GK_KEYS : OUTFIELD_KEYS;

    return keys
      .filter((k) => attributes[k] !== undefined)
      .map((k) => ({
        attribute: formatLabel(k),
        value: attributes[k],
        fullMark: maxValue,
      }));
  }, [attributes, maxValue, positionCategory]);

  if (data.length === 0) {
    return (
      <div
        className="flex items-center justify-center text-gray-400 text-sm"
        style={{ width: size, height: size }}
      >
        No attribute data available
      </div>
    );
  }

  return (
    <div style={{ width: size, height: size }}>
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart data={data} cx="50%" cy="50%" outerRadius="75%">
          <PolarGrid stroke="#e5e7eb" />
          <PolarAngleAxis
            dataKey="attribute"
            tick={{ fontSize: 11, fill: '#6b7280' }}
          />
          <PolarRadiusAxis
            angle={90}
            domain={[0, maxValue]}
            tick={{ fontSize: 9, fill: '#9ca3af' }}
            tickCount={5}
          />
          <Radar
            name="Attributes"
            dataKey="value"
            stroke="#16a34a"
            fill="#16a34a"
            fillOpacity={0.25}
            strokeWidth={2}
          />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
};

export default AttributeRadar;
