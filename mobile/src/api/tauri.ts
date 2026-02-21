import { invoke } from '@tauri-apps/api/core';

// ── Auth ──
export const login = (email: string, password: string) =>
  invoke<User>('login', { email, password });

export const register = (name: string, email: string, password: string, managedTeamId: number) =>
  invoke<User>('register', { name, email, password, managed_team_id: managedTeamId });

export const getProfile = (userId: number) =>
  invoke<User | null>('get_profile', { userId });

export const getAvailableTeams = () =>
  invoke<Team[]>('get_available_teams');

// ── Teams ──
export const getTeam = (teamId: number) =>
  invoke<Team | null>('get_team', { teamId });

export const getAllTeams = () =>
  invoke<Team[]>('get_all_teams');

export const getSquad = (teamId: number) =>
  invoke<Player[]>('get_squad', { teamId });

export const getSquadStats = (teamId: number) =>
  invoke<SquadStats>('get_squad_stats', { teamId });

// ── Players ──
export const getPlayer = (playerId: number) =>
  invoke<Player | null>('get_player', { playerId });

export const getPlayerAttributes = (playerId: number) =>
  invoke<PlayerAttributes | null>('get_player_attributes', { playerId });

// ── Formations ──
export const getFormations = () =>
  invoke<Formation[]>('get_formations');

export const getFormation = (formationId: number) =>
  invoke<Formation | null>('get_formation', { formationId });

// ── Tactics ──
export const getTeamTactics = (teamId: number) =>
  invoke<Tactic[]>('get_team_tactics', { teamId });

export const createTactic = (payload: CreateTacticPayload) =>
  invoke<Tactic>('create_tactic', { payload });

export const updateTactic = (tacticId: number, payload: UpdateTacticPayload) =>
  invoke<void>('update_tactic', { tacticId, payload });

export const deleteTactic = (tacticId: number) =>
  invoke<void>('delete_tactic', { tacticId });

export const assignTacticToTeam = (tacticId: number, teamId: number, isPrimary: boolean) =>
  invoke<void>('assign_tactic_to_team', { tacticId, teamId, isPrimary });

// ── Matches ──
export const getUpcomingMatches = (leagueId?: number, limit?: number) =>
  invoke<GameMatch[]>('get_upcoming_matches', { leagueId, limit });

export const getTeamMatches = (teamId: number) =>
  invoke<GameMatch[]>('get_team_matches', { teamId });

export const getMatchDetails = (matchId: number) =>
  invoke<GameMatch | null>('get_match_details', { matchId });

export const getMatchLineup = (matchId: number, teamId: number) =>
  invoke<MatchLineup[]>('get_match_lineup', { matchId, teamId });

export const saveMatchLineup = (matchId: number, teamId: number, payload: SaveLineupPayload) =>
  invoke<void>('save_match_lineup', { matchId, teamId, payload });

export const getMatchEvents = (matchId: number) =>
  invoke<MatchEvent[]>('get_match_events', { matchId });

export const resetMatch = (matchId: number) =>
  invoke<void>('reset_match', { matchId });

// ── Leagues ──
export const getLeagues = () =>
  invoke<League[]>('get_leagues');

export const getStandings = (leagueId: number) =>
  invoke<StandingEntry[]>('get_standings', { leagueId });

// ── Positions ──
export const getPositions = () =>
  invoke<Position[]>('get_positions');

// ── Game Time ──
export const getCurrentDate = (userId: number) =>
  invoke<GameTimeResponse>('get_current_date', { userId });

export const advanceDay = (userId: number) =>
  invoke<GameTimeResponse>('advance_day', { userId });

export const advanceToMatch = (userId: number) =>
  invoke<GameTimeResponse>('advance_to_match', { userId });

// ── Simulation ──
export const simulateMatch = (matchId: number, speed: string) =>
  invoke<void>('simulate_match', { matchId, speed });

// ── Types ──
export interface User {
  id: number;
  name: string;
  email: string;
  managed_team_id: number | null;
  game_date: string | null;
}

export interface Team {
  id: number;
  name: string;
  short_name: string | null;
  city: string | null;
  stadium_name: string | null;
  stadium_capacity: number | null;
  league_id: number | null;
  budget: number | null;
  reputation: number | null;
  primary_color: string | null;
  secondary_color: string | null;
  founded_year: number | null;
  primary_tactic_id: number | null;
}

export interface Player {
  id: number;
  first_name: string;
  last_name: string;
  date_of_birth: string | null;
  nationality: string | null;
  preferred_foot: string | null;
  height_cm: number | null;
  weight_kg: number | null;
  team_id: number | null;
  primary_position_id: number | null;
  market_value: number | null;
  wage_per_week: number | null;
  shirt_number: number | null;
  is_injured: boolean;
  contract_start: string | null;
  contract_end: string | null;
  position_name: string | null;
  position_short: string | null;
}

export interface PlayerAttributes {
  player_id: number;
  finishing: number; first_touch: number; free_kick_taking: number; heading: number;
  long_shots: number; long_throws: number; marking: number; passing: number;
  penalty_taking: number; tackling: number; technique: number; corners: number;
  crossing: number; dribbling: number;
  aggression: number; anticipation: number; bravery: number; composure: number;
  concentration: number; decisions: number; determination: number; flair: number;
  leadership: number; off_the_ball: number; positioning: number; teamwork: number;
  vision: number; work_rate: number;
  acceleration: number; agility: number; balance: number; jumping_reach: number;
  natural_fitness: number; pace: number; stamina: number; strength: number;
  aerial_reach: number; command_of_area: number; communication: number;
  eccentricity: number; handling: number; kicking: number; one_on_ones: number;
  reflexes: number; rushing_out: number; throwing: number;
  current_ability: number; potential_ability: number;
}

export interface Formation {
  id: number;
  name: string;
  display_name: string | null;
  description: string | null;
  positions: string;
  style: string | null;
  defenders_count: number;
  midfielders_count: number;
  forwards_count: number;
  is_active: boolean;
}

export interface Tactic {
  id: number;
  name: string;
  description: string | null;
  formation_id: number | null;
  mentality: string | null;
  team_instructions: string | null;
  pressing: string | null;
  tempo: string | null;
  width: string | null;
  defensive_line: string | null;
  offside_trap: boolean;
  play_out_of_defence: boolean;
  formation_name: string | null;
}

export interface CreateTacticPayload {
  name: string;
  formation_id: number;
  mentality?: string;
  team_instructions?: string;
  pressing?: string;
  tempo?: string;
  width?: string;
  defensive_line?: string;
}

export interface UpdateTacticPayload {
  name?: string;
  formation_id?: number;
  mentality?: string;
  team_instructions?: string;
  pressing?: string;
  tempo?: string;
  width?: string;
  defensive_line?: string;
}

export interface GameMatch {
  id: number;
  home_team_id: number;
  away_team_id: number;
  league_id: number | null;
  season_id: number | null;
  manager_id: number | null;
  match_date: string | null;
  matchday: number | null;
  home_formation_id: number | null;
  away_formation_id: number | null;
  home_score: number | null;
  away_score: number | null;
  status: string;
  match_stats: string | null;
  home_team_name: string | null;
  away_team_name: string | null;
  home_team_color: string | null;
  away_team_color: string | null;
  home_formation_name: string | null;
  away_formation_name: string | null;
}

export interface MatchLineup {
  id: number;
  match_id: number;
  team_id: number;
  player_id: number;
  is_starting: boolean;
  position: string | null;
  sort_order: number | null;
  x: number | null;
  y: number | null;
  player_name: string | null;
  shirt_number: number | null;
}

export interface SaveLineupPayload {
  starters: LineupEntry[];
  bench: LineupEntry[];
}

export interface LineupEntry {
  player_id: number;
  position?: string;
  sort_order?: number;
  x?: number;
  y?: number;
}

export interface MatchEvent {
  id: number;
  match_id: number;
  minute: number;
  event_type: string;
  team_type: string | null;
  player_name: string | null;
  description: string | null;
  x_coordinate: number | null;
  y_coordinate: number | null;
  commentary: string | null;
  sub_events: string | null;
}

export interface League {
  id: number;
  name: string;
  country: string | null;
  level: number | null;
  reputation: number | null;
}

export interface StandingEntry {
  team_id: number;
  team_name: string;
  short_name: string | null;
  primary_color: string | null;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goals_for: number;
  goals_against: number;
  goal_difference: number;
  points: number;
  form: string[];
  position: number;
}

export interface Position {
  id: number;
  name: string;
  short_name: string;
  category: string;
}

export interface GameTimeResponse {
  current_date: string;
  formatted_date: string;
  next_match: GameMatch | null;
  days_until_match: number | null;
  is_match_day: boolean;
}

export interface SquadStats {
  total_players: number;
  avg_age: number;
  avg_rating: number;
  injured_count: number;
  total_value: number;
}

export interface SimulationTick {
  minute: number;
  phase: string;
  possession: string;
  zone: string;
  ball: { x: number; y: number };
  events: SimulationEvent[];
  score: { home: number; away: number };
  stats: { home: TeamStats; away: TeamStats };
  commentary: string;
}

export interface SimulationEvent {
  event_type: string;
  team: string;
  primary_player: string | null;
  secondary_player: string | null;
  description: string;
  x: number;
  y: number;
}

export interface TeamStats {
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

export interface LineupData {
  home: LineupPlayer[];
  away: LineupPlayer[];
}

export interface LineupPlayer {
  id: number;
  name: string;
  shirt_number: number;
  position: string;
  x: number;
  y: number;
  team: string;
}
