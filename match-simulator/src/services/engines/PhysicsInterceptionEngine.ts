import { MatchContext, PlayerPosition } from '../../types';
import { MathUtils } from '../../utils/MathUtils';
import { CentralContestResolver } from './CentralContestResolver';
import { DiagnosticLogger } from './DiagnosticLogger';

/**
 * PHASE 3: Physics-Based Interception Detection Engine
 * 
 * Advanced interception system that uses realistic physics calculations:
 * - Ball trajectory prediction with velocity and acceleration
 * - Player movement prediction based on speed and direction
 * - Intersection point calculation for optimal interception
 * - Success probability based on multiple physical factors
 * - Integration with simultaneous player movement system
 */
export class PhysicsInterceptionEngine {
  
  // Physics constants
  private static readonly BALL_DECELERATION = 0.95; // Ball slows down due to friction
  private static readonly PLAYER_ACCELERATION = 2.0; // Player acceleration in m/s²
  private static readonly REACTION_TIME = 0.3; // Human reaction time in seconds
  private static readonly INTERCEPTION_RADIUS = 1.5; // Distance needed to intercept ball
  private static readonly PREDICTION_TIME_HORIZON = 3.0; // Seconds to predict ahead
  
  /**
   * Detect and process all potential interceptions for current game state
   */
  static processInterceptionDetection(context: MatchContext): InterceptionResult[] {
    const ballHolder = this.getBallHolder(context);
    const results: InterceptionResult[] = [];
    
    // Only process interceptions when ball is moving (pass, shot, cross)
    if (!this.isBallInMotion(context)) {
      return results;
    }
    
    console.log(`🎯 INTERCEPTION ENGINE: Analyzing ball trajectory for potential interceptions`);
    
    // Get ball trajectory prediction
    const ballTrajectory = this.predictBallTrajectory(context);
    
    // Find all players who could potentially intercept
    const potentialInterceptors = this.findPotentialInterceptors(context, ballTrajectory);
    
    console.log(`📊 POTENTIAL INTERCEPTORS: Found ${potentialInterceptors.length} players who could intercept`);
    
    // Calculate interception physics for each potential interceptor
    for (const interceptor of potentialInterceptors) {
      const interceptionPhysics = this.calculateInterceptionPhysics(
        interceptor,
        ballTrajectory,
        context
      );
      
      if (interceptionPhysics.canIntercept) {
        const result: InterceptionResult = {
          interceptor: interceptor,
          ballTrajectory: ballTrajectory,
          physics: interceptionPhysics,
          successProbability: this.calculateSuccessProbability(interceptionPhysics, context),
          interceptPoint: interceptionPhysics.optimalInterceptPoint,
          timeToIntercept: interceptionPhysics.timeToIntercept
        };
        
        results.push(result);
        
        console.log(`✅ INTERCEPTION POSSIBLE: Player ${interceptor.playerId} - ${(result.successProbability * 100).toFixed(1)}% chance at (${result.interceptPoint.x.toFixed(1)}, ${result.interceptPoint.y.toFixed(1)})`);
      }
    }
    
    // Sort by success probability (highest first)
    results.sort((a, b) => b.successProbability - a.successProbability);
    
    return results;
  }
  
  /**
   * Execute the most likely interception attempt
   */
  static executeInterceptionAttempt(
    interceptionResults: InterceptionResult[],
    context: MatchContext
  ): InterceptionOutcome | null {
    if (interceptionResults.length === 0) {
      return null;
    }
    
    // Get the most likely interception
    const bestAttempt = interceptionResults[0];
    
    // Roll for success based on calculated probability
    const roll = Math.random();
    const success = roll < bestAttempt.successProbability;
    
    console.log(`🎲 INTERCEPTION ATTEMPT: Player ${bestAttempt.interceptor.playerId} - ${(bestAttempt.successProbability * 100).toFixed(1)}% chance, rolled ${(roll * 100).toFixed(1)}% - ${success ? 'SUCCESS' : 'FAILED'}`);
    
    // Log the attempt for diagnostics
    DiagnosticLogger.logInterception(
      bestAttempt.interceptor,
      this.getBallHolder(context) || bestAttempt.interceptor,
      null,
      context,
      success
    );
    
    // Update ball and possession if successful
    if (success) {
      return this.executeSuccessfulInterception(bestAttempt, context);
    } else {
      return this.executeFailedInterception(bestAttempt, context);
    }
  }
  
  /**
   * Predict ball trajectory over time using physics
   */
  private static predictBallTrajectory(context: MatchContext): BallTrajectory {
    const ballPos = context.ballPosition;
    const trajectory: BallTrajectory = {
      startPosition: { x: ballPos.x, y: ballPos.y },
      velocity: this.getBallVelocity(context),
      positions: [],
      times: []
    };
    
    // Predict ball position at multiple time steps
    let currentPos = { x: ballPos.x, y: ballPos.y };
    let currentVel = { ...trajectory.velocity };
    
    for (let t = 0; t <= this.PREDICTION_TIME_HORIZON; t += 0.1) {
      // Apply deceleration
      const speed = Math.sqrt(currentVel.x ** 2 + currentVel.y ** 2);
      if (speed > 0.1) {
        const decelerationFactor = Math.pow(this.BALL_DECELERATION, t);
        currentVel.x *= decelerationFactor;
        currentVel.y *= decelerationFactor;
      }
      
      // Update position
      currentPos.x += currentVel.x * 0.1;
      currentPos.y += currentVel.y * 0.1;
      
      // Keep within bounds
      currentPos.x = Math.max(0, Math.min(100, currentPos.x));
      currentPos.y = Math.max(0, Math.min(100, currentPos.y));
      
      trajectory.positions.push({ x: currentPos.x, y: currentPos.y });
      trajectory.times.push(t);
      
      // Stop if ball has essentially stopped
      if (speed < 0.1) break;
    }
    
    return trajectory;
  }
  
  /**
   * Find players who could potentially intercept the ball
   */
  private static findPotentialInterceptors(
    context: MatchContext,
    ballTrajectory: BallTrajectory
  ): PlayerPosition[] {
    const interceptors: PlayerPosition[] = [];
    const ballHolder = this.getBallHolder(context);
    
    for (const [_, player] of context.playerPositions) {
      // Skip ball holder
      if (ballHolder && player.playerId === ballHolder.playerId) {
        continue;
      }
      
      // Skip players who are currently in an action
      if (player.actionTimer && player.actionTimer > 0) {
        continue;
      }
      
      // Skip players with interception cooldown
      if (player.actionCooldowns?.interception && player.actionCooldowns.interception > 0) {
        continue;
      }
      
      // Check if player is close enough to any point on ball trajectory
      const canReachTrajectory = this.canPlayerReachTrajectory(player, ballTrajectory);
      
      if (canReachTrajectory) {
        interceptors.push(player);
      }
    }
    
    return interceptors;
  }
  
  /**
   * Check if a player can reach any point on the ball trajectory
   */
  private static canPlayerReachTrajectory(
    player: PlayerPosition,
    ballTrajectory: BallTrajectory
  ): boolean {
    const maxPlayerSpeed = this.getPlayerMaxSpeed(player);
    const maxDistance = maxPlayerSpeed * this.PREDICTION_TIME_HORIZON;
    
    // Check if player can reach any point on the trajectory
    for (let i = 0; i < ballTrajectory.positions.length; i++) {
      const ballPos = ballTrajectory.positions[i];
      const time = ballTrajectory.times[i];
      
      const distanceToBall = MathUtils.distance(player.x, player.y, ballPos.x, ballPos.y);
      const maxPlayerDistance = maxPlayerSpeed * (time + this.REACTION_TIME);
      
      if (distanceToBall <= maxPlayerDistance) {
        return true;
      }
    }
    
    return false;
  }
  
  /**
   * Calculate detailed interception physics for a specific player
   */
  private static calculateInterceptionPhysics(
    player: PlayerPosition,
    ballTrajectory: BallTrajectory,
    context: MatchContext
  ): InterceptionPhysics {
    const playerSpeed = this.getPlayerMaxSpeed(player);
    
    let bestInterceptPoint: { x: number; y: number; time: number } | null = null;
    let minTimeToIntercept = Infinity;
    
    // Find optimal interception point
    for (let i = 0; i < ballTrajectory.positions.length; i++) {
      const ballPos = ballTrajectory.positions[i];
      const ballTime = ballTrajectory.times[i];
      
      const distanceToIntercept = MathUtils.distance(player.x, player.y, ballPos.x, ballPos.y);
      const playerTimeToReach = this.REACTION_TIME + (distanceToIntercept / playerSpeed);
      
      // Check if player can reach this point before or at the same time as ball
      if (playerTimeToReach <= ballTime + 0.2) { // Small tolerance
        const totalTime = Math.max(playerTimeToReach, ballTime);
        
        if (totalTime < minTimeToIntercept) {
          minTimeToIntercept = totalTime;
          bestInterceptPoint = {
            x: ballPos.x,
            y: ballPos.y,
            time: totalTime
          };
        }
      }
    }
    
    const canIntercept = bestInterceptPoint !== null;
    
    return {
      canIntercept,
      optimalInterceptPoint: bestInterceptPoint ? 
        { x: bestInterceptPoint.x, y: bestInterceptPoint.y } : 
        { x: player.x, y: player.y },
      timeToIntercept: minTimeToIntercept,
      playerSpeed: playerSpeed,
      distanceToIntercept: bestInterceptPoint ? 
        MathUtils.distance(player.x, player.y, bestInterceptPoint.x, bestInterceptPoint.y) : 
        Infinity,
      approachAngle: this.calculateApproachAngle(player, bestInterceptPoint, ballTrajectory),
      physicalAdvantage: this.calculatePhysicalAdvantage(player, context)
    };
  }
  
  /**
   * Calculate success probability based on physics and player attributes
   */
  private static calculateSuccessProbability(
    physics: InterceptionPhysics,
    context: MatchContext
  ): number {
    if (!physics.canIntercept) {
      return 0;
    }
    
    let probability = 0.5; // Base 50% chance
    
    // Time factor - easier to intercept if more time
    const timeFactor = Math.min(1, physics.timeToIntercept / 2);
    probability *= (0.3 + timeFactor * 0.7);
    
    // Distance factor - easier if closer
    const distanceFactor = Math.max(0, 1 - (physics.distanceToIntercept / 20));
    probability *= (0.4 + distanceFactor * 0.6);
    
    // Approach angle factor - perpendicular is best
    const angleFactor = 1 - Math.abs(physics.approachAngle - Math.PI/2) / (Math.PI/2);
    probability *= (0.7 + angleFactor * 0.3);
    
    // Physical advantage factor
    probability *= physics.physicalAdvantage;
    
    // Speed factor - faster players have better chance
    const speedFactor = Math.min(1, physics.playerSpeed / 10);
    probability *= (0.6 + speedFactor * 0.4);
    
    return Math.max(0.05, Math.min(0.95, probability));
  }
  
  /**
   * Execute a successful interception
   */
  private static executeSuccessfulInterception(
    attempt: InterceptionResult,
    context: MatchContext
  ): InterceptionOutcome {
    const interceptor = attempt.interceptor;
    
    // Move player to interception point
    interceptor.x = attempt.interceptPoint.x;
    interceptor.y = attempt.interceptPoint.y;
    
    // Update ball position
    context.ballPosition.x = attempt.interceptPoint.x;
    context.ballPosition.y = attempt.interceptPoint.y;
    context.ballPosition.speed = 0;
    
    // Transfer possession
    const oldPossession = { ...context.possession };
    context.possession = {
      team: interceptor.team,
      playerId: interceptor.playerId,
      timestamp: context.tick
    };
    
    // Apply interception cooldown
    if (!interceptor.actionCooldowns) interceptor.actionCooldowns = {};
    interceptor.actionCooldowns.interception = 5; // 5-tick cooldown
    
    // Log possession change
    DiagnosticLogger.logPossessionChange(
      oldPossession,
      context.possession,
      'Successful interception',
      context
    );
    
    return {
      success: true,
      interceptor: interceptor,
      newPossession: context.possession,
      interceptPoint: attempt.interceptPoint,
      description: `${this.getPlayerName(interceptor.playerId, context)} intercepts the ball`,
      commentary: `Excellent anticipation from ${this.getPlayerName(interceptor.playerId, context)} who reads the play perfectly and intercepts!`
    };
  }
  
  /**
   * Execute a failed interception attempt
   */
  private static executeFailedInterception(
    attempt: InterceptionResult,
    context: MatchContext
  ): InterceptionOutcome {
    const interceptor = attempt.interceptor;
    
    // Move player towards interception point but don't reach it
    const direction = Math.atan2(
      attempt.interceptPoint.y - interceptor.y,
      attempt.interceptPoint.x - interceptor.x
    );
    const partialDistance = attempt.physics.distanceToIntercept * 0.7;
    
    interceptor.x += Math.cos(direction) * partialDistance;
    interceptor.y += Math.sin(direction) * partialDistance;
    
    // Apply minor cooldown for failed attempt
    if (!interceptor.actionCooldowns) interceptor.actionCooldowns = {};
    interceptor.actionCooldowns.interception = 2; // 2-tick cooldown
    
    return {
      success: false,
      interceptor: interceptor,
      newPossession: context.possession, // No possession change
      interceptPoint: attempt.interceptPoint,
      description: `${this.getPlayerName(interceptor.playerId, context)} attempts to intercept but misses`,
      commentary: `${this.getPlayerName(interceptor.playerId, context)} goes for the interception but can't quite get there in time.`
    };
  }
  
  // HELPER METHODS
  
  private static getBallHolder(context: MatchContext): PlayerPosition | null {
    if (context.possession.playerId) {
      return context.playerPositions.get(context.possession.playerId) || null;
    }
    return null;
  }
  
  private static isBallInMotion(context: MatchContext): boolean {
    const ball = context.ballPosition;
    return ball.speed > 1; // Ball moving faster than 1 m/s
  }
  
  private static getBallVelocity(context: MatchContext): { x: number; y: number } {
    const ball = context.ballPosition;
    const speed = ball.speed || 0;
    const direction = ball.direction || 0;
    
    return {
      x: Math.cos(direction) * speed,
      y: Math.sin(direction) * speed
    };
  }
  
  private static getPlayerMaxSpeed(player: PlayerPosition): number {
    // Get from player attributes or use role-based defaults
    const roleSpeeds: Record<string, number> = {
      'GK': 6, 'CB1': 7, 'CB2': 7, 'RB': 8, 'LB': 8,
      'DM': 7, 'CM': 8, 'AM': 8, 'WM': 9, 'ST': 8, 'CF': 8
    };
    
    return roleSpeeds[player.role || 'CM'] || 7;
  }
  
  private static calculateApproachAngle(
    player: PlayerPosition,
    interceptPoint: { x: number; y: number; time: number } | null,
    ballTrajectory: BallTrajectory
  ): number {
    if (!interceptPoint) return 0;
    
    // Calculate angle between player approach and ball direction
    const playerDirection = Math.atan2(
      interceptPoint.y - player.y,
      interceptPoint.x - player.x
    );
    
    // Estimate ball direction at intercept point
    const ballDirection = ballTrajectory.velocity.x !== 0 || ballTrajectory.velocity.y !== 0 ?
      Math.atan2(ballTrajectory.velocity.y, ballTrajectory.velocity.x) : 0;
    
    return Math.abs(playerDirection - ballDirection);
  }
  
  private static calculatePhysicalAdvantage(player: PlayerPosition, context: MatchContext): number {
    // Base advantage from physical attributes
    let advantage = 0.8; // Base 80%
    
    // Add fatigue impact
    const fatigue = context.fatigueLevels[player.playerId.toString()] || 0;
    advantage *= (1 - fatigue * 0.3); // Up to 30% reduction from fatigue
    
    // Add pressure impact
    const nearbyOpponents = this.countNearbyOpponents(player, context, 8);
    advantage *= Math.max(0.6, 1 - nearbyOpponents * 0.1); // Pressure reduces advantage
    
    return Math.max(0.3, Math.min(1.2, advantage));
  }
  
  private static countNearbyOpponents(player: PlayerPosition, context: MatchContext, radius: number): number {
    const opposingTeam = player.team === 'home' ? 'away' : 'home';
    let count = 0;
    
    for (const [_, opponent] of context.playerPositions) {
      if (opponent.team === opposingTeam) {
        const distance = MathUtils.distance(player.x, player.y, opponent.x, opponent.y);
        if (distance < radius) count++;
      }
    }
    
    return count;
  }
  
  private static getPlayerName(playerId: number, context: MatchContext): string {
    const allPlayers = [...context.homeTeam.players, ...context.awayTeam.players];
    const player = allPlayers.find(p => p.id === playerId);
    return player ? `${player.first_name} ${player.last_name}` : `Player ${playerId}`;
  }
}

// TYPE DEFINITIONS

interface BallTrajectory {
  startPosition: { x: number; y: number };
  velocity: { x: number; y: number };
  positions: Array<{ x: number; y: number }>;
  times: number[];
}

interface InterceptionPhysics {
  canIntercept: boolean;
  optimalInterceptPoint: { x: number; y: number };
  timeToIntercept: number;
  playerSpeed: number;
  distanceToIntercept: number;
  approachAngle: number;
  physicalAdvantage: number;
}

interface InterceptionResult {
  interceptor: PlayerPosition;
  ballTrajectory: BallTrajectory;
  physics: InterceptionPhysics;
  successProbability: number;
  interceptPoint: { x: number; y: number };
  timeToIntercept: number;
}

interface InterceptionOutcome {
  success: boolean;
  interceptor: PlayerPosition;
  newPossession: any;
  interceptPoint: { x: number; y: number };
  description: string;
  commentary: string;
}