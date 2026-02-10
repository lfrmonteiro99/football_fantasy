// =============================================================================
// FRONTEND TYPE DEFINITIONS — Football Fantasy Manager
// =============================================================================
// This file is the SINGLE SOURCE OF TRUTH for all TypeScript interfaces used
// across the frontend.  Every API response shape, every Redux state slice, and
// every component prop that references a domain object MUST import from here.
//
// Organisation:
//   1. Primitive enums / union types
//   2. Core domain models (matching Laravel models exactly)
//   3. API response wrappers
//   4. API request payloads
//   5. SSE (Server-Sent Events) tick / event shapes
//   6. Redux state slice shapes
// =============================================================================

// ---------------------------------------------------------------------------
// 1. ENUMS & UNION TYPES
// ---------------------------------------------------------------------------

/** Match lifecycle status — maps to `matches.status` column. */
export type MatchStatus = 'scheduled' | 'in_progress' | 'completed';

/** Formation playing style. */
export type FormationStyle = 'defensive' | 'balanced' | 'attacking';

/** Tactic mentality level. */
export type Mentality =
  | 'very_defensive'
  | 'defensive'
  | 'balanced'
  | 'attacking'
  | 'very_attacking';

/** Team passing instructions. */
export type TeamInstructions =
  | 'control_possession'
  | 'direct_passing'
  | 'short_passing'
  | 'mixed';

/** Defensive line height. */
export type DefensiveLine =
  | 'very_deep'
  | 'deep'
  | 'standard'
  | 'high'
  | 'very_high';

/** Pressing intensity. */
export type PressingLevel = 'never' | 'rarely' | 'sometimes' | 'often' | 'always';

/** Tempo setting. */
export type Tempo = 'very_slow' | 'slow' | 'standard' | 'fast' | 'very_fast';

/** Width setting. */
export type Width = 'very_narrow' | 'narrow' | 'standard' | 'wide' | 'very_wide';

/** Player preferred foot. */
export type PreferredFoot = 'left' | 'right' | 'both';

/** Position categories — mirrors positions.category column. */
export type PositionCategory = 'goalkeeper' | 'defender' | 'midfielder' | 'forward';

/** Position short names used in the formation positions array. */
export type PositionAbbreviation =
  | 'GK' | 'CB' | 'LB' | 'RB' | 'WB' | 'SW'
  | 'DM' | 'CM' | 'AM' | 'LM' | 'RM'
  | 'LW' | 'RW' | 'ST' | 'CF' | 'F9';

/** Team side in a match. */
export type TeamSide = 'home' | 'away';

/** Match event types emitted by the simulation engine. */
export type MatchEventType =
  | 'goal'
  | 'shot'
  | 'shot_on_target'
  | 'save'
  | 'yellow_card'
  | 'red_card'
  | 'foul'
  | 'corner'
  | 'offside'
  | 'substitution'
  | 'free_kick'
  | 'penalty'
  | 'penalty_miss'
  | 'injury'
  | 'half_time'
  | 'full_time'
  | 'kickoff';

/** Simulation phase — maps to MatchState.phase. */
export type SimulationPhase =
  | 'kickoff'
  | 'open_play'
  | 'attack_home'
  | 'attack_away'
  | 'set_piece'
  | 'half_time'
  | 'full_time';

/** SSE event names from SimulationStreamController. */
export type SSEEventName =
  | 'lineup'
  | 'minute'
  | 'goal'
  | 'card'
  | 'half_time'
  | 'full_time'
  | 'error';

/** SSE speed parameter. */
export type SimulationSpeed = 'realtime' | 'fast' | 'instant';

/** Approach play setting. */
export type ApproachPlay = 'more_direct' | 'balanced' | 'patient';

/** Passing directness. */
export type PassingDirectness = 'very_short' | 'short' | 'standard' | 'direct' | 'very_direct';

/** Time-wasting setting. */
export type TimeWasting = 'never' | 'rarely' | 'sometimes' | 'often' | 'always';

/** Final third approach. */
export type FinalThird =
  | 'work_ball_into_box'
  | 'low_crosses'
  | 'whipped_crosses'
  | 'hit_early_crosses'
  | 'mixed';

/** Creative freedom setting. */
export type CreativeFreedom = 'disciplined' | 'balanced' | 'expressive';

/** Goalkeeper distribution. */
export type GoalkeeperDistribution =
  | 'distribute_quickly'
  | 'slow_pace_down'
  | 'roll_out'
  | 'throw_long'
  | 'take_short_kicks'
  | 'take_long_kicks'
  | 'mixed';

/** Tackling style. */
export type TacklingStyle = 'stay_on_feet' | 'get_stuck_in' | 'balanced';

/** Pressing trap direction. */
export type PressingTrap = 'none' | 'inside' | 'outside';

/** Form result for a single match. */
export type FormResult = 'W' | 'D' | 'L';

// ---------------------------------------------------------------------------
// 2. CORE DOMAIN MODELS
// ---------------------------------------------------------------------------

/** Mirrors `leagues` table. */
export interface League {
  id: number;
  name: string;
  country: string;
  level: number;
  max_teams: number;
  reputation: number;      // decimal(1)
  logo: string | null;
  created_at: string;
  updated_at: string;
  // Included via eager-load
  teams?: Team[];
}

/** Mirrors `seasons` table. */
export interface Season {
  id: number;
  name: string;
  start_date: string;      // "YYYY-MM-DD"
  end_date: string;
  is_current: boolean;
  created_at: string;
  updated_at: string;
}

/** Mirrors `teams` table. */
export interface Team {
  id: number;
  name: string;
  short_name: string;
  city: string;
  stadium_name: string | null;
  stadium_capacity: number | null;
  league_id: number;
  budget: string;           // decimal string from Laravel
  reputation: string;       // decimal string
  primary_color: string | null;
  secondary_color: string | null;
  founded_year: number | null;
  primary_tactic_id: number | null;
  created_at: string;
  updated_at: string;
  // Eager-loaded relations
  league?: League;
  players?: Player[];
  tactics?: TacticWithPivot[];
}

/** A single x/y position slot inside a Formation's positions JSON array. */
export interface FormationPosition {
  x: number;               // 0-100
  y: number;               // 0-100
  position: PositionAbbreviation;
}

/** Mirrors `formations` table. */
export interface Formation {
  id: number;
  name: string;             // e.g. "4-3-3"
  display_name: string;
  description: string | null;
  positions: FormationPosition[];
  style: FormationStyle;
  defenders_count: number;
  midfielders_count: number;
  forwards_count: number;
  is_active: boolean;
  sample_instructions: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
  // Counts from withCount
  tactics_count?: number;
}

/** Mirrors `positions` table (positional roles, not formation slots). */
export interface Position {
  id: number;
  name: string;             // "Centre Back"
  short_name: string;       // "CB"
  category: PositionCategory;
  key_attributes: string[];
  created_at: string;
  updated_at: string;
  // Counts from withCount
  primary_players_count?: number;
}

/** Mirrors `players` table. */
export interface Player {
  id: number;
  first_name: string;
  last_name: string;
  full_name: string;        // computed accessor
  date_of_birth: string;
  age: number;              // computed accessor
  nationality: string;
  preferred_foot: PreferredFoot;
  height_cm: number;
  weight_kg: number;
  team_id: number | null;
  primary_position_id: number;
  secondary_positions: number[] | null;
  market_value: string;     // decimal string
  wage_per_week: string;    // decimal string
  contract_start: string | null;
  contract_end: string | null;
  shirt_number: number | null;
  is_injured: boolean;
  injury_return_date: string | null;
  created_at: string;
  updated_at: string;
  // Eager-loaded relations
  team?: Team;
  primary_position?: Position;
  attributes?: PlayerAttributes;
  tactical_positions?: TacticalPosition[];
}

/** Mirrors `player_attributes` table — 64 attributes on a 1-20 scale. */
export interface PlayerAttributes {
  id: number;
  player_id: number;
  // Technical
  finishing: number;
  first_touch: number;
  free_kick_taking: number;
  heading: number;
  long_shots: number;
  long_throws: number;
  marking: number;
  passing: number;
  penalty_taking: number;
  tackling: number;
  technique: number;
  corners: number;
  crossing: number;
  dribbling: number;
  // Mental
  aggression: number;
  anticipation: number;
  bravery: number;
  composure: number;
  concentration: number;
  decisions: number;
  determination: number;
  flair: number;
  leadership: number;
  off_the_ball: number;
  positioning: number;
  teamwork: number;
  vision: number;
  work_rate: number;
  // Physical
  acceleration: number;
  agility: number;
  balance: number;
  jumping_reach: number;
  natural_fitness: number;
  pace: number;
  stamina: number;
  strength: number;
  // Goalkeeping
  aerial_reach: number;
  command_of_area: number;
  communication: number;
  eccentricity: number;
  handling: number;
  kicking: number;
  one_on_ones: number;
  reflexes: number;
  rushing_out: number;
  throwing: number;
  // Overall ratings (decimal:2)
  current_ability: number;
  potential_ability: number;
  created_at: string;
  updated_at: string;
}

/**
 * Grouped attribute categories as returned by GET /players/{id}/attributes.
 * Each group maps attribute-name -> value (1-20).
 */
export interface PlayerAttributesByCategory {
  player: Player;
  overall_ratings: {
    current_ability: number;
    potential_ability: number;
  };
  technical: Record<string, number>;
  mental: Record<string, number>;
  physical: Record<string, number>;
  goalkeeping: Record<string, number>;
}

/** Mirrors `tactics` table. */
export interface Tactic {
  id: number;
  name: string;
  description: string | null;
  formation_id: number;

  // Core settings
  mentality: Mentality;
  team_instructions: TeamInstructions;
  defensive_line: DefensiveLine;
  pressing: PressingLevel;
  tempo: Tempo;
  width: Width;

  // Boolean toggles
  offside_trap: boolean;
  play_out_of_defence: boolean;
  use_offside_trap: boolean;
  close_down_more: boolean;
  tackle_harder: boolean;
  get_stuck_in: boolean;

  // Extended in-possession
  attacking_width: Width | null;
  approach_play: ApproachPlay | null;
  passing_directness: PassingDirectness | null;
  time_wasting: TimeWasting | null;
  final_third: FinalThird | null;
  creative_freedom: CreativeFreedom | null;

  // Final third booleans
  work_ball_into_box: boolean;
  low_crosses: boolean;
  whipped_crosses: boolean;
  hit_early_crosses: boolean;

  // Transition booleans
  counter_press: boolean;
  counter_attack: boolean;
  regroup: boolean;
  hold_shape: boolean;
  goalkeeper_distribution: GoalkeeperDistribution | null;

  // GK distribution booleans
  distribute_quickly: boolean;
  slow_pace_down: boolean;
  roll_out: boolean;
  throw_long: boolean;
  take_short_kicks: boolean;
  take_long_kicks: boolean;

  // Out of possession
  line_of_engagement: DefensiveLine | null;
  pressing_intensity: PressingLevel | null;
  prevent_short_gk_distribution: boolean;
  tackling: TacklingStyle | null;
  pressing_trap: PressingTrap | null;
  stay_on_feet: boolean;

  // Complex JSON fields
  custom_positions: FormationPosition[] | null;
  player_assignments: Record<string, number> | null;
  characteristics: string[] | null;

  created_at: string;
  updated_at: string;

  // Eager-loaded relations
  formation?: Formation;
  teams?: Team[];
  tactical_positions?: TacticalPosition[];

  // Counts
  teams_count?: number;
}

/** Tactic when loaded through a team's BelongsToMany — includes pivot data. */
export interface TacticWithPivot extends Tactic {
  pivot: {
    team_id: number;
    tactic_id: number;
    is_primary: boolean;
    is_active: boolean;
    created_at: string;
    updated_at: string;
  };
}

/** Mirrors `tactical_positions` table (player -> position assignment in a tactic). */
export interface TacticalPosition {
  id: number;
  tactic_id: number;
  team_id: number;
  player_id: number;
  position_id: number;
  created_at: string;
  updated_at: string;
  // Eager-loaded
  player?: Player;
  position?: Position;
  tactic?: Tactic;
}

/** Mirrors `matches` table. */
export interface Match {
  id: number;
  home_team_id: number;
  away_team_id: number;
  league_id: number;
  season_id: number | null;
  manager_id: number | null;
  match_date: string;       // ISO datetime
  matchday: number | null;
  match_time: string | null;
  home_formation_id: number | null;
  away_formation_id: number | null;
  stadium: string | null;
  weather: string | null;
  temperature: number | null;
  attendance: number | null;
  home_score: number;
  away_score: number;
  status: MatchStatus;
  match_stats: MatchStats | null;
  created_at: string;
  updated_at: string;
  // Eager-loaded
  home_team?: Team;
  away_team?: Team;
  league?: League;
  season?: Season;
  events?: MatchEvent[];
  home_formation?: Formation;
  away_formation?: Formation;
}

/** Mirrors `match_events` table. */
export interface MatchEvent {
  id: number;
  match_id: number;
  minute: number;
  event_type: MatchEventType;
  team_type: TeamSide;
  player_name: string;
  description: string;
  x_coordinate: number;
  y_coordinate: number;
  commentary: string;
  sub_events: SubEvent[] | string | null;
  created_at: string;
  updated_at: string;
}

/** Sub-event structure within match events. */
export interface SubEvent {
  action: string;
  from_player: number | null;
  to_player: number | null;
  players_involved: number[];
  ball_start: { x: number; y: number } | number[];
  ball_end: { x: number; y: number } | number[];
}

/** A single animation step within an event's sequence array. */
export interface SequenceStep {
  action: string;         // 'pass' | 'shoot' | 'cross' | 'dribble' | 'tackle' | 'save' | 'header' | 'run' | 'clearance' | 'foul' | 'interception'
  actor_id: number;
  actor_name: string;
  ball_start: { x: number; y: number };
  ball_end: { x: number; y: number };
  duration_ms: number;
}

/** Mirrors `match_lineups` table. */
export interface MatchLineup {
  id: number;
  match_id: number;
  team_id: number;
  player_id: number;
  position: string;
  is_starting: boolean;
  sort_order: number;
  x: number | null;
  y: number | null;
  created_at: string;
  updated_at: string;
  // Eager-loaded
  player?: Player;
}

/** Mirrors `match_tactics` table. */
export interface MatchTactic {
  match_id: number;
  team_type: TeamSide;
  team_id: number;
  formation_id: number | null;
  custom_positions: FormationPosition[] | null;
  mentality: Mentality | null;
  team_instructions: TeamInstructions | null;
  pressing: PressingLevel | null;
  tempo: Tempo | null;
  width: Width | null;
  offside_trap: boolean | null;
  play_out_of_defence: boolean | null;
  use_offside_trap: boolean | null;
  close_down_more: boolean | null;
  tackle_harder: boolean | null;
  get_stuck_in: boolean | null;
  player_assignments: Record<string, number> | null;
  substitutions: MatchSubstitution[] | null;
  applied_at_minute: number;
}

/** Individual substitution record within MatchTactic.substitutions JSON. */
export interface MatchSubstitution {
  player_out_id: number;
  player_in_id: number;
  minute: number;
  timestamp?: string;
}

/** Match statistics shape — matches MatchState.stats[side]. */
export interface TeamMatchStats {
  possession_pct: number;
  shots: number;
  shots_on_target: number;
  corners: number;
  fouls: number;
  yellow_cards: number;
  red_cards: number;
  saves: number;
  passes: number;
  tackles: number;
  offsides: number;
}

/** Full match stats (both teams). */
export interface MatchStats {
  home: TeamMatchStats;
  away: TeamMatchStats;
}

/** User model — mirrors `users` table (hidden: password, remember_token). */
export interface User {
  id: number;
  name: string;
  email: string;
  email_verified_at: string | null;
  managed_team_id: number | null;
  game_date: string | null;  // "YYYY-MM-DD"
  created_at: string;
  updated_at: string;
  // Eager-loaded
  managed_team?: Team;
}

// ---------------------------------------------------------------------------
// 3. API RESPONSE WRAPPERS
// ---------------------------------------------------------------------------

/** Standard success envelope — most controllers use this shape. */
export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message: string;
}

/** Some controllers use `status` instead of `success`. */
export interface ApiStatusResponse<T> {
  status: 'success' | 'error';
  data: T;
  message?: string;
}

/** Validation error response (422). */
export interface ApiValidationError {
  success: false;
  message: string;
  errors: Record<string, string[]>;
}

/** Generic error response. */
export interface ApiError {
  success?: false;
  error?: string;
  message: string;
}

/** Laravel paginated response wrapper. */
export interface PaginatedResponse<T> {
  current_page: number;
  data: T[];
  first_page_url: string;
  from: number | null;
  last_page: number;
  last_page_url: string;
  links: PaginationLink[];
  next_page_url: string | null;
  path: string;
  per_page: number;
  prev_page_url: string | null;
  to: number | null;
  total: number;
}

export interface PaginationLink {
  url: string | null;
  label: string;
  active: boolean;
}

// --- Auth responses ---

export interface AuthLoginResponse {
  user: User;
  token: string;
  token_type: 'Bearer';
}

export interface AuthRegisterResponse extends AuthLoginResponse {
  calendar_generation: Record<string, unknown>;
}

// --- Team responses ---

export interface TeamSquadResponse {
  team: Team;
  players: SquadPlayer[];
  stats: SquadStats;
}

export interface SquadPlayer {
  id: number;
  full_name: string;
  shirt_number: number | null;
  position: {
    id: number;
    name: string;
    short_name: string;
    category: PositionCategory;
    key_attributes?: string[];
  } | null;
  age: number;
  nationality: string;
  market_value: string;
  current_ability: number;
  potential_ability: number;
  is_injured: boolean;
}

export interface SquadStats {
  total_players: number;
  average_age: number;
  total_value: number;
  average_rating: number;
  injured_players: number;
}

export interface TeamTacticsResponse {
  team: Team;
  tactics: TacticWithPivot[];
}

// --- Formation responses ---

export interface FormationVisualization {
  formation: Formation;
  field_positions: FormationPosition[];
  tactical_setup: {
    defensive_line: number | null;
    midfield_line: number | null;
    attacking_line: number | null;
  };
  width_analysis: {
    left_flank: number;
    center: number;
    right_flank: number;
  };
}

export interface FormationSampleInstructions {
  formation: {
    id: number;
    name: string;
    display_name: string;
    style: FormationStyle;
  };
  sample_instructions: Record<string, unknown>;
  has_sample_instructions: boolean;
}

/** Formations grouped by style — keys are style names. */
export type FormationsByStyle = Record<FormationStyle, Formation[]>;

// --- Tactic responses ---

export interface TacticAnalysis {
  tactic: Tactic;
  formation_analysis: {
    name: string;
    style: FormationStyle;
    defensive_stability: number;  // 0-100
    attacking_threat: number;     // 0-100
    midfield_control: number;     // 0-100
  };
  tactical_summary: {
    approach: string;
    strengths: string[];
    weaknesses: string[];
  };
  recommended_for: string[];
}

export interface TacticAssignResponse {
  tactic: Tactic;
  team: Team;
  is_primary: boolean;
}

// --- League responses ---

export interface LeagueStandingsResponse {
  league: {
    id: number;
    name: string;
    country: string | null;
  };
  standings: StandingEntry[];
  matches_played: number;
}

export interface StandingEntry {
  position: number;
  team: {
    id: number;
    name: string;
    short_name: string;
    primary_color: string | null;
    secondary_color: string | null;
  };
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goals_for: number;
  goals_against: number;
  goal_difference: number;
  points: number;
  form: FormResult[];
}

export interface LeagueOverviewEntry {
  league: { id: number; name: string };
  teams_count: number;
  matches_completed: number;
  matches_total: number;
  total_goals: number;
  avg_goals_per_match: number;
}

// --- Match responses ---

export interface MatchLineupResponse {
  home: {
    team: Team;
    formation: Formation | null;
    starting: MatchLineup[];
    bench: MatchLineup[];
  };
  away: {
    team: Team;
    formation: Formation | null;
    starting: MatchLineup[];
    bench: MatchLineup[];
  };
}

export interface MatchTacticsResponse {
  match: Match;
  home_tactics: TacticWithPivot | null;
  away_tactics: TacticWithPivot | null;
  home_formation: Formation | null;
  away_formation: Formation | null;
}

export interface MatchSimulationResult {
  match: Match;
  events: MatchEvent[];
}

export interface LeagueMatchesResponse {
  matches: Match[];
  league: League;
  season: Season;
}

// --- Time responses ---

export interface GameTimeResponse {
  current_date: string;         // "YYYY-MM-DD"
  formatted_date: string;       // "Monday, January 5, 2026"
  next_match?: Match | null;
  days_until_match?: number | null;
  match_day?: boolean;
}

export interface AdvanceDayResponse {
  message: string;
  current_date: string;
  formatted_date: string;
  next_match: Match | null;
  days_advanced: number;
}

// ---------------------------------------------------------------------------
// 4. API REQUEST PAYLOADS
// ---------------------------------------------------------------------------

export interface RegisterPayload {
  name: string;
  email: string;
  password: string;
  password_confirmation: string;
  managed_team_id: number;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface SaveLineupPayload {
  team_id: number;
  starting: {
    player_id: number;
    position: string;
    x?: number | null;
    y?: number | null;
  }[];
  bench: {
    player_id: number;
  }[];
}

export interface UpdateMatchTacticsPayload {
  team_type: TeamSide;
  formation_id?: number;
  custom_positions?: FormationPosition[];
  player_assignments?: Record<string, number>;
  substitutions?: {
    player_out_id: number;
    player_in_id: number;
    minute?: number;
  }[];
  mentality?: Mentality;
  team_instructions?: TeamInstructions;
  pressing?: PressingLevel;
  tempo?: Tempo;
  width?: Width;
  offside_trap?: boolean;
  play_out_of_defence?: boolean;
  use_offside_trap?: boolean;
  close_down_more?: boolean;
  tackle_harder?: boolean;
  get_stuck_in?: boolean;
}

export interface CreateTacticPayload {
  name: string;
  description?: string;
  formation_id: number;
  mentality: Mentality;
  team_instructions: TeamInstructions;
  defensive_line: DefensiveLine;
  pressing: PressingLevel;
  tempo: Tempo;
  width: Width;
  offside_trap?: boolean;
  play_out_of_defence?: boolean;
  use_offside_trap?: boolean;
  close_down_more?: boolean;
  tackle_harder?: boolean;
  get_stuck_in?: boolean;
  custom_positions?: FormationPosition[];
  player_assignments?: Record<string, number>;
  characteristics?: string[];
}

export interface UpdateTacticPayload extends Partial<CreateTacticPayload> {
  // Extended tactical fields
  attacking_width?: Width;
  approach_play?: ApproachPlay;
  passing_directness?: PassingDirectness;
  time_wasting?: TimeWasting;
  final_third?: FinalThird;
  creative_freedom?: CreativeFreedom;
  work_ball_into_box?: boolean;
  low_crosses?: boolean;
  whipped_crosses?: boolean;
  hit_early_crosses?: boolean;
  counter_press?: boolean;
  counter_attack?: boolean;
  regroup?: boolean;
  hold_shape?: boolean;
  goalkeeper_distribution?: GoalkeeperDistribution;
  distribute_quickly?: boolean;
  slow_pace_down?: boolean;
  roll_out?: boolean;
  throw_long?: boolean;
  take_short_kicks?: boolean;
  take_long_kicks?: boolean;
  line_of_engagement?: DefensiveLine;
  pressing_intensity?: PressingLevel;
  prevent_short_gk_distribution?: boolean;
  tackling?: TacklingStyle;
  pressing_trap?: PressingTrap;
  stay_on_feet?: boolean;
}

export interface AssignTacticPayload {
  team_id: number;
  is_primary?: boolean;
}

export interface AdvanceDayPayload {
  team_id: number;
}

// ---------------------------------------------------------------------------
// 5. SSE (SERVER-SENT EVENTS) SHAPES — Simulation Stream
// ---------------------------------------------------------------------------

/**
 * A single simulation tick — yielded once per simulated minute.
 * This is the `data` payload of the `minute` SSE event.
 * Also the shape of each element in simulateInstant's `minutes` array.
 */
export interface SimulationTick {
  minute: number;
  phase: SimulationPhase;
  possession: TeamSide;
  zone: string;             // 'def_home'|'mid'|'att_home' etc.
  events: SimulationTickEvent[];
  score: {
    home: number;
    away: number;
  };
  stats: MatchStats;
  commentary: string;
}

/** A single event within a simulation tick. */
export interface SimulationTickEvent {
  type: MatchEventType;
  team: TeamSide;
  primary_player_id?: number;
  primary_player_name: string | null;
  secondary_player_id?: number;
  secondary_player_name: string | null;
  outcome?: string;
  description: string;
  coordinates: { x: number; y: number };
  sequence: SequenceStep[];
}

/** SSE `lineup` event data. */
export interface SSELineupData {
  home: {
    team_name: string;
    formation: string | null;
    starting: {
      player_id: number;
      name: string;
      position: string;
      shirt_number: number | null;
    }[];
  };
  away: {
    team_name: string;
    formation: string | null;
    starting: {
      player_id: number;
      name: string;
      position: string;
      shirt_number: number | null;
    }[];
  };
}

/** SSE `goal` event data. */
export interface SSEGoalData {
  minute: number;
  team: TeamSide;
  scorer: string | null;
  assister: string | null;
  score: { home: number; away: number };
}

/** SSE `card` event data. */
export interface SSECardData {
  minute: number;
  team: TeamSide;
  player: string | null;
  card_type: 'yellow' | 'red';
}

/** SSE `half_time` or `full_time` event data. */
export interface SSEPhaseData {
  score: { home: number; away: number };
  stats: MatchStats;
}

/** SSE `error` event data. */
export interface SSEErrorData {
  message: string;
  code: number;
}

/** Instant simulation full response — GET matches/{id}/simulate-instant. */
export interface InstantSimulationResponse {
  match_id: number;
  lineups: SSELineupData;
  minutes: SimulationTick[];
  final_score: { home: number; away: number };
  full_time_stats: MatchStats;
}

// ---------------------------------------------------------------------------
// 6. REDUX STATE SLICE SHAPES
// ---------------------------------------------------------------------------

export type LoadingState = 'idle' | 'loading' | 'succeeded' | 'failed';

export interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  loading: LoadingState;
  error: string | null;
}

export interface TeamState {
  currentTeam: Team | null;
  squad: SquadPlayer[];
  squadStats: SquadStats | null;
  teamTactics: TacticWithPivot[];
  allTeams: Team[];
  loading: LoadingState;
  error: string | null;
}

export interface MatchState_Redux {
  upcomingMatches: Match[];
  leagueMatches: Match[];
  teamMatches: Match[];
  currentMatch: Match | null;
  currentLineup: MatchLineupResponse | null;
  matchEvents: MatchEvent[];
  // Live simulation state
  simulation: {
    isRunning: boolean;
    currentTick: SimulationTick | null;
    ticks: SimulationTick[];
    lineupData: SSELineupData | null;
    finalScore: { home: number; away: number } | null;
    finalStats: MatchStats | null;
    error: string | null;
  };
  loading: LoadingState;
  error: string | null;
}

export interface LeagueState {
  leagues: League[];
  currentLeague: League | null;
  standings: StandingEntry[];
  overview: LeagueOverviewEntry[];
  loading: LoadingState;
  error: string | null;
}

export interface TacticsState {
  tactics: Tactic[];
  currentTactic: Tactic | null;
  tacticAnalysis: TacticAnalysis | null;
  formations: Formation[];
  formationsByStyle: FormationsByStyle | null;
  currentFormation: Formation | null;
  formationVisualization: FormationVisualization | null;
  positions: Position[];
  loading: LoadingState;
  error: string | null;
}

export interface GameTimeState {
  currentDate: string | null;     // "YYYY-MM-DD"
  formattedDate: string | null;
  nextMatch: Match | null;
  daysUntilMatch: number | null;
  isMatchDay: boolean;
  loading: LoadingState;
  error: string | null;
}

/** Root Redux state shape. */
export interface RootState {
  auth: AuthState;
  team: TeamState;
  match: MatchState_Redux;
  league: LeagueState;
  tactics: TacticsState;
  gameTime: GameTimeState;
}
