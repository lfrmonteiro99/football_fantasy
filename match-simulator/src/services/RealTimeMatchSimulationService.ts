import { 
  MatchContext, 
  SecondUpdate, 
  RealTimeMatchStream, 
  SimulationRequest, 
  SimulationOptions,
  BallPosition,
  PlayerPosition,
  PossessionState,
  MatchEvent,
  MatchStatistics
} from '../types';
import { BallPositionEngine } from './engines/BallPositionEngine';
import { PlayerPositionEngine } from './engines/PlayerPositionEngine';
import { PossessionEngine } from './engines/PossessionEngine';
import { EventDetectionEngine } from './engines/EventDetectionEngine';
import { FatigueEngine } from './engines/FatigueEngine';
import { MomentumEngine } from './engines/MomentumEngine';
import { TacticalAnalysisEngine } from './engines/TacticalAnalysisEngine';
import { CommentaryEngine } from './engines/CommentaryEngine';
import { StatisticsEngine } from './engines/StatisticsEngine';
import { Logger } from '../utils/Logger';
import { MathUtils } from '../utils/MathUtils';

export class RealTimeMatchSimulationService {
  private static readonly SECONDS_PER_MINUTE = 60;
  private static readonly MATCH_DURATION_SECONDS = 90 * this.SECONDS_PER_MINUTE;
  
  private ballEngine: BallPositionEngine;
  private playerEngine: PlayerPositionEngine;
  private possessionEngine: PossessionEngine;
  private eventEngine: EventDetectionEngine;
  private fatigueEngine: FatigueEngine;
  private momentumEngine: MomentumEngine;
  private tacticalEngine: TacticalAnalysisEngine;
  private commentaryEngine: CommentaryEngine;
  private statisticsEngine: StatisticsEngine;
  
  constructor() {
    this.ballEngine = new BallPositionEngine();
    this.playerEngine = new PlayerPositionEngine();
    this.possessionEngine = new PossessionEngine();
    this.eventEngine = new EventDetectionEngine();
    this.fatigueEngine = new FatigueEngine();
    this.momentumEngine = new MomentumEngine();
    this.tacticalEngine = new TacticalAnalysisEngine();
    this.commentaryEngine = new CommentaryEngine();
    this.statisticsEngine = new StatisticsEngine();
  }
  
  public async simulateRealTimeMatch(request: SimulationRequest): Promise<RealTimeMatchStream> {
    const startTime = performance.now();
    const memoryStart = process.memoryUsage();
    
    try {
      Logger.info('Starting real-time match simulation', {
        homeTeam: request.home_team.name,
        awayTeam: request.away_team.name,
        options: request.options
      });
      
      const context = this.createMatchContext(request);
      const stream = new RealTimeMatchStream();
      
      // Initialize starting positions
      this.initializeStartingPositions(context);
      
      const tickRate = request.options?.tickRate || parseInt(process.env.SIMULATION_TICK_RATE || '60');
      const maxDuration = request.options?.maxDuration || RealTimeMatchSimulationService.MATCH_DURATION_SECONDS;
      
      // Generate updates every 5 seconds for better real-time feel while maintaining performance
      const updateInterval = 5; // seconds (smaller response)
      const totalUpdates = Math.floor(maxDuration / updateInterval);
      
      Logger.info(`Simulation parameters: ${tickRate}Hz, ${maxDuration}s duration, ${totalUpdates} updates`);
      
      // Main simulation loop - generate updates every 30 seconds
      for (let updateIndex = 0; updateIndex < totalUpdates; updateIndex++) {
        const second = updateIndex * updateInterval;
        context.currentSecond = second;
        context.currentMinute = Math.floor(second / RealTimeMatchSimulationService.SECONDS_PER_MINUTE);
        
        // Generate update for this time interval
        const update = await this.generateSecondUpdate(context, request.options);
        stream.updates.push(update);
        
        // Update match state
        this.updateMatchState(context, update);
        
        // Check for match end conditions
        if (this.shouldEndMatch(context)) {
          Logger.info('Match ended early due to conditions', { 
            minute: context.currentMinute,
            score: context.score 
          });
          break;
        }
        
        // Performance optimization: yield control every 50 updates
        if (updateIndex % 50 === 0) {
          await new Promise(resolve => setImmediate(resolve));
        }
      }
      
      // Finalize simulation
      stream.finalScore = context.score;
      stream.matchStatistics = this.statisticsEngine.calculateFinalStatistics(context);
      stream.events = context.matchEvents;
      stream.totalSeconds = context.currentSecond;
      stream.duration = performance.now() - startTime;
      
      // Performance metrics
      const memoryEnd = process.memoryUsage();
      stream.performance = {
        simulationTime: stream.duration,
        updatesPerSecond: stream.updates.length / (stream.duration / 1000),
        memoryUsage: memoryEnd.heapUsed - memoryStart.heapUsed
      };
      
      Logger.info('Match simulation completed', {
        duration: stream.duration,
        updates: stream.updates.length,
        events: stream.events.length,
        finalScore: stream.finalScore
      });
      
      return stream;
      
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      Logger.error('Match simulation failed', { error: errorMessage });
      throw error;
    }
  }
  
  private createMatchContext(request: SimulationRequest): MatchContext {
    return {
      tick: 0,
      homeTeam: request.home_team,
      awayTeam: request.away_team,
      homeTactic: request.home_tactic,
      awayTactic: request.away_tactic,
      weather: request.weather || 'normal',
      stadium: request.stadium || 'default',
      currentSecond: 0,
      currentMinute: 0,
      score: { home: 0, away: 0 },
      ballPosition: { x: 50, y: 50, speed: 0, direction: 0, status: 'in_play' },
      playerPositions: new Map<number, PlayerPosition>(),
      possession: { team: 'home', timestamp: 0 },
      fatigueLevels: {},
      momentum: 'balanced',
      intensity: 'medium',
      matchEvents: [],
      statistics: {
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
      },
      actionDurations: {},
      globalCooldowns: {},
      options: request.options || {}
    };
  }
  
  private initializeStartingPositions(context: MatchContext): void {
    // Initialize ball at center
    context.ballPosition = { x: 50, y: 50, speed: 0, direction: 0, status: 'in_play' };
    
    // Initialize player positions based on tactics
    const homePositions = this.playerEngine.initializePlayerPositions(context, 'home');
    const awayPositions = this.playerEngine.initializePlayerPositions(context, 'away');
    
    homePositions.forEach((pos: PlayerPosition, playerId: number) => {
      context.playerPositions.set(playerId, pos);
    });
    
    awayPositions.forEach((pos: PlayerPosition, playerId: number) => {
      context.playerPositions.set(playerId, pos);
    });
    
    // Initialize possession
    context.possession = { team: 'home', timestamp: 0 };
    
    // Set up kick-off: find a central midfielder and place them at ball position
    let kickOffPlayer = null;
    
    // Look for a central midfielder first
    for (const [playerId, position] of context.playerPositions) {
      if (position.team === 'home' && (position.role === 'CM' || position.role === 'DM' || position.role === 'AM')) {
        kickOffPlayer = position;
        break;
      }
    }
    
    // If no midfielder found, use any home player
    if (!kickOffPlayer) {
      for (const [playerId, position] of context.playerPositions) {
        if (position.team === 'home') {
          kickOffPlayer = position;
          break;
        }
      }
    }
    
    // Position the kick-off player exactly at the ball
    if (kickOffPlayer) {
      kickOffPlayer.x = 50;
      kickOffPlayer.y = 50;
      kickOffPlayer.action = 'positioning' as any;
      console.log(`Kick-off player ${kickOffPlayer.playerId} positioned at (50,50)`);
    }
    
    // Initialize fatigue levels
    const homeFatigue = this.fatigueEngine.initializeFatigueLevels(context, 'home');
    const awayFatigue = this.fatigueEngine.initializeFatigueLevels(context, 'away');
    
    homeFatigue.forEach((fatigue: number, playerId: number) => {
      context.fatigueLevels[playerId.toString()] = fatigue;
    });
    
    awayFatigue.forEach((fatigue: number, playerId: number) => {
      context.fatigueLevels[playerId.toString()] = fatigue;
    });
  }
  
  private async generateSecondUpdate(context: MatchContext, options?: SimulationOptions): Promise<SecondUpdate> {
    const update: SecondUpdate = {
      timestamp: context.currentSecond,
      minute: context.currentMinute,
      ballPosition: { x: 0, y: 0, speed: 0, direction: 0, status: 'in_play' },
      playerPositions: [],
      possession: { team: 'home', timestamp: 0 },
      events: [],
      fatigueLevels: {},
      momentum: 'balanced',
      intensity: 'medium',
      statistics: {
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
      }
    };
    
    // Update ball position
    update.ballPosition = this.ballEngine.updateBallPosition(context);
    
    // Update player positions (exactly 22 on pitch)
    const playerPositions = this.playerEngine.updatePlayerPositions(context);
    const uniqueById: Record<number, PlayerPosition> = {} as any;
    for (const pos of playerPositions.values()) {
      uniqueById[pos.playerId] = pos;
    }
    update.playerPositions = Object.values(uniqueById).slice(0, 22);

    // DIAGNOSTIC: log counts and anomalies
    try {
      const teamCounts = update.playerPositions.reduce((acc: any, p) => {
        acc[p.team] = (acc[p.team] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      const uniqueIds = new Set(update.playerPositions.map(p => p.playerId));
      if (uniqueIds.size !== update.playerPositions.length || update.playerPositions.length > 22) {
        Logger.warn('⚠️ PlayerPositions anomaly in update', {
          minute: context.currentMinute,
          updateCount: update.playerPositions.length,
          uniqueCount: uniqueIds.size,
          teamCounts,
        });
      } else if (process.env.DEBUG_SIM?.toLowerCase() === 'true') {
        Logger.info('👥 PlayerPositions summary', {
          minute: context.currentMinute,
          updateCount: update.playerPositions.length,
          teamCounts,
        });
      }
    } catch {}
    
    // Update possession
    update.possession = this.possessionEngine.updatePossession(context);
    
    // Check for events
    if (options?.enableCommentary !== false) {
      update.events = this.eventEngine.checkActionBasedEvents(context);
    }
    
    // Update fatigue levels
    if (options?.enableFatigue !== false) {
      const fatigueLevels = this.fatigueEngine.updateFatigueLevels(context);
      update.fatigueLevels = Object.fromEntries(fatigueLevels);
    }
    
    // Update momentum
    if (options?.enableMomentum !== false) {
      update.momentum = this.momentumEngine.updateMomentum(context);
    }
    
    // Update intensity
    update.intensity = this.calculateIntensity(context);
    
    // Generate commentary
    if (options?.enableCommentary !== false && update.events.length > 0) {
      update.commentary = this.commentaryEngine.generateCommentary(update.events[0]);
    }
    
    // Update statistics
    if (options?.enableStatistics !== false) {
      update.statistics = this.statisticsEngine.updateStatistics(context, update);
    }
    
    return update;
  }

  private getSignificantFatigueChanges(context: MatchContext): Record<string, number> {
    const changes: Record<string, number> = {};
    const threshold = 0.01; // Only include fatigue changes > 1%
    
    for (const [playerId, fatigue] of Object.entries(context.fatigueLevels)) {
      const previousFatigue = context.previousFatigueLevels?.[playerId] || 0;
      if (Math.abs(fatigue - previousFatigue) > threshold) {
        changes[playerId] = fatigue;
      }
    }
    
    // Store current fatigue for next comparison
    context.previousFatigueLevels = { ...context.fatigueLevels };
    
    return changes;
  }

  private filterRealisticEvents(events: MatchEvent[]): MatchEvent[] {
    return events.filter(event => {
      // Remove unrealistic substitutions (player replacing themselves)
      if (event.type === 'substitution') {
        const description = event.description || '';
        const parts = description.split(' replaces ');
        if (parts.length === 2 && parts[0] === parts[1]) {
          return false;
        }
      }
      
      // Remove excessive substitutions (more than 3 per team)
      if (event.type === 'substitution') {
        const teamSubstitutions = events.filter(e => 
          e.type === 'substitution' && e.team === event.team
        );
        if (teamSubstitutions.length > 3) {
          return false;
        }
      }
      
      return true;
    });
  }
  
  private updateMatchState(context: MatchContext, update: SecondUpdate): void {
    context.ballPosition = update.ballPosition;
    
    // Update player positions - keep exactly 22 by overwriting existing entries only
    // Replace map with the latest positions ensuring 22 entries
    const nextMap = new Map<number, PlayerPosition>();
    for (const pos of update.playerPositions) {
      nextMap.set(pos.playerId, pos);
    }
    // If some ids are missing due to slicing, keep existing entries to maintain 22 max
    if (nextMap.size < 22) {
      for (const [id, pos] of context.playerPositions) {
        if (nextMap.size >= 22) break;
        if (!nextMap.has(id)) nextMap.set(id, pos);
      }
    }
    context.playerPositions = nextMap;

    // DIAGNOSTIC: context size check
    if (context.playerPositions.size > 22) {
      const teams = { home: 0, away: 0 } as any;
      for (const p of context.playerPositions.values()) teams[p.team] = (teams[p.team] || 0) + 1;
      Logger.error('🚫 Context has more than 22 players after updateMatchState', {
        size: context.playerPositions.size,
        minute: context.currentMinute,
        teams,
      });
      // Trim deterministically
      let i = 0;
      const trimmed = new Map<number, PlayerPosition>();
      for (const [id, p] of context.playerPositions) {
        if (i >= 22) break;
        trimmed.set(id, p);
        i++;
      }
      context.playerPositions = trimmed;
    }
    
    context.possession = update.possession;
    
    // Update fatigue levels
    Object.entries(update.fatigueLevels).forEach(([playerId, fatigue]) => {
      context.fatigueLevels[playerId] = fatigue;
    });
    
    context.momentum = update.momentum;
    context.intensity = update.intensity;
    
    // Add events to match history
    update.events.forEach(event => {
      context.matchEvents.push(event);
      
      // Update score for goals
      if (event.type === 'goal') {
        if (event.team === 'home') {
          context.score.home++;
        } else {
          context.score.away++;
        }
      }
    });
  }
  
  private shouldEndMatch(context: MatchContext): boolean {
    // Check for red card conditions (minimum 7 players required)
    const homePlayers = context.homeTeam.players.length;
    const awayPlayers = context.awayTeam.players.length;
    
    const homeRedCards = context.matchEvents.filter(e => e.type === 'red_card' && e.team === 'home').length;
    const awayRedCards = context.matchEvents.filter(e => e.type === 'red_card' && e.team === 'away').length;
    
    if (homePlayers < 7 || homeRedCards < 7 || awayPlayers < 7 || awayRedCards < 7) {
      return true;
    }
    
    return false;
  }
  
  private calculateIntensity(context: MatchContext): string {
    const eventCount = context.matchEvents.length;
    const minute = context.currentMinute;
    
    if (eventCount > minute * 0.5) {
      return 'high';
    } else if (eventCount > minute * 0.2) {
      return 'medium';
    } else {
      return 'low';
    }
  }

  public async simulateStreamingMatch(
    request: SimulationRequest, 
    onUpdate: (update: SecondUpdate) => void
  ): Promise<void> {
    const startTime = performance.now();
    const memoryStart = process.memoryUsage();
    
    try {
      Logger.info('Starting streaming match simulation', {
        homeTeam: request.home_team.name,
        awayTeam: request.away_team.name,
        options: request.options
      });
      
      const context = this.createMatchContext(request);
      
      // Initialize starting positions
      this.initializeStartingPositions(context);
      
      const tickRate = request.options?.tickRate || parseInt(process.env.SIMULATION_TICK_RATE || '60');
      const maxDuration = request.options?.maxDuration || RealTimeMatchSimulationService.MATCH_DURATION_SECONDS;
      
      // Generate updates every 3 seconds for smooth real-time feel
      const updateInterval = 3; // seconds
      const totalUpdates = Math.floor(maxDuration / updateInterval);
      
      Logger.info(`Streaming simulation parameters: ${tickRate}Hz, ${maxDuration}s duration, ${totalUpdates} updates`);
      
      // Main simulation loop - stream updates in real-time
      for (let updateIndex = 0; updateIndex < totalUpdates; updateIndex++) {
        const second = updateIndex * updateInterval;
        context.currentSecond = second;
        context.currentMinute = Math.floor(second / RealTimeMatchSimulationService.SECONDS_PER_MINUTE);
        
        // Generate update for this time interval
        const update = await this.generateSecondUpdate(context, request.options);
        
        // LOG THE UPDATE BEING GENERATED
        Logger.info('🎮 GENERATING SIMULATION UPDATE', {
            minute: context.currentMinute,
            second: context.currentSecond,
            score: context.score,
            events_count: update.events?.length || 0,
            events: update.events?.map((e: any) => ({
                minute: e.minute,
                type: e.type,
                team: e.team,
                player: e.playerName,
                description: e.description
            })) || [],
            ball_position: update.ballPosition,
            possession: update.possession,
            momentum: update.momentum,
            intensity: update.intensity,
            statistics: update.statistics
        });
        
        // Stream this update immediately
        onUpdate(update);
        
        // Update match state
        this.updateMatchState(context, update);
        
        // Check for match end conditions
        if (this.shouldEndMatch(context)) {
          Logger.info('Match ended early due to conditions', { 
            minute: context.currentMinute,
            score: context.score 
          });
          break;
        }
        
        // Add realistic delay to simulate real-time progression
        // In production, this creates a more natural streaming experience
        await new Promise(resolve => setTimeout(resolve, 100)); // 100ms delay
        
        // Yield control periodically
        if (updateIndex % 10 === 0) {
          await new Promise(resolve => setImmediate(resolve));
        }
      }
      
      const duration = performance.now() - startTime;
      const memoryEnd = process.memoryUsage();
      
      Logger.info('Streaming match simulation completed', {
        duration,
        updates: totalUpdates,
        events: context.matchEvents.length,
        finalScore: context.score,
        memoryUsage: memoryEnd.heapUsed - memoryStart.heapUsed
      });
      
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      Logger.error('Streaming match simulation failed', { error: errorMessage });
      throw error;
    }
  }
} 