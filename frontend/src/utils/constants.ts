export const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

export const POSITION_COLORS: Record<string, string> = {
  GK: '#f59e0b',   // amber
  CB: '#3b82f6', LB: '#3b82f6', RB: '#3b82f6',  // blue
  DM: '#10b981', CM: '#10b981', AM: '#10b981',    // emerald
  LM: '#8b5cf6', RM: '#8b5cf6', LW: '#8b5cf6', RW: '#8b5cf6',  // violet
  ST: '#ef4444', CF: '#ef4444',  // red
};

export const MENTALITY_OPTIONS = ['very_defensive', 'defensive', 'balanced', 'attacking', 'very_attacking'] as const;
export const PRESSING_OPTIONS = ['never', 'rarely', 'sometimes', 'often', 'always'] as const;
export const TEMPO_OPTIONS = ['very_slow', 'slow', 'standard', 'fast', 'very_fast'] as const;
export const WIDTH_OPTIONS = ['very_narrow', 'narrow', 'standard', 'wide', 'very_wide'] as const;
export const SPEED_OPTIONS = ['realtime', 'fast', 'instant'] as const;
