import { MatchContext } from '../../types';
import { MathUtils } from '../../utils/MathUtils';

export class BallPositionEngine {
  private static readonly PASS_SPEED = 15;
  private static readonly SHOT_SPEED = 25;
  private static readonly DRIBBLE_SPEED = 8;
  private static readonly CROSS_SPEED = 20;
  private static readonly GOALKEEPER_KICK_SPEED = 30;
  
  // Play phases
  private static readonly PLAY_PHASES = {
    BUILD_UP: 'build_up',
    MIDFIELD_PLAY: 'midfield_play',
    ATTACKING_PLAY: 'attacking_play',
    FINISHING: 'finishing'
  };

  updateBallPosition(context: MatchContext): any {
    const ballPos = context.ballPosition;
    const possession = context.possession;
    
    // Check if ballPosition is valid
    if (!ballPos) {
      console.log('Ball engine: Ball position is null, initializing');
      return this.forceInitialPossession(context);
    }
    
    // Find player with possession
    const playerWithBall = this.findPlayerWithBall(context);
    
    if (playerWithBall) {
      console.log(`Ball found with player ${playerWithBall.playerId} at (${playerWithBall.x}, ${playerWithBall.y})`);
      
      // Check for defensive challenges near the ball
      const ballControlContest = this.checkBallControlContest(playerWithBall, context);
      // Debug removed for cleaner logs
      if (ballControlContest.contestHappened) {
        console.log(`🥊 BALL CONTROL CONTEST: ${ballControlContest.winner.playerId} wins vs ${ballControlContest.loser.playerId}`);
        
        // If defender wins, change possession and execute defensive action
        if (ballControlContest.possessionChanged) {
          context.possession.team = ballControlContest.winner.team;
          context.possession.playerId = ballControlContest.winner.playerId;
          
          // Defender should now try to keep possession - dribble or pass
          return this.executeDefensiveTransition(ballControlContest.winner, context);
        }
      }
      
      // Keep ball close to player - improved correlation
      return this.updateBallWithPlayerCorrelation(playerWithBall, context);
    } else {
      console.log(`No player found with ball at (${ballPos.x}, ${ballPos.y})`);
      // Force the ball to move to the nearest player from possessing team
      return this.forceInitialPossession(context);
    }
  }

  private findPlayerWithBall(context: MatchContext): any {
    const ballPos = context.ballPosition;
    
    // First check for close possession (within 3 units)
    for (const [_, player] of context.playerPositions) {
      const distance = MathUtils.distance(player.x, player.y, ballPos.x, ballPos.y);
      if (distance < 1) {
        return player;
      }
    }
    
    // If no close player, find the nearest player from possessing team
    const possessingTeam = context.possession.team;
    let nearestPlayer = null;
    let minDistance = Infinity;
    
    for (const [_, player] of context.playerPositions) {
      if (player.team === possessingTeam) {
        const distance = MathUtils.distance(player.x, player.y, ballPos.x, ballPos.y);
        if (distance < minDistance && distance < 15) { // Reasonable possession range
          minDistance = distance;
          nearestPlayer = player;
        }
      }
    }
    
    return nearestPlayer;
  }

  private checkBallControlContest(attackingPlayer: any, context: MatchContext) {
    const ballPos = context.ballPosition;
    const opposingTeam = attackingPlayer.team === 'home' ? 'away' : 'home';
    
    // Check if player is protected from tackles (just won possession)
    if (context.possessionProtection && 
        context.possessionProtection.playerId === attackingPlayer.playerId && 
        context.currentSecond < context.possessionProtection.expiresAt) {
      console.log(`🛡️ POSSESSION PROTECTED: Player ${attackingPlayer.playerId} is protected from tackles for ${(context.possessionProtection.expiresAt - context.currentSecond).toFixed(1)} more seconds`);
      return { contestHappened: false, possessionChanged: false };
    }
    
    // Reduce contest frequency - REDUCED cooldown for more dynamic play
    if (context.lastPossessionChange && (context.currentSecond - context.lastPossessionChange) < 1) {
      console.log(`⏰ CONTEST COOLDOWN: ${(context.currentSecond - context.lastPossessionChange).toFixed(1)} seconds since last possession change (need 1s)`);
      return { contestHappened: false, possessionChanged: false };
    }
    
    // Find nearby defending players
    const nearbyDefenders = [];
    for (const [_, player] of context.playerPositions) {
      if (player.team === opposingTeam) {
        const distance = MathUtils.distance(ballPos.x, ballPos.y, player.x, player.y);
        if (distance < 8) { // Within challenging distance - increased from 4 to 8
          nearbyDefenders.push({ player, distance });
        }
      }
    }
    
    if (nearbyDefenders.length === 0) {
      return { contestHappened: false, possessionChanged: false };
    }
    
    // Get the closest defender for the contest
    nearbyDefenders.sort((a, b) => a.distance - b.distance);
    const closestDefender = nearbyDefenders[0].player;
    
    // Only contest if defender is close enough and contest probability
    const distance = nearbyDefenders[0].distance;
    const probabilityRoll = Math.random();
    if (nearbyDefenders[0].distance > 4.0 || !MathUtils.probability(0.35)) { // 35% chance of contest for more dynamic play
      return { contestHappened: false, possessionChanged: false };
    }
    
    // Get player data for both players
    const allPlayers = [...context.homeTeam.players, ...context.awayTeam.players];
    const attackerData = allPlayers.find(p => p.id === attackingPlayer.playerId);
    const defenderData = allPlayers.find(p => p.id === closestDefender.playerId);
    
    if (!attackerData || !defenderData) {
      return { contestHappened: false, possessionChanged: false };
    }
    
    // Calculate contest outcome based on attributes
    const contestResult = this.calculateBallControlContest(
      attackerData, 
      defenderData, 
      attackingPlayer, 
      closestDefender, 
      context
    );
    
    return {
      contestHappened: true,
      winner: contestResult.winner,
      loser: contestResult.loser,
      possessionChanged: contestResult.possessionChanged,
      contestType: contestResult.contestType
    };
  }
  
  private calculateBallControlContest(attackerData: any, defenderData: any, attackerPos: any, defenderPos: any, context: MatchContext) {
    // Base attributes
    const attackerDribbling = attackerData.attributes?.dribbling || 60;
    const attackerPhysical = attackerData.attributes?.physical || 60;
    const attackerPace = attackerData.attributes?.pace || 60;
    
    const defenderDefending = defenderData.attributes?.defending || 60;
    const defenderPhysical = defenderData.attributes?.physical || 60;
    const defenderPace = defenderData.attributes?.pace || 60;
    
    // Fatigue effects (players get tired over time)
    const minute = Math.floor(context.currentSecond / 60);
    const attackerFatigue = this.calculateFatigueEffect(minute, attackerData.attributes?.physical || 60);
    const defenderFatigue = this.calculateFatigueEffect(minute, defenderData.attributes?.physical || 60);
    
    // Morale/Momentum effects
    const momentumBonus = context.momentum === attackerPos.team ? 1.1 : 
                         context.momentum === defenderPos.team ? 0.9 : 1.0;
    
    // Role-based bonuses
    const attackerRoleBonus = this.getAttackingRoleBonus(attackerPos.role);
    const defenderRoleBonus = this.getDefendingRoleBonus(defenderPos.role);
    
    // Calculate attacking strength
    let attackerStrength = (
      (attackerDribbling * 0.4) + // Main dribbling ability
      (attackerPhysical * 0.3) +  // Physical strength to hold ball
      (attackerPace * 0.3)        // Pace to beat defender
    ) * attackerFatigue * momentumBonus * attackerRoleBonus;
    
    // Calculate defending strength  
    let defenderStrength = (
      (defenderDefending * 0.5) + // Main defensive ability
      (defenderPhysical * 0.3) +  // Physical strength for tackles
      (defenderPace * 0.2)        // Pace to close down attacker
    ) * defenderFatigue * defenderRoleBonus;
    
    // Context modifiers
    const ballPos = context.ballPosition;
    
    // Defensive advantage when protecting own goal
    const isDefendingOwnGoal = (defenderPos.team === 'home' && ballPos.x < 25) || 
                               (defenderPos.team === 'away' && ballPos.x > 75);
    if (isDefendingOwnGoal) {
      defenderStrength *= 1.2; // 20% bonus for defending own goal
    }
    
    // Multiple defenders advantage
    const supportingDefenders = this.countSupportingDefenders(defenderPos, context);
    defenderStrength *= (1 + supportingDefenders * 0.15); // Each supporting defender adds 15%
    
    // Supporting attackers advantage
    const supportingAttackers = this.countSupportingAttackers(attackerPos, context);
    attackerStrength *= (1 + supportingAttackers * 0.1); // Each supporting attacker adds 10%
    
    // Add randomness (skill is main factor, but not 100% deterministic)
    const randomFactor = 0.8 + (Math.random() * 0.4); // Random between 0.8 and 1.2
    attackerStrength *= randomFactor;
    defenderStrength *= (2 - randomFactor); // Inverse randomness for defender
    
    console.log(`🥊 CONTEST CALCULATION: 
      Attacker ${attackerData.id}: drib=${attackerDribbling}, phys=${attackerPhysical}, fatigue=${attackerFatigue.toFixed(2)}, strength=${attackerStrength.toFixed(1)}
      Defender ${defenderData.id}: def=${defenderDefending}, phys=${defenderPhysical}, fatigue=${defenderFatigue.toFixed(2)}, strength=${defenderStrength.toFixed(1)}`);
    
    // Determine winner and contest type
    const attackerWins = attackerStrength > defenderStrength;
    const strengthDifference = Math.abs(attackerStrength - defenderStrength);
    
    let contestType = 'duel';
    if (strengthDifference < 5) {
      contestType = 'tight_contest';
    } else if (strengthDifference > 20) {
      contestType = attackerWins ? 'easy_dribble' : 'clean_tackle';
    }
    
    return {
      winner: attackerWins ? attackerPos : defenderPos,
      loser: attackerWins ? defenderPos : attackerPos,
      possessionChanged: !attackerWins, // Possession changes if defender wins
      contestType: contestType,
      strengthDifference: strengthDifference
    };
  }
  
  private calculateFatigueEffect(minute: number, physicalAttribute: number): number {
    // Better physical attributes = slower fatigue
    const fatigueResistance = physicalAttribute / 100;
    const fatigueRate = 1 - fatigueResistance * 0.3; // Max 30% fatigue resistance
    
    // Fatigue increases more dramatically after 60 minutes
    let fatigueMultiplier;
    if (minute < 30) {
      fatigueMultiplier = 1.0; // No fatigue first 30 minutes
    } else if (minute < 60) {
      fatigueMultiplier = 1 - ((minute - 30) * 0.003 * fatigueRate); // Gradual fatigue
    } else {
      fatigueMultiplier = 1 - (0.09 + (minute - 60) * 0.005 * fatigueRate); // Accelerated fatigue
    }
    
    return Math.max(0.6, fatigueMultiplier); // Minimum 60% performance
  }
  
  private getAttackingRoleBonus(role: string): number {
    switch (role) {
      case 'ST': case 'CF': return 1.3; // Strikers are good at holding up ball
      case 'AM': case 'WM': return 1.2; // Attacking players good at dribbling
      case 'CM': return 1.0; // Neutral
      case 'DM': return 0.9; // Defensive midfielders less agile
      default: return 0.8; // Defenders poor at dribbling
    }
  }
  
  private getDefendingRoleBonus(role: string): number {
    switch (role) {
      case 'CB1': case 'CB2': case 'CB3': return 1.3; // Center backs best at defending
      case 'RB': case 'LB': case 'WB': return 1.2; // Full backs good at defending
      case 'DM': return 1.25; // Defensive midfielders very good
      case 'CM': return 1.0; // Neutral
      case 'AM': case 'WM': return 0.8; // Attacking players poor at defending
      case 'ST': case 'CF': return 0.6; // Forwards very poor at defending
      case 'GK': return 1.5; // Goalkeepers excellent in their area
      default: return 1.0;
    }
  }
  
  private countSupportingDefenders(defender: any, context: MatchContext): number {
    const ballPos = context.ballPosition;
    let count = 0;
    
    for (const [_, player] of context.playerPositions) {
      if (player.team === defender.team && player.playerId !== defender.playerId) {
        const distance = MathUtils.distance(ballPos.x, ballPos.y, player.x, player.y);
        if (distance < 8 && this.isDefensiveRole(player.role || 'CM')) { // Supporting defenders within 8 units
          count++;
        }
      }
    }
    
    return Math.min(count, 2); // Cap at 2 supporting defenders
  }
  
  private countSupportingAttackers(attacker: any, context: MatchContext): number {
    const ballPos = context.ballPosition;
    let count = 0;
    
    for (const [_, player] of context.playerPositions) {
      if (player.team === attacker.team && player.playerId !== attacker.playerId) {
        const distance = MathUtils.distance(ballPos.x, ballPos.y, player.x, player.y);
        if (distance < 10) { // Supporting players within 10 units
          count++;
        }
      }
    }
    
    return Math.min(count, 3); // Cap at 3 supporting attackers
  }
  
  private isDefensiveRole(role: string): boolean {
    return ['CB1', 'CB2', 'CB3', 'RB', 'LB', 'WB', 'DM'].includes(role || '');
  }

  private forceInitialPossession(context: MatchContext): any {
    const possessingTeam = context.possession.team;
    let nearestPlayer = null;
    let minDistance = Infinity;
    
    // Initialize ball position if null
    if (!context.ballPosition) {
      console.log('Ball position: Ball position is completely null, creating default position');
      context.ballPosition = { x: 50, y: 50, speed: 0, direction: 0, status: 'in_play' };
    }
    
    // Find the closest player from the possessing team
    for (const [_, player] of context.playerPositions) {
      if (player.team === possessingTeam) {
        const distance = MathUtils.distance(player.x, player.y, context.ballPosition.x, context.ballPosition.y);
        if (distance < minDistance) {
          minDistance = distance;
          nearestPlayer = player;
        }
      }
    }
    
    if (nearestPlayer) {
      console.log(`Forcing ball to player ${nearestPlayer.playerId} at (${nearestPlayer.x}, ${nearestPlayer.y})`);
      // Move ball to the nearest player and start play
      return this.executePass(context.ballPosition, nearestPlayer, BallPositionEngine.PASS_SPEED);
    }
    
    // Fallback: return current ball position but with slight movement
    return {
      x: context.ballPosition.x + (Math.random() - 0.5),
      y: context.ballPosition.y + (Math.random() - 0.5), 
      speed: 2,
      direction: Math.random() * Math.PI * 2,
      status: 'in_play'
    };
  }

  private updateBallWithPlayerCorrelation(player: any, context: MatchContext): any {
    const ballPos = context.ballPosition;
    const possession = context.possession;
    const isHome = possession.team === 'home';
    
    // Extra null checks to prevent crashes
    if (!ballPos || ballPos.x === undefined || ballPos.y === undefined) {
      console.error('Ball position is null or invalid in updateBallWithPlayerCorrelation');
      return { x: 50, y: 50, speed: 0, direction: 0, status: 'in_play' };
    }
    
    if (!player || player.x === undefined || player.y === undefined) {
      console.error('Player position is null or invalid in updateBallWithPlayerCorrelation');
      return ballPos;
    }
    
    // Calculate ball position relative to player (keep ball close to player)
    const ballToPlayerDistance = MathUtils.distance(ballPos.x, ballPos.y, player.x, player.y);
    
    // If ball is too far from player, gradually move it closer
    if (ballToPlayerDistance > 2) {
      console.log(`Ball too far from player (${ballToPlayerDistance.toFixed(2)} units), moving closer`);
      const direction = Math.atan2(player.y - ballPos.y, player.x - ballPos.x);
      const moveDistance = Math.min(ballToPlayerDistance * 0.5, 3); // Move closer gradually
      
      return {
        x: ballPos.x + Math.cos(direction) * moveDistance,
        y: ballPos.y + Math.sin(direction) * moveDistance,
        speed: 5,
        direction: direction,
        status: 'in_play'
      };
    }
    
    // Ball is close to player, now determine play action
    const playPhase = this.determinePlayPhase(ballPos, isHome);
    
    // Execute play based on phase but with better ball-player correlation
    switch (playPhase) {
      case BallPositionEngine.PLAY_PHASES.BUILD_UP:
        return this.executeBuildUpPlayCorrelated(player, context);
      
      case BallPositionEngine.PLAY_PHASES.MIDFIELD_PLAY:
        return this.executeMidfieldPlayCorrelated(player, context);
      
      case BallPositionEngine.PLAY_PHASES.ATTACKING_PLAY:
        return this.executeAttackingPlayCorrelated(player, context);
      
      case BallPositionEngine.PLAY_PHASES.FINISHING:
        return this.executeFinishingPlayCorrelated(player, context);
      
      default:
        return this.executeBasicPlayCorrelated(player, context);
    }
  }

  // Legacy method kept for compatibility
  private updateBallWithPlayer(player: any, context: MatchContext): any {
    return this.updateBallWithPlayerCorrelation(player, context);
  }

  private determinePlayPhase(ballPos: any, isHome: boolean): string {
    const x = ballPos.x;
    
    if (isHome) {
      if (x < 25) return BallPositionEngine.PLAY_PHASES.BUILD_UP;
      if (x < 60) return BallPositionEngine.PLAY_PHASES.MIDFIELD_PLAY;
      if (x < 85) return BallPositionEngine.PLAY_PHASES.ATTACKING_PLAY;
      return BallPositionEngine.PLAY_PHASES.FINISHING;
    } else {
      if (x > 75) return BallPositionEngine.PLAY_PHASES.BUILD_UP;
      if (x > 40) return BallPositionEngine.PLAY_PHASES.MIDFIELD_PLAY;
      if (x > 15) return BallPositionEngine.PLAY_PHASES.ATTACKING_PLAY;
      return BallPositionEngine.PLAY_PHASES.FINISHING;
    }
  }

  private executeBuildUpPlay(player: any, context: MatchContext): any {
    const role = player.role || 'CM';
    const isHome = player.team === 'home';
    
    // Goalkeeper build-up
    if (role === 'GK') {
      return this.executeGoalkeeperBuildUp(player, context);
    }
    
    // Defender build-up
    if (role.includes('CB') || role.includes('RB') || role.includes('LB')) {
      return this.executeDefenderBuildUp(player, context);
    }
    
    // Default: pass to midfielder
    const midfielderTarget = this.findMidfielderTarget(player, context);
    if (midfielderTarget) {
      return this.executePass(context.ballPosition, midfielderTarget, BallPositionEngine.PASS_SPEED);
    }
    return this.executeBasicPlay(player, context);
  }

  private executeGoalkeeperBuildUp(player: any, context: MatchContext): any {
    const isHome = player.team === 'home';
    const ballPos = context.ballPosition;
    
    // GK looks for short passing options
    const shortPassTarget = this.findShortPassTarget(player, context);
    
    if (shortPassTarget && MathUtils.probability(0.7)) {
      // Short pass to defender
      return this.executePass(ballPos, shortPassTarget, BallPositionEngine.PASS_SPEED);
    } else {
      // Long kick upfield
      const targetX = isHome ? 60 : 40;
      const targetY = 50;
      return this.executePass(ballPos, { x: targetX, y: targetY }, BallPositionEngine.GOALKEEPER_KICK_SPEED);
    }
  }

  private executeDefenderBuildUp(player: any, context: MatchContext): any {
    const role = player.role || 'CB';
    const ballPos = context.ballPosition;
    
    // CB takes a touch and looks for midfield option
    if (MathUtils.probability(0.6)) {
      const midfielderTarget = this.findMidfielderTarget(player, context);
      if (midfielderTarget) {
        return this.executePass(ballPos, midfielderTarget, BallPositionEngine.PASS_SPEED);
      }
    }
    
    // If no good option, play safe pass to other defender
    const safeTarget = this.findSafePassTarget(player, context);
    return this.executePass(ballPos, safeTarget, BallPositionEngine.PASS_SPEED);
  }

  private executeMidfieldPlay(player: any, context: MatchContext): any {
    const role = player.role || 'CM';
    const ballPos = context.ballPosition;
    
    // Central midfielder controls and distributes
    if (role === 'CM' || role === 'DM') {
      return this.executeMidfieldDistribution(player, context);
    }
    
    // Attacking midfielder looks for attacking options
    if (role === 'AM') {
      return this.executeAttackingMidfieldPlay(player, context);
    }
    
    // Wide midfielder looks for wing play
    if (role === 'WM') {
      return this.executeWidePlay(player, context);
    }
    
    return this.executeBasicPlay(player, context);
  }

  private executeMidfieldDistribution(player: any, context: MatchContext): any {
    const ballPos = context.ballPosition;
    
    // Look for attacking midfielder or winger
    const attackingTarget = this.findAttackingTarget(player, context);
    if (attackingTarget && MathUtils.probability(0.6)) {
      return this.executePass(ballPos, attackingTarget, BallPositionEngine.PASS_SPEED);
    }
    
    // Quick one-two with nearby player
    const oneTwoTarget = this.findOneTwoTarget(player, context);
    if (oneTwoTarget && MathUtils.probability(0.4)) {
      return this.executePass(ballPos, oneTwoTarget, BallPositionEngine.PASS_SPEED);
    }
    
    // Carry ball forward
    return this.executeDribble(ballPos, this.getForwardDirection(player));
  }

  private executeAttackingMidfieldPlay(player: any, context: MatchContext): any {
    const ballPos = context.ballPosition;
    const isHome = player.team === 'home';
    
    // Look for striker or winger
    const strikerTarget = this.findStrikerTarget(player, context);
    if (strikerTarget && MathUtils.probability(0.5)) {
      return this.executePass(ballPos, strikerTarget, BallPositionEngine.PASS_SPEED);
    }
    
    // Drive toward goal
    const targetX = isHome ? ballPos.x + 10 : ballPos.x - 10;
    return this.executeDribble(ballPos, { x: targetX, y: ballPos.y });
  }

  private executeWidePlay(player: any, context: MatchContext): any {
    const ballPos = context.ballPosition;
    const isHome = player.team === 'home';
    
    // Cross into box if in good position
    if (this.isInCrossingPosition(ballPos, isHome)) {
      const crossTarget = this.findCrossTarget(player, context);
      if (crossTarget) {
        return this.executeCross(ballPos, crossTarget);
      }
    }
    
    // Cut inside or continue down wing
    if (MathUtils.probability(0.4)) {
      // Cut inside
      const targetX = isHome ? ballPos.x + 8 : ballPos.x - 8;
      const targetY = 50;
      return this.executeDribble(ballPos, { x: targetX, y: targetY });
    } else {
      // Continue down wing
      const targetX = isHome ? ballPos.x + 5 : ballPos.x - 5;
      return this.executeDribble(ballPos, { x: targetX, y: ballPos.y });
    }
  }

  private executeAttackingPlay(player: any, context: MatchContext): any {
    const role = player.role || 'CM';
    const ballPos = context.ballPosition;
    const isHome = player.team === 'home';
    
    // Striker in shooting position
    if (role === 'ST' && this.isInShootingPosition(ballPos, isHome)) {
      return this.executeShot(ballPos, isHome);
    }
    
    // Winger in crossing position
    if (role === 'WM' && this.isInCrossingPosition(ballPos, isHome)) {
      const crossTarget = this.findCrossTarget(player, context);
      if (crossTarget) {
        return this.executeCross(ballPos, crossTarget);
      }
    }
    
    // Attacking midfielder looking for final pass
    if (role === 'AM') {
      const finalPassTarget = this.findFinalPassTarget(player, context);
      if (finalPassTarget && MathUtils.probability(0.6)) {
        return this.executePass(ballPos, finalPassTarget, BallPositionEngine.PASS_SPEED);
      }
    }
    
    // Continue attacking movement
    return this.executeDribble(ballPos, this.getForwardDirection(player));
  }

  private executeFinishingPlay(player: any, context: MatchContext): any {
    const role = player.role || 'CM';
    const ballPos = context.ballPosition;
    const isHome = player.team === 'home';
    
    // Any player in finishing position should shoot
    if (this.isInShootingPosition(ballPos, isHome)) {
      return this.executeShot(ballPos, isHome);
    }
    
    // Quick pass to striker if available
    const strikerTarget = this.findStrikerTarget(player, context);
    if (strikerTarget && MathUtils.probability(0.7)) {
      return this.executePass(ballPos, strikerTarget, BallPositionEngine.PASS_SPEED);
    }
    
    // Last resort: shoot from current position
    return this.executeShot(ballPos, isHome);
  }

  private executeBasicPlay(player: any, context: MatchContext): any {
    const ballPos = context.ballPosition;
    
    // Simple pass to nearest teammate
    const nearestTeammate = this.findNearestTeammate(player, context);
    if (nearestTeammate) {
      return this.executePass(ballPos, nearestTeammate, BallPositionEngine.PASS_SPEED);
    }
    
    // Dribble forward
    return this.executeDribble(ballPos, this.getForwardDirection(player));
  }

  private executePass(from: any, to: any, speed: number): any {
    const direction = Math.atan2(to.y - from.y, to.x - from.x);
    const distance = MathUtils.distance(from.x, from.y, to.x, to.y);
    
    return {
      x: to.x,
      y: to.y,
      speed: speed,
      direction: direction,
      status: 'in_play'
    };
  }

  private executeDribble(from: any, to: any): any {
    const direction = Math.atan2(to.y - from.y, to.x - from.x);
    
    return {
      x: to.x,
      y: to.y,
      speed: BallPositionEngine.DRIBBLE_SPEED,
      direction: direction,
      status: 'in_play'
    };
  }

  private executeShot(from: any, isHome: boolean): any {
    const targetX = isHome ? 95 : 5;
    const targetY = 50 + (Math.random() - 0.5) * 20; // Add some variation
    
    const direction = Math.atan2(targetY - from.y, targetX - from.x);
    
    return {
      x: targetX,
      y: targetY,
      speed: BallPositionEngine.SHOT_SPEED,
      direction: direction,
      status: 'shot'
    };
  }

  private executeCross(from: any, to: any): any {
    const direction = Math.atan2(to.y - from.y, to.x - from.x);
    
    return {
      x: to.x,
      y: to.y,
      speed: BallPositionEngine.CROSS_SPEED,
      direction: direction,
      status: 'cross'
    };
  }

  private updateLooseBall(context: MatchContext): any {
    const ballPos = context.ballPosition;
    
    // Apply physics to loose ball
    const newPos = this.applyPhysics(ballPos);
    
    // Check if any player can intercept
    const interceptingPlayer = this.findInterceptingPlayer(context);
    if (interceptingPlayer) {
      return {
        x: interceptingPlayer.x,
        y: interceptingPlayer.y,
        speed: 0,
        direction: 0,
        status: 'intercepted'
      };
    }
    
    return newPos;
  }

  private applyPhysics(ballPos: any): any {
    // Apply friction
    const friction = 0.95;
    const newSpeed = ballPos.speed * friction;
    
    if (newSpeed < 0.5) {
      return {
        x: ballPos.x,
        y: ballPos.y,
        speed: 0,
        direction: 0,
        status: 'in_play'
      };
    }
    
    const newX = ballPos.x + Math.cos(ballPos.direction) * newSpeed * 0.1;
    const newY = ballPos.y + Math.sin(ballPos.direction) * newSpeed * 0.1;
    
    return {
      x: newX,
      y: newY,
      speed: newSpeed,
      direction: ballPos.direction,
      status: 'in_play'
    };
  }

  private findShortPassTarget(player: any, context: MatchContext): any {
    const isHome = player.team === 'home';
    
    for (const [_, teammate] of context.playerPositions) {
      if (teammate.team !== player.team) continue;
      if (teammate.playerId === player.playerId) continue;
      
      const distance = MathUtils.distance(player.x, player.y, teammate.x, teammate.y);
      if (distance > 3 && distance < 15) {
        // Prefer defenders for short passes
        if (teammate.role?.includes('CB') || teammate.role?.includes('RB') || teammate.role?.includes('LB')) {
          return teammate;
        }
      }
    }
    
    return null;
  }

  private findMidfielderTarget(player: any, context: MatchContext): any {
    for (const [_, teammate] of context.playerPositions) {
      if (teammate.team !== player.team) continue;
      if (teammate.playerId === player.playerId) continue;
      
      const distance = MathUtils.distance(player.x, player.y, teammate.x, teammate.y);
      if (distance > 5 && distance < 25) {
        if (teammate.role === 'DM' || teammate.role === 'CM') {
          return teammate;
        }
      }
    }
    
    return null;
  }

  private findSafePassTarget(player: any, context: MatchContext): any {
    for (const [_, teammate] of context.playerPositions) {
      if (teammate.team !== player.team) continue;
      if (teammate.playerId === player.playerId) continue;
      
      const distance = MathUtils.distance(player.x, player.y, teammate.x, teammate.y);
      if (distance > 3 && distance < 20) {
        if (teammate.role?.includes('CB') || teammate.role?.includes('RB') || teammate.role?.includes('LB')) {
          return teammate;
        }
      }
    }
    
    return null;
  }

  private findAttackingTarget(player: any, context: MatchContext): any {
    for (const [_, teammate] of context.playerPositions) {
      if (teammate.team !== player.team) continue;
      if (teammate.playerId === player.playerId) continue;
      
      const distance = MathUtils.distance(player.x, player.y, teammate.x, teammate.y);
      if (distance > 5 && distance < 30) {
        if (teammate.role === 'AM' || teammate.role === 'WM') {
          return teammate;
        }
      }
    }
    
    return null;
  }

  private findOneTwoTarget(player: any, context: MatchContext): any {
    for (const [_, teammate] of context.playerPositions) {
      if (teammate.team !== player.team) continue;
      if (teammate.playerId === player.playerId) continue;
      
      const distance = MathUtils.distance(player.x, player.y, teammate.x, teammate.y);
      if (distance > 2 && distance < 8) {
        return teammate;
      }
    }
    
    return null;
  }

  private findStrikerTarget(player: any, context: MatchContext): any {
    for (const [_, teammate] of context.playerPositions) {
      if (teammate.team !== player.team) continue;
      if (teammate.playerId === player.playerId) continue;
      
      const distance = MathUtils.distance(player.x, player.y, teammate.x, teammate.y);
      if (distance > 3 && distance < 25) {
        if (teammate.role === 'ST' || teammate.role === 'CF') {
          return teammate;
        }
      }
    }
    
    return null;
  }

  private findCrossTarget(player: any, context: MatchContext): any {
    for (const [_, teammate] of context.playerPositions) {
      if (teammate.team !== player.team) continue;
      if (teammate.playerId === player.playerId) continue;
      
      const distance = MathUtils.distance(player.x, player.y, teammate.x, teammate.y);
      if (distance > 5 && distance < 20) {
        if (teammate.role === 'ST' || teammate.role === 'CF') {
          return teammate;
        }
      }
    }
    
    return null;
  }

  private findFinalPassTarget(player: any, context: MatchContext): any {
    for (const [_, teammate] of context.playerPositions) {
      if (teammate.team !== player.team) continue;
      if (teammate.playerId === player.playerId) continue;
      
      const distance = MathUtils.distance(player.x, player.y, teammate.x, teammate.y);
      if (distance > 3 && distance < 15) {
        if (teammate.role === 'ST' || teammate.role === 'CF') {
          return teammate;
        }
      }
    }
    
    return null;
  }

  private findNearestTeammate(player: any, context: MatchContext): any {
    let nearest = null;
    let minDistance = Infinity;
    
    for (const [_, teammate] of context.playerPositions) {
      if (teammate.team !== player.team) continue;
      if (teammate.playerId === player.playerId) continue;
      
      const distance = MathUtils.distance(player.x, player.y, teammate.x, teammate.y);
      if (distance < minDistance && distance < 20) {
        minDistance = distance;
        nearest = teammate;
      }
    }
    
    return nearest;
  }

  private findInterceptingPlayer(context: MatchContext): any {
    const ballPos = context.ballPosition;
    let closest = null;
    let minDistance = Infinity;
    
    for (const [_, player] of context.playerPositions) {
      const distance = MathUtils.distance(player.x, player.y, ballPos.x, ballPos.y);
      if (distance < minDistance && distance < 3) {
        minDistance = distance;
        closest = player;
      }
    }
    
    return closest;
  }

  private isInCrossingPosition(ballPos: any, isHome: boolean): boolean {
    const x = ballPos.x;
    const y = ballPos.y;
    
    if (isHome) {
      return x > 70 && (y < 20 || y > 80);
    } else {
      return x < 30 && (y < 20 || y > 80);
    }
  }

  private isInShootingPosition(ballPos: any, isHome: boolean): boolean {
    const x = ballPos.x;
    
    if (isHome) {
      return x > 85;
    } else {
      return x < 15;
    }
  }

  private getForwardDirection(player: any): any {
    const isHome = player.team === 'home';
    return {
      x: isHome ? player.x + 5 : player.x - 5,
      y: player.y
    };
  }

  // Correlated play execution methods that maintain better ball-player connection
  private executeBuildUpPlayCorrelated(player: any, context: MatchContext): any {
    const ballPos = context.ballPosition;
    
    // Keep ball close to player during build-up
    if (MathUtils.probability(0.7)) {
      // Player keeps possession, ball stays near player
      return this.executePlayerPossession(player, context);
    } else {
      // Pass to nearby teammate
      const nearbyTeammate = this.findNearbyTeammate(player, context, 15);
      if (nearbyTeammate) {
        return this.executeGradualPass(ballPos, nearbyTeammate, BallPositionEngine.PASS_SPEED);
      }
    }
    
    return this.executePlayerPossession(player, context);
  }

  private executeMidfieldPlayCorrelated(player: any, context: MatchContext): any {
    const ballPos = context.ballPosition;
    
    if (MathUtils.probability(0.6)) {
      // Player dribbles forward
      return this.executePlayerPossession(player, context);
    } else {
      // Look for forward pass
      const forwardTeammate = this.findForwardTeammate(player, context);
      if (forwardTeammate) {
        return this.executeGradualPass(ballPos, forwardTeammate, BallPositionEngine.PASS_SPEED);
      }
    }
    
    return this.executePlayerPossession(player, context);
  }

  private executeAttackingPlayCorrelated(player: any, context: MatchContext): any {
    const ballPos = context.ballPosition;
    const isHome = player.team === 'home';
    
    if (this.isInShootingPosition(ballPos, isHome) && MathUtils.probability(0.4)) {
      // Take a shot
      return this.executeGradualShot(ballPos, isHome);
    } else if (MathUtils.probability(0.5)) {
      // Look for a cross or through ball
      const attackingTeammate = this.findAttackingTeammate(player, context);
      if (attackingTeammate) {
        return this.executeGradualPass(ballPos, attackingTeammate, BallPositionEngine.CROSS_SPEED);
      }
    }
    
    return this.executePlayerPossession(player, context);
  }

  private executeFinishingPlayCorrelated(player: any, context: MatchContext): any {
    const ballPos = context.ballPosition;
    const isHome = player.team === 'home';
    
    // High probability of shooting in finishing area
    if (MathUtils.probability(0.8)) {
      return this.executeGradualShot(ballPos, isHome);
    }
    
    return this.executePlayerPossession(player, context);
  }

  private executeBasicPlayCorrelated(player: any, context: MatchContext): any {
    const ballPos = context.ballPosition;
    
    // Basic possession - keep ball near player
    if (MathUtils.probability(0.6)) {
      return this.executePlayerPossession(player, context);
    } else {
      const nearestTeammate = this.findNearestTeammate(player, context);
      if (nearestTeammate) {
        return this.executeGradualPass(ballPos, nearestTeammate, BallPositionEngine.PASS_SPEED);
      }
    }
    
    return this.executePlayerPossession(player, context);
  }

  // Improved ball movement methods
  private executePlayerPossession(player: any, context: MatchContext): any {
    const ballPos = context.ballPosition;
    
    // Extra null checks
    if (!ballPos || ballPos.x === undefined || ballPos.y === undefined) {
      console.error('Ball position is null or invalid in executePlayerPossession');
      return { x: 50, y: 50, speed: 0, direction: 0, status: 'in_play' };
    }
    
    if (!player || player.x === undefined || player.y === undefined) {
      console.error('Player position is null or invalid in executePlayerPossession');
      return ballPos;
    }
    
    const isHome = player.team === 'home';
    
    // Get player attributes for dribbling ability
    const allPlayers = [...context.homeTeam.players, ...context.awayTeam.players];
    const playerData = allPlayers.find(p => p.id === player.playerId);
    const dribblingSkill = playerData?.attributes?.dribbling || 60;
    
    // Better ball control based on dribbling skill
    const controlVariation = Math.max(0.2, (100 - dribblingSkill) / 200); // Better players have tighter control
    
    // Direction of play with some variation based on skill
    const forwardOffset = (isHome ? 1.2 : -1.2) * (dribblingSkill / 80);
    const sideOffset = (Math.random() - 0.5) * controlVariation;
    
    // Keep ball close to player's feet with realistic positioning
    const targetX = Math.max(0, Math.min(100, player.x + forwardOffset));
    const targetY = Math.max(0, Math.min(100, player.y + sideOffset));
    
    // Smooth movement toward player position
    const currentDistance = MathUtils.distance(ballPos.x, ballPos.y, player.x, player.y);
    const moveSpeed = Math.min(2, currentDistance * 0.5);
    
    return {
      x: ballPos.x + (targetX - ballPos.x) * 0.3,
      y: ballPos.y + (targetY - ballPos.y) * 0.3,
      speed: moveSpeed,
      direction: Math.atan2(targetY - ballPos.y, targetX - ballPos.x),
      status: 'in_play'
    };
  }

  private executeGradualPass(from: any, to: any, speed: number): any {
    const direction = Math.atan2(to.y - from.y, to.x - from.x);
    const distance = MathUtils.distance(from.x, from.y, to.x, to.y);
    
    // Move ball gradually toward target with physics
    const moveDistance = Math.min(distance * 0.4, speed * 0.15);
    
    // Add some curve/spin to longer passes (more realistic)
    const curveFactor = Math.min(0.3, distance / 100);
    const curveOffset = (Math.random() - 0.5) * curveFactor;
    
    // Calculate perpendicular direction for curve
    const perpDirection = direction + Math.PI / 2;
    
    return {
      x: from.x + Math.cos(direction) * moveDistance + Math.cos(perpDirection) * curveOffset,
      y: from.y + Math.sin(direction) * moveDistance + Math.sin(perpDirection) * curveOffset,
      speed: speed * 0.9, // Ball slows down over time
      direction: direction,
      status: 'in_play'
    };
  }

  private executeGradualShot(from: any, isHome: boolean): any {
    const targetX = isHome ? 95 : 5;
    const targetY = 50 + (Math.random() - 0.5) * 20;
    
    const direction = Math.atan2(targetY - from.y, targetX - from.x);
    const distance = MathUtils.distance(from.x, from.y, targetX, targetY);
    
    // Move ball toward goal gradually
    const moveDistance = Math.min(distance * 0.4, BallPositionEngine.SHOT_SPEED * 0.1);
    
    return {
      x: from.x + Math.cos(direction) * moveDistance,
      y: from.y + Math.sin(direction) * moveDistance,
      speed: BallPositionEngine.SHOT_SPEED,
      direction: direction,
      status: 'shot'
    };
  }

  // Helper methods for finding teammates
  private findNearbyTeammate(player: any, context: MatchContext, maxDistance: number): any {
    for (const [_, teammate] of context.playerPositions) {
      if (teammate.team !== player.team) continue;
      if (teammate.playerId === player.playerId) continue;
      
      const distance = MathUtils.distance(player.x, player.y, teammate.x, teammate.y);
      if (distance < maxDistance) {
        return teammate;
      }
    }
    return null;
  }

  private findForwardTeammate(player: any, context: MatchContext): any {
    const isHome = player.team === 'home';
    
    for (const [_, teammate] of context.playerPositions) {
      if (teammate.team !== player.team) continue;
      if (teammate.playerId === player.playerId) continue;
      
      // Look for teammate ahead in attack direction
      const isTeammateAhead = isHome ? teammate.x > player.x : teammate.x < player.x;
      if (isTeammateAhead) {
        const distance = MathUtils.distance(player.x, player.y, teammate.x, teammate.y);
        if (distance < 25) {
          return teammate;
        }
      }
    }
    return null;
  }

  private findAttackingTeammate(player: any, context: MatchContext): any {
    const isHome = player.team === 'home';
    
    for (const [_, teammate] of context.playerPositions) {
      if (teammate.team !== player.team) continue;
      if (teammate.playerId === player.playerId) continue;
      
      // Look for teammate in attacking position
      const isInAttackingArea = isHome ? teammate.x > 70 : teammate.x < 30;
      if (isInAttackingArea) {
        return teammate;
      }
    }
    return null;
  }

  // NEW: Handle what happens after a defender wins the ball
  private executeDefensiveTransition(defender: any, context: MatchContext): any {
    const ballPos = context.ballPosition;
    const isHome = defender.team === 'home';
    
    console.log(`🛡️ DEFENSIVE TRANSITION: Player ${defender.playerId} (${defender.team}) won the ball, deciding next action...`);
    
    // FIRST: Move the ball away from congested area to prevent immediate counter-tackle
    const securedBallPosition = this.secureBallAfterTackle(defender, ballPos, context);
    
    // Set a possession protection period - no contests for next few ticks
    context.lastPossessionChange = context.currentSecond;
    context.possessionProtection = {
      playerId: defender.playerId,
      team: defender.team,
      expiresAt: context.currentSecond + 1.5 // REDUCED: 1.5 seconds of protection for balance
    };
    
    console.log(`🛡️ POSSESSION SECURED: Player ${defender.playerId} has 1.5 seconds protection from tackles`);
    
    // Get player data for decision making
    const allPlayers = [...context.homeTeam.players, ...context.awayTeam.players];
    const defenderData = allPlayers.find(p => p.id === defender.playerId);
    
    // Decision probability based on player attributes and situation
    const passingSkill = defenderData?.attributes?.passing || 60;
    const dribblingSkill = defenderData?.attributes?.dribbling || 60;
    
    // Check if defender is under pressure (but less sensitive after winning ball)
    const isUnderPressure = this.isDefenderUnderPressure(defender, context, true);
    
    // Find best passing options
    const safePassTarget = this.findSafeDefensivePassTarget(defender, context);
    const attackingPassTarget = this.findCounterAttackTarget(defender, context);
    
    // Decision making logic - more controlled after securing possession
    if (isUnderPressure) {
      // Under pressure - prioritize safety but with more time
      if (safePassTarget && MathUtils.probability(0.7)) {
        console.log(`🛡️ Under pressure, playing safe pass to ${safePassTarget.playerId}`);
        return this.executeControlledDefensivePass(securedBallPosition, safePassTarget, 'safe');
      } else {
        // Clear the ball if no safe pass available
        console.log(`🛡️ Under pressure, clearing the ball`);
        return this.executeDefensiveClearance(securedBallPosition, isHome);
      }
    } else {
      // Not under pressure - take time to build up play
      
      // Counter-attack opportunity
      if (attackingPassTarget && MathUtils.probability(0.3)) {
        console.log(`🛡️ Counter-attack opportunity to ${attackingPassTarget.playerId}`);
        return this.executeControlledDefensivePass(securedBallPosition, attackingPassTarget, 'counter');
      }
      
      // Keep possession and dribble forward if good skills
      if (dribblingSkill > 65 && MathUtils.probability(0.4)) {
        console.log(`🛡️ Taking time to dribble forward with secured possession`);
        return this.executeSecureDribble(defender, securedBallPosition, isHome);
      }
      
      // Safe build-up play
      if (safePassTarget && MathUtils.probability(0.5)) {
        console.log(`🛡️ Building up play with time, passing to ${safePassTarget.playerId}`);
        return this.executeControlledDefensivePass(securedBallPosition, safePassTarget, 'buildup');
      }
      
      // Default: keep possession and move forward slowly
      console.log(`🛡️ Maintaining possession, moving forward carefully`);
      return this.executeSecureDribble(defender, securedBallPosition, isHome);
    }
  }
  
  private secureBallAfterTackle(defender: any, ballPos: any, context: MatchContext): any {
    // Move ball to a safer position away from the tackle area
    const isHome = defender.team === 'home';
    const opposingTeam = isHome ? 'away' : 'home';
    
    // Find direction with least pressure
    let bestDirection = 0;
    let minPressure = Infinity;
    
    // Check 8 directions around the defender
    for (let angle = 0; angle < 8; angle++) {
      const checkDirection = (angle * Math.PI) / 4;
      const checkX = defender.x + Math.cos(checkDirection) * 6;
      const checkY = defender.y + Math.sin(checkDirection) * 6;
      
      // Count nearby opponents in this direction
      let pressure = 0;
      for (const [_, player] of context.playerPositions) {
        if (player.team === opposingTeam) {
          const distance = MathUtils.distance(checkX, checkY, player.x, player.y);
          if (distance < 8) {
            pressure += (8 - distance); // Closer = more pressure
          }
        }
      }
      
      if (pressure < minPressure) {
        minPressure = pressure;
        bestDirection = checkDirection;
      }
    }
    
    // Move ball in the safest direction, but not too far from defender
    const safeX = Math.max(0, Math.min(100, defender.x + Math.cos(bestDirection) * 3));
    const safeY = Math.max(0, Math.min(100, defender.y + Math.sin(bestDirection) * 3));
    
    console.log(`🛡️ SECURING BALL: Moving ball from (${ballPos.x.toFixed(1)}, ${ballPos.y.toFixed(1)}) to (${safeX.toFixed(1)}, ${safeY.toFixed(1)})`);
    
    return {
      x: safeX,
      y: safeY,
      speed: 2,
      direction: bestDirection,
      status: 'in_play'
    };
  }
  
  private isDefenderUnderPressure(defender: any, context: MatchContext, justWonBall: boolean = false): boolean {
    const opposingTeam = defender.team === 'home' ? 'away' : 'home';
    const pressureThreshold = justWonBall ? 3 : 5; // Less sensitive after just winning ball
    
    // Check for nearby opposing players
    for (const [_, player] of context.playerPositions) {
      if (player.team === opposingTeam) {
        const distance = MathUtils.distance(defender.x, defender.y, player.x, player.y);
        if (distance < pressureThreshold) {
          return true;
        }
      }
    }
    return false;
  }
  
  private findSafeDefensivePassTarget(defender: any, context: MatchContext): any {
    const isHome = defender.team === 'home';
    let bestTarget = null;
    let bestScore = -1;
    
    for (const [_, teammate] of context.playerPositions) {
      if (teammate.team !== defender.team) continue;
      if (teammate.playerId === defender.playerId) continue;
      
      const distance = MathUtils.distance(defender.x, defender.y, teammate.x, teammate.y);
      if (distance > 40) continue; // Too far for safe pass
      
      // Check if teammate is in safe position (not closely marked)
      const isTeammateSafe = this.isPlayerInSafePosition(teammate, context);
      if (!isTeammateSafe) continue;
      
      // Score based on safety and position
      let score = 0;
      
      // Prefer safer positions (further from opponent goal)
      const safetyX = isHome ? (25 - teammate.x) : (teammate.x - 75);
      if (safetyX > 0) score += safetyX * 0.1;
      
      // Prefer shorter passes for safety
      score += Math.max(0, 20 - distance) * 0.2;
      
      // Role preferences - prefer defensive players for safe passes
      if (teammate.role?.includes('CB') || teammate.role?.includes('DM')) {
        score += 10;
      }
      
      if (score > bestScore) {
        bestScore = score;
        bestTarget = teammate;
      }
    }
    
    return bestTarget;
  }
  
  private findCounterAttackTarget(defender: any, context: MatchContext): any {
    const isHome = defender.team === 'home';
    
    for (const [_, teammate] of context.playerPositions) {
      if (teammate.team !== defender.team) continue;
      if (teammate.playerId === defender.playerId) continue;
      
      const distance = MathUtils.distance(defender.x, defender.y, teammate.x, teammate.y);
      if (distance > 50) continue; // Too far
      
      // Look for forward players in good attacking positions
      const isInGoodAttackingPosition = isHome ? teammate.x > 60 : teammate.x < 40;
      if (!isInGoodAttackingPosition) continue;
      
      // Check if there's space to attack
      const hasSpaceToAttack = this.hasSpaceForCounterAttack(teammate, context);
      if (!hasSpaceToAttack) continue;
      
      // Prefer fast players for counter-attacks
      if (teammate.role === 'WM' || teammate.role === 'ST' || teammate.role === 'AM') {
        return teammate;
      }
    }
    
    return null;
  }
  
  private isPlayerInSafePosition(player: any, context: MatchContext): boolean {
    const opposingTeam = player.team === 'home' ? 'away' : 'home';
    
    // Check for nearby opponents
    for (const [_, opponent] of context.playerPositions) {
      if (opponent.team === opposingTeam) {
        const distance = MathUtils.distance(player.x, player.y, opponent.x, opponent.y);
        if (distance < 4) { // Too close to opponent
          return false;
        }
      }
    }
    return true;
  }
  
  private hasSpaceForCounterAttack(player: any, context: MatchContext): boolean {
    const isHome = player.team === 'home';
    const opposingTeam = isHome ? 'away' : 'home';
    
    // Check for space ahead of the player
    const spaceX = isHome ? player.x + 15 : player.x - 15;
    
    for (const [_, opponent] of context.playerPositions) {
      if (opponent.team === opposingTeam) {
        const opponentInPath = isHome ? 
          (opponent.x > player.x && opponent.x < spaceX) :
          (opponent.x < player.x && opponent.x > spaceX);
          
        if (opponentInPath) {
          const lateralDistance = Math.abs(opponent.y - player.y);
          if (lateralDistance < 10) { // Opponent blocks the path
            return false;
          }
        }
      }
    }
    return true;
  }
  
  private executeDefensivePass(from: any, to: any, passType: 'safe' | 'buildup' | 'counter'): any {
    const direction = Math.atan2(to.y - from.y, to.x - from.x);
    const distance = MathUtils.distance(from.x, from.y, to.x, to.y);
    
    let speed = BallPositionEngine.PASS_SPEED;
    if (passType === 'counter') {
      speed = BallPositionEngine.CROSS_SPEED; // Faster for counter-attacks
    }
    
    // Move ball gradually toward target
    const moveDistance = Math.min(distance * 0.4, speed * 0.15);
    
    return {
      x: from.x + Math.cos(direction) * moveDistance,
      y: from.y + Math.sin(direction) * moveDistance,
      speed: speed,
      direction: direction,
      status: 'in_play'
    };
  }
  
  private executeDefensiveDribble(defender: any, ballPos: any, isHome: boolean): any {
    // Dribble toward safer area or build-up position
    const targetX = isHome ? 
      Math.min(defender.x + 8, 45) : // Move forward but stay in defensive half
      Math.max(defender.x - 8, 55);
      
    const targetY = defender.y + (Math.random() - 0.5) * 6; // Small lateral movement
    
    const direction = Math.atan2(targetY - ballPos.y, targetX - ballPos.x);
    
    return {
      x: ballPos.x + Math.cos(direction) * 2,
      y: ballPos.y + Math.sin(direction) * 2,
      speed: BallPositionEngine.DRIBBLE_SPEED,
      direction: direction,
      status: 'in_play'
    };
  }
  
  private executeDefensiveClearance(ballPos: any, isHome: boolean): any {
    // Clear ball toward safer areas - up the field and to the sides
    const clearanceTargets = [
      { x: isHome ? 60 : 40, y: 20 }, // Left wing
      { x: isHome ? 60 : 40, y: 80 }, // Right wing
      { x: isHome ? 70 : 30, y: 50 }, // Center field
      { x: isHome ? 55 : 45, y: 15 }, // Left touchline
      { x: isHome ? 55 : 45, y: 85 }  // Right touchline
    ];
    
    const target = clearanceTargets[Math.floor(Math.random() * clearanceTargets.length)];
    const direction = Math.atan2(target.y - ballPos.y, target.x - ballPos.x);
    
    // High, long clearance
    return {
      x: target.x,
      y: target.y,
      speed: BallPositionEngine.GOALKEEPER_KICK_SPEED,
      direction: direction,
      status: 'in_play'
    };
  }
  
  private executeControlledDefensivePass(from: any, to: any, passType: 'safe' | 'buildup' | 'counter'): any {
    const direction = Math.atan2(to.y - from.y, to.x - from.x);
    const distance = MathUtils.distance(from.x, from.y, to.x, to.y);
    
    let speed = BallPositionEngine.PASS_SPEED;
    if (passType === 'counter') {
      speed = BallPositionEngine.CROSS_SPEED; // Faster for counter-attacks
    }
    
    // Controlled, gradual movement toward target - not instant
    const moveDistance = Math.min(distance * 0.3, speed * 0.1);
    
    return {
      x: from.x + Math.cos(direction) * moveDistance,
      y: from.y + Math.sin(direction) * moveDistance,
      speed: speed * 0.8, // Slightly slower for control
      direction: direction,
      status: 'in_play'
    };
  }
  
  private executeSecureDribble(defender: any, ballPos: any, isHome: boolean): any {
    // Controlled dribble - keep ball close and move gradually forward
    const forwardDirection = isHome ? 0 : Math.PI; // East for home, west for away
    const lateralVariation = (Math.random() - 0.5) * 0.5; // Small lateral movement
    
    const targetDirection = forwardDirection + lateralVariation;
    const moveDistance = 1.5; // Small, controlled steps
    
    const targetX = Math.max(0, Math.min(100, ballPos.x + Math.cos(targetDirection) * moveDistance));
    const targetY = Math.max(0, Math.min(100, ballPos.y + Math.sin(targetDirection) * moveDistance));
    
    return {
      x: targetX,
      y: targetY,
      speed: BallPositionEngine.DRIBBLE_SPEED * 0.6, // Slower, more controlled
      direction: targetDirection,
      status: 'in_play'
    };
  }

} 