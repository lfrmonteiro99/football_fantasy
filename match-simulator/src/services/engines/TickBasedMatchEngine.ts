import { MatchContext, PlayerPosition, MatchEvent, BallPosition } from '../../types';
import { MathUtils } from '../../utils/MathUtils';
import { EnhancedDecisionAI } from './EnhancedDecisionAI';
import { CentralContestResolver } from './CentralContestResolver';
import { ActionStateManager } from './ActionStateManager';
import { OffBallMovementEngine } from './OffBallMovementEngine';
import { SimultaneousPlayerEngine } from './SimultaneousPlayerEngine';
import { DiagnosticLogger } from './DiagnosticLogger';

/**
 * INTEGRATED TICK-BASED MATCH ENGINE
 * 
 * Phase 1-3 Integration:
 * - 1-second ticks (5400 total for 90 minutes)
 * - Action duration system (multi-tick actions)
 * - Enhanced AI decision making with memory
 * - Full 22-player simultaneous behavior
 * - Physics-based movement and contests
 * - Comprehensive diagnostic logging
 * - Robust design patterns
 */
export class TickBasedMatchEngine {
  
  // ACTION DURATIONS (in ticks/seconds)
  private static readonly ACTION_DURATIONS = {
    'dribble': 3,
    'pass': 2, 
    'shot': 4,
    'hold': 1,
    'tackle': 2,
    'cross': 2,
    'positioning': 1
  };

  /**
   * Main tick processing - called once per second
   */
  static processMatchTick(context: MatchContext): {
    ballPosition: BallPosition;
    playerPositions: PlayerPosition[];
    events: MatchEvent[];
    newPossession: any;
  } {
    console.log(`🎮 TICK ENGINE: Processing tick ${context.tick} (${context.currentMinute}:${String(context.currentSecond % 60).padStart(2, '0')})`);
    
    // ROBUST DESIGN B: Initialize action states on first tick
    if (context.tick === 0) {
      ActionStateManager.initializePlayerActionStates(context);
    }
    
    // STEP 1: Update action states and cooldowns
    ActionStateManager.updateActionStates(context);
    this.decrementAllCooldownsAndTimers(context);
    
    // STEP 2: Process on-ball phase
    const onBallResults = this.processOnBallPhase(context);
    
    // STEP 3: PHASE 3: Process simultaneous movement for all 22 players
    SimultaneousPlayerEngine.processSimultaneousMovement(context);
    
    // STEP 4: Physics update positions and ball
    const physicsResults = this.physicsUpdatePositionsAndBall(context);
    
    // STEP 5: Generate events (if any actions completed)
    const events = onBallResults.events || [];
    
    console.log(`✅ TICK RESULT: ${events.length} events, possession: ${onBallResults.possession?.team || context.possession.team}`);
    
    return {
      ballPosition: physicsResults.ballPosition,
      playerPositions: physicsResults.playerPositions,
      events: events,
      newPossession: onBallResults.possession || context.possession
    };
  }

  /**
   * STEP 1: Decrement all cooldowns and timers (now managed by ActionStateManager)
   */
  private static decrementAllCooldownsAndTimers(context: MatchContext): void {
    // Decrement global cooldowns
    for (const [key, value] of Object.entries(context.globalCooldowns)) {
      context.globalCooldowns[key] = Math.max(0, value - 1);
    }
    
    // ROBUST DESIGN B: Action timers now managed by ActionStateManager
    // Individual player timers and cooldowns are handled in ActionStateManager.updateActionStates()
    
    // Still decrement basic action timers for backward compatibility
    for (const [_, player] of context.playerPositions) {
      // Decrement action timer
      if (player.actionTimer > 0) {
        player.actionTimer--;
      }
      
      // Decrement individual cooldowns
      if (player.actionCooldowns) {
        for (const [action, cooldown] of Object.entries(player.actionCooldowns)) {
          player.actionCooldowns[action] = Math.max(0, cooldown - 1);
        }
      }
    }
    
    console.log(`⏰ COOLDOWNS: Updated all timers for tick ${context.tick}`);
  }

  /**
   * STEP 2: Process on-ball phase
   */
  private static processOnBallPhase(context: MatchContext): {
    events: MatchEvent[];
    possession?: any;
  } {
    const holder = this.getBallHolder(context);
    
    if (!holder) {
      // Handle loose ball contestation (PHASE 3)
      return { events: [] };
    }

    // If player is in middle of an action, continue it
    if (holder.actionTimer > 0) {
      console.log(`⏳ ACTION IN PROGRESS: Player ${holder.playerId} continuing ${holder.currentAction} (${holder.actionTimer} ticks remaining)`);
      return { events: [] };
    }

    // If player just completed an action, resolve it
    if (holder.actionTimer === 0 && holder.currentAction) {
      console.log(`🎬 ACTION COMPLETE: Player ${holder.playerId} finished ${holder.currentAction}`);
      return this.resolveCompletedAction(holder, context);
    }

    // Otherwise, player needs to make a new decision
    return this.initiateNewAction(holder, context);
  }

  /**
   * Get the current ball holder
   */
  private static getBallHolder(context: MatchContext): PlayerPosition | null {
    if (context.possession.playerId) {
      return context.playerPositions.get(context.possession.playerId) || null;
    }
    
    // Find closest player to ball if no specific holder
    const ballPos = context.ballPosition;
    let closest = null;
    let minDistance = Infinity;
    
    for (const [_, player] of context.playerPositions) {
      const distance = MathUtils.distance(player.x, player.y, ballPos.x, ballPos.y);
      if (distance < minDistance && distance < 5) {
        minDistance = distance;
        closest = player;
      }
    }
    
    return closest;
  }

  /**
   * ROBUST DESIGN B: Enhanced action initiation with state management
   */
  private static initiateNewAction(holder: PlayerPosition, context: MatchContext): {
    events: MatchEvent[];
    possession?: any;
  } {
    console.log(`🧠 ENHANCED AI: Making decision for player ${holder.playerId} at tick ${context.tick}`);
    
    let chosenAction: string;
    
    try {
      // PHASE 2: Use Enhanced Decision AI for sophisticated decision making
      chosenAction = EnhancedDecisionAI.makeEnhancedDecision(holder, context);
      console.log(`✅ ENHANCED DECISION: Player ${holder.playerId} chose "${chosenAction}" via Enhanced AI`);
    } catch (error) {
      // Fallback to basic logic if Enhanced AI fails
      console.log(`⚠️ ENHANCED AI FALLBACK: Error in Enhanced AI, using basic logic for player ${holder.playerId}`);
      chosenAction = this.makeBasicFallbackDecision(holder, context);
    }
    
    // Validate action exists in our durations
    if (!this.ACTION_DURATIONS[chosenAction as keyof typeof this.ACTION_DURATIONS]) {
      console.log(`❌ INVALID ACTION: "${chosenAction}" not found, defaulting to hold`);
      chosenAction = 'hold';
    }
    
    // ROBUST DESIGN B: Use Action State Manager to start action
    const duration = this.ACTION_DURATIONS[chosenAction as keyof typeof this.ACTION_DURATIONS] || 1;
    const target = this.getActionTarget(holder, chosenAction, context);
    
    const actionStarted = ActionStateManager.startPlayerAction(
      holder,
      chosenAction,
      target,
      duration,
      context
    );
    
    if (!actionStarted) {
      console.log(`⏸️ ACTION QUEUED: Player ${holder.playerId} - ${chosenAction} queued for later`);
      return { events: [] }; // Action was queued
    }
    
    console.log(`🎬 ROBUST ACTION START: Player ${holder.playerId} starts ${chosenAction} (${duration} ticks)`);
    
    return { events: [] }; // No immediate events - action will resolve later
  }

  /**
   * PHASE 2: Fallback decision making for when Enhanced AI fails
   */
  private static makeBasicFallbackDecision(holder: PlayerPosition, context: MatchContext): string {
    const nearestOpponent = this.findNearestOpponent(holder, context);
    const distanceToOpponent = nearestOpponent ? 
      MathUtils.distance(holder.x, holder.y, nearestOpponent.x, nearestOpponent.y) : Infinity;
    
    if (distanceToOpponent < 5) {
      return Math.random() < 0.6 ? 'pass' : 'dribble';
    } else if (this.isInShootingPosition(holder, context)) {
      return Math.random() < 0.3 ? 'shot' : 'pass'; 
    } else {
      return Math.random() < 0.7 ? 'dribble' : 'pass';
    }
  }

  /**
   * PHASE 2: ENHANCED ACTION RESOLUTION WITH SUCCESS/FAILURE TRACKING
   * Resolve a completed action and update player memory for learning
   */
  private static resolveCompletedAction(holder: PlayerPosition, context: MatchContext): {
    events: MatchEvent[];
    possession?: any;
  } {
    const action = holder.currentAction!;
    const minute = context.currentMinute;
    const playerName = this.getPlayerName(holder.playerId, context);
    
    // ROBUST DESIGN E: Log action state change for debugging
    DiagnosticLogger.logActionStateChange(holder, action, undefined, context);
    
    // Apply cooldown for this action
    if (!holder.actionCooldowns) holder.actionCooldowns = {};
    holder.actionCooldowns[action] = 3; // 3-tick cooldown
    
    // Clear current action
    holder.currentAction = undefined;
    holder.actionTimer = 0;
    
    console.log(`🎯 PHASE 2 RESOLVING: ${playerName} completed ${action}`);
    
    let result: { events: MatchEvent[]; possession?: any };
    
    switch (action) {
      case 'dribble':
        result = this.resolveDribble(holder, context, minute, playerName);
        break;
      case 'pass':
        result = this.resolvePass(holder, context, minute, playerName);
        break;
      case 'shot':
        result = this.resolveShot(holder, context, minute, playerName);
        break;
      case 'cross':
        result = this.resolveCross(holder, context, minute, playerName);
        break;
      case 'hold':
        result = this.resolveHold(holder, context, minute, playerName);
        break;
      default:
        result = { events: [] };
    }
    
    // PHASE 2: Update player memory based on action outcome
    this.updatePlayerMemoryWithOutcome(holder, context, action, result);
    
    return result;
  }

  /**
   * PHASE 2: Update player memory with action success/failure for learning
   */
  private static updatePlayerMemoryWithOutcome(
    holder: PlayerPosition, 
    context: MatchContext, 
    action: string, 
    result: { events: MatchEvent[]; possession?: any }
  ): void {
    if (!context.playerFailureMemory) {
      context.playerFailureMemory = {};
    }
    
    if (!context.playerFailureMemory[holder.playerId]) {
      context.playerFailureMemory[holder.playerId] = {};
    }
    
    const memory = context.playerFailureMemory[holder.playerId];
    
    // Determine if action was successful based on outcome
    const wasSuccessful = this.wasActionSuccessful(action, result, holder, context);
    
    if (wasSuccessful) {
      // Success: Reset failure counters for this action
      if (memory.lastFailedAction === action) {
        memory.consecutiveFailures = 0;
        console.log(`✅ MEMORY SUCCESS: Player ${holder.playerId} succeeded at ${action}, resetting failure count`);
      }
    } else {
      // Failure: Update failure memory
      if (memory.lastFailedAction === action) {
        memory.consecutiveFailures = (memory.consecutiveFailures || 0) + 1;
      } else {
        memory.lastFailedAction = action;
        memory.consecutiveFailures = 1;
      }
      memory.lastFailureTime = context.tick;
      
      console.log(`❌ MEMORY FAILURE: Player ${holder.playerId} failed at ${action} (${memory.consecutiveFailures} consecutive failures)`);
    }
    
    memory.lastActionTick = context.tick;
  }

  /**
   * PHASE 2: Determine if an action was successful based on its outcome
   */
  private static wasActionSuccessful(
    action: string, 
    result: { events: MatchEvent[]; possession?: any }, 
    holder: PlayerPosition, 
    context: MatchContext
  ): boolean {
    switch (action) {
      case 'pass':
      case 'cross':
        // Pass/cross successful if possession didn't change to opponent
        if (result.possession) {
          return result.possession.team === holder.team;
        }
        // If no possession change, assume successful
        return true;
        
      case 'shot':
        // Shot successful if it resulted in a goal or shot on target
        return result.events.some(event => 
          event.type === 'goal' || event.type === 'shot_on_target'
        );
        
      case 'dribble':
        // Dribble successful if player advanced and kept possession
        return !result.possession || result.possession.team === holder.team;
        
      case 'hold':
        // Hold successful if possession was maintained
        return !result.possession || result.possession.team === holder.team;
        
      default:
        return true; // Default to successful for unknown actions
    }
  }

  /**
   * Resolve dribble action
   */
  private static resolveDribble(holder: PlayerPosition, context: MatchContext, minute: number, playerName: string): {
    events: MatchEvent[];
    possession?: any;
  } {
    const isHome = holder.team === 'home';
    const moveDistance = 8; // meters
    const direction = isHome ? 0 : Math.PI; // toward goal
    
    // Calculate new position
    const newX = Math.max(0, Math.min(100, holder.x + Math.cos(direction) * moveDistance));
    const newY = holder.y;
    
    // Update positions
    holder.x = newX;
    holder.y = newY;
    context.ballPosition.x = newX;
    context.ballPosition.y = newY;
    
    const event: MatchEvent = {
      minute,
      type: 'dribbling',
      description: `${playerName} advances with the ball`,
      commentary: `${playerName} drives forward with the ball, making good progress up the field.`,
      playerId: holder.playerId,
      playerName: playerName,
      team: holder.team
    };
    
    return { events: [event] };
  }

  /**
   * ROBUST DESIGN: Resolve pass action using Central Contest Resolver
   */
  private static resolvePass(holder: PlayerPosition, context: MatchContext, minute: number, playerName: string): {
    events: MatchEvent[];
    possession?: any;
  } {
    // Find a teammate to pass to with improved selection
    const target = this.findBestPassTarget(holder, context);
    
    if (!target) {
      // No target - keep possession
      console.log(`❌ NO PASS TARGET: Player ${holder.playerId} has no viable pass options`);
      return { events: [] };
    }
    
    console.log(`🎯 PASS ATTEMPT: ${playerName} → ${this.getPlayerName(target.playerId, context)}`);
    
    // Set ball velocity for pass (for physics-based interception detection)
    const passDistance = MathUtils.distance(holder.x, holder.y, target.x, target.y);
    const passSpeed = Math.min(25, Math.max(10, passDistance * 0.8)); // Realistic pass speed
    const passDirection = Math.atan2(target.y - holder.y, target.x - holder.x);
    
    context.ballPosition.speed = passSpeed;
    context.ballPosition.direction = passDirection;
    
    // Use Central Contest Resolver for consistent, physics-based resolution
    const contestResult = CentralContestResolver.resolveBallContest(
      'pass',
      holder,
      target,
      { x: holder.x, y: holder.y }, // Ball starts at passer's position
      context,
      { passOrigin: { x: holder.x, y: holder.y } } // Additional data for pass physics
    );
    
    // ROBUST DESIGN E: Log possession change for debugging
    if (contestResult.newPossession.team !== context.possession.team || 
        contestResult.newPossession.playerId !== context.possession.playerId) {
      DiagnosticLogger.logPossessionChange(
        context.possession,
        contestResult.newPossession,
        `Pass contest result - ${contestResult.event.type}`,
        context
      );
    }
    
    // Update game state based on contest result
    context.possession = contestResult.newPossession;
    
    return {
      events: [contestResult.event],
      possession: contestResult.newPossession
    };
  }

  /**
   * Resolve shot action
   */
  private static resolveShot(holder: PlayerPosition, context: MatchContext, minute: number, playerName: string): {
    events: MatchEvent[];
    possession?: any;
  } {
    // Set ball velocity for shot (for physics-based interception detection)
    const isHome = holder.team === 'home';
    const goalX = isHome ? 100 : 0;
    const shotDistance = MathUtils.distance(holder.x, holder.y, goalX, 50);
    const shotSpeed = Math.min(30, Math.max(15, shotDistance * 1.2)); // Fast shot speed
    const shotDirection = Math.atan2(50 - holder.y, goalX - holder.x);
    
    context.ballPosition.speed = shotSpeed;
    context.ballPosition.direction = shotDirection;
    
    const isGoal = Math.random() < 0.05; // 5% goal chance for now
    
    if (isGoal) {
      // GOAL!
      if (holder.team === 'home') {
        context.score.home++;
      } else {
        context.score.away++;
      }
      
      const event: MatchEvent = {
        minute,
        type: 'goal',
        description: `⚽ ${playerName} scores!`,
        commentary: `GOAL! ${playerName} finds the back of the net with a brilliant finish!`,
        playerId: holder.playerId,
        playerName: playerName,
        team: holder.team
      };
      
      // Reset for kickoff
      context.ballPosition = { x: 50, y: 50, speed: 0, direction: 0, status: 'in_play' };
      context.possession = {
        team: holder.team === 'home' ? 'away' : 'home',
        timestamp: context.tick
      };
      
      return {
        events: [event],
        possession: context.possession
      };
    } else {
      // Shot missed
      const event: MatchEvent = {
        minute,
        type: 'shot',
        description: `${playerName} shoots wide`,
        commentary: `${playerName} takes aim but the shot goes wide of the target.`,
        playerId: holder.playerId,
        playerName: playerName,
        team: holder.team
      };
      
      return { events: [event] };
    }
  }

  /**
   * PHASE 2: Resolve cross action 
   */
  private static resolveCross(holder: PlayerPosition, context: MatchContext, minute: number, playerName: string): {
    events: MatchEvent[];
    possession?: any;
  } {
    // Find teammates in the box for crossing
    const teammates = this.findTeammatesInBox(holder.team, context);
    const success = Math.random() < 0.6; // 60% cross success rate
    
    if (success && teammates.length > 0) {
      // Successful cross to a teammate
      const targetTeammate = teammates[Math.floor(Math.random() * teammates.length)];
      const targetName = this.getPlayerName(targetTeammate.playerId, context);
      
      context.possession = {
        team: holder.team,
        playerId: targetTeammate.playerId,
        timestamp: context.tick
      };
      
      // Move ball to target
      context.ballPosition.x = targetTeammate.x;
      context.ballPosition.y = targetTeammate.y;
      
      const event: MatchEvent = {
        minute,
        type: 'cross',
        description: `${playerName} crosses to ${targetName}`,
        commentary: `${playerName} delivers a dangerous cross into the box and finds ${targetName} in space!`,
        playerId: holder.playerId,
        playerName: playerName,
        team: holder.team
      };
      
      return {
        events: [event],
        possession: context.possession
      };
    } else {
      // Failed cross - possession to opposing team
      const opposingTeam = holder.team === 'home' ? 'away' : 'home';
      const defender = this.findNearestOpponent(holder, context);
      
      if (defender) {
        context.possession = {
          team: opposingTeam,
          playerId: defender.playerId,
          timestamp: context.tick
        };
        
        context.ballPosition.x = defender.x;
        context.ballPosition.y = defender.y;
        
        const defenderName = this.getPlayerName(defender.playerId, context);
        
        const event: MatchEvent = {
          minute,
          type: 'clearance',
          description: `${defenderName} clears ${playerName}'s cross`,
          commentary: `${playerName} attempts a cross but ${defenderName} is well-positioned to clear the danger.`,
          playerId: defender.playerId,
          playerName: defenderName,
          team: defender.team
        };
        
        return {
          events: [event],
          possession: context.possession
        };
      }
    }
    
    return { events: [] };
  }

  /**
   * Find teammates in the penalty box for crossing targets
   */
  private static findTeammatesInBox(team: 'home' | 'away', context: MatchContext): PlayerPosition[] {
    const isHome = team === 'home';
    const teammates: PlayerPosition[] = [];
    
    // Define penalty box coordinates
    const boxMinX = isHome ? 85 : 0;
    const boxMaxX = isHome ? 100 : 15;
    const boxMinY = 25;
    const boxMaxY = 75;
    
    for (const [_, player] of context.playerPositions) {
      if (player.team === team) {
        if (player.x >= boxMinX && player.x <= boxMaxX && 
            player.y >= boxMinY && player.y <= boxMaxY) {
          teammates.push(player);
        }
      }
    }
    
    return teammates;
  }

  /**
   * Resolve hold action
   */
  private static resolveHold(holder: PlayerPosition, context: MatchContext, minute: number, playerName: string): {
    events: MatchEvent[];
    possession?: any;
  } {
    // Just hold the ball - no events
    return { events: [] };
  }

  /**
   * STEP 4: Physics update positions and ball (PHASE 3: Handled by SimultaneousPlayerEngine)
   */
  private static physicsUpdatePositionsAndBall(context: MatchContext): {
    ballPosition: BallPosition;
    playerPositions: PlayerPosition[];
  } {
    // PHASE 3: Player movement is now handled by SimultaneousPlayerEngine
    // This step now focuses on ball physics and final position updates
    const updatedPlayers: PlayerPosition[] = Array.from(context.playerPositions.values());
    
    // Ball physics is handled within SimultaneousPlayerEngine.updateBallPhysicsAndContests()
    // Just ensure ball position is properly bounded
    context.ballPosition.x = Math.max(0, Math.min(100, context.ballPosition.x));
    context.ballPosition.y = Math.max(0, Math.min(100, context.ballPosition.y));
    
    return {
      ballPosition: context.ballPosition,
      playerPositions: updatedPlayers
    };
  }

  // HELPER METHODS
  
  private static findNearestOpponent(player: PlayerPosition, context: MatchContext): PlayerPosition | null {
    const opposingTeam = player.team === 'home' ? 'away' : 'home';
    let nearest = null;
    let minDistance = Infinity;
    
    for (const [_, opponent] of context.playerPositions) {
      if (opponent.team === opposingTeam) {
        const distance = MathUtils.distance(player.x, player.y, opponent.x, opponent.y);
        if (distance < minDistance) {
          minDistance = distance;
          nearest = opponent;
        }
      }
    }
    
    return nearest;
  }
  
  /**
   * ROBUST DESIGN C: Pass target selection with safety fallback system
   */
  private static findBestPassTarget(player: PlayerPosition, context: MatchContext): PlayerPosition | null {
    // Check if player has high failure rate and should use safety system
    const playerMemory = context.playerFailureMemory?.[player.playerId];
    const consecutiveFailures = playerMemory?.consecutiveFailures || 0;
    const useSafetySystem = consecutiveFailures > 1;
    
    // Count nearby opponents for pressure analysis
    const nearbyOpponents = this.countNearbyOpponents(player, context, 10);
    const underHighPressure = nearbyOpponents > 1;
    
    console.log(`🎯 PASS TARGET SELECTION: Player ${player.playerId} - Failures: ${consecutiveFailures}, Pressure: ${nearbyOpponents} opponents`);
    
    if (useSafetySystem || underHighPressure) {
      console.log(`🛡️ SAFETY SYSTEM ACTIVATED: Using safe pass selection`);
      return this.findSafePassTarget(player, context);
    }
    
    return this.findOptimalPassTarget(player, context);
  }
  
  /**
   * ROBUST DESIGN C: Find safe pass target (short, safe passes)
   */
  private static findSafePassTarget(player: PlayerPosition, context: MatchContext): PlayerPosition | null {
    const safeTargets: Array<{player: PlayerPosition, score: number}> = [];
    
    for (const [_, teammate] of context.playerPositions) {
      if (teammate.team !== player.team || teammate.playerId === player.playerId) {
        continue;
      }
      
      const distance = MathUtils.distance(player.x, player.y, teammate.x, teammate.y);
      
      // SAFETY SYSTEM: Only consider close, safe passes
      if (distance < 5 || distance > 15) {
        continue;
      }
      
      // Skip teammates that just had the ball
      const teammateMemory = context.playerFailureMemory?.[teammate.playerId];
      if (teammateMemory?.lastActionTick && (context.tick - teammateMemory.lastActionTick) < 5) {
        continue;
      }
      
      // SAFETY SCORING: Prioritize safety over progression
      let score = 100; // Start with high base score
      
      // Distance safety bonus (closer is safer)
      score += (15 - distance) * 5; // More points for closer passes
      
      // Space safety (more space = safer)
      const teammateSpace = this.analyzeSpaceAroundPlayer(teammate, context);
      score += teammateSpace * 20;
      
      // Passing lane must be completely clear for safety
      if (!this.isPassingLaneClear(player, teammate, context)) {
        continue; // Skip if lane is not clear
      }
      
      // Backward/sideways passes are safer than forward
      const isHome = player.team === 'home';
      const isBackward = isHome ? teammate.x < player.x : teammate.x > player.x;
      const isSideways = Math.abs(teammate.x - player.x) < 5;
      
      if (isBackward) score += 30; // Bonus for safe backward passes
      else if (isSideways) score += 20; // Bonus for sideways passes
      
      // Defensive players are safer targets
      if (teammate.role?.includes('B') || teammate.role === 'DM') {
        score += 25;
      }
      
      safeTargets.push({ player: teammate, score });
    }
    
    if (safeTargets.length === 0) {
      console.log(`⚠️ NO SAFE TARGETS: Player ${player.playerId} - falling back to holding ball`);
      return null;
    }
    
    // Sort by safety score
    safeTargets.sort((a, b) => b.score - a.score);
    
    const safeTarget = safeTargets[0];
    console.log(`🛡️ SAFE PASS TARGET: Player ${player.playerId} → ${safeTarget.player.playerId} (safety score: ${safeTarget.score})`);
    
    return safeTarget.player;
  }
  
  /**
   * Find optimal pass target (normal pass selection)
   */
  private static findOptimalPassTarget(player: PlayerPosition, context: MatchContext): PlayerPosition | null {
    const viableTargets: Array<{player: PlayerPosition, score: number}> = [];
    
    for (const [_, teammate] of context.playerPositions) {
      if (teammate.team !== player.team || teammate.playerId === player.playerId) {
        continue;
      }
      
      const distance = MathUtils.distance(player.x, player.y, teammate.x, teammate.y);
      
      // Skip teammates that are too close or too far
      if (distance < 8 || distance > 35) {
        continue;
      }
      
      // Skip teammates that just had the ball (prevent immediate pass-back)
      const teammateMemory = context.playerFailureMemory?.[teammate.playerId];
      if (teammateMemory?.lastActionTick && (context.tick - teammateMemory.lastActionTick) < 3) {
        console.log(`🚫 PASS COOLDOWN: Skipping teammate ${teammate.playerId} - too recent ball contact`);
        continue;
      }
      
      // Score potential targets based on multiple factors
      let score = 0;
      
      // Distance preference (medium distances are better)
      if (distance < 15) score += 30;
      else if (distance < 25) score += 20;
      else score += 10;
      
      // Forward progress bonus
      const isHome = player.team === 'home';
      const progressivePass = isHome ? teammate.x > player.x : teammate.x < player.x;
      if (progressivePass) score += 25;
      
      // Space around teammate (less crowded is better)
      const teammateSpace = this.analyzeSpaceAroundPlayer(teammate, context);
      score += teammateSpace * 15;
      
      // Check if passing lane is clear
      if (this.isPassingLaneClear(player, teammate, context)) {
        score += 20;
      } else {
        score -= 30; // Heavy penalty for blocked lanes
      }
      
      // Role-based bonus (prefer certain positions)
      if (teammate.role === 'CM' || teammate.role === 'AM') score += 10;
      if (teammate.role === 'ST' || teammate.role === 'CF') score += 15;
      
      viableTargets.push({ player: teammate, score });
    }
    
    if (viableTargets.length === 0) {
      console.log(`❌ NO VIABLE TARGETS: Player ${player.playerId} has no good pass options`);
      return null;
    }
    
    // Sort by score and return the best target
    viableTargets.sort((a, b) => b.score - a.score);
    
    const bestTarget = viableTargets[0];
    console.log(`🎯 OPTIMAL PASS TARGET: Player ${player.playerId} → ${bestTarget.player.playerId} (score: ${bestTarget.score})`);
    
    return bestTarget.player;
  }
  
  /**
   * Count nearby opponents for pressure analysis
   */
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
  
  /**
   * CRITICAL FIX: Better interceptor selection logic
   */
  private static findBestInterceptor(passer: PlayerPosition, target: PlayerPosition, context: MatchContext): PlayerPosition | null {
    const opposingTeam = passer.team === 'home' ? 'away' : 'home';
    const potentialInterceptors: Array<{player: PlayerPosition, chance: number}> = [];
    
    for (const [_, opponent] of context.playerPositions) {
      if (opponent.team !== opposingTeam) continue;
      
      // Skip opponents with recent interception cooldown
      const interceptionCooldown = opponent.actionCooldowns?.['interception'] || 0;
      if (interceptionCooldown > 0) {
        console.log(`⏰ INTERCEPTION COOLDOWN: Player ${opponent.playerId} on cooldown for ${interceptionCooldown} ticks`);
        continue;
      }
      
      // Calculate interception chance based on position relative to pass
      const distanceToPassLine = this.distanceToLine(
        { x: passer.x, y: passer.y },
        { x: target.x, y: target.y },
        { x: opponent.x, y: opponent.y }
      );
      
      // Only consider opponents close to the passing line
      if (distanceToPassLine > 8) continue;
      
      const distanceToTarget = MathUtils.distance(opponent.x, opponent.y, target.x, target.y);
      const passingDistance = MathUtils.distance(passer.x, passer.y, target.x, target.y);
      
      // Opponent must be between passer and target to intercept
      const passerToOpponent = MathUtils.distance(passer.x, passer.y, opponent.x, opponent.y);
      if (passerToOpponent > passingDistance) continue;
      
      // Calculate interception chance
      let chance = Math.max(0, 1 - (distanceToPassLine / 8)); // Closer to line = higher chance
      chance *= Math.max(0.2, 1 - (distanceToTarget / 15)); // Closer to target = higher chance
      
      // Player attributes affect interception
      const allPlayers = [...context.homeTeam.players, ...context.awayTeam.players];
      const playerData = allPlayers.find(p => p.id === opponent.playerId);
      if (playerData) {
        const interceptionSkill = (playerData.attributes.interceptions || 60) / 100;
        chance *= interceptionSkill;
      }
      
      potentialInterceptors.push({ player: opponent, chance });
    }
    
    if (potentialInterceptors.length === 0) {
      return null;
    }
    
    // Sort by interception chance and pick the best one
    potentialInterceptors.sort((a, b) => b.chance - a.chance);
    
    const bestInterceptor = potentialInterceptors[0];
    
    // Roll for successful interception
    if (Math.random() < bestInterceptor.chance) {
      console.log(`🛡️ INTERCEPTION: Player ${bestInterceptor.player.playerId} intercepts with ${(bestInterceptor.chance * 100).toFixed(1)}% chance`);
      return bestInterceptor.player;
    }
    
    return null;
  }
  
  /**
   * Analyze space around a player to help with pass target selection
   */
  private static analyzeSpaceAroundPlayer(player: PlayerPosition, context: MatchContext): number {
    const opposingTeam = player.team === 'home' ? 'away' : 'home';
    let nearbyOpponents = 0;
    
    for (const [_, opponent] of context.playerPositions) {
      if (opponent.team === opposingTeam) {
        const distance = MathUtils.distance(player.x, player.y, opponent.x, opponent.y);
        if (distance < 8) nearbyOpponents++;
      }
    }
    
    // Return space score (fewer opponents = more space)
    return Math.max(0, 3 - nearbyOpponents);
  }
  
  /**
   * Check if passing lane between two players is clear
   */
  private static isPassingLaneClear(passer: PlayerPosition, receiver: PlayerPosition, context: MatchContext): boolean {
    const opposingTeam = passer.team === 'home' ? 'away' : 'home';
    
    for (const [_, opponent] of context.playerPositions) {
      if (opponent.team === opposingTeam) {
        const distanceToLine = this.distanceToLine(
          { x: passer.x, y: passer.y },
          { x: receiver.x, y: receiver.y },
          { x: opponent.x, y: opponent.y }
        );
        
        // If opponent is very close to the passing line
        if (distanceToLine < 3) {
          const passerToOpponent = MathUtils.distance(passer.x, passer.y, opponent.x, opponent.y);
          const passerToReceiver = MathUtils.distance(passer.x, passer.y, receiver.x, receiver.y);
          
          // Opponent is blocking if they're between passer and receiver
          if (passerToOpponent < passerToReceiver * 0.8) {
            return false;
          }
        }
      }
    }
    
    return true;
  }
  
  /**
   * Calculate distance from a point to a line segment
   */
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
  
  /**
   * Enhanced pressure analysis for better decision making
   */
  private static analyzePressureOnPlayer(player: PlayerPosition, context: MatchContext): { level: 'low' | 'medium' | 'high', nearbyOpponents: number, closestDistance: number } {
    const opposingTeam = player.team === 'home' ? 'away' : 'home';
    let nearbyOpponents = 0;
    let closestDistance = Infinity;
    
    for (const [_, opponent] of context.playerPositions) {
      if (opponent.team === opposingTeam) {
        const distance = MathUtils.distance(player.x, player.y, opponent.x, opponent.y);
        
        if (distance < closestDistance) {
          closestDistance = distance;
        }
        
        if (distance < 8) {
          nearbyOpponents++;
        }
      }
    }
    
    let level: 'low' | 'medium' | 'high';
    if (closestDistance < 4 || nearbyOpponents >= 2) {
      level = 'high';
    } else if (closestDistance < 8 || nearbyOpponents >= 1) {
      level = 'medium';
    } else {
      level = 'low';
    }
    
    return { level, nearbyOpponents, closestDistance };
  }
  
  private static isInShootingPosition(player: PlayerPosition, context: MatchContext): boolean {
    const isHome = player.team === 'home';
    return isHome ? player.x > 80 : player.x < 20;
  }
  
  private static getPlayerName(playerId: number, context: MatchContext): string {
    const allPlayers = [...context.homeTeam.players, ...context.awayTeam.players];
    const playerData = allPlayers.find(p => p.id === playerId);
    return playerData ? `${playerData.first_name} ${playerData.last_name}` : 'Unknown Player';
  }
  
  /**
   * Get target for a player action
   */
  private static getActionTarget(player: PlayerPosition, actionType: string, context: MatchContext): any {
    switch (actionType) {
      case 'pass':
        const passTarget = this.findBestPassTarget(player, context);
        return passTarget ? { x: passTarget.x, y: passTarget.y, playerId: passTarget.playerId } : undefined;
      
      case 'dribbling':
        const isHome = player.team === 'home';
        return { x: isHome ? player.x + 10 : player.x - 10, y: player.y };
      
      case 'shooting':
        const goalX = player.team === 'home' ? 100 : 0;
        return { x: goalX, y: 50 };
      
      default:
        return undefined;
    }
  }
}