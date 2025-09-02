import { MatchContext, PlayerPosition } from '../../types';
import { MathUtils } from '../../utils/MathUtils';

/**
 * ROBUST DESIGN D: Off-ball Movement & Positioning for Interception
 * 
 * Handles intelligent off-ball movement for all 22 players simultaneously.
 * Players position themselves to influence pass lanes, create space, and provide defensive coverage.
 * This prevents clustering and creates realistic football positioning patterns.
 */
export class OffBallMovementEngine {
  
  /**
   * Process off-ball movement for all players not currently in possession
   */
  static processOffBallMovement(context: MatchContext): void {
    const ballHolder = this.getBallHolder(context);
    const ballPos = context.ballPosition;
    
    console.log(`🏃 OFF-BALL MOVEMENT: Processing movement for ${context.playerPositions.size - (ballHolder ? 1 : 0)} off-ball players`);
    
    // Update each off-ball player's positioning
    for (const [playerId, player] of context.playerPositions) {
      if (ballHolder && player.playerId === ballHolder.playerId) {
        continue; // Skip ball holder
      }
      
      this.updateOffBallPlayerPosition(player, ballHolder, ballPos, context);
    }
    
    // Analyze and adjust for tactical spacing
    this.adjustTacticalSpacing(context);
  }
  
  /**
   * Update positioning for a single off-ball player
   */
  private static updateOffBallPlayerPosition(
    player: PlayerPosition, 
    ballHolder: PlayerPosition | null, 
    ballPos: any, 
    context: MatchContext
  ): void {
    const isHome = player.team === 'home';
    const hasPossession = ballHolder?.team === player.team;
    const role = player.role || 'CM';
    
    // Determine primary positioning objective
    const positioningObjective = this.determinePositioningObjective(player, ballHolder, ballPos, context);
    
    // Calculate target position based on objective
    const targetPosition = this.calculateTargetPosition(player, positioningObjective, ballHolder, ballPos, context);
    
    // Apply movement constraints (role restrictions, fatigue, etc.)
    const constrainedPosition = this.applyMovementConstraints(player, targetPosition, context);
    
    // Move player towards target position
    this.movePlayerTowardsTarget(player, constrainedPosition, positioningObjective, context);
    
    console.log(`📍 OFF-BALL: Player ${player.playerId} (${role}) - ${positioningObjective} → (${constrainedPosition.x.toFixed(1)}, ${constrainedPosition.y.toFixed(1)})`);
  }
  
  /**
   * Determine what the player should be trying to achieve with their positioning
   */
  private static determinePositioningObjective(
    player: PlayerPosition, 
    ballHolder: PlayerPosition | null, 
    ballPos: any, 
    context: MatchContext
  ): string {
    const isHome = player.team === 'home';
    const hasPossession = ballHolder?.team === player.team;
    const role = player.role || 'CM';
    const distanceToBall = MathUtils.distance(player.x, player.y, ballPos.x, ballPos.y);
    
    if (hasPossession) {
      // ATTACKING PHASE: Support possession
      if (distanceToBall < 15 && this.canProvideSupport(player, ballHolder!, context)) {
        return 'provide_support';
      } else if (this.shouldMakeForwardRun(player, ballHolder!, context)) {
        return 'make_forward_run';
      } else if (this.shouldCreateSpace(player, ballHolder!, context)) {
        return 'create_space';
      } else {
        return 'maintain_formation';
      }
    } else {
      // DEFENSIVE PHASE: Deny space and intercept
      if (this.shouldPressureBall(player, ballHolder!, context)) {
        return 'pressure_ball';
      } else if (this.shouldMarkOpponent(player, ballHolder!, context)) {
        return 'mark_opponent';
      } else if (this.shouldCoverPassingLanes(player, ballHolder!, context)) {
        return 'cover_passing_lanes';
      } else if (this.shouldProvideDefensiveCover(player, ballHolder!, context)) {
        return 'defensive_cover';
      } else {
        return 'maintain_shape';
      }
    }
  }
  
  /**
   * Calculate target position based on positioning objective
   */
  private static calculateTargetPosition(
    player: PlayerPosition,
    objective: string,
    ballHolder: PlayerPosition | null,
    ballPos: any,
    context: MatchContext
  ): { x: number; y: number } {
    switch (objective) {
      case 'provide_support':
        return this.calculateSupportPosition(player, ballHolder!, context);
      
      case 'make_forward_run':
        return this.calculateForwardRunPosition(player, ballHolder!, context);
      
      case 'create_space':
        return this.calculateSpaceCreationPosition(player, ballHolder!, context);
      
      case 'pressure_ball':
        return this.calculatePressurePosition(player, ballHolder!, context);
      
      case 'mark_opponent':
        return this.calculateMarkingPosition(player, context);
      
      case 'cover_passing_lanes':
        return this.calculatePassLaneCoverPosition(player, ballHolder!, context);
      
      case 'defensive_cover':
        return this.calculateDefensiveCoverPosition(player, context);
      
      case 'maintain_formation':
      case 'maintain_shape':
      default:
        return this.calculateFormationPosition(player, context);
    }
  }
  
  /**
   * ATTACKING: Calculate support position for ball holder
   */
  private static calculateSupportPosition(player: PlayerPosition, ballHolder: PlayerPosition, context: MatchContext): { x: number; y: number } {
    const supportAngles = [45, 90, 135, -45, -90, -135]; // Degrees around ball holder
    const supportDistance = 12; // Distance from ball holder
    
    let bestPosition = { x: player.x, y: player.y };
    let bestScore = -Infinity;
    
    for (const angle of supportAngles) {
      const radians = (angle * Math.PI) / 180;
      const targetX = ballHolder.x + Math.cos(radians) * supportDistance;
      const targetY = ballHolder.y + Math.sin(radians) * supportDistance;
      
      // Ensure position is within bounds
      const boundedX = Math.max(5, Math.min(95, targetX));
      const boundedY = Math.max(5, Math.min(95, targetY));
      
      // Score this position based on space and passing lane clearance
      const spaceScore = this.calculateSpaceScore({ x: boundedX, y: boundedY }, context);
      const laneScore = this.isPassingLaneClear(
        ballHolder, 
        { x: boundedX, y: boundedY, playerId: player.playerId, team: player.team } as PlayerPosition, 
        context
      ) ? 50 : 0;
      
      const totalScore = spaceScore + laneScore;
      
      if (totalScore > bestScore) {
        bestScore = totalScore;
        bestPosition = { x: boundedX, y: boundedY };
      }
    }
    
    return bestPosition;
  }
  
  /**
   * ATTACKING: Calculate forward run position
   */
  private static calculateForwardRunPosition(player: PlayerPosition, ballHolder: PlayerPosition, context: MatchContext): { x: number; y: number } {
    const isHome = player.team === 'home';
    const forwardDirection = isHome ? 1 : -1;
    const runDistance = 20;
    
    // Calculate position ahead of current position
    const targetX = Math.max(5, Math.min(95, player.x + (forwardDirection * runDistance)));
    const targetY = player.y + ((Math.random() - 0.5) * 10); // Some lateral variation
    
    return {
      x: targetX,
      y: Math.max(5, Math.min(95, targetY))
    };
  }
  
  /**
   * ATTACKING: Calculate space creation position (pulling defenders away)
   */
  private static calculateSpaceCreationPosition(player: PlayerPosition, ballHolder: PlayerPosition, context: MatchContext): { x: number; y: number } {
    // Move away from congested areas to create space for teammates
    const congestedAreas = this.findCongestedAreas(context);
    
    let bestPosition = { x: player.x, y: player.y };
    let maxDistanceFromCongestion = 0;
    
    // Test several positions around the player
    const testPositions = this.generateTestPositions(player, 15);
    
    for (const testPos of testPositions) {
      let minDistanceToConsgetion = Infinity;
      
      for (const congestion of congestedAreas) {
        const distance = MathUtils.distance(testPos.x, testPos.y, congestion.x, congestion.y);
        minDistanceToConsgetion = Math.min(minDistanceToConsgetion, distance);
      }
      
      if (minDistanceToConsgetion > maxDistanceFromCongestion) {
        maxDistanceFromCongestion = minDistanceToConsgetion;
        bestPosition = testPos;
      }
    }
    
    return bestPosition;
  }
  
  /**
   * DEFENSIVE: Calculate pressure position on ball holder
   */
  private static calculatePressurePosition(player: PlayerPosition, ballHolder: PlayerPosition, context: MatchContext): { x: number; y: number } {
    // Move towards ball holder but maintain defensive discipline
    const pressureDistance = 6; // Don't get too close to avoid being dribbled past
    const directionToBall = Math.atan2(ballHolder.y - player.y, ballHolder.x - player.x);
    
    const targetX = ballHolder.x - Math.cos(directionToBall) * pressureDistance;
    const targetY = ballHolder.y - Math.sin(directionToBall) * pressureDistance;
    
    return {
      x: Math.max(0, Math.min(100, targetX)),
      y: Math.max(0, Math.min(100, targetY))
    };
  }
  
  /**
   * DEFENSIVE: Calculate marking position for nearest opponent
   */
  private static calculateMarkingPosition(player: PlayerPosition, context: MatchContext): { x: number; y: number } {
    const nearestOpponent = this.findNearestOpponent(player, context);
    
    if (!nearestOpponent) {
      return this.calculateFormationPosition(player, context);
    }
    
    // Position between opponent and own goal
    const isHome = player.team === 'home';
    const ownGoalX = isHome ? 0 : 100;
    
    // Calculate position 70% of the way from own goal to opponent
    const markingX = ownGoalX + (nearestOpponent.x - ownGoalX) * 0.7;
    const markingY = nearestOpponent.y;
    
    return {
      x: Math.max(0, Math.min(100, markingX)),
      y: Math.max(0, Math.min(100, markingY))
    };
  }
  
  /**
   * DEFENSIVE: Calculate position to cover passing lanes
   */
  private static calculatePassLaneCoverPosition(player: PlayerPosition, ballHolder: PlayerPosition, context: MatchContext): { x: number; y: number } {
    // Find most dangerous passing option for opponent
    const dangerousTarget = this.findMostDangerousPassTarget(ballHolder, context);
    
    if (!dangerousTarget) {
      return this.calculateFormationPosition(player, context);
    }
    
    // Position to intercept pass between ball holder and dangerous target
    const interceptPoint = this.calculateOptimalInterceptPoint(ballHolder, dangerousTarget, player, context);
    
    return interceptPoint;
  }
  
  /**
   * Calculate optimal interception point along a passing lane
   */
  private static calculateOptimalInterceptPoint(
    passer: PlayerPosition, 
    target: PlayerPosition, 
    interceptor: PlayerPosition, 
    context: MatchContext
  ): { x: number; y: number } {
    // Calculate point along pass line where interceptor can best reach
    const passVector = {
      x: target.x - passer.x,
      y: target.y - passer.y
    };
    
    const passLength = Math.sqrt(passVector.x ** 2 + passVector.y ** 2);
    const normalizedPass = {
      x: passVector.x / passLength,
      y: passVector.y / passLength
    };
    
    // Test multiple points along the pass line
    const testPoints = [];
    for (let t = 0.2; t <= 0.8; t += 0.1) {
      const testX = passer.x + normalizedPass.x * passLength * t;
      const testY = passer.y + normalizedPass.y * passLength * t;
      
      const distanceFromInterceptor = MathUtils.distance(interceptor.x, interceptor.y, testX, testY);
      
      testPoints.push({
        x: testX,
        y: testY,
        distance: distanceFromInterceptor,
        t: t
      });
    }
    
    // Find the closest reachable point
    testPoints.sort((a, b) => a.distance - b.distance);
    const bestPoint = testPoints[0];
    
    return {
      x: Math.max(0, Math.min(100, bestPoint.x)),
      y: Math.max(0, Math.min(100, bestPoint.y))
    };
  }
  
  /**
   * DEFENSIVE: Calculate defensive cover position
   */
  private static calculateDefensiveCoverPosition(player: PlayerPosition, context: MatchContext): { x: number; y: number } {
    const isHome = player.team === 'home';
    const ownGoalX = isHome ? 0 : 100;
    const ballPos = context.ballPosition;
    
    // Position to provide cover behind the defensive line
    const coverX = ownGoalX + (ballPos.x - ownGoalX) * 0.3; // 30% of way from goal to ball
    const coverY = ballPos.y; // Align with ball laterally
    
    return {
      x: Math.max(0, Math.min(100, coverX)),
      y: Math.max(0, Math.min(100, coverY))
    };
  }
  
  /**
   * Calculate formation-based position (tactical positioning)
   */
  private static calculateFormationPosition(player: PlayerPosition, context: MatchContext): { x: number; y: number } {
    // This would use the existing tactical positioning logic
    // For now, maintain current position with slight adjustments
    return {
      x: player.x + ((Math.random() - 0.5) * 2),
      y: player.y + ((Math.random() - 0.5) * 2)
    };
  }
  
  /**
   * Apply movement constraints based on role, fatigue, and tactical discipline
   */
  private static applyMovementConstraints(
    player: PlayerPosition, 
    targetPosition: { x: number; y: number }, 
    context: MatchContext
  ): { x: number; y: number } {
    const role = player.role || 'CM';
    const isHome = player.team === 'home';
    
    // Apply role-based zone restrictions
    let constrainedX = targetPosition.x;
    let constrainedY = targetPosition.y;
    
    // Apply strict role-based constraints
    switch (role) {
      case 'GK':
        constrainedX = isHome ? Math.max(0, Math.min(16.5, targetPosition.x)) : Math.max(83.5, Math.min(100, targetPosition.x));
        constrainedY = Math.max(25, Math.min(75, targetPosition.y));
        break;
      
      case 'CB1':
      case 'CB2':
      case 'CB3':
        constrainedX = isHome ? Math.max(5, Math.min(40, targetPosition.x)) : Math.max(60, Math.min(95, targetPosition.x));
        constrainedY = Math.max(20, Math.min(80, targetPosition.y));
        break;
      
      case 'RB':
        constrainedX = isHome ? Math.max(5, Math.min(75, targetPosition.x)) : Math.max(25, Math.min(95, targetPosition.x));
        constrainedY = Math.max(60, Math.min(95, targetPosition.y));
        break;
      
      case 'LB':
        constrainedX = isHome ? Math.max(5, Math.min(75, targetPosition.x)) : Math.max(25, Math.min(95, targetPosition.x));
        constrainedY = Math.max(5, Math.min(40, targetPosition.y));
        break;
      
      case 'DM':
        constrainedX = isHome ? Math.max(20, Math.min(60, targetPosition.x)) : Math.max(40, Math.min(80, targetPosition.x));
        constrainedY = Math.max(25, Math.min(75, targetPosition.y));
        break;
      
      case 'CM':
        constrainedX = isHome ? Math.max(25, Math.min(75, targetPosition.x)) : Math.max(25, Math.min(75, targetPosition.x));
        constrainedY = Math.max(25, Math.min(75, targetPosition.y));
        break;
      
      case 'AM':
        constrainedX = isHome ? Math.max(40, Math.min(90, targetPosition.x)) : Math.max(10, Math.min(60, targetPosition.x));
        constrainedY = Math.max(25, Math.min(75, targetPosition.y));
        break;
      
      case 'WM':
        constrainedX = isHome ? Math.max(30, Math.min(85, targetPosition.x)) : Math.max(15, Math.min(70, targetPosition.x));
        if (targetPosition.y > 50) {
          constrainedY = Math.max(60, Math.min(95, targetPosition.y));
        } else {
          constrainedY = Math.max(5, Math.min(40, targetPosition.y));
        }
        break;
      
      case 'ST':
      case 'CF':
        constrainedX = isHome ? Math.max(55, Math.min(95, targetPosition.x)) : Math.max(5, Math.min(45, targetPosition.x));
        constrainedY = Math.max(25, Math.min(75, targetPosition.y));
        break;
    }
    
    // Apply fatigue constraints (tired players move less)
    const fatigueLevel = context.fatigueLevels[player.playerId.toString()] || 0;
    const fatigueMultiplier = fatigueLevel > 0.7 ? 0.5 : (fatigueLevel > 0.5 ? 0.7 : 1.0);
    
    const currentDistance = MathUtils.distance(player.x, player.y, constrainedX, constrainedY);
    const maxMovement = 5 * fatigueMultiplier; // Max movement per tick
    
    if (currentDistance > maxMovement) {
      const direction = Math.atan2(constrainedY - player.y, constrainedX - player.x);
      constrainedX = player.x + Math.cos(direction) * maxMovement;
      constrainedY = player.y + Math.sin(direction) * maxMovement;
    }
    
    return {
      x: Math.max(0, Math.min(100, constrainedX)),
      y: Math.max(0, Math.min(100, constrainedY))
    };
  }
  
  /**
   * Move player towards target position
   */
  private static movePlayerTowardsTarget(
    player: PlayerPosition, 
    targetPosition: { x: number; y: number }, 
    objective: string, 
    context: MatchContext
  ): void {
    const distance = MathUtils.distance(player.x, player.y, targetPosition.x, targetPosition.y);
    
    if (distance < 1) {
      return; // Already at target
    }
    
    // Calculate movement speed based on objective urgency
    const urgencyMultipliers: Record<string, number> = {
      'pressure_ball': 1.0,
      'cover_passing_lanes': 0.9,
      'provide_support': 0.8,
      'mark_opponent': 0.8,
      'make_forward_run': 0.7,
      'defensive_cover': 0.6,
      'create_space': 0.5,
      'maintain_formation': 0.3,
      'maintain_shape': 0.3
    };
    
    const baseSpeed = 3; // Base movement speed per tick
    const urgency = urgencyMultipliers[objective] || 0.5;
    const moveSpeed = baseSpeed * urgency;
    
    // Calculate direction and move
    const direction = Math.atan2(targetPosition.y - player.y, targetPosition.x - player.x);
    const moveDistance = Math.min(distance, moveSpeed);
    
    player.x += Math.cos(direction) * moveDistance;
    player.y += Math.sin(direction) * moveDistance;
    player.direction = direction;
    player.speed = moveSpeed;
  }
  
  /**
   * Adjust tactical spacing to prevent clustering
   */
  private static adjustTacticalSpacing(context: MatchContext): void {
    const spacingThreshold = 8; // Minimum distance between teammates
    const adjustmentForce = 2; // How much to push players apart
    
    const homePositions: PlayerPosition[] = [];
    const awayPositions: PlayerPosition[] = [];
    
    // Separate players by team
    for (const [_, player] of context.playerPositions) {
      if (player.team === 'home') {
        homePositions.push(player);
      } else {
        awayPositions.push(player);
      }
    }
    
    // Apply spacing for each team separately
    this.applyTeamSpacing(homePositions, spacingThreshold, adjustmentForce);
    this.applyTeamSpacing(awayPositions, spacingThreshold, adjustmentForce);
  }
  
  /**
   * Apply spacing adjustments for a team
   */
  private static applyTeamSpacing(players: PlayerPosition[], threshold: number, force: number): void {
    for (let i = 0; i < players.length; i++) {
      for (let j = i + 1; j < players.length; j++) {
        const player1 = players[i];
        const player2 = players[j];
        
        const distance = MathUtils.distance(player1.x, player1.y, player2.x, player2.y);
        
        if (distance < threshold && distance > 0) {
          const overlap = threshold - distance;
          const pushDistance = (overlap / 2) * force;
          
          const direction = Math.atan2(player2.y - player1.y, player2.x - player1.x);
          
          // Push players apart
          player1.x -= Math.cos(direction) * pushDistance;
          player1.y -= Math.sin(direction) * pushDistance;
          player2.x += Math.cos(direction) * pushDistance;
          player2.y += Math.sin(direction) * pushDistance;
          
          // Keep within bounds
          player1.x = Math.max(0, Math.min(100, player1.x));
          player1.y = Math.max(0, Math.min(100, player1.y));
          player2.x = Math.max(0, Math.min(100, player2.x));
          player2.y = Math.max(0, Math.min(100, player2.y));
        }
      }
    }
  }
  
  // HELPER METHODS
  
  private static getBallHolder(context: MatchContext): PlayerPosition | null {
    if (context.possession.playerId) {
      return context.playerPositions.get(context.possession.playerId) || null;
    }
    return null;
  }
  
  private static canProvideSupport(player: PlayerPosition, ballHolder: PlayerPosition, context: MatchContext): boolean {
    const distance = MathUtils.distance(player.x, player.y, ballHolder.x, ballHolder.y);
    return distance > 8 && distance < 20; // Not too close, not too far
  }
  
  private static shouldMakeForwardRun(player: PlayerPosition, ballHolder: PlayerPosition, context: MatchContext): boolean {
    const role = player.role || 'CM';
    return (role === 'ST' || role === 'CF' || role === 'AM' || role === 'WM') && Math.random() < 0.3;
  }
  
  private static shouldCreateSpace(player: PlayerPosition, ballHolder: PlayerPosition, context: MatchContext): boolean {
    return Math.random() < 0.2; // 20% chance to create space
  }
  
  private static shouldPressureBall(player: PlayerPosition, ballHolder: PlayerPosition, context: MatchContext): boolean {
    const distance = MathUtils.distance(player.x, player.y, ballHolder.x, ballHolder.y);
    const role = player.role || 'CM';
    
    // Defensive players more likely to press, especially if close
    const pressingChance = role.includes('M') ? 0.4 : (role.includes('B') ? 0.6 : 0.2);
    return distance < 15 && Math.random() < pressingChance;
  }
  
  private static shouldMarkOpponent(player: PlayerPosition, ballHolder: PlayerPosition, context: MatchContext): boolean {
    const nearestOpponent = this.findNearestOpponent(player, context);
    if (!nearestOpponent) return false;
    
    const distance = MathUtils.distance(player.x, player.y, nearestOpponent.x, nearestOpponent.y);
    return distance < 12 && Math.random() < 0.5;
  }
  
  private static shouldCoverPassingLanes(player: PlayerPosition, ballHolder: PlayerPosition, context: MatchContext): boolean {
    const role = player.role || 'CM';
    return (role === 'DM' || role.includes('M')) && Math.random() < 0.4;
  }
  
  private static shouldProvideDefensiveCover(player: PlayerPosition, ballHolder: PlayerPosition, context: MatchContext): boolean {
    const role = player.role || 'CM';
    return role.includes('B') && Math.random() < 0.3;
  }
  
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
  
  private static findMostDangerousPassTarget(ballHolder: PlayerPosition, context: MatchContext): PlayerPosition | null {
    const teammates = [];
    
    for (const [_, player] of context.playerPositions) {
      if (player.team === ballHolder.team && player.playerId !== ballHolder.playerId) {
        teammates.push(player);
      }
    }
    
    if (teammates.length === 0) return null;
    
    // Find the most advanced/dangerous teammate
    const isHome = ballHolder.team === 'home';
    teammates.sort((a, b) => isHome ? b.x - a.x : a.x - b.x);
    
    return teammates[0];
  }
  
  private static calculateSpaceScore(position: { x: number; y: number }, context: MatchContext): number {
    let spaceScore = 100; // Start with max score
    
    // Reduce score based on nearby players
    for (const [_, player] of context.playerPositions) {
      const distance = MathUtils.distance(position.x, position.y, player.x, player.y);
      if (distance < 10) {
        spaceScore -= Math.max(0, 20 - (distance * 2));
      }
    }
    
    return Math.max(0, spaceScore);
  }
  
  private static isPassingLaneClear(passer: PlayerPosition, target: PlayerPosition, context: MatchContext): boolean {
    const opposingTeam = passer.team === 'home' ? 'away' : 'home';
    
    for (const [_, opponent] of context.playerPositions) {
      if (opponent.team === opposingTeam) {
        const distanceToLine = this.distanceToLine(
          { x: passer.x, y: passer.y },
          { x: target.x, y: target.y },
          { x: opponent.x, y: opponent.y }
        );
        
        if (distanceToLine < 4) {
          const passerToOpponent = MathUtils.distance(passer.x, passer.y, opponent.x, opponent.y);
          const passerToTarget = MathUtils.distance(passer.x, passer.y, target.x, target.y);
          
          if (passerToOpponent < passerToTarget * 0.8) {
            return false;
          }
        }
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
  
  private static findCongestedAreas(context: MatchContext): Array<{ x: number; y: number; density: number }> {
    const gridSize = 10;
    const congestionMap: Record<string, { x: number; y: number; count: number }> = {};
    
    // Count players in each grid cell
    for (const [_, player] of context.playerPositions) {
      const gridX = Math.floor(player.x / gridSize);
      const gridY = Math.floor(player.y / gridSize);
      const key = `${gridX},${gridY}`;
      
      if (!congestionMap[key]) {
        congestionMap[key] = { x: gridX * gridSize + gridSize/2, y: gridY * gridSize + gridSize/2, count: 0 };
      }
      congestionMap[key].count++;
    }
    
    // Return areas with high density
    return Object.values(congestionMap)
      .filter(area => area.count >= 3)
      .map(area => ({ x: area.x, y: area.y, density: area.count }));
  }
  
  private static generateTestPositions(player: PlayerPosition, radius: number): Array<{ x: number; y: number }> {
    const positions = [];
    const angles = [0, 45, 90, 135, 180, 225, 270, 315];
    
    for (const angle of angles) {
      const radians = (angle * Math.PI) / 180;
      const x = Math.max(0, Math.min(100, player.x + Math.cos(radians) * radius));
      const y = Math.max(0, Math.min(100, player.y + Math.sin(radians) * radius));
      positions.push({ x, y });
    }
    
    return positions;
  }
}