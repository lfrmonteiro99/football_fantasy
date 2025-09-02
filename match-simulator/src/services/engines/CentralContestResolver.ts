import { MatchContext, PlayerPosition, MatchEvent } from '../../types';
import { MathUtils } from '../../utils/MathUtils';
import { DiagnosticLogger } from './DiagnosticLogger';

/**
 * ROBUST DESIGN A: Central Contest Resolver (Single Source of Truth)
 * 
 * All contests for the same ball/time must be resolved by one function that considers:
 * - time-to-ball (distance / effective_speed)
 * - ball flight time / pass vector  
 * - first-touch ability of receiver
 * - randomness & composure
 * 
 * This avoids contradictory outcomes and ping-pong loops.
 */
export class CentralContestResolver {
  
  /**
   * Master contest resolution function - single source of truth for all ball contests
   */
  static resolveBallContest(
    contestType: 'pass' | 'loose_ball' | 'header' | 'tackle',
    initiator: PlayerPosition,
    target: PlayerPosition | null,
    ballPosition: { x: number; y: number },
    context: MatchContext,
    additionalData?: any
  ): BallContestResult {
    
    const tick = context.tick;
    const minute = context.currentMinute;
    
    console.log(`🏆 CENTRAL CONTEST RESOLVER: ${contestType.toUpperCase()} - Tick ${tick}, Minute ${minute}`);
    
    // Get all potential contestants (players who could contest this ball)
    const contestants = this.identifyContestants(contestType, initiator, target, ballPosition, context);
    
    // Calculate physics for each contestant
    const contestantPhysics = contestants.map(contestant => 
      this.calculateContestantPhysics(contestant, ballPosition, target, context, additionalData)
    );
    
    // Log comprehensive diagnostic information
    this.logContestDiagnostics(contestType, initiator, target, ballPosition, contestantPhysics, context);
    
    // Resolve the contest using physics-based calculations
    const winner = this.determineContestWinner(contestantPhysics, contestType, context);
    
    // ROBUST DESIGN E: Log ball contest with diagnostic details
    DiagnosticLogger.logBallContest(
      contestType,
      contestantPhysics.map(cp => cp.player), // Extract players from physics data
      winner.player,
      ballPosition,
      context,
      { 
        contestantPhysics: contestantPhysics.map(cp => ({
          playerId: cp.player.playerId,
          timeToBall: cp.timeToBall,
          ballFlightTime: cp.ballFlightTime,
          distanceToBall: cp.distanceToBall,
          firstTouchAbility: cp.firstTouchAbility,
          composure: cp.composure,
          effectiveSpeed: cp.effectiveSpeed
        }))
      }
    );
    
    // Generate appropriate events and possession changes
    const result = this.generateContestResult(contestType, winner, initiator, target, context, minute);
    
    console.log(`🏅 CONTEST WINNER: Player ${winner.player.playerId} (${winner.player.team}) - Score: ${winner.contestScore.toFixed(2)}`);
    
    return result;
  }
  
  /**
   * Identify all players who could potentially contest this ball
   */
  private static identifyContestants(
    contestType: string,
    initiator: PlayerPosition,
    target: PlayerPosition | null,
    ballPosition: { x: number; y: number },
    context: MatchContext
  ): PlayerPosition[] {
    
    const contestants: PlayerPosition[] = [initiator];
    
    // Add intended target if it exists
    if (target) {
      contestants.push(target);
    }
    
    // Find other players within reasonable contest range
    const maxContestRange = contestType === 'pass' ? 15 : 8;
    
    for (const [_, player] of context.playerPositions) {
      if (player.playerId === initiator.playerId || (target && player.playerId === target.playerId)) {
        continue; // Already included
      }
      
      const distanceToBall = MathUtils.distance(player.x, player.y, ballPosition.x, ballPosition.y);
      
      if (distanceToBall <= maxContestRange) {
        // Check if player is available to contest (not in middle of another action)
        if (this.isPlayerAvailableToContest(player, context)) {
          contestants.push(player);
        }
      }
    }
    
    return contestants;
  }
  
  /**
   * Calculate physics for each contestant
   */
  private static calculateContestantPhysics(
    contestant: PlayerPosition,
    ballPosition: { x: number; y: number },
    target: PlayerPosition | null,
    context: MatchContext,
    additionalData?: any
  ): ContestantPhysics {
    
    const allPlayers = [...context.homeTeam.players, ...context.awayTeam.players];
    const playerData = allPlayers.find(p => p.id === contestant.playerId);
    
    // Calculate time to ball
    const distanceToBall = MathUtils.distance(contestant.x, contestant.y, ballPosition.x, ballPosition.y);
    const effectiveSpeed = this.calculateEffectiveSpeed(contestant, playerData, context);
    const timeToBall = distanceToBall / effectiveSpeed;
    
    // Calculate ball flight time (if this is a pass contest)
    let ballFlightTime = 0;
    if (target && additionalData?.passOrigin) {
      const passDistance = MathUtils.distance(additionalData.passOrigin.x, additionalData.passOrigin.y, target.x, target.y);
      const ballSpeed = 25; // meters per second
      ballFlightTime = passDistance / ballSpeed;
    }
    
    // Calculate interception geometry (distance to pass line)
    let distanceToPassLine = Infinity;
    let interceptAngle = 0;
    
    if (target && additionalData?.passOrigin) {
      distanceToPassLine = this.distanceToLine(
        additionalData.passOrigin,
        { x: target.x, y: target.y },
        { x: contestant.x, y: contestant.y }
      );
      
      // Calculate approach angle for interception
      const passDirection = Math.atan2(target.y - additionalData.passOrigin.y, target.x - additionalData.passOrigin.x);
      const approachDirection = Math.atan2(ballPosition.y - contestant.y, ballPosition.x - contestant.x);
      interceptAngle = Math.abs(passDirection - approachDirection);
    }
    
    // Calculate first-touch ability
    const firstTouchAbility = this.calculateFirstTouchAbility(contestant, playerData);
    
    // Calculate composure under pressure
    const pressureLevel = this.calculatePressureLevel(contestant, context);
    const composure = this.calculateComposure(playerData, pressureLevel);
    
    return {
      player: contestant,
      playerData: playerData,
      distanceToBall,
      timeToBall,
      ballFlightTime,
      distanceToPassLine,
      interceptAngle,
      firstTouchAbility,
      composure,
      effectiveSpeed,
      contestScore: 0 // Will be calculated later
    };
  }
  
  /**
   * Determine the contest winner using comprehensive physics-based scoring
   */
  private static determineContestWinner(
    contestants: ContestantPhysics[],
    contestType: string,
    context: MatchContext
  ): ContestantPhysics {
    
    // Calculate contest score for each contestant
    contestants.forEach(contestant => {
      contestant.contestScore = this.calculateContestScore(contestant, contestType, context);
    });
    
    // Sort by contest score (highest wins)
    contestants.sort((a, b) => b.contestScore - a.contestScore);
    
    // Add randomness factor (but weighted by skill)
    const topContestants = contestants.slice(0, 3); // Consider top 3 contestants
    const randomizedWinner = this.selectWinnerWithRandomness(topContestants);
    
    return randomizedWinner;
  }
  
  /**
   * Calculate comprehensive contest score for a contestant
   */
  private static calculateContestScore(
    contestant: ContestantPhysics,
    contestType: string,
    context: MatchContext
  ): number {
    
    let score = 100; // Base score
    
    // Time to ball is critical - earlier arrival = higher score
    const maxTime = 3; // seconds
    const timeAdvantage = Math.max(0, (maxTime - contestant.timeToBall) / maxTime);
    score *= (0.5 + timeAdvantage * 0.5); // 50% base + up to 50% for time advantage
    
    // First touch ability
    score *= contestant.firstTouchAbility;
    
    // Composure under pressure
    score *= contestant.composure;
    
    // Contest-specific adjustments
    switch (contestType) {
      case 'pass':
        // For passes, interception position matters
        if (contestant.distanceToPassLine < 5) {
          const lineAdvantage = (5 - contestant.distanceToPassLine) / 5;
          score *= (1 + lineAdvantage * 0.3); // Up to 30% bonus for good positioning
        }
        
        // Approach angle matters for interceptions
        const optimalAngle = Math.PI / 2; // 90 degrees is optimal
        const angleFactor = 1 - Math.abs(contestant.interceptAngle - optimalAngle) / Math.PI;
        score *= (0.8 + angleFactor * 0.2); // 80% base + up to 20% for good angle
        break;
        
      case 'loose_ball':
        // For loose balls, speed and positioning are key
        score *= (contestant.effectiveSpeed / 10); // Normalize speed factor
        break;
        
      case 'header':
        // For headers, height and heading ability matter
        const headingSkill = (contestant.playerData?.attributes?.heading_accuracy || 60) / 100;
        score *= headingSkill;
        break;
        
      case 'tackle':
        // For tackles, defensive skills matter
        const tacklingSkill = (contestant.playerData?.attributes?.standing_tackle || 60) / 100;
        score *= tacklingSkill;
        break;
    }
    
    // Apply fatigue penalty
    const fatigueLevel = context.fatigueLevels[contestant.player.playerId.toString()] || 0;
    const fatiguePenalty = Math.max(0.6, 1 - fatigueLevel * 0.4); // Max 40% penalty
    score *= fatiguePenalty;
    
    // Apply action cooldown penalty
    const hasRecentAction = this.hasRecentActionCooldown(contestant.player, context);
    if (hasRecentAction) {
      score *= 0.7; // 30% penalty for recent action
    }
    
    return score;
  }
  
  /**
   * Select winner with controlled randomness based on skill differences
   */
  private static selectWinnerWithRandomness(topContestants: ContestantPhysics[]): ContestantPhysics {
    if (topContestants.length === 0) return topContestants[0];
    if (topContestants.length === 1) return topContestants[0];
    
    const bestScore = topContestants[0].contestScore;
    const secondBestScore = topContestants[1].contestScore;
    
    // If the gap is large (>20%), winner is almost certain
    const scoreDifference = (bestScore - secondBestScore) / bestScore;
    
    if (scoreDifference > 0.2) {
      // Clear winner - 95% chance
      return Math.random() < 0.95 ? topContestants[0] : topContestants[1];
    } else if (scoreDifference > 0.1) {
      // Moderate advantage - 75% chance
      return Math.random() < 0.75 ? topContestants[0] : topContestants[1];
    } else {
      // Close contest - 60% chance for slight favorite
      return Math.random() < 0.6 ? topContestants[0] : topContestants[1];
    }
  }
  
  /**
   * Generate appropriate contest result with events and possession changes
   */
  private static generateContestResult(
    contestType: string,
    winner: ContestantPhysics,
    initiator: PlayerPosition,
    target: PlayerPosition | null,
    context: MatchContext,
    minute: number
  ): BallContestResult {
    
    const winnerIsInitiator = winner.player.playerId === initiator.playerId;
    const winnerIsTarget = target && winner.player.playerId === target.playerId;
    
    let eventType: string;
    let description: string;
    let commentary: string;
    
    // Determine event type and descriptions
    if (contestType === 'pass') {
      if (winnerIsTarget) {
        eventType = 'pass';
        description = `${this.getPlayerName(initiator.playerId, context)} passes to ${this.getPlayerName(winner.player.playerId, context)}`;
        commentary = `${this.getPlayerName(initiator.playerId, context)} finds ${this.getPlayerName(winner.player.playerId, context)} with a well-placed pass.`;
      } else if (!winnerIsInitiator) {
        eventType = 'interception';
        description = `${this.getPlayerName(winner.player.playerId, context)} intercepts ${this.getPlayerName(initiator.playerId, context)}'s pass`;
        commentary = `${this.getPlayerName(initiator.playerId, context)} attempts a pass but ${this.getPlayerName(winner.player.playerId, context)} reads it well and intercepts!`;
      } else {
        eventType = 'pass_failed';
        description = `${this.getPlayerName(initiator.playerId, context)}'s pass is unsuccessful`;
        commentary = `${this.getPlayerName(initiator.playerId, context)} attempts a pass but it doesn't reach its target.`;
      }
    } else {
      eventType = contestType;
      description = `${this.getPlayerName(winner.player.playerId, context)} wins ${contestType}`;
      commentary = `${this.getPlayerName(winner.player.playerId, context)} comes out on top in the contest.`;
    }
    
    // Create event
    const event: MatchEvent = {
      minute,
      type: eventType as any,
      description,
      commentary,
      playerId: winner.player.playerId,
      playerName: this.getPlayerName(winner.player.playerId, context),
      team: winner.player.team
    };
    
    // Update possession
    const newPossession = {
      team: winner.player.team,
      playerId: winner.player.playerId,
      timestamp: context.tick
    };
    
    // Update ball position
    context.ballPosition.x = winner.player.x;
    context.ballPosition.y = winner.player.y;
    context.ballPosition.speed = 0; // Ball comes to rest with winner
    
    // Apply action cooldowns to prevent immediate re-contests
    this.applyPostContestCooldowns(winner.player, contestType);
    
    return {
      winner: winner.player,
      event: event,
      newPossession: newPossession,
      success: winnerIsTarget || winnerIsInitiator
    };
  }
  
  /**
   * Comprehensive diagnostic logging for contest resolution
   */
  private static logContestDiagnostics(
    contestType: string,
    initiator: PlayerPosition,
    target: PlayerPosition | null,
    ballPosition: { x: number; y: number },
    contestants: ContestantPhysics[],
    context: MatchContext
  ): void {
    
    console.log(`📊 CONTEST DIAGNOSTICS - ${contestType.toUpperCase()}`);
    console.log(`   Tick: ${context.tick}, Ball Position: (${ballPosition.x.toFixed(1)}, ${ballPosition.y.toFixed(1)})`);
    console.log(`   Initiator: Player ${initiator.playerId} at (${initiator.x.toFixed(1)}, ${initiator.y.toFixed(1)})`);
    
    if (target) {
      console.log(`   Target: Player ${target.playerId} at (${target.x.toFixed(1)}, ${target.y.toFixed(1)})`);
    }
    
    console.log(`   Contestants (${contestants.length}):`);
    contestants.forEach(contestant => {
      console.log(`     Player ${contestant.player.playerId} (${contestant.player.team}): ` +
                 `pos=(${contestant.player.x.toFixed(1)}, ${contestant.player.y.toFixed(1)}), ` +
                 `dist=${contestant.distanceToBall.toFixed(1)}m, ` +
                 `time=${contestant.timeToBall.toFixed(2)}s, ` +
                 `lineDistance=${contestant.distanceToPassLine.toFixed(1)}m, ` +
                 `firstTouch=${contestant.firstTouchAbility.toFixed(2)}, ` +
                 `composure=${contestant.composure.toFixed(2)}, ` +
                 `score=${contestant.contestScore.toFixed(2)}`);
    });
  }
  
  // HELPER METHODS
  
  private static isPlayerAvailableToContest(player: PlayerPosition, context: MatchContext): boolean {
    // Check if player is in middle of an action
    if (player.actionTimer && player.actionTimer > 0) {
      return false;
    }
    
    // Check for action cooldowns
    const relevantCooldowns = ['interception', 'tackle', 'pass'];
    for (const action of relevantCooldowns) {
      if (player.actionCooldowns?.[action] && player.actionCooldowns[action] > 0) {
        return false;
      }
    }
    
    return true;
  }
  
  private static calculateEffectiveSpeed(player: PlayerPosition, playerData: any, context: MatchContext): number {
    let baseSpeed = 8; // Default speed
    
    if (playerData?.attributes) {
      baseSpeed = (playerData.attributes.pace || 60) / 10; // Convert to m/s
    }
    
    // Apply fatigue
    const fatigueLevel = context.fatigueLevels[player.playerId.toString()] || 0;
    const fatigueEffect = Math.max(0.6, 1 - fatigueLevel * 0.4);
    
    return baseSpeed * fatigueEffect;
  }
  
  private static calculateFirstTouchAbility(player: PlayerPosition, playerData: any): number {
    if (!playerData?.attributes) return 0.7; // Default
    
    const ballControl = (playerData.attributes.ball_control || 60) / 100;
    const reactions = (playerData.attributes.reactions || 60) / 100;
    
    return (ballControl + reactions) / 2;
  }
  
  private static calculatePressureLevel(player: PlayerPosition, context: MatchContext): number {
    const opposingTeam = player.team === 'home' ? 'away' : 'home';
    let nearbyOpponents = 0;
    
    for (const [_, opponent] of context.playerPositions) {
      if (opponent.team === opposingTeam) {
        const distance = MathUtils.distance(player.x, player.y, opponent.x, opponent.y);
        if (distance < 8) nearbyOpponents++;
      }
    }
    
    return Math.min(1, nearbyOpponents / 3); // Normalize to 0-1
  }
  
  private static calculateComposure(playerData: any, pressureLevel: number): number {
    const baseComposure = playerData?.attributes?.composure || 60;
    const composureRatio = baseComposure / 100;
    
    // Pressure reduces composure
    return Math.max(0.3, composureRatio * (1 - pressureLevel * 0.3));
  }
  
  private static distanceToLine(start: {x: number, y: number}, end: {x: number, y: number}, point: {x: number, y: number}): number {
    const A = point.x - start.x;
    const B = point.y - start.y;
    const C = end.x - start.x;
    const D = end.y - start.y;
    
    const dot = A * C + B * D;
    const lenSq = C * C + D * D;
    
    if (lenSq === 0) return MathUtils.distance(point.x, point.y, start.x, start.y);
    
    const param = dot / lenSq;
    
    let xx, yy;
    if (param < 0) {
      xx = start.x;
      yy = start.y;
    } else if (param > 1) {
      xx = end.x;
      yy = end.y;
    } else {
      xx = start.x + param * C;
      yy = start.y + param * D;
    }
    
    return MathUtils.distance(point.x, point.y, xx, yy);
  }
  
  private static hasRecentActionCooldown(player: PlayerPosition, context: MatchContext): boolean {
    if (!player.actionCooldowns) return false;
    
    const relevantActions = ['pass', 'tackle', 'interception', 'dribble'];
    return relevantActions.some(action => (player.actionCooldowns?.[action] || 0) > 0);
  }
  
  private static applyPostContestCooldowns(player: PlayerPosition, contestType: string): void {
    if (!player.actionCooldowns) player.actionCooldowns = {};
    
    // Apply appropriate cooldowns based on contest type
    switch (contestType) {
      case 'pass':
        player.actionCooldowns['pass'] = 2;
        break;
      case 'tackle':
        player.actionCooldowns['tackle'] = 3;
        break;
      case 'interception':
        player.actionCooldowns['interception'] = 4;
        break;
      default:
        player.actionCooldowns['general'] = 2;
    }
  }
  
  private static getPlayerName(playerId: number, context: MatchContext): string {
    const allPlayers = [...context.homeTeam.players, ...context.awayTeam.players];
    const playerData = allPlayers.find(p => p.id === playerId);
    return playerData ? `${playerData.first_name} ${playerData.last_name}` : 'Unknown Player';
  }
}

// Supporting interfaces
interface ContestantPhysics {
  player: PlayerPosition;
  playerData: any;
  distanceToBall: number;
  timeToBall: number;
  ballFlightTime: number;
  distanceToPassLine: number;
  interceptAngle: number;
  firstTouchAbility: number;
  composure: number;
  effectiveSpeed: number;
  contestScore: number;
}

interface BallContestResult {
  winner: PlayerPosition;
  event: MatchEvent;
  newPossession: any;
  success: boolean;
}