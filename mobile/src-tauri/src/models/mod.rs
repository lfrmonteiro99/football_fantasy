use serde::{Deserialize, Serialize};

// ── Auth ──

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct User {
    pub id: i64,
    pub name: String,
    pub email: String,
    pub managed_team_id: Option<i64>,
    pub game_date: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct LoginPayload {
    pub email: String,
    pub password: String,
}

#[derive(Debug, Deserialize)]
pub struct RegisterPayload {
    pub name: String,
    pub email: String,
    pub password: String,
    pub managed_team_id: i64,
}

// ── Teams ──

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Team {
    pub id: i64,
    pub name: String,
    pub short_name: Option<String>,
    pub city: Option<String>,
    pub stadium_name: Option<String>,
    pub stadium_capacity: Option<i64>,
    pub league_id: Option<i64>,
    pub budget: Option<f64>,
    pub reputation: Option<f64>,
    pub primary_color: Option<String>,
    pub secondary_color: Option<String>,
    pub founded_year: Option<i64>,
    pub primary_tactic_id: Option<i64>,
}

// ── Players ──

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Player {
    pub id: i64,
    pub first_name: String,
    pub last_name: String,
    pub date_of_birth: Option<String>,
    pub nationality: Option<String>,
    pub preferred_foot: Option<String>,
    pub height_cm: Option<i64>,
    pub weight_kg: Option<i64>,
    pub team_id: Option<i64>,
    pub primary_position_id: Option<i64>,
    pub market_value: Option<f64>,
    pub wage_per_week: Option<f64>,
    pub shirt_number: Option<i64>,
    pub is_injured: bool,
    pub contract_start: Option<String>,
    pub contract_end: Option<String>,
    pub position_name: Option<String>,
    pub position_short: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PlayerAttributes {
    pub player_id: i64,
    // Technical
    pub finishing: i64,
    pub first_touch: i64,
    pub free_kick_taking: i64,
    pub heading: i64,
    pub long_shots: i64,
    pub long_throws: i64,
    pub marking: i64,
    pub passing: i64,
    pub penalty_taking: i64,
    pub tackling: i64,
    pub technique: i64,
    pub corners: i64,
    pub crossing: i64,
    pub dribbling: i64,
    // Mental
    pub aggression: i64,
    pub anticipation: i64,
    pub bravery: i64,
    pub composure: i64,
    pub concentration: i64,
    pub decisions: i64,
    pub determination: i64,
    pub flair: i64,
    pub leadership: i64,
    pub off_the_ball: i64,
    pub positioning: i64,
    pub teamwork: i64,
    pub vision: i64,
    pub work_rate: i64,
    // Physical
    pub acceleration: i64,
    pub agility: i64,
    pub balance: i64,
    pub jumping_reach: i64,
    pub natural_fitness: i64,
    pub pace: i64,
    pub stamina: i64,
    pub strength: i64,
    // Goalkeeping
    pub aerial_reach: i64,
    pub command_of_area: i64,
    pub communication: i64,
    pub eccentricity: i64,
    pub handling: i64,
    pub kicking: i64,
    pub one_on_ones: i64,
    pub reflexes: i64,
    pub rushing_out: i64,
    pub throwing: i64,
    // Overall
    pub current_ability: f64,
    pub potential_ability: f64,
}

// ── Formations ──

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Formation {
    pub id: i64,
    pub name: String,
    pub display_name: Option<String>,
    pub description: Option<String>,
    pub positions: String, // JSON array
    pub style: Option<String>,
    pub defenders_count: i64,
    pub midfielders_count: i64,
    pub forwards_count: i64,
    pub is_active: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FormationPosition {
    pub position: String,
    pub x: f64,
    pub y: f64,
}

// ── Tactics ──

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Tactic {
    pub id: i64,
    pub name: String,
    pub description: Option<String>,
    pub formation_id: Option<i64>,
    pub mentality: Option<String>,
    pub team_instructions: Option<String>,
    pub pressing: Option<String>,
    pub tempo: Option<String>,
    pub width: Option<String>,
    pub defensive_line: Option<String>,
    pub offside_trap: bool,
    pub play_out_of_defence: bool,
    pub formation_name: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct CreateTacticPayload {
    pub name: String,
    pub formation_id: i64,
    pub mentality: Option<String>,
    pub team_instructions: Option<String>,
    pub pressing: Option<String>,
    pub tempo: Option<String>,
    pub width: Option<String>,
    pub defensive_line: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateTacticPayload {
    pub name: Option<String>,
    pub formation_id: Option<i64>,
    pub mentality: Option<String>,
    pub team_instructions: Option<String>,
    pub pressing: Option<String>,
    pub tempo: Option<String>,
    pub width: Option<String>,
    pub defensive_line: Option<String>,
}

// ── Matches ──

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GameMatch {
    pub id: i64,
    pub home_team_id: i64,
    pub away_team_id: i64,
    pub league_id: Option<i64>,
    pub season_id: Option<i64>,
    pub manager_id: Option<i64>,
    pub match_date: Option<String>,
    pub matchday: Option<i64>,
    pub home_formation_id: Option<i64>,
    pub away_formation_id: Option<i64>,
    pub home_score: Option<i64>,
    pub away_score: Option<i64>,
    pub status: String,
    pub match_stats: Option<String>,
    pub home_team_name: Option<String>,
    pub away_team_name: Option<String>,
    pub home_team_color: Option<String>,
    pub away_team_color: Option<String>,
    pub home_formation_name: Option<String>,
    pub away_formation_name: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MatchEvent {
    pub id: i64,
    pub match_id: i64,
    pub minute: i64,
    pub event_type: String,
    pub team_type: Option<String>,
    pub player_name: Option<String>,
    pub description: Option<String>,
    pub x_coordinate: Option<f64>,
    pub y_coordinate: Option<f64>,
    pub commentary: Option<String>,
    pub sub_events: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MatchLineup {
    pub id: i64,
    pub match_id: i64,
    pub team_id: i64,
    pub player_id: i64,
    pub is_starting: bool,
    pub position: Option<String>,
    pub sort_order: Option<i64>,
    pub x: Option<f64>,
    pub y: Option<f64>,
    pub player_name: Option<String>,
    pub shirt_number: Option<i64>,
}

#[derive(Debug, Deserialize)]
pub struct SaveLineupPayload {
    pub starters: Vec<LineupEntry>,
    pub bench: Vec<LineupEntry>,
}

#[derive(Debug, Deserialize)]
pub struct LineupEntry {
    pub player_id: i64,
    pub position: Option<String>,
    pub sort_order: Option<i64>,
    pub x: Option<f64>,
    pub y: Option<f64>,
}

// ── Leagues ──

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct League {
    pub id: i64,
    pub name: String,
    pub country: Option<String>,
    pub level: Option<i64>,
    pub reputation: Option<f64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StandingEntry {
    pub team_id: i64,
    pub team_name: String,
    pub short_name: Option<String>,
    pub primary_color: Option<String>,
    pub played: i64,
    pub won: i64,
    pub drawn: i64,
    pub lost: i64,
    pub goals_for: i64,
    pub goals_against: i64,
    pub goal_difference: i64,
    pub points: i64,
    pub form: Vec<String>,
    pub position: i64,
}

// ── Positions ──

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Position {
    pub id: i64,
    pub name: String,
    pub short_name: String,
    pub category: String,
}

// ── Game Time ──

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GameTimeResponse {
    pub current_date: String,
    pub formatted_date: String,
    pub next_match: Option<GameMatch>,
    pub days_until_match: Option<i64>,
    pub is_match_day: bool,
}

// ── Simulation ──

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SimulationTick {
    pub minute: i64,
    pub phase: String,
    pub possession: String,
    pub zone: String,
    pub ball: BallPosition,
    pub events: Vec<SimulationEvent>,
    pub score: Score,
    pub stats: MatchStats,
    pub commentary: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BallPosition {
    pub x: f64,
    pub y: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Score {
    pub home: i64,
    pub away: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MatchStats {
    pub home: TeamStats,
    pub away: TeamStats,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TeamStats {
    pub possession_pct: f64,
    pub shots: i64,
    pub shots_on_target: i64,
    pub corners: i64,
    pub fouls: i64,
    pub yellow_cards: i64,
    pub red_cards: i64,
    pub saves: i64,
    pub passes: i64,
    pub tackles: i64,
    pub offsides: i64,
}

impl TeamStats {
    pub fn new() -> Self {
        Self {
            possession_pct: 50.0,
            shots: 0,
            shots_on_target: 0,
            corners: 0,
            fouls: 0,
            yellow_cards: 0,
            red_cards: 0,
            saves: 0,
            passes: 0,
            tackles: 0,
            offsides: 0,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SimulationEvent {
    pub event_type: String,
    pub team: String,
    pub primary_player: Option<String>,
    pub secondary_player: Option<String>,
    pub description: String,
    pub x: f64,
    pub y: f64,
    pub sequence: Vec<SequenceStep>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SequenceStep {
    pub action: String,
    pub actor: Option<String>,
    pub ball_start: BallPosition,
    pub ball_end: BallPosition,
    pub duration_ms: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LineupData {
    pub home: Vec<LineupPlayer>,
    pub away: Vec<LineupPlayer>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LineupPlayer {
    pub id: i64,
    pub name: String,
    pub shirt_number: i64,
    pub position: String,
    pub x: f64,
    pub y: f64,
    pub team: String,
}

// ── Squad Stats ──

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SquadStats {
    pub total_players: i64,
    pub avg_age: f64,
    pub avg_rating: f64,
    pub injured_count: i64,
    pub total_value: f64,
}
