// Shared types and constants for the unified simulator

export type Vec = { x: number; y: number };

export type Attributes = {
  speed: number;
  staminaMax: number;
  passing: number;
  vision: number;
  dribbling: number;
  shooting: number;
  tackling: number;
  aggression: number;
  composure: number;
  positioning: number;
  first_touch: number;
  goalkeeping?: number;
};

export type DynamicState = {
  stamina: number;
  morale: number;
  confidence: number;
  fatigue: number;
  current_action?: string | null;
  action_timer: number;
  action_intent?: any;
  cooldowns: Record<string, number>;
  memory: {
    last_failed_action?: string;
    fail_counts?: Record<string, number>;
    last_interceptor?: number;
    last_action_tick?: number;
  };
  is_subbed?: boolean;
  is_injured?: boolean;
  distance_covered: number;
};

export type Player = {
  id: number;
  name: string;
  team_id: number;
  role: string;
  is_keeper?: boolean;
  pos: Vec;
  vel: Vec;
  base_position: Vec;
  attributes: Attributes;
  dynamic: DynamicState;
  tactical: Record<string, any>;
  stats: Record<string, number>;
};

export type Team = {
  id: number;
  name: string;
  formation_slots: Record<string, Vec>;
  tactic: Record<string, any>;
  cohesion: number;
  momentum: number;
  players: Player[];
  bench: Player[];
  subs_left: number;
  phase?: 'attack' | 'defence' | 'transition';
  ball_owned?: boolean;
};

export type ScheduledEvent =
  | {
      tick: number;
      type: 'pass_arrival';
      passer_id: number;
      intended_receiver_id: number;
      origin: Vec;
      target: Vec;
      flight_time: number;
    }
  | {
      tick: number;
      type: 'set_piece';
      subtype: 'throw_in' | 'corner' | 'free_kick' | 'goal_kick';
      location: Vec;
      attacking_team_id: number;
    };

export type Ball = {
  pos: Vec;
  vel: Vec;
  holder_id: number | null;
  last_touch_player_id?: number;
  scheduled_events: ScheduledEvent[];
};

export type GameState = {
  tick: number;
  minute: number;
  second: number;
  teams: { home: Team; away: Team };
  all_players: Player[];
  ball: Ball;
  referee_strictness: number;
  weather: string;
  commentary_log: string[];
  spatial_index: any;
  scores?: { home: number; away: number };
  last_offball_event_tick?: number;
  recent_contests?: Array<{
    type: 'free_ball' | 'pass_arrival' | 'tackle' | 'aerial';
    winner_id: number;
    attacker_id?: number;
    defender_id?: number;
    intended_receiver_id?: number;
    outcome?: 'success' | 'fail' | 'foul' | 'intercepted' | 'complete';
    location: Vec;
  }>;
  tick_events?: any[];
  onEvent?: (e: any) => void;
};

export type RunOptions = {
  onTick?: (snapshot: any) => void;
  tickPublishInterval?: number; // e.g., publish every N ticks
  onEvent?: (e: any) => void;
};

export type SpatialIndex = {
  cellSize: number;
  cells: Map<string, Player[]>;
};

// Constants (tunable; meters represented in 0..100 pitch scale)
export const MATCH_SECONDS = 90 * 60; // 5400
export const TICK_INTERVAL = 1; // 1 second
export const PERSONAL_SPACE = 2.0;
export const PRESS_RADIUS = 12.0;
export const PASS_SPEED_MPS = 20.0;
export const PASS_FLIGHT_MIN = 1;
export const PASS_FLIGHT_MAX = 4;
export const FRICTION_COEFF = 0.85;
export const DRIBBLE_JITTER: [number, number] = [-12, 12];
export const SHOT_JITTER: [number, number] = [-15, 15];
export const TACKLE_SUCCESS_THRESHOLD = 10;
export const FOUL_BASE_PROB = 0.05;
export const TACKLE_RADIUS = 3.0;

export const DEFAULT_ACTION_DURATIONS: Record<string, number> = {
  pass: 2,
  dribble: 3,
  shoot: 4,
  hold: 1,
  clear: 2,
  tackle: 2,
  cross: 2,
};

export const COOLDOWNS: Record<string, number> = {
  pass: 1,
  dribble: 2,
  shoot: 3,
  tackle: 2,
};

export const MAX_OFFBALL_EVENTS_PER_5S = 1;

// Math helpers
export const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
export const mag = (v: Vec) => Math.hypot(v.x, v.y);
export const norm = (v: Vec): Vec => {
  const m = mag(v) || 1;
  return { x: v.x / m, y: v.y / m };
};
export const add = (a: Vec, b: Vec): Vec => ({ x: a.x + b.x, y: a.y + b.y });
export const sub = (a: Vec, b: Vec): Vec => ({ x: a.x - b.x, y: a.y - b.y });
export const mul = (a: Vec, k: number): Vec => ({ x: a.x * k, y: a.y * k });

export const randRange = (min: number, max: number) => min + Math.random() * (max - min);
export const jitter = ([min, max]: [number, number]) => randRange(min, max);


