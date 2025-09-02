import { MatchContext, MatchEvent } from '../../types';
import { MathUtils } from '../../utils/MathUtils';

export class EventDetectionEngine {
  private static readonly EVENT_PROBABILITIES = {
    SHOT: 0.3,
    GOAL: 0.001, // Much lower for realistic scoring
    PASS: 0.3, // FURTHER REDUCED: Avoid duplication with phase events
    TACKLE: 0.2, // REDUCED: Let phase events handle most actions
    DRIBBLE: 0.25,
    FOUL: 0.01,
    CARD: 0.001,
    OFFSIDE: 0.02,
    CORNER: 0.03,
    SUBSTITUTION: 0.005
  };

  checkActionBasedEvents(context: MatchContext): MatchEvent[] {
    const events: MatchEvent[] = [];
    const ballPos = context.ballPosition;
    const possession = context.possession;
    
    // Check if ballPosition is valid
    if (!ballPos) {
      console.log('Event engine: Ball position is null');
      return events;
    }
    
    // Find player with ball
    const playerWithBall = this.findPlayerWithBall(context);
    if (!playerWithBall) {
      console.log(`Event engine: No player found with ball at (${ballPos.x}, ${ballPos.y})`);
      return events;
    }
    
    // RATE LIMITING: Prevent same player from generating too many events too quickly
    const playerId = playerWithBall.playerId;
    const currentTime = context.currentSecond;
    const lastEventTime = context.lastPlayerEventTime?.[playerId] || 0;
    
    if (currentTime - lastEventTime < 2) { // Minimum 2 seconds between events from same player
      console.log(`⏱️ RATE LIMITED: Player ${playerId} last event was ${(currentTime - lastEventTime).toFixed(1)}s ago`);
      return events;
    }
    
    console.log(`Event engine: Player ${playerWithBall.playerId} has ball at (${playerWithBall.x}, ${playerWithBall.y})`);
    
    const role = playerWithBall.role || 'CM';
    const isHome = playerWithBall.team === 'home';
    const playPhase = this.determinePlayPhase(ballPos, isHome);
    
    // PRIORITY: Try phase-based events first (better contextual commentary)
    switch (playPhase) {
      case 'build_up':
        events.push(...this.generateBuildUpEvents(playerWithBall, context));
        break;
      case 'midfield_play':
        events.push(...this.generateMidfieldEvents(playerWithBall, context));
        break;
      case 'attacking_play':
        events.push(...this.generateAttackingEvents(playerWithBall, context));
        break;
      case 'finishing':
        events.push(...this.generateFinishingEvents(playerWithBall, context));
        break;
    }
    
    // FALLBACK: Only use general events if no phase-based events were generated
    if (events.length === 0) {
      console.log(`📋 FALLBACK: Using general events for player ${playerWithBall.playerId}`);
      events.push(...this.checkGeneralEvents(context));
    } else {
      console.log(`🎯 PHASE EVENTS: Generated ${events.length} contextual events for ${playPhase}`);
    }
    
    // Update last event time for this player
    if (events.length > 0) {
      if (!context.lastPlayerEventTime) {
        context.lastPlayerEventTime = {};
      }
      context.lastPlayerEventTime[playerWithBall.playerId] = context.currentSecond;
      console.log(`📅 EVENT LOGGED: Player ${playerWithBall.playerId} at ${context.currentSecond}s`);
    }
    
    return events;
  }

  private findPlayerWithBall(context: MatchContext): any {
    const ballPos = context.ballPosition;
    
    // First check for close possession (within 3 units)
    for (const [_, player] of context.playerPositions) {
      const distance = MathUtils.distance(player.x, player.y, ballPos.x, ballPos.y);
      if (distance < 3) {
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

  private determinePlayPhase(ballPos: any, isHome: boolean): string {
    const x = ballPos.x;
    
    if (isHome) {
      if (x < 25) return 'build_up';
      if (x < 60) return 'midfield_play';
      if (x < 85) return 'attacking_play';
      return 'finishing';
    } else {
      if (x > 75) return 'build_up';
      if (x > 40) return 'midfield_play';
      if (x > 15) return 'attacking_play';
      return 'finishing';
    }
  }

  private generateBuildUpEvents(player: any, context: MatchContext): MatchEvent[] {
    const events: MatchEvent[] = [];
    const role = player.role || 'CM';
    const playerName = this.getPlayerName(player.playerId, context);
    const ballPos = context.ballPosition;
    
    // CONTEXTUAL COMMENTARY based on actual pitch situation
    const pressureAnalysis = this.analyzePressureOnPlayer(player, context);
    const nearbyPlayers = this.getNearbyPlayers(player, context);
    
    if (role === 'GK') {
      if (MathUtils.probability(0.3)) {
        // Generate commentary based on actual pressure situation
        let commentary = `${playerName} has possession in his penalty area.`;
        
        if (pressureAnalysis.nearbyOpponents > 0) {
          commentary += ` He's under pressure from ${pressureAnalysis.nearbyOpponents} attacking player${pressureAnalysis.nearbyOpponents > 1 ? 's' : ''} and needs to make a quick decision.`;
        } else {
          commentary += ` With no immediate pressure, he has time to pick out his pass.`;
        }
        
        if (nearbyPlayers.defenders.length > 0) {
          commentary += ` His center-backs are offering themselves for a short pass.`;
        }
        
        events.push({
          minute: Math.floor(context.currentSecond / 60),
          type: 'pass',
          description: `${playerName} on the ball in the penalty area`,
          commentary: commentary,
          playerId: player.playerId,
          team: player.team
        });
      }
    } else if (role.includes('CB')) {
      if (MathUtils.probability(0.4)) {
        let commentary = `${playerName} brings the ball forward from defense.`;
        
        // Describe the actual field position
        const fieldPosition = this.describeFieldPosition(ballPos, player.team === 'home');
        commentary += ` He's positioned ${fieldPosition}.`;
        
        if (pressureAnalysis.level === 'high') {
          commentary += ` The opposition is pressing high and he's under immediate pressure.`;
        } else if (pressureAnalysis.level === 'medium') {
          commentary += ` An opposing player is closing him down but he has a moment to decide.`;
        } else {
          commentary += ` With space ahead of him, he can drive forward or look for a pass.`;
        }
        
        events.push({
          minute: Math.floor(context.currentSecond / 60),
          type: 'pass',
          description: `${playerName} advancing with the ball`,
          commentary: commentary,
          playerId: player.playerId,
          team: player.team
        });
      }
    }
    
    return events;
  }

  private generateMidfieldEvents(player: any, context: MatchContext): MatchEvent[] {
    const events: MatchEvent[] = [];
    const role = player.role || 'CM';
    const playerName = this.getPlayerName(player.playerId, context);
    const ballPos = context.ballPosition;
    
    // Contextual analysis
    const pressureAnalysis = this.analyzePressureOnPlayer(player, context);
    const fieldPosition = this.describeFieldPosition(ballPos, player.team === 'home');
    const nearbyPlayers = this.getNearbyPlayers(player, context);
    
    if (role === 'DM') {
      if (MathUtils.probability(0.3)) {
        let commentary = `${playerName} collects the ball ${fieldPosition}.`;
        
        if (pressureAnalysis.level === 'high') {
          commentary += ` He's immediately under pressure and needs to make a quick decision to avoid losing possession.`;
        } else {
          commentary += ` With time and space, he can dictate the tempo of the game.`;
        }
        
        if (nearbyPlayers.forwards.length > 0) {
          commentary += ` The attacking players are making runs ahead of him.`;
        }
        
        events.push({
          minute: Math.floor(context.currentSecond / 60),
          type: 'pass',
          description: `${playerName} orchestrating from deep`,
          commentary: commentary,
          playerId: player.playerId,
          team: player.team
        });
      }
    } else if (role === 'CM') {
      if (MathUtils.probability(0.4)) {
        let commentary = `${playerName} drives forward ${fieldPosition}.`;
        
        const spaceAhead = this.hasSpaceAhead(player, context);
        if (spaceAhead) {
          commentary += ` He sees space ahead and pushes forward with purpose.`;
        } else {
          commentary += ` The midfield is congested but he looks for gaps to exploit.`;
        }
        
        if (pressureAnalysis.nearbyOpponents > 1) {
          commentary += ` Multiple opponents are converging on him.`;
        }
        
        events.push({
          minute: Math.floor(context.currentSecond / 60),
          type: 'dribbling',
          description: `${playerName} advancing through midfield`,
          commentary: commentary,
          playerId: player.playerId,
          team: player.team
        });
      }
    } else if (role === 'AM') {
      if (MathUtils.probability(0.3)) {
        let commentary = `${playerName} gets on the ball ${fieldPosition}.`;
        
        const isInFinalThird = (player.team === 'home' && ballPos.x > 67) || (player.team === 'away' && ballPos.x < 33);
        
        if (isInFinalThird) {
          commentary += ` In the final third, he looks to create something special.`;
          if (nearbyPlayers.forwards.length > 0) {
            commentary += ` The strikers are making their moves in the penalty area.`;
          }
        } else {
          commentary += ` He's looking to thread the ball through to the forwards.`;
        }
        
        events.push({
          minute: Math.floor(context.currentSecond / 60),
          type: 'pass',
          description: `${playerName} creating in the final third`,
          commentary: commentary,
          playerId: player.playerId,
          team: player.team
        });
      }
    }
    
    return events;
  }

  private generateAttackingEvents(player: any, context: MatchContext): MatchEvent[] {
    const events: MatchEvent[] = [];
    const role = player.role || 'CM';
    const playerName = this.getPlayerName(player.playerId, context);
    const isHome = player.team === 'home';
    
    if (role === 'AM') {
      if (MathUtils.probability(0.4)) {
        events.push({
          minute: Math.floor(context.currentSecond / 60),
          type: 'pass',
          description: `${playerName} slips a pass through to the winger`,
          commentary: `${playerName} receives the ball and spots the winger making a run down the flank. He plays a perfectly weighted through ball that splits the defense.`,
          playerId: player.playerId,
          team: player.team
        });
      }
    } else if (role === 'WM') {
      if (this.isInCrossingPosition(context.ballPosition, isHome) && MathUtils.probability(0.5)) {
        events.push({
          minute: Math.floor(context.currentSecond / 60),
          type: 'cross',
          description: `${playerName} delivers a cross into the box`,
          commentary: `${playerName} reaches the byline and delivers a dangerous cross into the penalty area. The striker is making his run, timing it perfectly to get between the center backs.`,
          playerId: player.playerId,
          team: player.team
        });
      }
    } else if (role === 'ST') {
      if (MathUtils.probability(0.3)) {
        events.push({
          minute: Math.floor(context.currentSecond / 60),
          type: 'dribbling',
          description: `${playerName} peels off the defender into space`,
          commentary: `${playerName} makes a clever run, peeling off his marker to find space in the penalty area. He's perfectly positioned to receive the cross.`,
          playerId: player.playerId,
          team: player.team
        });
      }
    }
    
    return events;
  }

  private generateFinishingEvents(player: any, context: MatchContext): MatchEvent[] {
    const events: MatchEvent[] = [];
    const role = player.role || 'CM';
    const playerName = this.getPlayerName(player.playerId, context);
    const isHome = player.team === 'home';
    
    if (this.isInShootingPosition(context.ballPosition, isHome)) {
      if (MathUtils.probability(0.6)) {
        const isGoal = this.calculateGoalProbability(context);
        
        if (isGoal && MathUtils.probability(isGoal)) {
          events.push({
            minute: Math.floor(context.currentSecond / 60),
            type: 'goal',
            description: `${playerName} scores!`,
            commentary: `${playerName} gets his head to the cross and directs it toward goal! The goalkeeper dives but can't reach it - IT'S A GOAL!`,
            playerId: player.playerId,
            team: player.team
          });
          
          // Update score
          if (isHome) {
            context.score.home++;
          } else {
            context.score.away++;
          }
          
          // GOAL RESET: Reset ball and players to starting positions
          this.executeGoalReset(context, isHome);
        } else {
          events.push({
            minute: Math.floor(context.currentSecond / 60),
            type: 'shot_on_target',
            description: `${playerName} heads the ball toward goal`,
            commentary: `${playerName} meets the cross with a powerful header! The goalkeeper dives and just manages to parry it away for a corner.`,
            playerId: player.playerId,
            team: player.team
          });
        }
      }
    }
    
    return events;
  }

  private checkGeneralEvents(context: MatchContext): MatchEvent[] {
    const events: MatchEvent[] = [];
    
    // Check for passes first - ball needs to move
    if (MathUtils.probability(EventDetectionEngine.EVENT_PROBABILITIES.PASS)) {
      const passEvent = this.generatePassEvent(context);
      if (passEvent) events.push(passEvent);
    }
    
    // Check for tackles based on defensive attributes
    if (MathUtils.probability(EventDetectionEngine.EVENT_PROBABILITIES.TACKLE)) {
      const tackeEvent = this.generateDefensiveEvent(context, 'tackle');
      if (tackeEvent) events.push(tackeEvent);
    }
    
    // Check for interceptions
    if (MathUtils.probability(0.02)) { // 2% chance for interceptions
      const interceptionEvent = this.generateDefensiveEvent(context, 'interception');
      if (interceptionEvent) events.push(interceptionEvent);
    }
    
    // Check for clearances in defensive areas
    const ballPos = context.ballPosition;
    const isInDefensiveArea = ballPos.x < 25 || ballPos.x > 75;
    if (isInDefensiveArea && MathUtils.probability(0.03)) {
      const clearanceEvent = this.generateDefensiveEvent(context, 'clearance');
      if (clearanceEvent) events.push(clearanceEvent);
    }
    
    // Check for pressing actions
    if (MathUtils.probability(0.05)) { // 5% chance for pressing
      const pressingEvent = this.generateDefensiveEvent(context, 'pressing');
      if (pressingEvent) events.push(pressingEvent);
    }
    
    // Check for fouls
    if (MathUtils.probability(EventDetectionEngine.EVENT_PROBABILITIES.FOUL)) {
      const foulingPlayer = this.getRandomPlayer(context);
      const fouledPlayer = this.getRandomPlayer(context);
      
      if (foulingPlayer && fouledPlayer && foulingPlayer.team !== fouledPlayer.team) {
        events.push({
          minute: Math.floor(context.currentSecond / 60),
          type: 'foul',
          description: `${this.getPlayerName(foulingPlayer.playerId, context)} commits a foul`,
          commentary: `${this.getPlayerName(foulingPlayer.playerId, context)} goes in late and catches ${this.getPlayerName(fouledPlayer.playerId, context)}. The referee blows for a foul.`,
          playerId: foulingPlayer.playerId,
          team: foulingPlayer.team
        });
      }
    }
    
    // Check for offsides
    if (MathUtils.probability(EventDetectionEngine.EVENT_PROBABILITIES.OFFSIDE)) {
      const offsidePlayer = this.getRandomPlayer(context);
      if (offsidePlayer) {
        events.push({
          minute: Math.floor(context.currentSecond / 60),
          type: 'offside',
          description: `${this.getPlayerName(offsidePlayer.playerId, context)} is caught offside`,
          commentary: `${this.getPlayerName(offsidePlayer.playerId, context)} makes a run but the assistant referee's flag goes up. He was just a fraction offside.`,
          playerId: offsidePlayer.playerId,
          team: offsidePlayer.team
        });
      }
    }
    
    return events;
  }

  private generateDefensiveEvent(context: MatchContext, eventType: 'tackle' | 'interception' | 'clearance' | 'pressing'): MatchEvent | null {
    const ballPos = context.ballPosition;
    if (!ballPos) return null;
    
    // Find attacking player with ball
    const attackingPlayer = this.findPlayerWithBall(context);
    if (!attackingPlayer) return null;
    
    // Check if player is protected from tackles (just won possession)
    if (eventType === 'tackle' && context.possessionProtection && 
        context.possessionProtection.playerId === attackingPlayer.playerId && 
        context.currentSecond < context.possessionProtection.expiresAt) {
      console.log(`🛡️ POSSESSION PROTECTED: Player ${attackingPlayer.playerId} protected from tackles`);
      return null; // No tackle event if player is protected
    }
    
    // Add cooldown between possession changes - REDUCED for more dynamic play
    if (eventType === 'tackle' && context.lastPossessionChange && 
        (context.currentSecond - context.lastPossessionChange) < 1) {
      return null; // No tackle if recent possession change (reduced from 2s to 1s)
    }
    
    // Find defending players nearby
    const opposingTeam = attackingPlayer.team === 'home' ? 'away' : 'home';
    const nearbyDefenders = [];
    
    for (const [_, player] of context.playerPositions) {
      if (player.team === opposingTeam) {
        const distance = MathUtils.distance(ballPos.x, ballPos.y, player.x, player.y);
        if (distance < 8) { // Within challenging distance
          nearbyDefenders.push({ player, distance });
        }
      }
    }
    
    if (nearbyDefenders.length === 0) return null;
    
    // Sort by distance and pick the closest defender
    nearbyDefenders.sort((a, b) => a.distance - b.distance);
    const defender = nearbyDefenders[0].player;
    
    // Get player data for attribute calculations
    const allPlayers = [...context.homeTeam.players, ...context.awayTeam.players];
    const attackerData = allPlayers.find(p => p.id === attackingPlayer.playerId);
    const defenderData = allPlayers.find(p => p.id === defender.playerId);
    
    if (!attackerData || !defenderData) return null;
    
    // Calculate success probability based on defensive action type
    const successProbability = this.calculateDefensiveActionSuccess(
      attackerData, 
      defenderData, 
      attackingPlayer,
      defender,
      context, 
      eventType
    );
    
    // Determine if the defensive action succeeds
    const actionSucceeds = MathUtils.probability(successProbability);
    
    const defenderName = this.getPlayerName(defender.playerId, context);
    const attackerName = this.getPlayerName(attackingPlayer.playerId, context);
    const minute = Math.floor(context.currentSecond / 60);
    
    // Generate event based on type and success
    switch (eventType) {
      case 'tackle':
        if (actionSucceeds) {
          // CHANGE POSSESSION when tackle succeeds
          context.possession.team = defender.team as 'home' | 'away';
          context.possession.playerId = defender.playerId;
          context.possession.timestamp = context.currentSecond;
          
          // Add possession protection period to prevent immediate counter-tackle
          context.lastPossessionChange = context.currentSecond;
          context.possessionProtection = {
            playerId: defender.playerId,
            team: defender.team as 'home' | 'away',
            expiresAt: context.currentSecond + 1.5 // REDUCED: 1.5 seconds protection
          };
          
          console.log(`🛡️ TACKLE SUCCESS: ${defenderName} wins possession, protected for 3 seconds`);
          
          return {
            minute,
            type: 'tackle_success',
            description: `${defenderName} times his tackle perfectly and dispossesses ${attackerName}`,
            commentary: `Excellent defending from ${defenderName}! He times his tackle perfectly and wins the ball cleanly from ${attackerName}.`,
            playerId: defender.playerId,
            team: defender.team
          };
        } else {
          return {
            minute,
            type: 'tackle_failed',
            description: `${defenderName} attempts a tackle but ${attackerName} keeps possession`,
            commentary: `${defenderName} slides in but ${attackerName} shows great skill to evade the challenge and maintain possession.`,
            playerId: defender.playerId,
            team: defender.team
          };
        }
      
      case 'interception':
        if (actionSucceeds) {
          return {
            minute,
            type: 'interception',
            description: `${defenderName} intercepts the pass`,
            commentary: `Great anticipation from ${defenderName}! He reads the play perfectly and cuts out the pass intended for ${attackerName}.`,
            playerId: defender.playerId,
            team: defender.team
          };
        }
        break;
      
      case 'clearance':
        if (actionSucceeds) {
          const clearanceArea = this.getClearanceArea(ballPos, defender.team === 'home');
          return {
            minute,
            type: 'clearance',
            description: `${defenderName} clears the ball to safety`,
            commentary: `Under pressure from ${attackerName}, ${defenderName} doesn't take any chances and hoofs the ball ${clearanceArea}.`,
            playerId: defender.playerId,
            team: defender.team
          };
        }
        break;
      
      case 'pressing':
        if (actionSucceeds) {
          return {
            minute,
            type: 'pressing',
            description: `${defenderName} closes down ${attackerName}`,
            commentary: `${defenderName} applies pressure to ${attackerName}, forcing him into a hurried decision. The pressing game is working well.`,
            playerId: defender.playerId,
            team: defender.team
          };
        }
        break;
    }
    
    return null;
  }
  
  private calculateDefensiveActionSuccess(
    attackerData: any, 
    defenderData: any, 
    attackerPos: any, 
    defenderPos: any,
    context: MatchContext, 
    actionType: string
  ): number {
    // Base attributes
    const attackerDribbling = attackerData.attributes?.dribbling || 60;
    const attackerPace = attackerData.attributes?.pace || 60;
    const attackerPhysical = attackerData.attributes?.physical || 60;
    
    const defenderDefending = defenderData.attributes?.defending || 60;
    const defenderPace = defenderData.attributes?.pace || 60;
    const defenderPhysical = defenderData.attributes?.physical || 60;
    
    // Fatigue effects
    const minute = Math.floor(context.currentSecond / 60);
    const attackerFatigue = this.calculateFatigueEffect(minute, attackerData.attributes?.physical || 60);
    const defenderFatigue = this.calculateFatigueEffect(minute, defenderData.attributes?.physical || 60);
    
    // Morale/Momentum effects
    const momentumBonus = context.momentum === defenderPos.team ? 1.1 : 
                         context.momentum === attackerPos.team ? 0.9 : 1.0;
    
    // Base success probability varies by action type - MORE BALANCED
    let baseSuccess = 0.35; // 35% base (increased from 30%)
    switch (actionType) {
      case 'tackle':
        baseSuccess = 0.45; // Slightly increased but balanced
        break;
      case 'interception':
        baseSuccess = 0.3; // Increased from 0.25
        break;
      case 'clearance':
        baseSuccess = 0.6; // Clearances are easier in defensive areas
        break;
      case 'pressing':
        baseSuccess = 0.5; // Pressing success varies
        break;
    }
    
    // Calculate defensive strength vs attacking strength
    let defenderStrength = (defenderDefending * 0.6 + defenderPhysical * 0.2 + defenderPace * 0.2) * defenderFatigue;
    let attackerStrength = (attackerDribbling * 0.5 + attackerPhysical * 0.3 + attackerPace * 0.2) * attackerFatigue;
    
    // Apply momentum
    defenderStrength *= momentumBonus;
    attackerStrength *= (2 - momentumBonus); // Inverse for attacker
    
    // Role-based bonuses
    const defenderRoleBonus = this.getDefendingRoleBonus(defenderPos.role);
    defenderStrength *= defenderRoleBonus;
    
    // Context modifiers
    const ballPos = context.ballPosition;
    
    // Defensive advantage in own penalty area
    const isDefendingOwnPenalty = (defenderPos.team === 'home' && ballPos.x < 16.5) || 
                                  (defenderPos.team === 'away' && ballPos.x > 83.5);
    if (isDefendingOwnPenalty) {
      defenderStrength *= 1.3; // 30% bonus for defending penalty area
    }
    
    // Calculate final probability - MORE BALANCED
    const strengthRatio = defenderStrength / (defenderStrength + attackerStrength);
    let successProbability = baseSuccess + (strengthRatio - 0.5) * 0.3; // REDUCED impact of strength difference
    
    // Add randomness - INCREASED randomness for more balanced play
    const randomFactor = 0.7 + (Math.random() * 0.6); // Between 0.7 and 1.3 (more variance)
    successProbability *= randomFactor;
    
    // Cap between 0.15 and 0.75 - NARROWER range for more balanced outcomes
    return Math.max(0.15, Math.min(0.75, successProbability));
  }
  
  private calculateFatigueEffect(minute: number, physicalAttribute: number): number {
    const fatigueResistance = physicalAttribute / 100;
    const fatigueRate = 1 - fatigueResistance * 0.3;
    
    let fatigueMultiplier;
    if (minute < 30) {
      fatigueMultiplier = 1.0;
    } else if (minute < 60) {
      fatigueMultiplier = 1 - ((minute - 30) * 0.003 * fatigueRate);
    } else {
      fatigueMultiplier = 1 - (0.09 + (minute - 60) * 0.005 * fatigueRate);
    }
    
    return Math.max(0.6, fatigueMultiplier);
  }
  
  private getDefendingRoleBonus(role: string): number {
    switch (role) {
      case 'CB1': case 'CB2': case 'CB3': return 1.3;
      case 'RB': case 'LB': case 'WB': return 1.2;
      case 'DM': return 1.25;
      case 'CM': return 1.0;
      case 'AM': case 'WM': return 0.8;
      case 'ST': case 'CF': return 0.6;
      case 'GK': return 1.5;
      default: return 1.0;
    }
  }
  
  private getClearanceArea(ballPos: any, isHome: boolean): string {
    const areas = [
      'up the line', 
      'into the stands', 
      'out for a throw-in', 
      'towards the halfway line',
      'to the wings',
      'into touch'
    ];
    
    // Add context-based clearances
    if (ballPos.y < 30) {
      areas.push('down the left flank');
    } else if (ballPos.y > 70) {
      areas.push('down the right flank');
    }
    
    return areas[Math.floor(Math.random() * areas.length)];
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

  private calculateGoalProbability(context: MatchContext): number {
    const ballPos = context.ballPosition;
    const possession = context.possession;
    
    // Find the player with the ball
    const playerWithBall = this.findPlayerWithBall(context);
    if (!playerWithBall) {
      return 0.001; // Very low probability if no player found
    }
    
    // Get player data to access attributes
    const allPlayers = [...context.homeTeam.players, ...context.awayTeam.players];
    const player = allPlayers.find(p => p.id === playerWithBall.playerId);
    
    let prob = 0.005; // Base probability (0.5%)
    
    // Player attribute influence on shooting
    if (player && player.attributes) {
      // Shooting skill increases probability (0-30 points = 0-90 skill)
      const shootingSkill = player.attributes.shooting || 60;
      prob += (shootingSkill - 50) / 1000; // Each point above 50 adds 0.1%
      
      // Finishing in pressure situations (physical + mental)
      const composure = (player.attributes.physical || 70) / 100;
      prob *= composure;
      
      // Role-based bonuses
      const role = playerWithBall.role || 'CM';
      if (role === 'ST' || role === 'CF') {
        prob *= 1.5; // Strikers get 50% bonus
      } else if (role === 'AM') {
        prob *= 1.2; // Attacking midfielders get 20% bonus
      }
    }
    
    // Position-based probability
    const isHome = possession.team === 'home';
    const distanceFromGoal = isHome ? (100 - ballPos.x) : ballPos.x;
    
    if (distanceFromGoal < 5) {
      prob += 0.15; // Very close to goal - huge bonus
    } else if (distanceFromGoal < 10) {
      prob += 0.08; // Close to goal - big bonus
    } else if (distanceFromGoal < 20) {
      prob += 0.03; // Edge of box - moderate bonus
    }
    
    // Angle to goal - harder from the sides
    const goalY = 50;
    const angleToGoal = Math.abs(ballPos.y - goalY);
    if (angleToGoal > 30) {
      prob *= 0.5; // Harder from wide angles
    } else if (angleToGoal > 15) {
      prob *= 0.7; // Moderate angle difficulty
    }
    
    // One-on-one with goalkeeper
    if (this.isOneOnOne(context, playerWithBall)) {
      prob += 0.25; // Major bonus for one-on-one situations
      console.log(`ONE-ON-ONE: Player ${playerWithBall.playerId} vs GK, probability: ${prob.toFixed(3)}`);
    }
    
    // Momentum bonus
    if (context.momentum === possession.team) {
      prob *= 1.3; // 30% bonus for momentum
    }
    
    // Pressure from defenders
    const nearbyDefenders = this.countNearbyDefenders(context, playerWithBall);
    prob *= Math.max(0.3, 1 - (nearbyDefenders * 0.2)); // Each defender reduces by 20%
    
    return Math.min(prob, 0.6); // Cap at 60% for very favorable situations
  }
  
  private isOneOnOne(context: MatchContext, attacker: any): boolean {
    const ballPos = context.ballPosition;
    const isHome = attacker.team === 'home';
    const goalX = isHome ? 100 : 0;
    
    // Check if attacker is close to goal and has clear path
    const distanceToGoal = Math.abs(ballPos.x - goalX);
    if (distanceToGoal > 25) return false; // Too far from goal
    
    // Count defenders between attacker and goal
    let defendersInPath = 0;
    const opposingTeam = isHome ? 'away' : 'home';
    
    for (const [_, player] of context.playerPositions) {
      if (player.team === opposingTeam && player.role !== 'GK') {
        const playerX = player.x;
        
        // Check if defender is between attacker and goal
        const isBetween = isHome ? 
          (playerX > ballPos.x && playerX < goalX) : 
          (playerX < ballPos.x && playerX > goalX);
          
        if (isBetween) {
          const lateralDistance = Math.abs(player.y - ballPos.y);
          if (lateralDistance < 15) { // Defender is in the path
            defendersInPath++;
          }
        }
      }
    }
    
    return defendersInPath <= 1; // One-on-one if 1 or fewer defenders in path
  }
  
  private countNearbyDefenders(context: MatchContext, attacker: any): number {
    const ballPos = context.ballPosition;
    const opposingTeam = attacker.team === 'home' ? 'away' : 'home';
    let count = 0;
    
    for (const [_, player] of context.playerPositions) {
      if (player.team === opposingTeam) {
        const distance = MathUtils.distance(ballPos.x, ballPos.y, player.x, player.y);
        if (distance < 8) { // Within 8 units
          count++;
        }
      }
    }
    
    return count;
  }

  private getPlayerName(playerId: number, context: MatchContext): string {
    const allPlayers = [...context.homeTeam.players, ...context.awayTeam.players];
    const player = allPlayers.find(p => p.id === playerId);
    return player ? `${player.first_name} ${player.last_name}` : 'Unknown Player';
  }

  private getRandomPlayer(context: MatchContext): any {
    const players = Array.from(context.playerPositions.values());
    return players[Math.floor(Math.random() * players.length)];
  }
  
  private generatePassEvent(context: MatchContext): MatchEvent | null {
    const playerWithBall = this.findPlayerWithBall(context);
    if (!playerWithBall) return null;
    
    const playerName = this.getPlayerName(playerWithBall.playerId, context);
    const minute = Math.floor(context.currentSecond / 60);
    
    // Get player data for multi-factor calculation
    const allPlayers = [...context.homeTeam.players, ...context.awayTeam.players];
    const passerData = allPlayers.find(p => p.id === playerWithBall.playerId);
    if (!passerData) return null;
    
    // Find best passing target using multi-factor analysis
    const passResult = this.calculatePassSuccess(playerWithBall, context, passerData);
    
    if (passResult.success && passResult.target) {
      // Successful pass
      context.possession.playerId = passResult.target.playerId;
      context.possession.timestamp = context.currentSecond;
      
      const targetName = this.getPlayerName(passResult.target.playerId, context);
      
      return {
        minute,
        type: 'pass',
        description: `${playerName} passes to ${targetName}`,
        commentary: this.generatePassCommentary(playerName, targetName, passResult),
        playerId: playerWithBall.playerId,
        team: playerWithBall.team
      };
    } else {
      // Failed pass - possession changes to opposition
      const opposingTeam = playerWithBall.team === 'home' ? 'away' : 'home';
      const interceptor = this.findNearestOpponent(playerWithBall, context);
      
      if (interceptor) {
        context.possession.team = opposingTeam;
        context.possession.playerId = interceptor.playerId;
        context.possession.timestamp = context.currentSecond;
        
        const interceptorName = this.getPlayerName(interceptor.playerId, context);
        
        return {
          minute,
          type: 'interception',
          description: `${playerName}'s pass is intercepted by ${interceptorName}`,
          commentary: `${playerName} attempts a pass but ${interceptorName} reads it perfectly and intercepts!`,
          playerId: interceptor.playerId,
          team: interceptor.team
        };
      }
    }
    
    return null;
  }
  
  private calculatePassSuccess(passer: any, context: MatchContext, passerData: any): {
    success: boolean;
    target: any | null;
    quality: 'poor' | 'average' | 'good' | 'excellent';
    distance: number;
  } {
    // Get passer attributes with fatigue effects
    const fatigueLevel = context.fatigueLevels[passerData.id] || 0;
    const fatigueMultiplier = fatigueLevel > 50 ? Math.max(0.7, 1 - (fatigueLevel - 50) / 100) : 1.0;
    
    const passing = (passerData.attributes?.passing || 60) * fatigueMultiplier;
    const vision = (passerData.attributes?.vision || 60) * fatigueMultiplier;
    const composure = passerData.attributes?.composure || 60;
    
    // Find potential targets
    const possessingTeam = context.possession.team;
    const teammates = Array.from(context.playerPositions.values())
      .filter(p => p.team === possessingTeam && p.playerId !== passer.playerId);
    
    if (teammates.length === 0) {
      return { success: false, target: null, quality: 'poor', distance: 0 };
    }
    
    // Evaluate each potential target
    const targetEvaluations = teammates.map(teammate => {
      const distance = this.calculateDistance(passer.x, passer.y, teammate.x, teammate.y);
      const pressureOnTarget = this.calculatePressureOnPlayer(teammate, context);
      const passingLaneClear = this.isPassingLaneClear(passer, teammate, context);
      
      // Base success probability
      let successProb = Math.min(95, passing * 0.8 + vision * 0.2);
      
      // Distance penalty
      if (distance > 30) {
        successProb -= (distance - 30) * 0.8;
      } else if (distance < 5) {
        successProb -= 10; // Too close passes are awkward
      }
      
      // Pressure penalties
      successProb -= pressureOnTarget * 0.3;
      
      // Passing lane penalty
      if (!passingLaneClear) {
        successProb -= 25;
      }
      
      // Weather effects
      if (context.weather === 'rain') {
        successProb -= 8;
      }
      
      // Composure under pressure
      const pressureOnPasser = this.calculatePressureOnPlayer(passer, context);
      if (pressureOnPasser > 50) {
        successProb += (composure - 60) * 0.2; // Good composure helps under pressure
      }
      
      return {
        teammate,
        distance,
        successProb: Math.max(5, Math.min(95, successProb)),
        quality: this.getPassQuality(successProb)
      };
    });
    
    // Select best target (highest success probability)
    const bestTarget = targetEvaluations.reduce((best, current) => 
      current.successProb > best.successProb ? current : best
    );
    
    // Determine if pass succeeds
    const success = Math.random() * 100 < bestTarget.successProb;
    
    return {
      success,
      target: success ? bestTarget.teammate : null,
      quality: bestTarget.quality,
      distance: bestTarget.distance
    };
  }
  
  private calculateDistance(x1: number, y1: number, x2: number, y2: number): number {
    return Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
  }
  
  private calculatePressureOnPlayer(player: any, context: MatchContext): number {
    const opposingTeam = player.team === 'home' ? 'away' : 'home';
    let pressure = 0;
    
    for (const [_, opponent] of context.playerPositions) {
      if (opponent.team === opposingTeam) {
        const distance = this.calculateDistance(player.x, player.y, opponent.x, opponent.y);
        if (distance < 10) {
          pressure += Math.max(0, 10 - distance) * 8;
        }
      }
    }
    
    return Math.min(100, pressure);
  }
  
  private isPassingLaneClear(passer: any, receiver: any, context: MatchContext): boolean {
    const opposingTeam = passer.team === 'home' ? 'away' : 'home';
    
    for (const [_, opponent] of context.playerPositions) {
      if (opponent.team === opposingTeam) {
        const distanceToLine = this.distanceToLine(
          { x: passer.x, y: passer.y },
          { x: receiver.x, y: receiver.y },
          { x: opponent.x, y: opponent.y }
        );
        
        if (distanceToLine < 4) {
          const passerToOpponent = this.calculateDistance(passer.x, passer.y, opponent.x, opponent.y);
          const passerToReceiver = this.calculateDistance(passer.x, passer.y, receiver.x, receiver.y);
          
          if (passerToOpponent < passerToReceiver) {
            return false;
          }
        }
      }
    }
    
    return true;
  }
  
  private getPassQuality(successProb: number): 'poor' | 'average' | 'good' | 'excellent' {
    if (successProb >= 80) return 'excellent';
    if (successProb >= 65) return 'good';
    if (successProb >= 45) return 'average';
    return 'poor';
  }
  
  private generatePassCommentary(passerName: string, targetName: string, passResult: any): string {
    const qualityPhrases = {
      excellent: ['perfectly weighted', 'sublime', 'inch-perfect', 'exquisite'],
      good: ['well-placed', 'accurate', 'measured', 'precise'],
      average: ['simple', 'straightforward', 'safe'],
      poor: ['hopeful', 'speculative', 'risky']
    };
    
    const phrases = qualityPhrases[passResult.quality as keyof typeof qualityPhrases];
    const phrase = phrases[Math.floor(Math.random() * phrases.length)];
    
    if (passResult.distance > 25) {
      return `${passerName} plays a ${phrase} long ball to ${targetName}.`;
    } else {
      return `${passerName} makes a ${phrase} pass to ${targetName}.`;
    }
  }
  
  private findNearestOpponent(player: any, context: MatchContext): any {
    const opposingTeam = player.team === 'home' ? 'away' : 'home';
    let nearest = null;
    let minDistance = Infinity;
    
    for (const [_, opponent] of context.playerPositions) {
      if (opponent.team === opposingTeam) {
        const distance = this.calculateDistance(player.x, player.y, opponent.x, opponent.y);
        if (distance < minDistance) {
          minDistance = distance;
          nearest = opponent;
        }
      }
    }
    
    return nearest;
  }
  
  private executeGoalReset(context: MatchContext, scoringTeamIsHome: boolean): void {
    console.log(`⚽ GOAL RESET: Resetting positions after goal by ${scoringTeamIsHome ? 'home' : 'away'} team`);
    
    // Reset ball to center circle
    context.ballPosition = {
      x: 50,
      y: 50,
      speed: 0,
      direction: 0,
      status: 'in_play'
    };
    
    // Reset possession to the team that conceded (kickoff rule)
    const kickoffTeam = scoringTeamIsHome ? 'away' : 'home';
    context.possession = {
      team: kickoffTeam,
      playerId: undefined,
      timestamp: context.currentSecond
    };
    
    console.log(`⚽ KICKOFF: ${kickoffTeam} team will have kickoff`);
    
    // Reset all players to their starting positions
    this.resetPlayersToStartingPositions(context);
  }
  
  private resetPlayersToStartingPositions(context: MatchContext): void {
    console.log(`🔄 RESET: Moving all players back to starting positions`);
    
    // Get the PlayerPositionEngine to reset positions
    // We need to recreate the starting positions for both teams
    const homePositions = this.getStartingFormationPositions(context.homeTeam, 'home', context.homeTactic);
    const awayPositions = this.getStartingFormationPositions(context.awayTeam, 'away', context.awayTactic);
    
    // Update all player positions to starting positions
    context.playerPositions.clear();
    
    // Add home team players
    homePositions.forEach((position, playerId) => {
      context.playerPositions.set(playerId, {
        playerId: playerId,
        x: position.x,
        y: position.y,
        speed: 0,
        direction: 0,
        action: 'standing',
        actionTimer: 0, // PHASE 1: Initialize action timer
        currentAction: undefined, // PHASE 1: No current action
        energy: Math.max(60, context.fatigueLevels[playerId.toString()] || 100), // Preserve fatigue but minimum 60%
        role: position.role,
        team: 'home',
        // PHASE 1: Action system properties
        lastActionTick: undefined,
        actionCooldowns: {},
        // ROBUST DESIGN B: Enhanced action states and timers
        actionState: {
          current: 'idle',
          phase: 0,
          canInterrupt: true,
          priority: 0,
          target: undefined
        },
        physicalState: {
          fatigue: context.fatigueLevels[playerId.toString()] || 0,
          balance: 1,
          momentum: { x: 0, y: 0 },
          recovery: 0,
          stamina: 100
        },
        intentTarget: undefined
      });
    });
    
    // Add away team players
    awayPositions.forEach((position, playerId) => {
      context.playerPositions.set(playerId, {
        playerId: playerId,
        x: position.x,
        y: position.y,
        speed: 0,
        direction: 0,
        action: 'standing',
        actionTimer: 0, // PHASE 1: Initialize action timer
        currentAction: undefined, // PHASE 1: No current action
        energy: Math.max(60, context.fatigueLevels[playerId.toString()] || 100), // Preserve fatigue but minimum 60%
        role: position.role,
        team: 'away',
        // PHASE 1: Action system properties
        lastActionTick: undefined,
        actionCooldowns: {},
        // ROBUST DESIGN B: Enhanced action states and timers
        actionState: {
          current: 'idle',
          phase: 0,
          canInterrupt: true,
          priority: 0,
          target: undefined
        },
        physicalState: {
          fatigue: context.fatigueLevels[playerId.toString()] || 0,
          balance: 1,
          momentum: { x: 0, y: 0 },
          recovery: 0,
          stamina: 100
        },
        intentTarget: undefined
      });
    });
    
    console.log(`🔄 RESET COMPLETE: All ${context.playerPositions.size} players moved to starting positions`);
    // Ensure exactly 22 after reset (diagnostic + trim)
    if (context.playerPositions.size > 22) {
      const trimmed = new Map<number, any>();
      let i = 0;
      for (const [id, p] of context.playerPositions) {
        if (i >= 22) break;
        trimmed.set(id, p);
        i++;
      }
      context.playerPositions = trimmed as any;
      console.log(`🚫 RESET TRIM: Reduced players to ${context.playerPositions.size}`);
    }
  }
  
  private getStartingFormationPositions(team: any, teamSide: 'home' | 'away', tactic: any): Map<number, {x: number, y: number, role: string}> {
    const positions = new Map<number, {x: number, y: number, role: string}>();
    const isHome = teamSide === 'home';

    // Sort players by position for proper formation
    const sortedPlayers = team.players.sort((a: any, b: any) => {
      const positionPriority: { [key: string]: number } = {
        'goalkeeper': 1,
        'defender': 2,
        'midfielder': 3,
        'forward': 4
      };
      const aPriority = positionPriority[a.primary_position.category] || 5;
      const bPriority = positionPriority[b.primary_position.category] || 5;
      return aPriority - bPriority;
    });

    // Default to 4-4-2 template
    const template: { defenders: number; midfielders: number; forwards: number } = { defenders: 4, midfielders: 4, forwards: 2 };

    const gks = sortedPlayers.filter((p: any) => p.primary_position?.category === 'goalkeeper');
    const defs = sortedPlayers.filter((p: any) => p.primary_position?.category === 'defender');
    const mids = sortedPlayers.filter((p: any) => p.primary_position?.category === 'midfielder');
    const fwds = sortedPlayers.filter((p: any) => p.primary_position?.category === 'forward');

    const pick = (list: any[], count: number) => list.slice(0, Math.min(count, list.length));

    const chosen: any[] = [];
    // 1 GK
    if (gks.length > 0) chosen.push(gks[0]); else if (sortedPlayers.length > 0) chosen.push(sortedPlayers[0]);
    // Lines by template
    chosen.push(...pick(defs, template.defenders));
    chosen.push(...pick(mids, template.midfielders));
    chosen.push(...pick(fwds, template.forwards));

    // Fill up to 11 if any role short
    const chosenIds = new Set(chosen.map(p => p.id));
    for (const p of sortedPlayers) {
      if (chosen.length >= 11) break;
      if (!chosenIds.has(p.id)) {
        chosen.push(p);
        chosenIds.add(p.id);
      }
    }

    // Build category indices for role mapping
    let defIdx = 0, midIdx = 0, fwdIdx = 0, gkIdx = 0;
    for (const player of chosen.slice(0, 11)) {
      const category = player.primary_position.category;
      let idxForCategory = 0;
      switch (category) {
        case 'goalkeeper': idxForCategory = gkIdx++; break;
        case 'defender': idxForCategory = defIdx++; break;
        case 'midfielder': idxForCategory = midIdx++; break;
        case 'forward': idxForCategory = fwdIdx++; break;
        default: idxForCategory = 0; break;
      }
      const role = this.determinePlayerRole(player, '4-4-2', idxForCategory);
      const position = this.getFormationStartingPosition(role, isHome, idxForCategory);
      positions.set(player.id, { x: position.x, y: position.y, role });
    }

    return positions;
  }
  
  private determinePlayerRole(player: any, formation: string, index: number): string {
    const category = player.primary_position.category;
    
    // Simplified 4-4-2 role mapping (can be enhanced for other formations)
    switch (category) {
      case 'goalkeeper':
        return 'GK';
      case 'defender':
        if (index === 0 || index === 1) return index === 0 ? 'CB1' : 'CB2';
        return index === 2 ? 'RB' : 'LB';
      case 'midfielder':
        if (index <= 1) return 'CM';
        return 'WM';
      case 'forward':
        return 'ST';
      default:
        return 'CM';
    }
  }
  
  private getFormationStartingPosition(role: string, isHome: boolean, index: number): { x: number; y: number } {
    // Standard 4-4-2 formation positions
    switch (role) {
      case 'GK':
        return { x: isHome ? 5 : 95, y: 50 };
      case 'CB1':
        return { x: isHome ? 15 : 85, y: 35 };
      case 'CB2':
        return { x: isHome ? 15 : 85, y: 65 };
      case 'RB':
        return { x: isHome ? 20 : 80, y: 15 };
      case 'LB':
        return { x: isHome ? 20 : 80, y: 85 };
      case 'CM':
        const yPosCM = index % 2 === 0 ? 40 : 60;
        return { x: isHome ? 40 : 60, y: yPosCM };
      case 'WM':
        const yPosWM = index % 2 === 0 ? 20 : 80;
        return { x: isHome ? 50 : 50, y: yPosWM };
      case 'ST':
        const yPosST = index % 2 === 0 ? 40 : 60;
        return { x: isHome ? 80 : 20, y: yPosST };
      default:
        return { x: isHome ? 50 : 50, y: 50 };
    }
  }
  
  // CONTEXTUAL COMMENTARY HELPER METHODS
  private analyzePressureOnPlayer(player: any, context: MatchContext): { level: 'low' | 'medium' | 'high', nearbyOpponents: number, closestDistance: number } {
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
  
  private getNearbyPlayers(player: any, context: MatchContext): { defenders: any[], midfielders: any[], forwards: any[] } {
    const teammates = [];
    
    for (const [_, teammate] of context.playerPositions) {
      if (teammate.team === player.team && teammate.playerId !== player.playerId) {
        const distance = MathUtils.distance(player.x, player.y, teammate.x, teammate.y);
        if (distance < 15) { // Within reasonable passing distance
          teammates.push({ ...teammate, distance });
        }
      }
    }
    
    return {
      defenders: teammates.filter(p => p.role?.includes('B') || p.role?.includes('CB')),
      midfielders: teammates.filter(p => p.role?.includes('M') || p.role === 'DM'),
      forwards: teammates.filter(p => p.role === 'ST' || p.role === 'CF')
    };
  }
  
  private describeFieldPosition(ballPos: any, isHome: boolean): string {
    const x = ballPos.x;
    const y = ballPos.y;
    
    // Describe X position (depth)
    let depthDesc = '';
    if (isHome) {
      if (x < 25) depthDesc = 'deep in his own half';
      else if (x < 50) depthDesc = 'in his own half';
      else if (x < 75) depthDesc = 'in the opponent\'s half';
      else depthDesc = 'high up the pitch';
    } else {
      if (x > 75) depthDesc = 'deep in his own half';
      else if (x > 50) depthDesc = 'in his own half';
      else if (x > 25) depthDesc = 'in the opponent\'s half';
      else depthDesc = 'high up the pitch';
    }
    
    // Describe Y position (width)
    let widthDesc = '';
    if (y < 25) widthDesc = 'on the left flank';
    else if (y > 75) widthDesc = 'on the right flank';
    else widthDesc = 'centrally';
    
    return `${depthDesc} ${widthDesc}`;
  }
  
  private hasSpaceAhead(player: any, context: MatchContext): boolean {
    const isHome = player.team === 'home';
    const forwardDirection = isHome ? 1 : -1;
    const checkDistance = 10;
    
    const aheadX = player.x + (forwardDirection * checkDistance);
    const aheadY = player.y;
    
    // Count opponents in the space ahead
    const opposingTeam = isHome ? 'away' : 'home';
    let opponentsAhead = 0;
    
    for (const [_, opponent] of context.playerPositions) {
      if (opponent.team === opposingTeam) {
        const distance = MathUtils.distance(aheadX, aheadY, opponent.x, opponent.y);
        if (distance < 8) {
          opponentsAhead++;
        }
      }
    }
    
    return opponentsAhead === 0;
  }
  
  private distanceToLine(start: {x: number, y: number}, end: {x: number, y: number}, point: {x: number, y: number}): number {
    const A = point.x - start.x;
    const B = point.y - start.y;
    const C = end.x - start.x;
    const D = end.y - start.y;
    
    const dot = A * C + B * D;
    const lenSq = C * C + D * D;
    
    if (lenSq === 0) return this.calculateDistance(point.x, point.y, start.x, start.y);
    
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
    
    return this.calculateDistance(point.x, point.y, xx, yy);
  }
}