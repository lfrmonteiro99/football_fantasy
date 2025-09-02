// Core Types
export interface Team {
  id: number;
  name: string;
  players: Player[];
  formation?: string;
  tactic?: Tactic;
}

export interface Player {
  id: number;
  first_name: string;
  last_name: string;
  shirt_number: number;
  primary_position: Position;
  attributes: PlayerAttributes;
  team_id: number;
}

export interface Position {
  id: number;
  name: string;
  short_name: string;
  category: string;
  key_attributes: string[];
}

export interface PlayerAttributes {
  pace: number;
  shooting: number;
  passing: number;
  dribbling: number;
  defending: number;
  physical: number;
  stamina: number;
  strength: number;
  acceleration: number;
  sprint_speed: number;
  finishing: number;
  shot_power: number;
  long_shots: number;
  volleys: number;
  penalties: number;
  vision: number;
  crossing: number;
  free_kick_accuracy: number;
  short_passing: number;
  long_passing: number;
  curve: number;
  agility: number;
  balance: number;
  reactions: number;
  ball_control: number;
  dribbling_skill: number;
  composure: number;
  interceptions: number;
  heading_accuracy: number;
  marking: number;
  standing_tackle: number;
  sliding_tackle: number;
  jumping: number;
  stamina_attr: number;
  strength_attr: number;
  aggression: number;
}

export interface Tactic {
  id: number;
  name: string;
  formation_id: number;
  mentality: string;
  custom_positions?: CustomPosition[];
  player_assignments?: PlayerAssignment[];
  [key: string]: any;
}

export interface CustomPosition {
  id: number;
  x: number;
  y: number;
  position_type: string;
}

export interface PlayerAssignment {
  player_id: number;
  position_id: number;
  custom_x?: number;
  custom_y?: number;
}

// Simulation Types
export interface MatchContext {
  // PHASE 1: Tick-based system (1-second ticks, 5400 total)
  tick: number; // Current tick (0-5399)
  currentSecond: number; // Derived: tick
  currentMinute: number; // Derived: Math.floor(tick / 60)
  homeTeam: Team;
  awayTeam: Team;
  homeTactic?: Tactic;
  awayTactic?: Tactic;
  score: { home: number; away: number };
  possession: PossessionState;
  ballPosition: BallPosition;
  playerPositions: Map<number, PlayerPosition>;
  fatigueLevels: Record<string, number>;
  previousFatigueLevels?: Record<string, number>;
  momentum: string;
  intensity: string;
  matchEvents: MatchEvent[];
  statistics: MatchStatistics;
  weather: string;
  stadium: string;
  options: SimulationOptions;
  
  // PHASE 1: Action timing system
  actionDurations: Record<string, number>; // Duration in ticks for each action type
  globalCooldowns: Record<string, number>; // Global cooldowns that decrement each tick
  
  // Legacy support (will be removed after Phase 1)
  lastPossessionChange?: number;
  possessionProtection?: {
    playerId: number;
    team: 'home' | 'away';
    expiresAt: number;
  };
  lastPlayerEventTime?: Record<number, number>;
  playerFailureMemory?: Record<number, {
    lastFailedAction?: string;
    lastFailureTime?: number;
    consecutiveFailures?: number;
    lastOpponentId?: number;
    lastActionTick?: number; // PHASE 2: Track when last action was taken
  }>;
  // ROBUST DESIGN B: Action state management
  activeActions?: Map<number, PlayerActionState>; // Track all active player actions
  actionQueue?: Map<number, string[]>; // Queued actions per player
  contestHistory?: ContestRecord[]; // History of ball contests for analysis
}

export interface BallPosition {
  x: number;
  y: number;
  speed: number;
  direction: number;
  status: BallStatus;
}

export type BallStatus = 'in_play' | 'out_of_play' | 'goal_area' | 'corner' | 'free_kick' | 'penalty';

export interface PlayerPosition {
  playerId: number;
  x: number;
  y: number;
  speed: number;
  direction: number;
  action: PlayerAction;
  actionTimer: number; // NEW: Remaining ticks for current action
  currentAction?: string; // NEW: Current action being performed
  energy: number;
  role?: string;
  team: 'home' | 'away';
  // PHASE 1: Action system properties
  lastActionTick?: number; // Last tick when action was initiated
  actionCooldowns?: Record<string, number>; // Cooldown timers per action type
  // ROBUST DESIGN B: Enhanced action states and timers
  actionState: PlayerActionState; // Current action state
  intentTarget?: { x: number; y: number; playerId?: number }; // Target of current intent
  actionStartTick?: number; // When current action started
  queuedAction?: string; // Next action to perform after current completes
  physicalState: PlayerPhysicalState; // Physical condition affecting actions
}

export type PlayerAction = 'standing' | 'walking' | 'running' | 'sprinting' | 'tackling' | 'shooting' | 'passing' | 'dribbling' | 'positioning';

export interface PlayerActionState {
  current: 'idle' | 'preparing' | 'executing' | 'recovering' | 'contested';
  phase: number; // 0-100 completion percentage
  canInterrupt: boolean; // Whether action can be interrupted
  priority: number; // Action priority (higher = harder to interrupt)
  target?: any; // Target of the action (player, position, etc.)
}

export interface PlayerPhysicalState {
  fatigue: number; // 0-1 fatigue level
  balance: number; // 0-1 balance state
  momentum: { x: number; y: number }; // Current momentum vector
  recovery: number; // Recovery time from previous action
  stamina: number; // Current stamina level
}

export interface PossessionState {
  team: 'home' | 'away';
  playerId?: number;
  timestamp: number;
}

export interface MatchEvent {
  minute: number;
  type: EventType;
  description: string;
  commentary: string;
  playerId?: number;
  playerName?: string; // CRITICAL FIX: Add player name for logging
  team?: 'home' | 'away';
}

export type EventType = 
  | 'goal' 
  | 'shot' 
  | 'shot_on_target'
  | 'shot_off_target'
  | 'pass' 
  | 'tackle' 
  | 'tackle_success'
  | 'tackle_failed'
  | 'foul' 
  | 'yellow_card' 
  | 'red_card' 
  | 'corner' 
  | 'free_kick' 
  | 'penalty' 
  | 'offside' 
  | 'substitution' 
  | 'injury' 
  | 'save' 
  | 'cross' 
  | 'header' 
  | 'volley' 
  | 'long_shot' 
  | 'breakaway' 
  | 'counter_attack'
  | 'dribbling'
  | 'interception'
  | 'clearance'
  | 'pressing';

export interface SecondUpdate {
  timestamp: number;
  minute: number;
  ballPosition: BallPosition;
  playerPositions: PlayerPosition[];
  possession: PossessionState;
  events: MatchEvent[];
  fatigueLevels: Record<string, number>;
  momentum: string;
  intensity: string;
  commentary?: string;
  statistics: MatchStatistics;
}

export interface MatchStatistics {
  possession: { home: number; away: number };
  passes: { home: number; away: number };
  shots: { home: number; away: number };
  shots_on_target: { home: number; away: number };
  tackles: { home: number; away: number };
  fouls: { home: number; away: number };
  cards: { 
    home: { yellow: number; red: number }; 
    away: { yellow: number; red: number } 
  };
  corners: { home: number; away: number };
  offsides: { home: number; away: number };
  saves: { home: number; away: number };
  clearances: { home: number; away: number };
  interceptions: { home: number; away: number };
}

export class RealTimeMatchStream {
  public updates: SecondUpdate[] = [];
  public finalScore: { home: number; away: number } = { home: 0, away: 0 };
  public matchStatistics: MatchStatistics = {
    possession: { home: 50, away: 50 },
    passes: { home: 0, away: 0 },
    shots: { home: 0, away: 0 },
    shots_on_target: { home: 0, away: 0 },
    tackles: { home: 0, away: 0 },
    fouls: { home: 0, away: 0 },
    cards: { home: { yellow: 0, red: 0 }, away: { yellow: 0, red: 0 } },
    corners: { home: 0, away: 0 },
    offsides: { home: 0, away: 0 },
    saves: { home: 0, away: 0 },
    clearances: { home: 0, away: 0 },
    interceptions: { home: 0, away: 0 }
  };
  public events: MatchEvent[] = [];
  public totalSeconds: number = 0;
  public duration: number = 0;
  public performance: {
    simulationTime: number;
    updatesPerSecond: number;
    memoryUsage: number;
  } = {
    simulationTime: 0,
    updatesPerSecond: 0,
    memoryUsage: 0
  };
  
  public addUpdate(update: SecondUpdate): void {
    this.updates.push(update);
    
    // Add events to main events array
    for (const event of update.events) {
      this.events.push(event);
    }
  }
  
  public setFinalScore(score: { home: number; away: number }): void {
    this.finalScore = score;
  }
  
  public setMatchStatistics(statistics: MatchStatistics): void {
    this.matchStatistics = statistics;
  }
  
  public toArray(): any {
    return {
      updates: this.updates.map(update => this.updateToArray(update)),
      final_score: this.finalScore,
      match_statistics: this.matchStatistics,
      events: this.events.map(event => this.eventToArray(event)),
      total_seconds: this.updates.length,
      duration: this.duration,
      performance: this.performance
    };
  }
  
  private updateToArray(update: SecondUpdate): any {
    return {
      timestamp: update.timestamp,
      minute: update.minute,
      ball_position: {
        x: update.ballPosition?.x ?? 50,
        y: update.ballPosition?.y ?? 50,
        speed: update.ballPosition?.speed ?? 0,
        direction: update.ballPosition?.direction ?? 0,
        status: update.ballPosition?.status ?? 'in_play'
      },
      player_positions: update.playerPositions.map(pos => ({
        player_id: pos.playerId,
        x: pos.x,
        y: pos.y,
        speed: pos.speed,
        direction: pos.direction,
        action: pos.action,
        energy: pos.energy
      })),
      possession: {
        team: update.possession.team,
        player_id: update.possession.playerId,
        timestamp: update.possession.timestamp
      },
      events: update.events.map(event => this.eventToArray(event)),
      fatigue_levels: update.fatigueLevels,
      momentum: update.momentum,
      intensity: update.intensity,
      commentary: update.commentary,
      statistics: update.statistics
    };
  }
  
  private eventToArray(event: MatchEvent): any {
    return {
      minute: event.minute,
      type: event.type,
      description: event.description,
      commentary: event.commentary,
      playerId: event.playerId,
      team: event.team
    };
  }
}

// API Types
export interface SimulationRequest {
  home_team: Team;
  away_team: Team;
  home_tactic?: Tactic;
  away_tactic?: Tactic;
  weather?: string;
  stadium?: string;
  options?: SimulationOptions;
}

export interface SimulationOptions {
  realTime?: boolean;
  tickRate?: number;
  maxDuration?: number;
  enableCommentary?: boolean;
  enableStatistics?: boolean;
  enableFatigue?: boolean;
  enableMomentum?: boolean;
  enableWeather?: boolean;
}

export interface SimulationResponse {
  success: boolean;
  data?: RealTimeMatchStream;
  error?: string;
  performance?: {
    simulationTime: number;
    memoryUsage: number;
    cpuUsage: number;
  };
}

// Engine Types
export interface EngineResult {
  success: boolean;
  data: any;
  error?: string;
}

export interface BallMovement {
  x: number;
  y: number;
  speed: number;
  direction: number;
}

export interface PlayerMovement {
  x: number;
  y: number;
  speed: number;
  direction: number;
  action: PlayerAction;
}

export interface EventProbability {
  type: EventType;
  probability: number;
  conditions: EventCondition[];
}

export interface EventCondition {
  type: 'position' | 'possession' | 'fatigue' | 'momentum' | 'tactical';
  value: any;
  operator: 'equals' | 'greater_than' | 'less_than' | 'in_range' | 'near';
}

export interface ContestRecord {
  tick: number;
  type: 'pass' | 'tackle' | 'header' | 'loose_ball';
  participants: number[]; // Player IDs
  winner: number; // Winner player ID
  ballPosition: { x: number; y: number };
  duration: number; // How many ticks the contest lasted
} 