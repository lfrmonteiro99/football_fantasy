import { MatchContext, PlayerPosition } from '../../types';
import { MathUtils } from '../../utils/MathUtils';

/**
 * PHASE 2: ENHANCED DECISION AI
 * 
 * Multi-factor decision system that considers:
 * - Player attributes and skills
 * - Game context (score, time, pressure)
 * - Tactical situations
 * - Player memory and learning
 * - Risk/reward analysis
 */
export class EnhancedDecisionAI {

  /**
   * Main decision-making method - replaces simple random choices
   */
  static makeEnhancedDecision(holder: PlayerPosition, context: MatchContext): string {
    console.log(`🧠 ENHANCED AI: Making decision for player ${holder.playerId} at tick ${context.tick}`);

    // Get player data for attribute-based decisions
    const playerData = this.getPlayerData(holder.playerId, context);
    if (!playerData) {
      console.log(`⚠️ FALLBACK: No player data for ${holder.playerId}, using basic logic`);
      return this.makeBasicDecision(holder, context);
    }

    // Analyze current game situation
    const situationAnalysis = this.analyzeGameSituation(holder, context);
    
    // Calculate decision factors
    const decisionFactors = this.calculateDecisionFactors(holder, context, playerData, situationAnalysis);
    
    // Apply player memory and learning
    const memoryAdjustedFactors = this.applyPlayerMemory(decisionFactors, holder, context);
    
    // Make final decision based on all factors
    const decision = this.selectOptimalAction(memoryAdjustedFactors, holder, context);
    
    // Update player memory with this decision
    this.updatePlayerMemory(holder, context, decision);
    
    console.log(`🎯 ENHANCED DECISION: Player ${holder.playerId} (${holder.role}) chose "${decision}" based on multi-factor analysis`);
    
    return decision;
  }

  /**
   * Analyze the current game situation comprehensively
   */
  private static analyzeGameSituation(holder: PlayerPosition, context: MatchContext): GameSituation {
    const isHome = holder.team === 'home';
    const ballPos = context.ballPosition;
    
    // Time pressure analysis
    const timeRemaining = 5400 - context.tick; // Ticks remaining
    const minutesRemaining = Math.floor(timeRemaining / 60);
    const timePhase = this.getTimePhase(context.currentMinute);
    
    // Score analysis
    const score = context.score;
    const scoreDifference = isHome ? (score.home - score.away) : (score.away - score.home);
    const gameState = this.determineGameState(scoreDifference, minutesRemaining);
    
    // Pressure analysis
    const nearbyOpponents = this.countNearbyOpponents(holder, context);
    const pressureLevel = this.calculatePressureLevel(nearbyOpponents, holder, context);
    
    // Tactical position analysis
    const fieldZone = this.determineFieldZone(ballPos, isHome);
    const tacticalPhase = this.determineTacticalPhase(fieldZone, context.possession.team === holder.team);
    
    // Space analysis
    const spaceAvailable = this.analyzeAvailableSpace(holder, context);
    const passingOptions = this.countPassingOptions(holder, context);
    
    return {
      timePhase,
      gameState,
      pressureLevel,
      fieldZone,
      tacticalPhase,
      spaceAvailable,
      passingOptions,
      nearbyOpponents,
      scoreDifference,
      minutesRemaining
    };
  }

  /**
   * Calculate comprehensive decision factors
   */
  private static calculateDecisionFactors(
    holder: PlayerPosition, 
    context: MatchContext, 
    playerData: any, 
    situation: GameSituation
  ): DecisionFactors {
    const attributes = playerData.attributes;
    
    // Base probabilities influenced by player attributes
    let factors: DecisionFactors = {
      shoot: this.calculateShootProbability(holder, context, attributes, situation),
      pass: this.calculatePassProbability(holder, context, attributes, situation),
      dribble: this.calculateDribbleProbability(holder, context, attributes, situation),
      hold: this.calculateHoldProbability(holder, context, attributes, situation),
      cross: this.calculateCrossProbability(holder, context, attributes, situation)
    };

    // Apply contextual modifiers
    factors = this.applyContextualModifiers(factors, situation, attributes);
    factors = this.applyRoleModifiers(factors, holder.role || 'CM', situation);
    factors = this.applyGameStateModifiers(factors, situation);
    
    return factors;
  }

  /**
   * Calculate shooting probability based on multiple factors
   */
  private static calculateShootProbability(
    holder: PlayerPosition, 
    context: MatchContext, 
    attributes: any, 
    situation: GameSituation
  ): number {
    let probability = 0.05; // Base 5%
    
    // Position factor
    if (situation.fieldZone === 'attacking_penalty') {
      probability += 0.6; // Big bonus in penalty area
    } else if (situation.fieldZone === 'attacking_third') {
      probability += 0.3; // Moderate bonus in attacking third
    } else {
      probability = 0.01; // Very low outside attacking areas
    }
    
    // Player shooting skill
    const shootingSkill = attributes.shooting || 60;
    probability += (shootingSkill - 60) * 0.01; // Each point above 60 adds 1%
    
    // Pressure factor
    if (situation.pressureLevel === 'low') {
      probability *= 1.5; // More likely to shoot when not pressured
    } else if (situation.pressureLevel === 'high') {
      probability *= 0.6; // Less likely when heavily pressured
    }
    
    // Game state factor
    if (situation.gameState === 'losing' && situation.minutesRemaining < 15) {
      probability *= 1.8; // More desperate shooting when losing late
    } else if (situation.gameState === 'winning' && situation.minutesRemaining < 10) {
      probability *= 0.4; // Conservative when winning late
    }
    
    // Role factor
    const role = holder.role || 'CM';
    if (role === 'ST' || role === 'CF') {
      probability *= 2.0; // Strikers shoot more
    } else if (role === 'AM') {
      probability *= 1.5; // Attacking midfielders shoot moderately
    } else if (role.includes('CB') || role === 'GK') {
      probability *= 0.1; // Defenders rarely shoot
    }
    
    return Math.max(0.01, Math.min(0.9, probability));
  }

  /**
   * Calculate passing probability with sophisticated analysis
   */
  private static calculatePassProbability(
    holder: PlayerPosition, 
    context: MatchContext, 
    attributes: any, 
    situation: GameSituation
  ): number {
    let probability = 0.4; // Base 40%
    
    // Passing skill factor
    const passingSkill = attributes.passing || 60;
    probability += (passingSkill - 60) * 0.008; // Each point above 60 adds 0.8%
    
    // Available passing options
    if (situation.passingOptions >= 3) {
      probability += 0.3; // Many options available
    } else if (situation.passingOptions >= 1) {
      probability += 0.15; // Some options available
    } else {
      probability *= 0.5; // Few options, less likely to pass
    }
    
    // Pressure factor
    if (situation.pressureLevel === 'high') {
      if (passingSkill > 75) {
        probability += 0.2; // Skilled passers handle pressure well
      } else {
        probability += 0.1; // Average players try quick passes under pressure
      }
    }
    
    // Tactical phase
    if (situation.tacticalPhase === 'build_up') {
      probability += 0.25; // More passing in build-up play
    } else if (situation.tacticalPhase === 'counter_attack') {
      probability += 0.15; // Quick passing in counter-attacks
    }
    
    // Role factor
    const role = holder.role || 'CM';
    if (role === 'DM' || role === 'CM') {
      probability += 0.2; // Midfielders pass more
    } else if (role === 'AM') {
      probability += 0.1; // Creative players balance passing and other actions
    }
    
    return Math.max(0.1, Math.min(0.95, probability));
  }

  /**
   * Calculate dribbling probability with skill and context
   */
  private static calculateDribbleProbability(
    holder: PlayerPosition, 
    context: MatchContext, 
    attributes: any, 
    situation: GameSituation
  ): number {
    let probability = 0.25; // Base 25%
    
    // Dribbling skill factor
    const dribblingSkill = attributes.dribbling || 60;
    probability += (dribblingSkill - 60) * 0.01; // Each point above 60 adds 1%
    
    // Space factor
    if (situation.spaceAvailable > 10) {
      probability += 0.3; // Lots of space, good for dribbling
    } else if (situation.spaceAvailable > 5) {
      probability += 0.15; // Some space available
    } else {
      probability *= 0.6; // Limited space, harder to dribble
    }
    
    // Pressure factor
    if (situation.pressureLevel === 'low') {
      probability += 0.25; // Easier to dribble when not pressured
    } else if (situation.pressureLevel === 'high') {
      if (dribblingSkill > 80) {
        probability += 0.1; // Skilled dribblers can handle pressure
      } else {
        probability *= 0.4; // Average players struggle under pressure
      }
    }
    
    // Field zone factor
    if (situation.fieldZone === 'attacking_third') {
      probability += 0.2; // More aggressive dribbling in attack
    } else if (situation.fieldZone === 'defensive_third') {
      probability *= 0.6; // More conservative in defense
    }
    
    // Role factor
    const role = holder.role || 'CM';
    if (role === 'WM' || role === 'AM') {
      probability += 0.25; // Wingers and attacking mids dribble more
    } else if (role.includes('CB') || role === 'GK') {
      probability *= 0.3; // Defenders dribble less
    }
    
    return Math.max(0.05, Math.min(0.8, probability));
  }

  /**
   * Calculate hold probability (keeping possession without immediate action)
   */
  private static calculateHoldProbability(
    holder: PlayerPosition, 
    context: MatchContext, 
    attributes: any, 
    situation: GameSituation
  ): number {
    let probability = 0.15; // Base 15%
    
    // Composure factor
    const composure = attributes.composure || 60;
    probability += (composure - 60) * 0.005; // Each point above 60 adds 0.5%
    
    // Pressure factor
    if (situation.pressureLevel === 'high') {
      if (composure > 75) {
        probability += 0.15; // Calm players hold ball under pressure
      } else {
        probability *= 0.5; // Nervous players don't hold ball long
      }
    } else {
      probability += 0.1; // More willing to hold when not pressured
    }
    
    // Game state factor
    if (situation.gameState === 'winning' && situation.minutesRemaining < 5) {
      probability += 0.4; // Run down the clock when winning
    } else if (situation.gameState === 'losing' && situation.minutesRemaining < 15) {
      probability *= 0.3; // Don't waste time when losing
    }
    
    // No good options available
    if (situation.passingOptions === 0 && situation.spaceAvailable < 3) {
      probability += 0.3; // Hold ball if no good alternatives
    }
    
    return Math.max(0.02, Math.min(0.6, probability));
  }

  /**
   * Calculate crossing probability for wide players
   */
  private static calculateCrossProbability(
    holder: PlayerPosition, 
    context: MatchContext, 
    attributes: any, 
    situation: GameSituation
  ): number {
    let probability = 0.05; // Base 5%
    
    // Position requirement - must be in wide areas
    const ballPos = context.ballPosition;
    const isWidePosition = ballPos.y < 25 || ballPos.y > 75;
    
    if (!isWidePosition) {
      return 0.01; // Almost no crossing from central positions
    }
    
    // Must be in attacking areas
    if (situation.fieldZone !== 'attacking_third' && situation.fieldZone !== 'attacking_penalty') {
      return 0.02; // Very low crossing from midfield/defense
    }
    
    probability = 0.4; // Base crossing probability in wide attacking positions
    
    // Crossing skill factor
    const crossingSkill = attributes.crossing || 60;
    probability += (crossingSkill - 60) * 0.01; // Each point above 60 adds 1%
    
    // Count targets in box
    const targetsInBox = this.countPlayersInBox(holder.team, context);
    if (targetsInBox >= 2) {
      probability += 0.3; // Good targets available
    } else if (targetsInBox >= 1) {
      probability += 0.15; // Some targets available
    } else {
      probability *= 0.3; // No targets, less likely to cross
    }
    
    // Role factor
    const role = holder.role || 'CM';
    if (role === 'WM') {
      probability += 0.2; // Wide midfielders cross more
    } else if (role === 'RB' || role === 'LB') {
      probability += 0.1; // Full-backs cross moderately
    }
    
    return Math.max(0.01, Math.min(0.8, probability));
  }

  /**
   * Apply contextual modifiers based on game situation
   */
  private static applyContextualModifiers(
    factors: DecisionFactors, 
    situation: GameSituation, 
    attributes: any
  ): DecisionFactors {
    // Time pressure modifiers
    if (situation.timePhase === 'late' && situation.gameState === 'losing') {
      // Desperate late game - more shooting, less holding
      factors.shoot *= 1.5;
      factors.hold *= 0.3;
      factors.pass *= 1.2; // Quick passing to create chances
    } else if (situation.timePhase === 'late' && situation.gameState === 'winning') {
      // Protecting lead - more holding, less risky actions
      factors.hold *= 2.0;
      factors.dribble *= 0.6;
      factors.shoot *= 0.7;
    }
    
    // High pressure situations
    if (situation.pressureLevel === 'high') {
      const mentalStrength = attributes.composure || 60;
      const pressureFactor = mentalStrength / 100;
      
      factors.hold *= pressureFactor;
      factors.dribble *= pressureFactor;
      factors.pass *= (1 + pressureFactor); // Good under pressure = better passing
    }
    
    return factors;
  }

  /**
   * Apply role-specific modifiers
   */
  private static applyRoleModifiers(
    factors: DecisionFactors, 
    role: string, 
    situation: GameSituation
  ): DecisionFactors {
    switch (role) {
      case 'GK':
        factors.shoot = 0.001;
        factors.pass *= 2.0;
        factors.hold *= 1.5;
        factors.dribble *= 0.2;
        factors.cross = 0.001;
        break;
        
      case 'CB1':
      case 'CB2':
      case 'CB3':
        factors.shoot *= 0.1;
        factors.pass *= 1.3;
        factors.hold *= 1.2;
        factors.dribble *= 0.6;
        factors.cross *= 0.3;
        break;
        
      case 'RB':
      case 'LB':
        factors.shoot *= 0.3;
        factors.pass *= 1.1;
        factors.cross *= 1.5;
        break;
        
      case 'DM':
        factors.shoot *= 0.5;
        factors.pass *= 1.4;
        factors.hold *= 1.3;
        factors.dribble *= 0.8;
        break;
        
      case 'CM':
        // Balanced - no major modifications
        break;
        
      case 'AM':
        factors.shoot *= 1.3;
        factors.pass *= 1.2;
        factors.dribble *= 1.2;
        break;
        
      case 'WM':
        factors.dribble *= 1.4;
        factors.cross *= 1.8;
        factors.pass *= 1.1;
        break;
        
      case 'ST':
      case 'CF':
        factors.shoot *= 2.5;
        factors.hold *= 1.2;
        factors.dribble *= 1.1;
        factors.pass *= 0.9;
        break;
    }
    
    return factors;
  }

  /**
   * Apply game state modifiers
   */
  private static applyGameStateModifiers(factors: DecisionFactors, situation: GameSituation): DecisionFactors {
    switch (situation.gameState) {
      case 'losing':
        if (situation.minutesRemaining < 20) {
          factors.shoot *= 1.4;
          factors.pass *= 1.2;
          factors.hold *= 0.6;
        }
        break;
        
      case 'winning':
        if (situation.minutesRemaining < 10) {
          factors.hold *= 1.6;
          factors.pass *= 1.1;
          factors.dribble *= 0.8;
          factors.shoot *= 0.8;
        }
        break;
        
      case 'drawing':
        if (situation.minutesRemaining < 5) {
          factors.shoot *= 1.2;
          factors.pass *= 1.1;
        }
        break;
    }
    
    return factors;
  }

  /**
   * Apply player memory and learning from past experiences
   */
  private static applyPlayerMemory(
    factors: DecisionFactors, 
    holder: PlayerPosition, 
    context: MatchContext
  ): DecisionFactors {
    const memory = context.playerFailureMemory?.[holder.playerId];
    
    if (!memory) {
      return factors; // No memory data available
    }
    
    // If player recently failed at an action, reduce probability
    if (memory.lastFailedAction && memory.lastFailureTime && 
        (context.tick - memory.lastFailureTime) < 300) { // Within last 5 minutes
      
      const actionKey = memory.lastFailedAction as keyof DecisionFactors;
      if (factors[actionKey] !== undefined) {
        const reductionFactor = Math.max(0.5, 1 - (memory.consecutiveFailures || 0) * 0.2);
        factors[actionKey] *= reductionFactor;
        
        console.log(`🧠 MEMORY: Player ${holder.playerId} reducing ${memory.lastFailedAction} probability due to recent failures`);
      }
    }
    
    return factors;
  }

  /**
   * Select the optimal action based on calculated probabilities
   */
  private static selectOptimalAction(
    factors: DecisionFactors, 
    holder: PlayerPosition, 
    context: MatchContext
  ): string {
    // Check cooldowns first
    const availableActions: Array<{action: string, probability: number}> = [];
    
    Object.entries(factors).forEach(([action, probability]) => {
      const cooldown = holder.actionCooldowns?.[action] || 0;
      if (cooldown === 0 && probability > 0.01) {
        availableActions.push({ action, probability });
      }
    });
    
    if (availableActions.length === 0) {
      console.log(`🚫 ALL ACTIONS ON COOLDOWN: Player ${holder.playerId} defaulting to hold`);
      return 'hold';
    }
    
    // Weighted random selection
    const totalWeight = availableActions.reduce((sum, item) => sum + item.probability, 0);
    let random = Math.random() * totalWeight;
    
    for (const item of availableActions) {
      random -= item.probability;
      if (random <= 0) {
        console.log(`🎲 DECISION: Player ${holder.playerId} chose "${item.action}" (${(item.probability * 100).toFixed(1)}% probability)`);
        return item.action;
      }
    }
    
    // Fallback to highest probability action
    const bestAction = availableActions.reduce((best, current) => 
      current.probability > best.probability ? current : best
    );
    
    return bestAction.action;
  }

  /**
   * Update player memory with decision outcome
   */
  private static updatePlayerMemory(
    holder: PlayerPosition, 
    context: MatchContext, 
    decision: string
  ): void {
    if (!context.playerFailureMemory) {
      context.playerFailureMemory = {};
    }
    
    if (!context.playerFailureMemory[holder.playerId]) {
      context.playerFailureMemory[holder.playerId] = {};
    }
    
    // Memory will be updated with success/failure when action is resolved
    context.playerFailureMemory[holder.playerId].lastActionTick = context.tick;
  }

  // Helper methods
  private static getPlayerData(playerId: number, context: MatchContext): any {
    const allPlayers = [...context.homeTeam.players, ...context.awayTeam.players];
    return allPlayers.find(p => p.id === playerId);
  }

  private static makeBasicDecision(holder: PlayerPosition, context: MatchContext): string {
    // Fallback to basic logic if enhanced AI fails
    const random = Math.random();
    if (random < 0.4) return 'pass';
    if (random < 0.7) return 'dribble';
    if (random < 0.9) return 'hold';
    return 'shoot';
  }

  private static getTimePhase(minute: number): 'early' | 'middle' | 'late' {
    if (minute < 30) return 'early';
    if (minute < 70) return 'middle';
    return 'late';
  }

  private static determineGameState(scoreDifference: number, minutesRemaining: number): 'winning' | 'losing' | 'drawing' {
    if (scoreDifference > 0) return 'winning';
    if (scoreDifference < 0) return 'losing';
    return 'drawing';
  }

  private static countNearbyOpponents(holder: PlayerPosition, context: MatchContext): number {
    const opposingTeam = holder.team === 'home' ? 'away' : 'home';
    let count = 0;
    
    for (const [_, player] of context.playerPositions) {
      if (player.team === opposingTeam) {
        const distance = MathUtils.distance(holder.x, holder.y, player.x, player.y);
        if (distance < 8) count++;
      }
    }
    
    return count;
  }

  private static calculatePressureLevel(nearbyOpponents: number, holder: PlayerPosition, context: MatchContext): 'low' | 'medium' | 'high' {
    if (nearbyOpponents >= 2) return 'high';
    if (nearbyOpponents >= 1) return 'medium';
    return 'low';
  }

  private static determineFieldZone(ballPos: any, isHome: boolean): string {
    const x = ballPos.x;
    
    if (isHome) {
      if (x < 25) return 'defensive_third';
      if (x < 67) return 'middle_third';
      if (x < 85) return 'attacking_third';
      return 'attacking_penalty';
    } else {
      if (x > 75) return 'defensive_third';
      if (x > 33) return 'middle_third';
      if (x > 15) return 'attacking_third';
      return 'attacking_penalty';
    }
  }

  private static determineTacticalPhase(fieldZone: string, inPossession: boolean): string {
    if (!inPossession) return 'defending';
    
    switch (fieldZone) {
      case 'defensive_third': return 'build_up';
      case 'middle_third': return 'progression';
      case 'attacking_third': return 'creation';
      case 'attacking_penalty': return 'finishing';
      default: return 'transition';
    }
  }

  private static analyzeAvailableSpace(holder: PlayerPosition, context: MatchContext): number {
    const opposingTeam = holder.team === 'home' ? 'away' : 'home';
    const checkRadius = 10;
    let space = checkRadius;
    
    for (const [_, opponent] of context.playerPositions) {
      if (opponent.team === opposingTeam) {
        const distance = MathUtils.distance(holder.x, holder.y, opponent.x, opponent.y);
        if (distance < space) {
          space = distance;
        }
      }
    }
    
    return space;
  }

  private static countPassingOptions(holder: PlayerPosition, context: MatchContext): number {
    let options = 0;
    
    for (const [_, teammate] of context.playerPositions) {
      if (teammate.team === holder.team && teammate.playerId !== holder.playerId) {
        const distance = MathUtils.distance(holder.x, holder.y, teammate.x, teammate.y);
        if (distance > 5 && distance < 30) {
          // Check if passing lane is reasonably clear
          if (this.isPassingLaneReasonablyClear(holder, teammate, context)) {
            options++;
          }
        }
      }
    }
    
    return options;
  }

  private static countPlayersInBox(team: 'home' | 'away', context: MatchContext): number {
    let count = 0;
    const isHome = team === 'home';
    
    // Define penalty box coordinates
    const boxMinX = isHome ? 85 : 0;
    const boxMaxX = isHome ? 100 : 15;
    const boxMinY = 25;
    const boxMaxY = 75;
    
    for (const [_, player] of context.playerPositions) {
      if (player.team === team) {
        if (player.x >= boxMinX && player.x <= boxMaxX && 
            player.y >= boxMinY && player.y <= boxMaxY) {
          count++;
        }
      }
    }
    
    return count;
  }

  private static isPassingLaneReasonablyClear(
    passer: PlayerPosition, 
    receiver: PlayerPosition, 
    context: MatchContext
  ): boolean {
    const opposingTeam = passer.team === 'home' ? 'away' : 'home';
    
    for (const [_, opponent] of context.playerPositions) {
      if (opponent.team === opposingTeam) {
        const distanceToLine = this.distanceToLine(
          { x: passer.x, y: passer.y },
          { x: receiver.x, y: receiver.y },
          { x: opponent.x, y: opponent.y }
        );
        
        if (distanceToLine < 4) {
          const passerToOpponent = MathUtils.distance(passer.x, passer.y, opponent.x, opponent.y);
          const passerToReceiver = MathUtils.distance(passer.x, passer.y, receiver.x, receiver.y);
          
          if (passerToOpponent < passerToReceiver) {
            return false;
          }
        }
      }
    }
    
    return true;
  }

  private static distanceToLine(
    start: {x: number, y: number}, 
    end: {x: number, y: number}, 
    point: {x: number, y: number}
  ): number {
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
}

// Supporting interfaces
interface GameSituation {
  timePhase: 'early' | 'middle' | 'late';
  gameState: 'winning' | 'losing' | 'drawing';
  pressureLevel: 'low' | 'medium' | 'high';
  fieldZone: string;
  tacticalPhase: string;
  spaceAvailable: number;
  passingOptions: number;
  nearbyOpponents: number;
  scoreDifference: number;
  minutesRemaining: number;
}

interface DecisionFactors {
  shoot: number;
  pass: number;
  dribble: number;
  hold: number;
  cross: number;
}