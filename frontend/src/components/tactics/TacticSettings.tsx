import React from 'react';
import type {
  CreateTacticPayload,
  TacticAnalysis,
  Mentality,
  DefensiveLine,
  PressingLevel,
  Tempo,
  Width,
} from '../../types';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface TacticSettingsProps {
  tactic: Partial<CreateTacticPayload>;
  onChange: (field: string, value: any) => void;
  analysis?: TacticAnalysis | null;
}

// ---------------------------------------------------------------------------
// Five-step selector
// ---------------------------------------------------------------------------

interface FiveStepSliderProps {
  value: string | undefined;
  options: readonly string[];
  onChange: (val: string) => void;
  label: string;
  activeColor?: string;
}

const FiveStepSlider: React.FC<FiveStepSliderProps> = ({
  value,
  options,
  onChange,
  label,
  activeColor = 'bg-green-600 text-white',
}) => (
  <div className="mb-4">
    <label className="text-sm font-medium text-gray-700">{label}</label>
    <div className="flex gap-1 mt-1">
      {options.map((opt) => (
        <button
          key={opt}
          type="button"
          className={`flex-1 py-2 text-xs rounded transition-colors ${
            value === opt
              ? activeColor
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
          onClick={() => onChange(opt)}
        >
          {opt.replace(/_/g, ' ')}
        </button>
      ))}
    </div>
  </div>
);

// ---------------------------------------------------------------------------
// Mentality options with color gradient
// ---------------------------------------------------------------------------

const MENTALITY_OPTIONS: { value: Mentality; label: string; color: string }[] = [
  { value: 'very_defensive', label: 'Very Def', color: 'bg-blue-800 text-white' },
  { value: 'defensive', label: 'Defensive', color: 'bg-blue-500 text-white' },
  { value: 'balanced', label: 'Balanced', color: 'bg-gray-500 text-white' },
  { value: 'attacking', label: 'Attacking', color: 'bg-orange-500 text-white' },
  { value: 'very_attacking', label: 'Very Att', color: 'bg-red-600 text-white' },
];

const DEFENSIVE_LINE_OPTIONS: readonly DefensiveLine[] = [
  'very_deep',
  'deep',
  'standard',
  'high',
  'very_high',
];

const PRESSING_OPTIONS: readonly PressingLevel[] = [
  'never',
  'rarely',
  'sometimes',
  'often',
  'always',
];

const TEMPO_OPTIONS: readonly Tempo[] = [
  'very_slow',
  'slow',
  'standard',
  'fast',
  'very_fast',
];

const WIDTH_OPTIONS: readonly Width[] = [
  'very_narrow',
  'narrow',
  'standard',
  'wide',
  'very_wide',
];

// ---------------------------------------------------------------------------
// Toggle checkbox
// ---------------------------------------------------------------------------

interface ToggleProps {
  label: string;
  checked: boolean;
  onChange: (val: boolean) => void;
}

const Toggle: React.FC<ToggleProps> = ({ label, checked, onChange }) => (
  <label className="flex items-center gap-2 cursor-pointer py-1">
    <input
      type="checkbox"
      checked={checked}
      onChange={(e) => onChange(e.target.checked)}
      className="w-4 h-4 rounded border-gray-300 text-green-600 focus:ring-green-500"
    />
    <span className="text-sm text-gray-700">
      {label.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
    </span>
  </label>
);

// ---------------------------------------------------------------------------
// Analysis bar
// ---------------------------------------------------------------------------

function AnalysisBar({ label, value }: { label: string; value: number }) {
  const color =
    value >= 70 ? 'bg-green-500' : value >= 40 ? 'bg-yellow-500' : 'bg-red-500';
  return (
    <div className="mb-2">
      <div className="flex justify-between text-xs mb-0.5">
        <span className="text-gray-600">{label}</span>
        <span className="font-medium text-gray-800">{value}</span>
      </div>
      <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full ${color}`}
          style={{ width: `${value}%` }}
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const TacticSettings: React.FC<TacticSettingsProps> = ({
  tactic,
  onChange,
  analysis = null,
}) => {
  return (
    <div className="space-y-6">
      {/* Mentality */}
      <div>
        <label className="text-sm font-medium text-gray-700">Mentality</label>
        <div className="flex gap-1 mt-1">
          {MENTALITY_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              className={`flex-1 py-2 text-xs rounded transition-colors ${
                tactic.mentality === opt.value
                  ? opt.color
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
              onClick={() => onChange('mentality', opt.value)}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Defensive Line */}
      <FiveStepSlider
        label="Defensive Line"
        value={tactic.defensive_line}
        options={DEFENSIVE_LINE_OPTIONS}
        onChange={(val) => onChange('defensive_line', val)}
      />

      {/* Pressing */}
      <FiveStepSlider
        label="Pressing"
        value={tactic.pressing}
        options={PRESSING_OPTIONS}
        onChange={(val) => onChange('pressing', val)}
      />

      {/* Tempo */}
      <FiveStepSlider
        label="Tempo"
        value={tactic.tempo}
        options={TEMPO_OPTIONS}
        onChange={(val) => onChange('tempo', val)}
      />

      {/* Width */}
      <FiveStepSlider
        label="Width"
        value={tactic.width}
        options={WIDTH_OPTIONS}
        onChange={(val) => onChange('width', val)}
      />

      {/* Toggles */}
      <div>
        <label className="text-sm font-medium text-gray-700 mb-1 block">
          Team Instructions
        </label>
        <div className="grid grid-cols-2 gap-x-4">
          <Toggle
            label="offside_trap"
            checked={!!tactic.offside_trap}
            onChange={(val) => onChange('offside_trap', val)}
          />
          <Toggle
            label="play_out_of_defence"
            checked={!!tactic.play_out_of_defence}
            onChange={(val) => onChange('play_out_of_defence', val)}
          />
          <Toggle
            label="counter_attack"
            checked={!!(tactic as any).counter_attack}
            onChange={(val) => onChange('counter_attack', val)}
          />
          <Toggle
            label="close_down_more"
            checked={!!tactic.close_down_more}
            onChange={(val) => onChange('close_down_more', val)}
          />
          <Toggle
            label="tackle_harder"
            checked={!!tactic.tackle_harder}
            onChange={(val) => onChange('tackle_harder', val)}
          />
        </div>
      </div>

      {/* Analysis section (read-only) */}
      {analysis && (
        <div className="border-t border-gray-200 pt-4">
          <h4 className="text-sm font-semibold text-gray-700 mb-3">
            Tactical Analysis
          </h4>

          <AnalysisBar
            label="Defensive Stability"
            value={analysis.formation_analysis.defensive_stability}
          />
          <AnalysisBar
            label="Attacking Threat"
            value={analysis.formation_analysis.attacking_threat}
          />
          <AnalysisBar
            label="Midfield Control"
            value={analysis.formation_analysis.midfield_control}
          />

          {/* Strengths */}
          {analysis.tactical_summary.strengths.length > 0 && (
            <div className="mt-3">
              <span className="text-xs font-medium text-gray-500 block mb-1">
                Strengths
              </span>
              <div className="flex flex-wrap gap-1">
                {analysis.tactical_summary.strengths.map((s, i) => (
                  <span
                    key={i}
                    className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800"
                  >
                    {s}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Weaknesses */}
          {analysis.tactical_summary.weaknesses.length > 0 && (
            <div className="mt-2">
              <span className="text-xs font-medium text-gray-500 block mb-1">
                Weaknesses
              </span>
              <div className="flex flex-wrap gap-1">
                {analysis.tactical_summary.weaknesses.map((w, i) => (
                  <span
                    key={i}
                    className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800"
                  >
                    {w}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default TacticSettings;
