import { MatchContext, PlayerPosition } from '../../types';
import { MathUtils } from '../../utils/MathUtils';
import { DiagnosticLogger } from './DiagnosticLogger';
import { PhysicsInterceptionEngine } from './PhysicsInterceptionEngine';

/**
 * PHASE 3: Full 22-Player Simultaneous Behavior Engine
 * 
 * Implements comprehensive simultaneous movement for all 22 players each tick.
 * Based on detailed pseudocode with formation/tactics, ball-aware intelligence,
 * pressing, rotations, passing-lane awareness, and tactical reactions.
 */
export class SimultaneousPlayerEngine {
  
  // Configuration constants
  private static readonly PERSONAL_SPACE = 2.0; // meters
  private static readonly PRESS_RADIUS = 12.0; // meters
  private static readonly CONTEST_RADIUS = 3.0; // meters
  private static readonly PASS_DISTANCE_WEIGHT = 0.7;
  private static readonly AVOIDANCE_WEIGHT = 0.8;
  private static readonly FRICTION_COEFFICIENT = 0.95;
  
  // Action durations (in ticks/seconds)
  private static readonly ACTION_DURATIONS = {
    'pass': 2,
    'dribble': 3,
    'shot': 4,
    'press': 1,
    'mark': 1,
    'run': 1
  };
  
  // Cooldowns (in ticks/seconds)  
  private static readonly ACTION_COOLDOWNS = {
    'dribble': 2,
    'pass': 1,
    'press': 3,
    'tackle': 4
  };
  
  /**
   * Main simultaneous processing function - called each tick for all 22 players
   */
  static processSimultaneousMovement(context: MatchContext): void {
    console.log(`🏟️ SIMULTANEOUS ENGINE: Processing all 22 players for tick ${context.tick}`);
    
    // 1. Update team phase and tactical adjustments
    this.updateTeamPhaseAndTactics(context);
    
    // 2. Compute intent for each player
    const allPlayers = Array.from(context.playerPositions.values());
    for (const player of allPlayers) {
      this.computePlayerIntent(player, context);
    }
    
    // 3. Resolve all movements with collision avoidance
    this.resolveAllMovementsAndActions(allPlayers, context);
    
    // 4. Process physics-based interceptions
    this.processPhysicsInterceptions(context);
    
    // 5. Update ball physics and contests
    this.updateBallPhysicsAndContests(context);
    
    // 6. Apply fatigue and cooldowns
    this.applyFatigueAndCooldowns(allPlayers, context);
    
    console.log(`✅ SIMULTANEOUS ENGINE: Completed processing for ${allPlayers.length} players`);
  }
  
  /**
   * 1. Update team phase and tactical adaptation
   */
  private static updateTeamPhaseAndTactics(context: MatchContext): void {
    const ballHolderId = context.possession.playerId;
    const ballHolder = ballHolderId ? context.playerPositions.get(ballHolderId) : null;
    
    // Determine team phases
    const homeTeam = { id: 'home', ballOwned: false, phase: 'defence' };
    const awayTeam = { id: 'away', ballOwned: false, phase: 'defence' };
    
    if (ballHolder) {
      if (ballHolder.team === 'home') {
        homeTeam.ballOwned = true;
        homeTeam.phase = 'attack';
        awayTeam.phase = 'defence';
      } else {
        awayTeam.ballOwned = true;
        awayTeam.phase = 'attack';
        homeTeam.phase = 'defence';
      }
    } else {
      // Ball is loose - transition phase
      homeTeam.phase = 'transition';
      awayTeam.phase = 'transition';
    }
    
    // Store team phases in context for reference
    context.teamPhases = { home: homeTeam.phase, away: awayTeam.phase };
    
    console.log(`📊 TEAM PHASES: Home=${homeTeam.phase}, Away=${awayTeam.phase}, Ball Holder=${ballHolderId || 'None'}`);
  }
  
  /**
   * 2. Compute intent for each player
   */
  private static computePlayerIntent(player: PlayerPosition, context: MatchContext): void {
    // Skip if player is injured or unavailable
    if (this.isPlayerUnavailable(player)) {
      player.intent = this.createIdleIntent();
      return;
    }
    
    // Build perception snapshot
    const perception = this.buildPerception(player, context);
    
    // Choose behavior module based on team phase
    let intent;
    const teamPhase = context.teamPhases?.[player.team] || 'defence';
    
    if (player.team === context.possession.team && teamPhase === 'attack') {
      intent = this.attackingOffBallLogic(player, perception, context);
    } else if (player.team !== context.possession.team && teamPhase === 'defence') {
      intent = this.defendingOffBallLogic(player, perception, context);
    } else {
      intent = this.transitionOffBallLogic(player, perception, context);
    }
    
    // Apply personal tendencies and cooldowns
    intent = this.applyPersonalTendenciesAndCooldowns(player, intent, perception, context);
    
    // Store intent
    player.intent = intent;
    
    console.log(`🧠 INTENT: Player ${player.playerId} (${player.role}) - ${intent.microAction} → (${intent.moveTarget.x.toFixed(1)}, ${intent.moveTarget.y.toFixed(1)})`);
  }
  
  /**
   * 3. Build perception snapshot for player
   */
  private static buildPerception(player: PlayerPosition, context: MatchContext): PlayerPerception {
    const nearbyTeammates = this.findNearbyPlayers(player, context, player.team, 30);
    const nearbyOpponents = this.findNearbyPlayers(player, context, player.team === 'home' ? 'away' : 'home', 30);
    const ballPos = context.ballPosition;
    const distToBall = MathUtils.distance(player.x, player.y, ballPos.x, ballPos.y);
    
    return {
      nearbyTeammates,
      nearbyOpponents,
      ball: ballPos,
      distToBall,
      hasClearLineToBall: this.hasLineOfSight(player, ballPos, context),
      teamPhase: context.teamPhases?.[player.team] || 'defence',
      formationTarget: this.getFormationTarget(player, context),
      passingOptions: this.evaluatePassingOptions(player, context),
      nearestTeammate: this.findNearestTeammate(player, context),
      nearestOpponent: this.findNearestOpponent(player, context)
    };
  }
  
  /**
   * 4. Attacking off-ball logic (role-aware)
   */
  private static attackingOffBallLogic(player: PlayerPosition, perception: PlayerPerception, context: MatchContext): PlayerIntent {
    const role = player.role || 'CM';
    const baseTarget = perception.formationTarget;
    
    // If player is ball holder, use on-ball logic
    if (context.possession.playerId === player.playerId) {
      return this.onBallIntent(player, perception, context);
    }
    
    let intent: PlayerIntent = {
      moveTarget: baseTarget,
      microAction: 'hold_shape',
      runTimer: 0,
      priority: 1
    };
    
    switch (true) {
      case role === 'ST' || role === 'CF':
        intent = this.strikerAttackingIntent(player, perception, context);
        break;
        
      case role.includes('W') || role === 'LM' || role === 'RM':
        intent = this.wingerAttackingIntent(player, perception, context);
        break;
        
      case role.includes('CM') || role.includes('DM') || role === 'AM':
        intent = this.midfielderAttackingIntent(player, perception, context);
        break;
        
      case role.includes('B'): // Fullbacks/Center-backs
        intent = this.defenderAttackingIntent(player, perception, context);
        break;
        
      default:
        intent.moveTarget = baseTarget;
        intent.microAction = 'hold_shape';
    }
    
    // Adjust for spacing and passing lane value
    intent.moveTarget = this.adjustTargetForSpacingAndLaneValue(intent.moveTarget, player, perception, context);
    
    return intent;
  }
  
  /**
   * 5. Defending off-ball logic (role-aware)
   */
  private static defendingOffBallLogic(player: PlayerPosition, perception: PlayerPerception, context: MatchContext): PlayerIntent {
    const role = player.role || 'CM';
    let intent: PlayerIntent = {
      moveTarget: perception.formationTarget,
      microAction: 'mark',
      runTimer: 0,
      priority: 2
    };
    
    // Check for marking assignment (man-mark or zonal)
    const markTarget = this.getMarkingTarget(player, context);
    if (markTarget) {
      intent.moveTarget = this.shadowOpponentPosition(markTarget, player);
      intent.microAction = 'mark';
      
      // High pressing intensity - step up to pressure
      if (this.shouldPress(player, perception, context)) {
        intent.microAction = 'press';
        intent.priority = 3;
      }
    } else {
      // Zonal behavior based on role
      switch (true) {
        case role.includes('CB'):
          intent = this.centerBackDefendingIntent(player, perception, context);
          break;
          
        case role.includes('B'): // Fullbacks
          intent = this.fullbackDefendingIntent(player, perception, context);
          break;
          
        case role.includes('M'): // Midfielders
          intent = this.midfielderDefendingIntent(player, perception, context);
          break;
          
        default:
          intent.moveTarget = this.getDefensiveLineTarget(player, context);
      }
    }
    
    // Apply pressure intensity
    if (this.getPressingIntensity(context) === 'high') {
      intent = this.increasePressureIntent(intent, player, perception, context);
    }
    
    // Ensure compactness with team line
    intent.moveTarget = this.ensureCompactnessWithTeamLine(intent.moveTarget, player, context);
    
    return intent;
  }
  
  /**
   * 6. Transition behavior logic
   */
  private static transitionOffBallLogic(player: PlayerPosition, perception: PlayerPerception, context: MatchContext): PlayerIntent {
    const role = player.role || 'CM';
    let intent: PlayerIntent = {
      moveTarget: perception.formationTarget,
      microAction: 'recover',
      runTimer: 0,
      priority: 2
    };
    
    // Check if we should counter-press (just lost ball)
    if (this.shouldCounterPress(player, perception, context)) {
      intent.moveTarget = this.getCounterPressTarget(player, perception, context);
      intent.microAction = 'counter_press';
      intent.priority = 4;
    }
    // Check if we should make quick forward run (just gained ball)
    else if (this.shouldMakeCounterRun(player, perception, context)) {
      intent.moveTarget = this.getCounterRunTarget(player, perception, context);
      intent.microAction = 'exploit_space';
      intent.priority = 3;
    }
    // Default transition behavior
    else {
      if (player.team === context.possession.team) {
        // Support the transition to attack
        intent.moveTarget = this.getSupportChannelTarget(player, perception, context);
        intent.microAction = 'support';
      } else {
        // Retreat to defensive shape
        intent.moveTarget = this.getRetreatTarget(player, context);
        intent.microAction = 'recover';
      }
    }
    
    return intent;
  }
  
  /**
   * 7. Resolve all movements with collision avoidance
   */
  private static resolveAllMovementsAndActions(players: PlayerPosition[], context: MatchContext): void {
    // First compute desired displacement
    for (const player of players) {
      if (!player.intent) continue;
      
      const desiredVector = {
        x: player.intent.moveTarget.x - player.x,
        y: player.intent.moveTarget.y - player.y
      };
      
      const desiredDistance = Math.min(
        Math.sqrt(desiredVector.x ** 2 + desiredVector.y ** 2),
        this.getEffectiveSpeed(player, context)
      );
      
      const desiredDir = desiredDistance > 0 ? {
        x: desiredVector.x / Math.sqrt(desiredVector.x ** 2 + desiredVector.y ** 2),
        y: desiredVector.y / Math.sqrt(desiredVector.x ** 2 + desiredVector.y ** 2)
      } : { x: 0, y: 0 };
      
      player.desiredVelocity = {
        x: desiredDir.x * desiredDistance,
        y: desiredDir.y * desiredDistance
      };
    }
    
    // Apply steering to avoid collisions
    for (const player of players) {
      let avoidance = { x: 0, y: 0 };
      
      const neighbors = this.findNearbyPlayers(player, context, 'both', this.PERSONAL_SPACE);
      for (const neighbor of neighbors) {
        if (neighbor.playerId === player.playerId) continue;
        
        const distance = MathUtils.distance(player.x, player.y, neighbor.x, neighbor.y);
        const overlap = this.PERSONAL_SPACE - distance;
        
        if (overlap > 0) {
          const awayDir = this.normalize({ x: player.x - neighbor.x, y: player.y - neighbor.y });
          avoidance.x += awayDir.x * overlap * this.AVOIDANCE_WEIGHT;
          avoidance.y += awayDir.y * overlap * this.AVOIDANCE_WEIGHT;
        }
      }
      
      // Combine desired velocity with avoidance
      const combinedVelocity = {
        x: (player.desiredVelocity?.x || 0) + avoidance.x,
        y: (player.desiredVelocity?.y || 0) + avoidance.y
      };
      
      // Clamp to max speed
      const maxSpeed = this.getEffectiveSpeed(player, context);
      const speed = Math.sqrt(combinedVelocity.x ** 2 + combinedVelocity.y ** 2);
      
      if (speed > maxSpeed) {
        combinedVelocity.x = (combinedVelocity.x / speed) * maxSpeed;
        combinedVelocity.y = (combinedVelocity.y / speed) * maxSpeed;
      }
      
      player.velocity = combinedVelocity;
    }
    
    // Apply velocity to positions
    for (const player of players) {
      if (player.velocity) {
        player.x = Math.max(0, Math.min(100, player.x + player.velocity.x));
        player.y = Math.max(0, Math.min(100, player.y + player.velocity.y));
        player.speed = Math.sqrt(player.velocity.x ** 2 + player.velocity.y ** 2);
        player.direction = Math.atan2(player.velocity.y, player.velocity.x);
      }
    }
    
    console.log(`🏃 MOVEMENT: Applied movement for ${players.length} players with collision avoidance`);
  }
  
  /**
   * 4. Process physics-based interceptions
   */
  private static processPhysicsInterceptions(context: MatchContext): void {
    // Get potential interceptions using physics-based analysis
    const interceptionResults = PhysicsInterceptionEngine.processInterceptionDetection(context);
    
    if (interceptionResults.length > 0) {
      console.log(`🎯 PHYSICS INTERCEPTIONS: Found ${interceptionResults.length} potential interceptions`);
      
      // Execute the most likely interception attempt
      const interceptionOutcome = PhysicsInterceptionEngine.executeInterceptionAttempt(interceptionResults, context);
      
      if (interceptionOutcome) {
        console.log(`⚡ INTERCEPTION ${interceptionOutcome.success ? 'SUCCESS' : 'FAILED'}: ${interceptionOutcome.description}`);
        
        // Add interception event to context if we have events array
        if (context.matchEvents) {
          const event = {
            minute: context.currentMinute,
            type: interceptionOutcome.success ? 'interception' : 'attempted_interception',
            description: interceptionOutcome.description,
            commentary: interceptionOutcome.commentary,
            playerId: interceptionOutcome.interceptor.playerId,
            playerName: this.getPlayerName(interceptionOutcome.interceptor.playerId, context),
            team: interceptionOutcome.interceptor.team
          };
          
          context.matchEvents.push(event as any);
        }
      }
    }
  }
  
  /**
   * 5. Update ball physics and possession contests
   */
  private static updateBallPhysicsAndContests(context: MatchContext): void {
    const ballHolderId = context.possession.playerId;
    
    if (ballHolderId) {
      // Ball is held by a player
      const holder = context.playerPositions.get(ballHolderId);
      if (holder) {
        // Ball follows holder during actions
        if (holder.currentAction === 'pass' && (holder.actionTimer || 0) > 0) {
          // Keep ball at holder until pass is released
          context.ballPosition.x = holder.x;
          context.ballPosition.y = holder.y;
        } else if (holder.currentAction === 'dribble') {
          // Ball slightly ahead of dribbler
          const forwardOffset = this.getForwardVector(holder);
          context.ballPosition.x = holder.x + forwardOffset.x * 0.5;
          context.ballPosition.y = holder.y + forwardOffset.y * 0.5;
          context.ballPosition.speed = holder.speed || 0;
          context.ballPosition.direction = holder.direction;
        } else {
          // Default: ball at player position
          context.ballPosition.x = holder.x;
          context.ballPosition.y = holder.y;
        }
      }
    } else {
      // Ball is free - apply physics
      context.ballPosition.x += (context.ballPosition as any).vel?.x || 0;
      context.ballPosition.y += (context.ballPosition as any).vel?.y || 0;
      
      // Apply friction
      if ((context.ballPosition as any).vel) {
        (context.ballPosition as any).vel.x *= this.FRICTION_COEFFICIENT;
        (context.ballPosition as any).vel.y *= this.FRICTION_COEFFICIENT;
      }
      
      // Check for possession contests
      const candidates = this.findNearbyPlayers(
        { x: context.ballPosition.x, y: context.ballPosition.y } as any,
        context,
        'both',
        this.CONTEST_RADIUS
      );
      
      if (candidates.length > 0) {
        const winner = this.resolveContestByTimeToBall(candidates, context.ballPosition, context);
        if (winner) {
          context.possession.playerId = winner.playerId;
          context.possession.team = winner.team;
          context.possession.timestamp = context.tick;
          
          DiagnosticLogger.logPossessionChange(
            { team: 'none', playerId: null },
            context.possession,
            'Ball contest resolution',
            context
          );
        }
      }
    }
  }
  
  /**
   * 9. Apply fatigue and cooldowns
   */
  private static applyFatigueAndCooldowns(players: PlayerPosition[], context: MatchContext): void {
    for (const player of players) {
      // Decrement action timer
      if (player.actionTimer && player.actionTimer > 0) {
        player.actionTimer--;
      }
      
      // Decrement cooldowns
      if (player.actionCooldowns) {
        for (const [action, cooldown] of Object.entries(player.actionCooldowns)) {
          if (cooldown > 0) {
            player.actionCooldowns[action] = cooldown - 1;
          }
        }
      }
      
      // Update fatigue based on action intensity
      const fatigueIncrease = this.calculateFatigueIncrease(player, context);
      const currentFatigue = context.fatigueLevels[player.playerId.toString()] || 0;
      context.fatigueLevels[player.playerId.toString()] = Math.min(1, currentFatigue + fatigueIncrease);
    }
  }
  
  // HELPER METHODS
  
  private static isPlayerUnavailable(player: PlayerPosition): boolean {
    return false; // Placeholder for injury/sub logic
  }
  
  private static createIdleIntent(): PlayerIntent {
    return {
      moveTarget: { x: 0, y: 0 },
      microAction: 'idle',
      runTimer: 0,
      priority: 0
    };
  }
  
  private static findNearbyPlayers(
    centerPoint: { x: number; y: number; playerId?: number },
    context: MatchContext,
    teamFilter: 'home' | 'away' | 'both',
    radius: number
  ): PlayerPosition[] {
    const nearby: PlayerPosition[] = [];
    
    for (const [_, player] of context.playerPositions) {
      if (centerPoint.playerId && player.playerId === centerPoint.playerId) continue;
      
      if (teamFilter !== 'both' && player.team !== teamFilter) continue;
      
      const distance = MathUtils.distance(centerPoint.x, centerPoint.y, player.x, player.y);
      if (distance <= radius) {
        nearby.push(player);
      }
    }
    
    return nearby;
  }
  
  private static hasLineOfSight(player: PlayerPosition, target: { x: number; y: number }, context: MatchContext): boolean {
    // Simplified line of sight - check if any players block the direct path
    const opponents = this.findNearbyPlayers(player, context, player.team === 'home' ? 'away' : 'home', 50);
    
    for (const opponent of opponents) {
      const distanceToLine = this.distanceToLine(
        { x: player.x, y: player.y },
        { x: target.x, y: target.y },
        { x: opponent.x, y: opponent.y }
      );
      
      if (distanceToLine < 2) { // 2 meter blocking radius
        return false;
      }
    }
    
    return true;
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
  
  private static getFormationTarget(player: PlayerPosition, context: MatchContext): { x: number; y: number } {
    // Simplified formation target - use role-based positioning
    const role = player.role || 'CM';
    const isHome = player.team === 'home';
    
    // Basic formation positions (can be enhanced with actual formation data)
    const formationMap: Record<string, { x: number; y: number }> = {
      'GK': { x: isHome ? 10 : 90, y: 50 },
      'CB1': { x: isHome ? 20 : 80, y: 35 },
      'CB2': { x: isHome ? 20 : 80, y: 65 },
      'RB': { x: isHome ? 25 : 75, y: 15 },
      'LB': { x: isHome ? 25 : 75, y: 85 },
      'DM': { x: isHome ? 35 : 65, y: 50 },
      'CM': { x: isHome ? 45 : 55, y: 50 },
      'AM': { x: isHome ? 65 : 35, y: 50 },
      'WM': { x: isHome ? 50 : 50, y: player.y > 50 ? 80 : 20 },
      'ST': { x: isHome ? 80 : 20, y: 50 },
      'CF': { x: isHome ? 75 : 25, y: 50 }
    };
    
    return formationMap[role] || { x: isHome ? 50 : 50, y: 50 };
  }
  
  private static evaluatePassingOptions(player: PlayerPosition, context: MatchContext): PassingOption[] {
    const options: PassingOption[] = [];
    const teammates = this.findNearbyPlayers(player, context, player.team, 40);
    
    for (const teammate of teammates) {
      const distance = MathUtils.distance(player.x, player.y, teammate.x, teammate.y);
      const lineClear = this.hasLineOfSight(player, teammate, context);
      const pressure = this.calculatePressureOnPlayer(teammate, context);
      
      const passingScore = Math.max(0, 100 - distance * 2 - pressure * 3 + (lineClear ? 20 : -20));
      
      options.push({
        target: teammate,
        score: passingScore,
        distance: distance,
        lineClear: lineClear
      });
    }
    
    return options.sort((a, b) => b.score - a.score);
  }
  
  private static calculatePressureOnPlayer(player: PlayerPosition, context: MatchContext): number {
    const opponents = this.findNearbyPlayers(player, context, player.team === 'home' ? 'away' : 'home', 10);
    let pressure = 0;
    
    for (const opponent of opponents) {
      const distance = MathUtils.distance(player.x, player.y, opponent.x, opponent.y);
      pressure += Math.max(0, 10 - distance);
    }
    
    return Math.min(100, pressure);
  }
  
  private static findNearestTeammate(player: PlayerPosition, context: MatchContext): PlayerPosition | null {
    const teammates = this.findNearbyPlayers(player, context, player.team, 100);
    if (teammates.length === 0) return null;
    
    return teammates.reduce((nearest, current) => {
      const nearestDist = MathUtils.distance(player.x, player.y, nearest.x, nearest.y);
      const currentDist = MathUtils.distance(player.x, player.y, current.x, current.y);
      return currentDist < nearestDist ? current : nearest;
    });
  }
  
  private static findNearestOpponent(player: PlayerPosition, context: MatchContext): PlayerPosition | null {
    const opponents = this.findNearbyPlayers(player, context, player.team === 'home' ? 'away' : 'home', 100);
    if (opponents.length === 0) return null;
    
    return opponents.reduce((nearest, current) => {
      const nearestDist = MathUtils.distance(player.x, player.y, nearest.x, nearest.y);
      const currentDist = MathUtils.distance(player.x, player.y, current.x, current.y);
      return currentDist < nearestDist ? current : nearest;
    });
  }
  
  private static getEffectiveSpeed(player: PlayerPosition, context: MatchContext): number {
    const baseSpeeds = { 'GK': 2, 'CB1': 3, 'CB2': 3, 'RB': 4, 'LB': 4, 'DM': 3, 'CM': 4, 'AM': 4, 'WM': 5, 'ST': 4, 'CF': 4 };
    const baseSpeed = baseSpeeds[player.role as keyof typeof baseSpeeds] || 3;
    
    const fatigue = context.fatigueLevels[player.playerId.toString()] || 0;
    const fatigueMultiplier = Math.max(0.5, 1 - fatigue);
    
    return baseSpeed * fatigueMultiplier;
  }
  
  private static normalize(vector: { x: number; y: number }): { x: number; y: number } {
    const magnitude = Math.sqrt(vector.x ** 2 + vector.y ** 2);
    if (magnitude === 0) return { x: 0, y: 0 };
    return { x: vector.x / magnitude, y: vector.y / magnitude };
  }
  
  private static getForwardVector(player: PlayerPosition): { x: number; y: number } {
    return { x: Math.cos(player.direction), y: Math.sin(player.direction) };
  }
  
  private static resolveContestByTimeToBall(candidates: PlayerPosition[], ballPos: any, context: MatchContext): PlayerPosition | null {
    if (candidates.length === 0) return null;
    
    let best = candidates[0];
    let bestTime = this.calculateTimeToBall(best, ballPos, context);
    
    for (let i = 1; i < candidates.length; i++) {
      const time = this.calculateTimeToBall(candidates[i], ballPos, context);
      if (time < bestTime) {
        best = candidates[i];
        bestTime = time;
      }
    }
    
    return best;
  }
  
  private static calculateTimeToBall(player: PlayerPosition, ballPos: any, context: MatchContext): number {
    const distance = MathUtils.distance(player.x, player.y, ballPos.x, ballPos.y);
    const speed = this.getEffectiveSpeed(player, context);
    const reactionDelay = 0.2; // 200ms reaction time
    
    return distance / speed + reactionDelay;
  }
  
  private static calculateFatigueIncrease(player: PlayerPosition, context: MatchContext): number {
    const intensityMap = { 'idle': 0, 'hold_shape': 0.01, 'support': 0.02, 'run': 0.05, 'press': 0.08, 'counter_press': 0.1 };
    const microAction = player.intent?.microAction || 'idle';
    return intensityMap[microAction as keyof typeof intensityMap] || 0.02;
  }
  
  private static getPlayerName(playerId: number, context: MatchContext): string {
    const allPlayers = [...context.homeTeam.players, ...context.awayTeam.players];
    const player = allPlayers.find(p => p.id === playerId);
    return player ? `${player.first_name} ${player.last_name}` : `Player ${playerId}`;
  }
  
  // PLACEHOLDER METHODS - To be implemented based on specific tactical requirements
  
  private static onBallIntent(player: PlayerPosition, perception: PlayerPerception, context: MatchContext): PlayerIntent {
    // Placeholder for on-ball decision making
    return {
      moveTarget: { x: player.x, y: player.y },
      microAction: 'hold_ball',
      runTimer: 0,
      priority: 5
    };
  }
  
  private static strikerAttackingIntent(player: PlayerPosition, perception: PlayerPerception, context: MatchContext): PlayerIntent {
    // Striker should make runs behind defense or occupy center
    const isHome = player.team === 'home';
    const runTarget = {
      x: isHome ? Math.min(95, player.x + 10) : Math.max(5, player.x - 10),
      y: player.y + ((Math.random() - 0.5) * 10)
    };
    
    return {
      moveTarget: runTarget,
      microAction: 'time_run',
      runTimer: 0,
      priority: 3
    };
  }
  
  private static wingerAttackingIntent(player: PlayerPosition, perception: PlayerPerception, context: MatchContext): PlayerIntent {
    // Winger should stretch width or cut inside
    const cutInside = Math.random() < 0.3;
    const moveTarget = cutInside ? 
      { x: player.x, y: player.y < 50 ? player.y + 10 : player.y - 10 } :
      { x: player.x, y: player.y < 50 ? Math.max(5, player.y - 5) : Math.min(95, player.y + 5) };
    
    return {
      moveTarget,
      microAction: cutInside ? 'cut_inside' : 'hug_line',
      runTimer: 0,
      priority: 2
    };
  }
  
  private static midfielderAttackingIntent(player: PlayerPosition, perception: PlayerPerception, context: MatchContext): PlayerIntent {
    // Midfielder should occupy passing lanes
    return {
      moveTarget: this.occupyPassingLane(player, perception, context),
      microAction: perception.distToBall < 20 ? 'offer_ball' : 'hold_shape',
      runTimer: 0,
      priority: 2
    };
  }
  
  private static defenderAttackingIntent(player: PlayerPosition, perception: PlayerPerception, context: MatchContext): PlayerIntent {
    // Defender may overlap or hold shape
    const shouldOverlap = Math.random() < 0.2; // 20% chance to overlap
    
    if (shouldOverlap) {
      const isHome = player.team === 'home';
      const overlapTarget = {
        x: isHome ? Math.min(80, player.x + 15) : Math.max(20, player.x - 15),
        y: player.y
      };
      
      return {
        moveTarget: overlapTarget,
        microAction: 'overlap',
        runTimer: 0,
        priority: 2
      };
    }
    
    return {
      moveTarget: this.getDefensiveLineTarget(player, context),
      microAction: 'hold_shape',
      runTimer: 0,
      priority: 1
    };
  }
  
  private static occupyPassingLane(player: PlayerPosition, perception: PlayerPerception, context: MatchContext): { x: number; y: number } {
    // Find good passing lane position
    const ballPos = perception.ball;
    const direction = Math.atan2(player.y - ballPos.y, player.x - ballPos.x);
    const distance = 15; // 15 meters from ball for good passing option
    
    return {
      x: Math.max(5, Math.min(95, ballPos.x + Math.cos(direction) * distance)),
      y: Math.max(5, Math.min(95, ballPos.y + Math.sin(direction) * distance))
    };
  }
  
  private static adjustTargetForSpacingAndLaneValue(
    target: { x: number; y: number },
    player: PlayerPosition,
    perception: PlayerPerception,
    context: MatchContext
  ): { x: number; y: number } {
    // Simple spacing adjustment - avoid clustering
    const teammates = perception.nearbyTeammates.filter(t => 
      MathUtils.distance(target.x, target.y, t.x, t.y) < 8
    );
    
    if (teammates.length > 0) {
      // Move slightly away from nearest teammate
      const nearest = teammates[0];
      const awayDirection = Math.atan2(target.y - nearest.y, target.x - nearest.x);
      
      return {
        x: Math.max(0, Math.min(100, target.x + Math.cos(awayDirection) * 3)),
        y: Math.max(0, Math.min(100, target.y + Math.sin(awayDirection) * 3))
      };
    }
    
    return target;
  }
  
  private static getMarkingTarget(player: PlayerPosition, context: MatchContext): PlayerPosition | null {
    // Simple marking - find nearest opponent
    return this.findNearestOpponent(player, context);
  }
  
  private static shadowOpponentPosition(opponent: PlayerPosition, player: PlayerPosition): { x: number; y: number } {
    // Position between opponent and own goal
    const isHome = player.team === 'home';
    const ownGoalX = isHome ? 0 : 100;
    
    // 70% of way from goal to opponent
    const shadowX = ownGoalX + (opponent.x - ownGoalX) * 0.7;
    
    return {
      x: Math.max(0, Math.min(100, shadowX)),
      y: Math.max(0, Math.min(100, opponent.y))
    };
  }
  
  private static shouldPress(player: PlayerPosition, perception: PlayerPerception, context: MatchContext): boolean {
    return perception.distToBall < this.PRESS_RADIUS && Math.random() < 0.4;
  }
  
  private static centerBackDefendingIntent(player: PlayerPosition, perception: PlayerPerception, context: MatchContext): PlayerIntent {
    return {
      moveTarget: this.getDefensiveLineTarget(player, context),
      microAction: this.isOpponentThreatNearby(player, perception) ? 'close_down' : 'mark',
      runTimer: 0,
      priority: 3
    };
  }
  
  private static fullbackDefendingIntent(player: PlayerPosition, perception: PlayerPerception, context: MatchContext): PlayerIntent {
    const ballOnSameSide = this.isBallOnSameSide(player, perception);
    
    return {
      moveTarget: ballOnSameSide ? 
        this.getTightMarkingTarget(player, perception) : 
        this.maintainDefensiveWidth(player, context),
      microAction: ballOnSameSide ? 'track' : 'hold_width',
      runTimer: 0,
      priority: 2
    };
  }
  
  private static midfielderDefendingIntent(player: PlayerPosition, perception: PlayerPerception, context: MatchContext): PlayerIntent {
    if (perception.distToBall < 25) {
      return {
        moveTarget: this.getCutPassingLaneTarget(player, perception),
        microAction: 'intercept_shallow',
        runTimer: 0,
        priority: 2
      };
    }
    
    return {
      moveTarget: this.getCoverCenterLaneTarget(player, context),
      microAction: 'cover',
      runTimer: 0,
      priority: 1
    };
  }
  
  private static getDefensiveLineTarget(player: PlayerPosition, context: MatchContext): { x: number; y: number } {
    // Simplified defensive line positioning
    const isHome = player.team === 'home';
    const ballPos = context.ballPosition;
    
    const lineX = isHome ? Math.max(15, Math.min(35, ballPos.x - 20)) : Math.min(85, Math.max(65, ballPos.x + 20));
    
    return { x: lineX, y: player.y };
  }
  
  private static getPressingIntensity(context: MatchContext): 'low' | 'medium' | 'high' {
    // Simplified - could be enhanced with tactical data
    return Math.random() < 0.3 ? 'high' : 'medium';
  }
  
  private static increasePressureIntent(
    intent: PlayerIntent,
    player: PlayerPosition,
    perception: PlayerPerception,
    context: MatchContext
  ): PlayerIntent {
    if (perception.distToBall < this.PRESS_RADIUS) {
      intent.microAction = 'press';
      intent.priority = Math.max(intent.priority, 3);
    }
    return intent;
  }
  
  private static ensureCompactnessWithTeamLine(
    target: { x: number; y: number },
    player: PlayerPosition,
    context: MatchContext
  ): { x: number; y: number } {
    // Keep defensive line compact
    const teammates = this.findNearbyPlayers(player, context, player.team, 30);
    const defensiveTeammates = teammates.filter(t => t.role?.includes('B') || t.role?.includes('CB'));
    
    if (defensiveTeammates.length > 0) {
      const avgX = defensiveTeammates.reduce((sum, t) => sum + t.x, 0) / defensiveTeammates.length;
      const maxDistance = 8; // Max distance from average line
      
      if (Math.abs(target.x - avgX) > maxDistance) {
        target.x = avgX + (target.x > avgX ? maxDistance : -maxDistance);
      }
    }
    
    return target;
  }
  
  private static shouldCounterPress(player: PlayerPosition, perception: PlayerPerception, context: MatchContext): boolean {
    return perception.distToBall < 12 && Math.random() < 0.3;
  }
  
  private static shouldMakeCounterRun(player: PlayerPosition, perception: PlayerPerception, context: MatchContext): boolean {
    const role = player.role || '';
    return (role.includes('W') || role === 'ST') && Math.random() < 0.4;
  }
  
  private static getCounterPressTarget(player: PlayerPosition, perception: PlayerPerception, context: MatchContext): { x: number; y: number } {
    const ballPos = perception.ball;
    return {
      x: Math.max(0, Math.min(100, ballPos.x + ((Math.random() - 0.5) * 4))),
      y: Math.max(0, Math.min(100, ballPos.y + ((Math.random() - 0.5) * 4)))
    };
  }
  
  private static getCounterRunTarget(player: PlayerPosition, perception: PlayerPerception, context: MatchContext): { x: number; y: number } {
    const isHome = player.team === 'home';
    return {
      x: isHome ? Math.min(90, player.x + 20) : Math.max(10, player.x - 20),
      y: player.y + ((Math.random() - 0.5) * 15)
    };
  }
  
  private static getSupportChannelTarget(player: PlayerPosition, perception: PlayerPerception, context: MatchContext): { x: number; y: number } {
    const ballPos = perception.ball;
    const supportDistance = 15;
    const angle = Math.atan2(player.y - ballPos.y, player.x - ballPos.x);
    
    return {
      x: Math.max(5, Math.min(95, ballPos.x + Math.cos(angle) * supportDistance)),
      y: Math.max(5, Math.min(95, ballPos.y + Math.sin(angle) * supportDistance))
    };
  }
  
  private static getRetreatTarget(player: PlayerPosition, context: MatchContext): { x: number; y: number } {
    return this.getFormationTarget(player, context);
  }
  
  private static applyPersonalTendenciesAndCooldowns(
    player: PlayerPosition,
    intent: PlayerIntent,
    perception: PlayerPerception,
    context: MatchContext
  ): PlayerIntent {
    // Check cooldowns
    if (player.actionCooldowns && player.actionCooldowns[intent.microAction] > 0) {
      intent.microAction = 'hold_shape'; // Fallback action
    }
    
    // Apply personal tendencies (simplified)
    if (Math.random() < 0.1) { // 10% chance for personal variation
      const variations = ['aggressive', 'cautious', 'creative'];
      const variation = variations[Math.floor(Math.random() * variations.length)];
      
      if (variation === 'aggressive') {
        intent.priority = Math.min(5, intent.priority + 1);
      }
    }
    
    return intent;
  }
  
  // Additional placeholder methods
  private static isOpponentThreatNearby(player: PlayerPosition, perception: PlayerPerception): boolean {
    return perception.nearbyOpponents.some(opp => 
      MathUtils.distance(player.x, player.y, opp.x, opp.y) < 10
    );
  }
  
  private static isBallOnSameSide(player: PlayerPosition, perception: PlayerPerception): boolean {
    return Math.abs(player.y - perception.ball.y) < 25;
  }
  
  private static getTightMarkingTarget(player: PlayerPosition, perception: PlayerPerception): { x: number; y: number } {
    const nearestOpponent = perception.nearestOpponent;
    if (nearestOpponent) {
      return { x: nearestOpponent.x - 2, y: nearestOpponent.y };
    }
    return { x: player.x, y: player.y };
  }
  
  private static maintainDefensiveWidth(player: PlayerPosition, context: MatchContext): { x: number; y: number } {
    return this.getFormationTarget(player, context);
  }
  
  private static getCutPassingLaneTarget(player: PlayerPosition, perception: PlayerPerception): { x: number; y: number } {
    const ballPos = perception.ball;
    const bestTarget = perception.passingOptions[0];
    
    if (bestTarget) {
      // Position to intercept pass
      const midPoint = {
        x: (ballPos.x + bestTarget.target.x) / 2,
        y: (ballPos.y + bestTarget.target.y) / 2
      };
      return midPoint;
    }
    
    return { x: player.x, y: player.y };
  }
  
  private static getCoverCenterLaneTarget(player: PlayerPosition, context: MatchContext): { x: number; y: number } {
    const ballPos = context.ballPosition;
    const isHome = player.team === 'home';
    
    // Cover central area
    return {
      x: isHome ? Math.max(20, Math.min(60, ballPos.x - 10)) : Math.min(80, Math.max(40, ballPos.x + 10)),
      y: 50 // Central position
    };
  }
}

// TYPE DEFINITIONS

interface PlayerPerception {
  nearbyTeammates: PlayerPosition[];
  nearbyOpponents: PlayerPosition[];
  ball: any;
  distToBall: number;
  hasClearLineToBall: boolean;
  teamPhase: string;
  formationTarget: { x: number; y: number };
  passingOptions: PassingOption[];
  nearestTeammate: PlayerPosition | null;
  nearestOpponent: PlayerPosition | null;
}

interface PlayerIntent {
  moveTarget: { x: number; y: number };
  microAction: string;
  runTimer: number;
  priority: number;
}

interface PassingOption {
  target: PlayerPosition;
  score: number;
  distance: number;
  lineClear: boolean;
}

// Extend context type for team phases
declare module '../../types' {
  interface MatchContext {
    teamPhases?: { home: string; away: string };
  }
  
  interface PlayerPosition {
    intent?: PlayerIntent;
    desiredVelocity?: { x: number; y: number };
    velocity?: { x: number; y: number };
  }
}