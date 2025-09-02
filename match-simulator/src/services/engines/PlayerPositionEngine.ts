import { MatchContext, PlayerPosition } from '../../types';
import { MathUtils } from '../../utils/MathUtils';
import { TacticalPositionEngine } from './TacticalPositionEngine';
import { EnhancedDecisionAI } from './EnhancedDecisionAI';
import { FatigueEngine } from './FatigueEngine';

export class PlayerPositionEngine {
  private static readonly MAX_PLAYER_SPEED = 8;
  private static readonly SPRINT_SPEED = 12;
  private static readonly WALKING_SPEED = 2;
  private static readonly RUNNING_SPEED = 6;
  
  // Football positioning zones (x: 0-100, y: 0-100)
  private static readonly ZONES = {
    DEFENSIVE_THIRD: { min: 0, max: 33 },
    MIDDLE_THIRD: { min: 33, max: 67 },
    ATTACKING_THIRD: { min: 67, max: 100 },
    PENALTY_AREA: { min: 0, max: 16.5 }, // 16.5% of pitch = penalty area
    GOAL_AREA: { min: 0, max: 5.5 } // 5.5% of pitch = goal area
  };

  initializePlayerPositions(context: MatchContext, team: 'home' | 'away'): Map<number, PlayerPosition> {
    const positions = new Map<number, PlayerPosition>();
    const teamPlayers = team === 'home' ? context.homeTeam.players : context.awayTeam.players;
    
    console.log(`\n=== INITIALIZING ${team.toUpperCase()} TEAM POSITIONS ===`);
    console.log(`Team players count: ${teamPlayers.length}`);
    
    try {
      // Sort players by position for proper formation
      const sortedPlayers = this.sortPlayersByPosition(teamPlayers);
      
      // Create formation positions based on team tactic or default 4-4-2
      const formation = this.getFormation(team === 'home' ? context.homeTactic : context.awayTactic);

      // Select starting XI based on formation to ensure exactly 11 players on the pitch
      const startingEleven = this.selectStartingEleven(sortedPlayers, formation);
      
      console.log(`Formation: ${formation}`);
      console.log('Player positions:');
      
      // Group players by category for proper index-based role mapping (limited to XI)
      const playersByCategory = {
        goalkeeper: startingEleven.filter(p => p.primary_position.category === 'goalkeeper'),
        defender: startingEleven.filter(p => p.primary_position.category === 'defender'),
        midfielder: startingEleven.filter(p => p.primary_position.category === 'midfielder'),
        forward: startingEleven.filter(p => p.primary_position.category === 'forward')
      };
      
      // Process each category separately to get proper indexing
      Object.entries(playersByCategory).forEach(([category, players]) => {
        players.forEach((player, categoryIndex) => {
          const role = this.determinePlayerRole(player, formation, categoryIndex);
          const position = this.getStartingPosition(role, team, categoryIndex);
          
          console.log(`Player ${player.id} (${player.first_name} ${player.last_name}): category=${category}, role=${role}, position=(${position.x}, ${position.y}), TEAM=${team}`);
          
          positions.set(player.id, {
            playerId: player.id,
            x: position.x,
            y: position.y,
            speed: 0,
            direction: 0,
            action: 'standing',
            actionTimer: 0, // PHASE 1: Initialize action timer
            currentAction: undefined, // PHASE 1: No current action
            energy: 100,
            role: role,
            team: team,
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
              fatigue: 0,
              balance: 1,
              momentum: { x: 0, y: 0 },
              recovery: 0,
              stamina: 100
            },
            intentTarget: undefined
          });
        });
      });
      
    } catch (error) {
      console.error(`Error initializing ${team} team positions:`, error);
      // Create fallback positions if something goes wrong
      teamPlayers.forEach((player, index) => {
        positions.set(player.id, {
          playerId: player.id,
          x: team === 'home' ? 20 + (index * 7) : 80 - (index * 7),
          y: 20 + (index * 6),
          speed: 0,
          direction: 0,
          action: 'standing',
          actionTimer: 0, // PHASE 1: Initialize action timer
          currentAction: undefined, // PHASE 1: No current action
          energy: 100,
          role: 'CM',
          team: team,
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
            fatigue: 0,
            balance: 1,
            momentum: { x: 0, y: 0 },
            recovery: 0,
            stamina: 100
          },
          intentTarget: undefined
        });
      });
    }
    
    console.log(`=== ${team.toUpperCase()} TEAM INITIALIZATION COMPLETE ===\n`);
    
    return positions;
  }

  updatePlayerPositions(context: MatchContext): Map<number, PlayerPosition> {
    const updatedPositions = new Map<number, PlayerPosition>();
    
    for (const [playerId, playerPos] of context.playerPositions) {
      const updatedPosition = this.calculatePlayerMovement(playerPos, context);
      updatedPositions.set(playerId, updatedPosition);
    }
    
    return updatedPositions;
  }

  private sortPlayersByPosition(players: any[]): any[] {
    // Sort by position priority: GK, DEF, MID, FWD
    const positionPriority: { [key: string]: number } = {
      'Goalkeeper': 1,
      'Defender': 2,
      'Midfielder': 3,
      'Forward': 4
    };
    
    return players.sort((a, b) => {
      const aPriority = positionPriority[a.primary_position.category] || 5;
      const bPriority = positionPriority[b.primary_position.category] || 5;
      return aPriority - bPriority;
    });
  }

  /**
   * Ensures we pick exactly 11 players per team with a reasonable distribution per formation.
   * Falls back gracefully if squad composition is unusual.
   */
  private selectStartingEleven(players: any[], formation: string): any[] {
    const gks = players.filter(p => p.primary_position?.category === 'goalkeeper');
    const defs = players.filter(p => p.primary_position?.category === 'defender');
    const mids = players.filter(p => p.primary_position?.category === 'midfielder');
    const fwds = players.filter(p => p.primary_position?.category === 'forward');

    // Formation templates: [defenders, midfielders, forwards]
    const templateMap: Record<string, [number, number, number]> = {
      '4-4-2': [4, 4, 2],
      '4-3-3': [4, 3, 3],
      '3-5-2': [3, 5, 2],
      '4-2-3-1': [4, 5, 1],
      '3-4-3': [3, 4, 3]
    };
    const tpl = templateMap[formation] || templateMap['4-4-2'];

    const pick = (list: any[], count: number) => list.slice(0, Math.max(0, Math.min(count, list.length)));

    // Always ensure 1 GK (fallback to any player if no GK exists)
    const chosen: any[] = [];
    if (gks.length > 0) {
      chosen.push(gks[0]);
    } else if (players.length > 0) {
      chosen.push(players[0]);
    }

    // Pick per role based on template
    chosen.push(...pick(defs, tpl[0]));
    chosen.push(...pick(mids, tpl[1]));
    chosen.push(...pick(fwds, tpl[2]));

    // If we still have fewer than 11 (e.g., missing roles), fill from remaining players without duplicates
    const chosenIds = new Set(chosen.map(p => p.id));
    for (const p of players) {
      if (chosen.length >= 11) break;
      if (!chosenIds.has(p.id)) {
        chosen.push(p);
        chosenIds.add(p.id);
      }
    }

    // If somehow more than 11 (duplicated roles), trim to 11 deterministically
    return chosen.slice(0, 11);
  }

  private getFormation(tactic: any): string {
    if (tactic?.formation_id) {
      // Map formation IDs to strings (4-4-2, 4-3-3, etc.)
      const formationMap: { [key: number]: string } = {
        1: '4-4-2',
        2: '4-3-3',
        3: '3-5-2',
        4: '4-2-3-1',
        5: '3-4-3'
      };
      return formationMap[tactic.formation_id] || '4-4-2';
    }
    return '4-4-2'; // Default formation
  }

  private determinePlayerRole(player: any, formation: string, index: number): string {
    const position = player.primary_position.short_name;
    const category = player.primary_position.category;
    
    console.log(`Determining role for player ${player.id}: position=${position}, category=${category}, index=${index}, formation=${formation}`);
    
    // Map positions to roles based on formation
    switch (formation) {
      case '4-4-2':
        return this.map442Roles(position, category, index);
      case '4-3-3':
        return this.map433Roles(position, category, index);
      case '3-5-2':
        return this.map352Roles(position, category, index);
      case '4-2-3-1':
        return this.map4231Roles(position, category, index);
      case '3-4-3':
        return this.map343Roles(position, category, index);
      default:
        return this.map442Roles(position, category, index);
    }
  }

  private map442Roles(position: string, category: string, index: number): string {
    // Simplified 4-4-2 Formation mapping that avoids complex counting
    try {
      switch (category) {
        case 'goalkeeper':
          return 'GK';
        
        case 'defender':
          // Use index to determine defender role - safer than counting
          if (index === 0 || index === 1) return index === 0 ? 'CB1' : 'CB2';
          return index === 2 ? 'RB' : 'LB';
        
        case 'midfielder':
          // Use index to determine midfielder role
          if (index <= 1) return 'CM';  // First two are CMs  
          return 'WM';  // Next two are wide midfielders
        
        case 'forward':
          return 'ST';  // All forwards are strikers
        
        default:
          console.log(`Unknown category: ${category}, defaulting to CM`);
          return 'CM';
      }
    } catch (error) {
      console.error(`Error mapping role for category ${category}:`, error);
      return 'CM'; // Safe fallback
    }
  }

  private map433Roles(position: string, category: string, index: number): string {
    try {
      switch (category) {
        case 'goalkeeper': return 'GK';
        case 'defender':
          if (index <= 1) return index === 0 ? 'CB1' : 'CB2';
          return index === 2 ? 'RB' : 'LB';
        case 'midfielder':
          return index === 0 ? 'DM' : 'CM';
        case 'forward':
          if (index === 0) return 'ST';
          return 'WM'; // Wings in 4-3-3
        default: return 'CM';
      }
    } catch (error) {
      console.error(`Error in map433Roles:`, error);
      return 'CM';
    }
  }

  private map352Roles(position: string, category: string, index: number): string {
    try {
      switch (category) {
        case 'goalkeeper': return 'GK';
        case 'defender': 
          return index <= 2 ? `CB${index + 1}` : 'WB';
        case 'midfielder': 
          return index <= 1 ? 'DM' : 'CM';
        case 'forward': return 'ST';
        default: return 'CM';
      }
    } catch (error) {
      console.error(`Error in map352Roles:`, error);
      return 'CM';
    }
  }

  private map4231Roles(position: string, category: string, index: number): string {
    try {
      switch (category) {
        case 'goalkeeper': return 'GK';
        case 'defender':
          if (index <= 1) return index === 0 ? 'CB1' : 'CB2';
          return index === 2 ? 'RB' : 'LB';
        case 'midfielder':
          if (index <= 1) return 'DM';
          return index <= 4 ? 'AM' : 'WM';
        case 'forward': return 'ST';
        default: return 'CM';
      }
    } catch (error) {
      console.error(`Error in map4231Roles:`, error);
      return 'CM';
    }
  }

  private map343Roles(position: string, category: string, index: number): string {
    try {
      switch (category) {
        case 'goalkeeper': return 'GK';
        case 'defender': return index <= 2 ? `CB${index + 1}` : 'WB';
        case 'midfielder': return index <= 1 ? 'DM' : 'CM';
        case 'forward': return 'ST';
        default: return 'CM';
      }
    } catch (error) {
      console.error(`Error in map343Roles:`, error);
      return 'CM';
    }
  }

  private getStartingPosition(role: string, team: 'home' | 'away', index: number): { x: number; y: number } {
    const isHome = team === 'home';
    
    // Simplified, robust positioning that avoids null references
    try {
      switch (role) {
        case 'GK':
          return { x: isHome ? 5 : 95, y: 50 };
        
        case 'CB1':
          return { x: isHome ? 15 : 85, y: 35 };
        case 'CB2':
          return { x: isHome ? 15 : 85, y: 65 };
        case 'CB3':
          return { x: isHome ? 15 : 85, y: 50 };
        
        case 'RB':
          return { x: isHome ? 20 : 80, y: 15 };
        case 'LB':
          return { x: isHome ? 20 : 80, y: 85 };
        
        case 'WB':
          return { x: isHome ? 25 : 75, y: index % 2 === 0 ? 15 : 85 };
        
        case 'DM':
          return { x: isHome ? 30 : 70, y: 50 };
        
        case 'CM':
          // Simple alternating pattern for central midfielders
          const yPosCM = index % 2 === 0 ? 40 : 60;
          return { x: isHome ? 40 : 60, y: yPosCM };
        
        case 'AM':
          return { x: isHome ? 65 : 35, y: 50 };
        
        case 'WM':
          // Simple alternating pattern for wide midfielders
          const yPosWM = index % 2 === 0 ? 20 : 80;
          return { x: isHome ? 50 : 50, y: yPosWM };
        
        case 'ST':
          // Simple alternating pattern for strikers
          const yPosST = index % 2 === 0 ? 40 : 60;
          return { x: isHome ? 80 : 20, y: yPosST };
        
        case 'CF':
          return { x: isHome ? 75 : 25, y: 50 };
        
        default:
          console.log(`Unknown role: ${role}, using default position`);
          return { x: isHome ? 50 : 50, y: 50 };
      }
    } catch (error) {
      console.error(`Error in getStartingPosition for role ${role}:`, error);
      return { x: isHome ? 50 : 50, y: 50 }; // Safe fallback
    }
  }

  private calculatePlayerMovement(playerPos: PlayerPosition, context: MatchContext): PlayerPosition {
    const ballPos = context.ballPosition;
    const possession = context.possession;
    const isHome = playerPos.team === 'home';
    
    // Check for null ballPosition
    if (!ballPos) {
      console.log('Player position: Ball position is null, keeping player in current position');
      return playerPos; // Return unchanged position if ball position is null
    }
    
    // Determine player action based on role and game situation
    const action = this.determinePlayerAction(playerPos, ballPos, possession, context);
    
    // Calculate target position based on role and action
    const targetPos = this.calculateTargetPosition(playerPos, ballPos, possession, action, context);
    
    // Calculate movement towards target
    const movement = this.calculateMovement(playerPos, targetPos, action);
    
    // Apply zone restrictions based on role
    let restrictedPos = this.applyZoneRestrictions(movement, playerPos.role || 'CM', isHome);

    // Light same-team separation to avoid bunching (repulsion when closer than 3 units)
    restrictedPos = this.applySeparation(restrictedPos, playerPos, context);
    
    // Update fatigue based on action
    const allPlayers = [...context.homeTeam.players, ...context.awayTeam.players];
    const playerData = allPlayers.find(p => p.id === playerPos.playerId);
    
    if (playerData) {
      // Get current fatigue level and apply simple fatigue effect to movement speed
      const fatigueLevel = context.fatigueLevels[playerPos.playerId.toString()] || 0;
      const fatigueEffect = fatigueLevel > 0.5 ? Math.max(0.6, 1 - (fatigueLevel - 0.5) * 2) : 1.0;
      movement.speed *= fatigueEffect;
      
      console.log(`💪 MOVEMENT FATIGUE: Player ${playerPos.playerId} - fatigue: ${(fatigueLevel * 100).toFixed(1)}%, speed: ${(fatigueEffect * 100).toFixed(0)}%`);
    }

    return {
      ...playerPos,
      x: restrictedPos.x,
      y: restrictedPos.y,
      speed: movement.speed,
      direction: movement.direction,
      action: action as any,
      team: playerPos.team // CRITICAL: Explicitly preserve team field
    };
  }

  private determinePlayerAction(playerPos: PlayerPosition, ballPos: any, possession: any, context: MatchContext): string {
    const role = playerPos.role || 'CM';
    const isHome = playerPos.team === 'home';
    const hasPossession = possession.team === playerPos.team;
    
    // Check for null ballPosition
    if (!ballPos) {
      return 'positioning'; // Default action if ball position is null
    }
    
    const distanceToBall = MathUtils.distance(playerPos.x, playerPos.y, ballPos.x, ballPos.y);
    
    // Goalkeeper behavior - keep existing logic for specialized role
    if (role === 'GK') {
      return this.calculateGoalkeeperAction(playerPos, ballPos, isHome);
    }
    
    // Get player data for advanced AI decision making
    const allPlayers = [...context.homeTeam.players, ...context.awayTeam.players];
    const playerData = allPlayers.find(p => p.id === playerPos.playerId);
    
    if (playerData) {
      // 🧠 PHASE 2: USE ENHANCED DECISION AI - Context-driven decisions
      const aiDecision = EnhancedDecisionAI.makeEnhancedDecision(playerPos, context);
      console.log(`🤖 ENHANCED AI DECISION: Player ${playerPos.playerId} (${role}) chose ${aiDecision}`);
      return aiDecision;
    }
    
    // Fallback to previous logic if player data not found
    console.log(`⚠️ FALLBACK: Using simple logic for player ${playerPos.playerId}`);
    
    // Player has possession
    if (hasPossession && distanceToBall < 3) {
      return this.calculatePossessionAction(role, playerPos, ballPos, context);
    }
    
    // Player is closest to ball (should tackle/intercept)
    if (this.isClosestPlayerToBall(playerPos, context)) {
      return 'tackling';
    }
    
    // Use tactical action determination
    const tacticalActions = this.getTacticalPlayerActions(playerPos, ballPos, hasPossession, context);
    if (tacticalActions.length > 0) {
      // Select the most appropriate tactical action
      return this.selectBestTacticalAction(tacticalActions, playerPos, ballPos, context);
    }
    
    // Support behavior based on role
    if (hasPossession) {
      return this.calculateSupportAction(role, playerPos, ballPos, isHome);
    }
    
    // Defensive behavior
    if (!hasPossession) {
      return this.calculateDefensiveAction(role, playerPos, ballPos, isHome);
    }
    
    // Default positioning
    return 'positioning';
  }

  private calculateGoalkeeperAction(playerPos: PlayerPosition, ballPos: any, isHome: boolean): string {
    const distanceToBall = MathUtils.distance(playerPos.x, playerPos.y, ballPos.x, ballPos.y);
    const isInPenaltyArea = isHome ? ballPos.x < 16.5 : ballPos.x > 83.5;
    
    if (distanceToBall < 5 && isInPenaltyArea) {
      return 'tackling'; // Goalkeeper intercepting
    }
    
    return 'positioning'; // Goalkeeper positioning
  }

  private calculatePossessionAction(role: string, playerPos: PlayerPosition, ballPos: any, context: MatchContext): string {
    const isHome = playerPos.team === 'home';
    const isInAttackingArea = isHome ? ballPos.x > 70 : ballPos.x < 30;
    const isInShootingRange = isHome ? ballPos.x > 80 : ballPos.x < 20;
    
    // DYNAMIC POSSESSION ANALYSIS
    const pressureAnalysis = this.analyzePressureOnPlayer(playerPos, context);
    const spaceAnalysis = this.analyzeAvailableSpace(playerPos, ballPos, context);
    const passingOptions = this.analyzePassingOptions(playerPos, context);
    
    console.log(`⚽ POSSESSION DECISION: Player ${playerPos.playerId} (${role}) - Pressure: ${pressureAnalysis.level}, Space: ${spaceAnalysis.hasSpace ? 'YES' : 'NO'}, Passes: ${passingOptions.length}`);
    
    // IMMEDIATE SHOOTING OPPORTUNITY
    if ((role === 'ST' || role === 'CF' || role === 'AM') && isInShootingRange && pressureAnalysis.level !== 'high') {
      if (MathUtils.probability(0.6)) {
        console.log(`🎯 SHOOTING: ${role} taking shot from shooting range`);
        return 'shooting';
      }
    }
    
    // HIGH PRESSURE SITUATIONS - Quick decisions
    if (pressureAnalysis.level === 'high') {
      console.log(`🔥 HIGH PRESSURE: ${pressureAnalysis.nearbyOpponents} opponents within ${pressureAnalysis.closestDistance.toFixed(1)} units`);
      
      // Try to pass quickly if good options available
      if (passingOptions.length > 0 && MathUtils.probability(0.7)) {
        console.log(`⚡ QUICK PASS: Under pressure, playing quick pass`);
        return 'passing';
      }
      
      // Try to dribble out of pressure if player has good dribbling skills
      const playerData = this.getPlayerData(playerPos.playerId, context);
      const dribblingSkill = playerData?.attributes?.dribbling || 60;
      
      if (dribblingSkill > 70 && MathUtils.probability(0.5)) {
        console.log(`🕺 PRESSURE DRIBBLE: High skill player attempting to dribble under pressure`);
        return 'dribbling';
      }
      
      // Default: try to pass or clear
      return MathUtils.probability(0.8) ? 'passing' : 'dribbling';
    }
    
    // MEDIUM PRESSURE - More options
    if (pressureAnalysis.level === 'medium') {
      console.log(`⚠️ MEDIUM PRESSURE: Opponent within ${pressureAnalysis.closestDistance.toFixed(1)} units`);
      
      // In attacking area with space - dribble forward
      if (isInAttackingArea && spaceAnalysis.hasSpace) {
        console.log(`🏃 ATTACKING DRIBBLE: Moving forward in attacking area`);
        return 'dribbling';
      }
      
      // Good passing options available
      if (passingOptions.length >= 2 && MathUtils.probability(0.6)) {
        console.log(`📡 MEASURED PASS: Good passing options available`);
        return 'passing';
      }
      
      // Dribble to create space
      if (MathUtils.probability(0.4)) {
        console.log(`🎭 SPACE CREATION: Dribbling to create space`);
        return 'dribbling';
      }
      
      return 'passing';
    }
    
    // LOW PRESSURE - Freedom to choose
    console.log(`✅ LOW PRESSURE: Freedom to make decisions`);
    
    // In attacking area - be aggressive
    if (isInAttackingArea) {
      if (spaceAnalysis.hasSpace && MathUtils.probability(0.7)) {
        console.log(`⚡ ATTACK DRIBBLE: Space available, dribbling forward aggressively`);
        return 'dribbling';
      }
      
      if (passingOptions.length > 0 && MathUtils.probability(0.5)) {
        console.log(`🎯 ATTACK PASS: Looking for through ball or cross`);
        return 'passing';
      }
    }
    
    // Build-up play - move the ball forward
    if (spaceAnalysis.hasSpace && MathUtils.probability(0.6)) {
      console.log(`🏃 BUILD-UP DRIBBLE: Moving ball forward in build-up`);
      return 'dribbling';
    }
    
    // Look for passing options
    if (passingOptions.length > 0 && MathUtils.probability(0.5)) {
      console.log(`📈 BUILD-UP PASS: Progressing play through passing`);
      return 'passing';
    }
    
    // Default: keep moving with the ball
    console.log(`⚽ DEFAULT DRIBBLE: Continuing with possession`);
    return 'dribbling';
  }

  private calculateSupportAction(role: string, playerPos: PlayerPosition, ballPos: any, isHome: boolean): string {
    const distanceToBall = MathUtils.distance(playerPos.x, playerPos.y, ballPos.x, ballPos.y);
    
    // Move towards ball to support
    if (distanceToBall > 10) {
      return 'running';
    }
    
    // Find space for pass
    return 'positioning';
  }

  private calculateDefensiveAction(role: string, playerPos: PlayerPosition, ballPos: any, isHome: boolean): string {
    const distanceToBall = MathUtils.distance(playerPos.x, playerPos.y, ballPos.x, ballPos.y);
    
    // Close down ball carrier
    if (distanceToBall < 8) {
      return 'tackling';
    }
    
    // Mark space or track back
    return 'positioning';
  }

  private isClosestPlayerToBall(playerPos: PlayerPosition, context: MatchContext): boolean {
    const ballPos = context.ballPosition;
    
    // Check for null ballPosition
    if (!ballPos) {
      return false; // No player is closest if ball position is null
    }
    
    const playerDistance = MathUtils.distance(playerPos.x, playerPos.y, ballPos.x, ballPos.y);

    // Only allow one chaser per team to avoid swarming the ball
    const sameTeamChasers = Array.from(context.playerPositions.values()).filter(p => p.team === playerPos.team)
      .sort((a, b) => MathUtils.distance(a.x, a.y, ballPos.x, ballPos.y) - MathUtils.distance(b.x, b.y, ballPos.x, ballPos.y));
    const isPrimaryChaser = sameTeamChasers.length > 0 && sameTeamChasers[0].playerId === playerPos.playerId;
    if (!isPrimaryChaser) return false;
    
    for (const [_, otherPlayer] of context.playerPositions) {
      if (otherPlayer.playerId === playerPos.playerId) continue;
      
      const otherDistance = MathUtils.distance(otherPlayer.x, otherPlayer.y, ballPos.x, ballPos.y);
      if (otherDistance < playerDistance) {
        return false;
      }
    }
    
    return true;
  }

  private calculateTargetPosition(playerPos: PlayerPosition, ballPos: any, possession: any, action: string, context: MatchContext): { x: number; y: number } {
    const role = playerPos.role || 'CM';
    const isHome = playerPos.team === 'home';
    
    // ALWAYS start with tactical position as base
    const tacticalPosition = this.getTacticalFormationPosition(playerPos, context);
    const distanceToBall = MathUtils.distance(playerPos.x, playerPos.y, ballPos.x, ballPos.y);
    
    switch (action) {
      case 'tackling':
        // Only approach ball if player is close enough and not breaking formation too much
        if (distanceToBall < 8 && this.canLeavePosition(playerPos, ballPos, context)) {
          return this.getControlledApproachPosition(playerPos, ballPos, tacticalPosition);
        }
        return tacticalPosition;
      
      case 'shooting':
        return { x: isHome ? 95 : 5, y: 50 };
      
      case 'passing':
        return this.findPassTarget(playerPos, context);
      
      case 'dribbling':
        // DYNAMIC DRIBBLING: Move based on space analysis and pressure
        return this.calculateDribblingTarget(playerPos, ballPos, tacticalPosition, context);
      
      case 'running':
        // Support movement towards ball but don't abandon position completely
        if (distanceToBall < 12 && this.canLeavePosition(playerPos, ballPos, context)) {
          return this.getControlledSupportPosition(playerPos, ballPos, tacticalPosition);
        }
        return tacticalPosition;
      
      case 'positioning':
      default:
        return tacticalPosition;
    }
  }

  private findPassTarget(playerPos: PlayerPosition, context: MatchContext): { x: number; y: number } {
    const isHome = playerPos.team === 'home';
    const targetX = isHome ? playerPos.x + 20 : playerPos.x - 20;
    
    // Find teammate in good position
    for (const [_, teammate] of context.playerPositions) {
      if (teammate.team !== playerPos.team) continue;
      if (teammate.playerId === playerPos.playerId) continue;
      
      const distance = MathUtils.distance(playerPos.x, playerPos.y, teammate.x, teammate.y);
      if (distance > 5 && distance < 40) {
        return { x: teammate.x, y: teammate.y };
      }
    }
    
    return { x: targetX, y: playerPos.y };
  }

  private getTacticalFormationPosition(playerPos: PlayerPosition, context: MatchContext): { x: number; y: number } {
    const role = playerPos.role || 'CM';
    const isHome = playerPos.team === 'home';
    
    // Get player data for tactical decision making
    const allPlayers = [...context.homeTeam.players, ...context.awayTeam.players];
    const playerData = allPlayers.find(p => p.id === playerPos.playerId);
    
    // Use the tactical position engine for realistic positioning
    const tacticalPosition = TacticalPositionEngine.getTacticalPosition(
      role,
      isHome,
      context,
      playerData
    );
    
    console.log(`🎯 TACTICAL POSITIONING: Player ${playerPos.playerId} (${role}) positioned at (${tacticalPosition.x.toFixed(1)}, ${tacticalPosition.y.toFixed(1)})`);
    
    return tacticalPosition;
  }

  private getFormationPosition(role: string, isHome: boolean, context: MatchContext): { x: number; y: number } {
    const ballPos = context.ballPosition;
    const possession = context.possession;
    const hasPossession = possession.team === (isHome ? 'home' : 'away');
    
    // Defensive line positioning based on ball position and possession
    let defensiveLineX = isHome ? 20 : 80;
    let midfieldLineX = isHome ? 40 : 60;
    let attackingLineX = isHome ? 70 : 30;
    
    if (ballPos) {
      if (hasPossession) {
        // Push forward when in possession
        defensiveLineX = isHome ? Math.min(35, ballPos.x - 15) : Math.max(65, ballPos.x + 15);
        midfieldLineX = isHome ? Math.min(55, ballPos.x + 10) : Math.max(45, ballPos.x - 10);
      } else {
        // Compact defense when not in possession
        defensiveLineX = isHome ? Math.max(15, Math.min(25, ballPos.x - 20)) : Math.min(85, Math.max(75, ballPos.x + 20));
        midfieldLineX = isHome ? Math.max(25, Math.min(45, ballPos.x - 10)) : Math.min(75, Math.max(55, ballPos.x + 10));
      }
    }
    
    switch (role) {
      case 'GK':
        // Goalkeeper positioning based on ball position
        let gkX = isHome ? 8 : 92;
        if (ballPos) {
          const dangerZone = isHome ? ballPos.x < 25 : ballPos.x > 75;
          if (dangerZone) {
            gkX = isHome ? Math.min(12, ballPos.x + 5) : Math.max(88, ballPos.x - 5);
          }
        }
        return { x: gkX, y: ballPos ? Math.max(30, Math.min(70, ballPos.y)) : 50 };
      
      case 'CB1':
        return { 
          x: defensiveLineX, 
          y: ballPos ? Math.max(25, Math.min(45, ballPos.y - 10)) : 35 
        };
      case 'CB2':
        return { 
          x: defensiveLineX, 
          y: ballPos ? Math.max(55, Math.min(75, ballPos.y + 10)) : 65 
        };
      case 'CB3':
        return { 
          x: defensiveLineX, 
          y: ballPos ? Math.max(40, Math.min(60, ballPos.y)) : 50 
        };
      
      case 'RB':
        return { 
          x: defensiveLineX + (isHome ? 5 : -5), 
          y: ballPos ? Math.max(5, Math.min(25, ballPos.y - 15)) : 15 
        };
      case 'LB':
        return { 
          x: defensiveLineX + (isHome ? 5 : -5), 
          y: ballPos ? Math.max(75, Math.min(95, ballPos.y + 15)) : 85 
        };
      
      case 'WB':
        const wbY = ballPos ? (ballPos.y < 50 ? 20 : 80) : 50;
        return { x: defensiveLineX + (isHome ? 10 : -10), y: wbY };
      
      case 'DM':
        return { 
          x: defensiveLineX + (isHome ? 10 : -10), 
          y: ballPos ? Math.max(35, Math.min(65, ballPos.y)) : 50 
        };
      
      case 'CM':
        return { 
          x: midfieldLineX, 
          y: ballPos ? Math.max(30, Math.min(70, ballPos.y)) : 50 
        };
      
      case 'AM':
        return { 
          x: midfieldLineX + (isHome ? 15 : -15), 
          y: ballPos ? Math.max(35, Math.min(65, ballPos.y)) : 50 
        };
      
      case 'WM':
        const wmY = ballPos ? (ballPos.y < 50 ? 25 : 75) : 50;
        return { x: midfieldLineX, y: wmY };
      
      case 'ST':
        return { 
          x: attackingLineX, 
          y: ballPos ? Math.max(35, Math.min(65, ballPos.y)) : 50 
        };
      
      case 'CF':
        return { 
          x: attackingLineX - (isHome ? 10 : -10), 
          y: ballPos ? Math.max(40, Math.min(60, ballPos.y)) : 50 
        };
      
      default:
        return { x: isHome ? 50 : 50, y: 50 };
    }
  }

  private calculateMovement(currentPos: PlayerPosition, targetPos: { x: number; y: number }, action: string): { x: number; y: number; speed: number; direction: number } {
    const distance = MathUtils.distance(currentPos.x, currentPos.y, targetPos.x, targetPos.y);
    
    if (distance < 1) {
      return { x: currentPos.x, y: currentPos.y, speed: 0, direction: 0 };
    }
    
    const direction = Math.atan2(targetPos.y - currentPos.y, targetPos.x - currentPos.x);
    let speed = this.getActionSpeed(action);
    
    // Reduce speed if very close to target
    if (distance < 3) {
      speed *= 0.5;
    }
    
    const newX = currentPos.x + Math.cos(direction) * speed * 0.1;
    const newY = currentPos.y + Math.sin(direction) * speed * 0.1;
    
    return { x: newX, y: newY, speed, direction };
  }

  private getActionSpeed(action: string): number {
    switch (action) {
      case 'sprinting':
        return PlayerPositionEngine.SPRINT_SPEED;
      case 'running':
        return PlayerPositionEngine.RUNNING_SPEED;
      case 'walking':
        return PlayerPositionEngine.WALKING_SPEED;
      case 'tackling':
        return PlayerPositionEngine.SPRINT_SPEED;
      case 'shooting':
        return 0; // Player stops to shoot
      case 'passing':
        return 0; // Player stops to pass
      case 'dribbling':
        return PlayerPositionEngine.RUNNING_SPEED;
      case 'positioning':
      default:
        return PlayerPositionEngine.WALKING_SPEED;
    }
  }

  private applyZoneRestrictions(position: { x: number; y: number }, role: string, isHome: boolean): { x: number; y: number } {
    let restrictedX = position.x;
    let restrictedY = position.y;
    
    // Apply STRICT role-based zone restrictions to maintain formation
    switch (role) {
      case 'GK':
        // Goalkeeper MUST stay in penalty area
        restrictedX = isHome ? Math.max(0, Math.min(16.5, position.x)) : Math.max(83.5, Math.min(100, position.x));
        restrictedY = Math.max(25, Math.min(75, position.y));
        break;
      
      case 'CB1':
      case 'CB2':
      case 'CB3':
        // Center backs MUST stay in defensive third with stricter limits
        restrictedX = isHome ? Math.max(5, Math.min(35, position.x)) : Math.max(65, Math.min(95, position.x));
        restrictedY = Math.max(25, Math.min(75, position.y));
        break;
      
      case 'RB':
        // Right back stays on right side with defensive bias
        restrictedX = isHome ? Math.max(5, Math.min(70, position.x)) : Math.max(30, Math.min(95, position.x));
        restrictedY = Math.max(50, Math.min(95, position.y)); // Right side
        break;
        
      case 'LB':
        // Left back stays on left side with defensive bias  
        restrictedX = isHome ? Math.max(5, Math.min(70, position.x)) : Math.max(30, Math.min(95, position.x));
        restrictedY = Math.max(5, Math.min(50, position.y)); // Left side
        break;
      
      case 'WB':
        // Wing backs can go further forward but stay on their side
        restrictedY = Math.max(10, Math.min(90, position.y));
        break;
      
      case 'DM':
        // Defensive midfielder MUST shield the defense
        restrictedX = isHome ? Math.max(15, Math.min(50, position.x)) : Math.max(50, Math.min(85, position.x));
        restrictedY = Math.max(30, Math.min(70, position.y));
        break;
      
      case 'CM':
        // Central midfielder with tighter restrictions to prevent clustering
        restrictedX = isHome ? Math.max(25, Math.min(70, position.x)) : Math.max(30, Math.min(75, position.x));
        restrictedY = Math.max(30, Math.min(70, position.y));
        break;
      
      case 'AM':
        // Attacking midfielder stays forward but not too far
        restrictedX = isHome ? Math.max(40, Math.min(90, position.x)) : Math.max(10, Math.min(60, position.x));
        restrictedY = Math.max(30, Math.min(70, position.y));
        break;
      
      case 'WM':
        // Wide midfielders MUST stay on their flanks
        restrictedX = isHome ? Math.max(30, Math.min(85, position.x)) : Math.max(15, Math.min(70, position.x));
        // Determine if right or left winger based on current Y position
        if (position.y > 50) {
          restrictedY = Math.max(55, Math.min(95, position.y)); // Right wing
        } else {
          restrictedY = Math.max(5, Math.min(45, position.y)); // Left wing
        }
        break;
      
      case 'ST':
      case 'CF':
        // Strikers MUST stay in attacking areas
        restrictedX = isHome ? Math.max(60, Math.min(95, position.x)) : Math.max(5, Math.min(40, position.x));
        restrictedY = Math.max(30, Math.min(70, position.y));
        break;
    }
    
    // Ensure position is within pitch boundaries
    restrictedX = Math.max(0, Math.min(100, restrictedX));
    restrictedY = Math.max(0, Math.min(100, restrictedY));
    
    // Log excessive movement for debugging
    const originalDistance = MathUtils.distance(position.x, position.y, restrictedX, restrictedY);
    if (originalDistance > 5) {
      console.log(`🚫 ZONE RESTRICTION: ${role} moved from (${position.x.toFixed(1)}, ${position.y.toFixed(1)}) to (${restrictedX.toFixed(1)}, ${restrictedY.toFixed(1)}) - distance: ${originalDistance.toFixed(1)}`);
    }
    
    return { x: restrictedX, y: restrictedY };
  }

  /**
   * Simple local separation to reduce clustering: repels from nearest 2 same-team players if too close.
   */
  private applySeparation(position: { x: number; y: number }, playerPos: PlayerPosition, context: MatchContext): { x: number; y: number } {
    const MIN_DISTANCE = 3; // percent units on pitch coordinates
    const REPULSION = 0.8;  // strength of repulsion step per tick
    let sx = position.x;
    let sy = position.y;

    let adjustments = 0;
    for (const [_, teammate] of context.playerPositions) {
      if (teammate.playerId === playerPos.playerId) continue;
      if (teammate.team !== playerPos.team) continue;
      const dx = sx - teammate.x;
      const dy = sy - teammate.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > 0 && dist < MIN_DISTANCE) {
        const factor = (MIN_DISTANCE - dist) / MIN_DISTANCE;
        sx += (dx / dist) * REPULSION * factor;
        sy += (dy / dist) * REPULSION * factor;
        adjustments++;
        if (adjustments >= 2) break; // only repel using nearest two
      }
    }

    // Keep inside field bounds
    sx = Math.max(0, Math.min(100, sx));
    sy = Math.max(0, Math.min(100, sy));
    return { x: sx, y: sy };
  }

  private getTacticalPlayerActions(playerPos: PlayerPosition, ballPos: any, hasPossession: boolean, context: MatchContext): string[] {
    const role = playerPos.role || 'CM';
    
    // Get player data for tactical decision making
    const allPlayers = [...context.homeTeam.players, ...context.awayTeam.players];
    const playerData = allPlayers.find(p => p.id === playerPos.playerId);
    
    // Use the tactical position engine to get possible actions
    const tacticalActions = TacticalPositionEngine.getPlayerActions(
      role,
      { x: playerPos.x, y: playerPos.y },
      ballPos,
      hasPossession,
      playerData
    );
    
    return tacticalActions;
  }
  
  private selectBestTacticalAction(actions: string[], playerPos: PlayerPosition, ballPos: any, context: MatchContext): string {
    const role = playerPos.role || 'CM';
    const isHome = playerPos.team === 'home';
    const distanceToBall = MathUtils.distance(playerPos.x, playerPos.y, ballPos.x, ballPos.y);
    
    // Priority-based action selection based on context
    const actionPriorities: { [key: string]: number } = {
      'shoot': distanceToBall < 15 && this.isInShootingPosition(playerPos, isHome) ? 100 : 0,
      'finish': distanceToBall < 10 && this.isInShootingPosition(playerPos, isHome) ? 95 : 0,
      'cross': this.isInCrossingPosition(playerPos, isHome) ? 90 : 0,
      'pass_forward': 80,
      'key_pass': 85,
      'through_ball': 85,
      'tackle': distanceToBall < 8 ? 75 : 0,
      'interception': 70,
      'press': 60,
      'overlap': role.includes('B') ? 65 : 0,
      'track_back': 55,
      'shield_defense': role === 'DM' ? 70 : 0,
      'link_up': role === 'AM' ? 75 : 0,
      'run_behind': role === 'ST' ? 80 : 0
    };
    
    // Find the highest priority action available
    let bestAction = 'positioning';
    let bestPriority = 0;
    
    for (const action of actions) {
      const priority = actionPriorities[action] || 30;
      if (priority > bestPriority) {
        bestPriority = priority;
        bestAction = this.mapTacticalActionToMovementAction(action);
      }
    }
    
    console.log(`🎯 TACTICAL ACTION: Player ${playerPos.playerId} (${role}) selected "${bestAction}" from [${actions.join(', ')}]`);
    
    return bestAction;
  }
  
  private mapTacticalActionToMovementAction(tacticalAction: string): string {
    // Map tactical actions to movement/animation actions
    const actionMap: { [key: string]: string } = {
      'shoot': 'shooting',
      'finish': 'shooting', 
      'header': 'shooting',
      'cross': 'passing',
      'pass_forward': 'passing',
      'pass_short': 'passing',
      'pass_switch': 'passing',
      'key_pass': 'passing',
      'through_ball': 'passing',
      'distribute': 'passing',
      'progressive_pass': 'passing',
      'assist': 'passing',
      'tackle': 'tackling',
      'interception': 'tackling',
      'block': 'tackling',
      'clearance': 'tackling',
      'press': 'running',
      'press_forward': 'running',
      'press_high': 'running',
      'track_back': 'running',
      'defensive_recovery': 'running',
      'overlap': 'running',
      'run_behind': 'running',
      'late_run': 'running',
      'box_to_box_run': 'running',
      'dribble': 'dribbling',
      'dribble_forward': 'dribbling',
      'cut_inside': 'dribbling',
      'hold_up_play': 'positioning',
      'link_up': 'positioning',
      'shield_defense': 'positioning',
      'aerial_duel': 'positioning',
      'sweeping': 'positioning',
      'shot_stopping': 'positioning',
      'distribution_short': 'passing',
      'distribution_long': 'passing'
    };
    
    return actionMap[tacticalAction] || 'positioning';
  }
  
  private isInShootingPosition(playerPos: PlayerPosition, isHome: boolean): boolean {
    const x = playerPos.x;
    return isHome ? x > 85 : x < 15;
  }
  
  private isInCrossingPosition(playerPos: PlayerPosition, isHome: boolean): boolean {
    const x = playerPos.x;
    const y = playerPos.y;
    
    if (isHome) {
      return x > 70 && (y < 20 || y > 80);
    } else {
      return x < 30 && (y < 20 || y > 80);
    }
  }
  
  private canLeavePosition(playerPos: PlayerPosition, ballPos: any, context: MatchContext): boolean {
    const role = playerPos.role || 'CM';
    const distanceToBall = MathUtils.distance(playerPos.x, playerPos.y, ballPos.x, ballPos.y);
    
    // Goalkeepers should rarely leave their area
    if (role === 'GK') {
      const isHome = playerPos.team === 'home';
      const dangerZone = isHome ? ballPos.x < 16.5 : ballPos.x > 83.5;
      return dangerZone && distanceToBall < 8;
    }
    
    // Defenders can leave position only if ball is in their zone
    if (role.includes('CB') || role.includes('B')) {
      const isHome = playerPos.team === 'home';
      const isInDefensiveZone = isHome ? ballPos.x < 40 : ballPos.x > 60;
      return isInDefensiveZone;
    }
    
    // Midfielders have more freedom but should stay within reasonable range
    if (role.includes('M') || role === 'DM') {
      return distanceToBall < 25;
    }
    
    // Forwards can be more aggressive in chasing the ball
    if (role === 'ST' || role === 'CF') {
      return distanceToBall < 30;
    }
    
    return true; // Default allow movement
  }
  
  private getControlledApproachPosition(playerPos: PlayerPosition, ballPos: any, tacticalPosition: any): { x: number; y: number } {
    // Move towards ball but only 30% of the way, keeping tactical discipline
    const approachFactor = 0.3;
    
    const targetX = tacticalPosition.x + (ballPos.x - tacticalPosition.x) * approachFactor;
    const targetY = tacticalPosition.y + (ballPos.y - tacticalPosition.y) * approachFactor;
    
    // Ensure we don't move too far from tactical position
    const maxDistance = 15;
    const distance = MathUtils.distance(tacticalPosition.x, tacticalPosition.y, targetX, targetY);
    
    if (distance > maxDistance) {
      const direction = Math.atan2(targetY - tacticalPosition.y, targetX - tacticalPosition.x);
      return {
        x: tacticalPosition.x + Math.cos(direction) * maxDistance,
        y: tacticalPosition.y + Math.sin(direction) * maxDistance
      };
    }
    
    return { x: targetX, y: targetY };
  }
  
  private getControlledSupportPosition(playerPos: PlayerPosition, ballPos: any, tacticalPosition: any): { x: number; y: number } {
    // Support movement that maintains formation structure
    const supportFactor = 0.2; // Even more conservative for support moves
    
    const targetX = tacticalPosition.x + (ballPos.x - tacticalPosition.x) * supportFactor;
    const targetY = tacticalPosition.y + (ballPos.y - tacticalPosition.y) * supportFactor;
    
    // Stricter distance limits for support movements
    const maxDistance = 10;
    const distance = MathUtils.distance(tacticalPosition.x, tacticalPosition.y, targetX, targetY);
    
    if (distance > maxDistance) {
      const direction = Math.atan2(targetY - tacticalPosition.y, targetX - tacticalPosition.x);
      return {
        x: tacticalPosition.x + Math.cos(direction) * maxDistance,
        y: tacticalPosition.y + Math.sin(direction) * maxDistance
      };
    }
    
    return { x: targetX, y: targetY };
  }
  
  private analyzePressureOnPlayer(playerPos: PlayerPosition, context: MatchContext): { level: 'low' | 'medium' | 'high', nearbyOpponents: number, closestDistance: number } {
    const opposingTeam = playerPos.team === 'home' ? 'away' : 'home';
    let nearbyOpponents = 0;
    let closestDistance = Infinity;
    
    for (const [_, opponent] of context.playerPositions) {
      if (opponent.team === opposingTeam) {
        const distance = MathUtils.distance(playerPos.x, playerPos.y, opponent.x, opponent.y);
        
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
  
  private analyzeAvailableSpace(playerPos: PlayerPosition, ballPos: any, context: MatchContext): { hasSpace: boolean, direction: number, spaceDistance: number } {
    const isHome = playerPos.team === 'home';
    const opposingTeam = isHome ? 'away' : 'home';
    
    // Check space in forward direction
    const forwardDirection = isHome ? 0 : Math.PI; // East for home, west for away
    const spaceCheckDistance = 15;
    
    const checkX = playerPos.x + Math.cos(forwardDirection) * spaceCheckDistance;
    const checkY = playerPos.y + Math.sin(forwardDirection) * spaceCheckDistance;
    
    // Count opponents in the forward space
    let opponentsInSpace = 0;
    for (const [_, opponent] of context.playerPositions) {
      if (opponent.team === opposingTeam) {
        const distance = MathUtils.distance(checkX, checkY, opponent.x, opponent.y);
        if (distance < 8) {
          opponentsInSpace++;
        }
      }
    }
    
    // Also check lateral space (left and right)
    const lateralDirections = [forwardDirection + Math.PI/2, forwardDirection - Math.PI/2];
    let bestDirection = forwardDirection;
    let maxSpace = opponentsInSpace === 0 ? spaceCheckDistance : 0;
    
    for (const direction of lateralDirections) {
      const lateralX = playerPos.x + Math.cos(direction) * spaceCheckDistance;
      const lateralY = playerPos.y + Math.sin(direction) * spaceCheckDistance;
      
      let opponentsInLateralSpace = 0;
      for (const [_, opponent] of context.playerPositions) {
        if (opponent.team === opposingTeam) {
          const distance = MathUtils.distance(lateralX, lateralY, opponent.x, opponent.y);
          if (distance < 8) {
            opponentsInLateralSpace++;
          }
        }
      }
      
      if (opponentsInLateralSpace === 0 && maxSpace === 0) {
        bestDirection = direction;
        maxSpace = spaceCheckDistance;
      }
    }
    
    return {
      hasSpace: maxSpace > 0,
      direction: bestDirection,
      spaceDistance: maxSpace
    };
  }
  
  private analyzePassingOptions(playerPos: PlayerPosition, context: MatchContext): Array<{ teammate: any, distance: number, quality: 'safe' | 'progressive' | 'risky' }> {
    const passingOptions = [];
    
    for (const [_, teammate] of context.playerPositions) {
      if (teammate.team !== playerPos.team || teammate.playerId === playerPos.playerId) {
        continue;
      }
      
      const distance = MathUtils.distance(playerPos.x, playerPos.y, teammate.x, teammate.y);
      
      // Only consider reasonable passing distances
      if (distance > 40 || distance < 3) {
        continue;
      }
      
      // Check if passing lane is clear
      const isLaneClear = this.isPassingLaneClear(playerPos, teammate, context);
      if (!isLaneClear) {
        continue;
      }
      
      // Determine pass quality
      let quality: 'safe' | 'progressive' | 'risky';
      const isHome = playerPos.team === 'home';
      const isProgressive = isHome ? teammate.x > playerPos.x + 5 : teammate.x < playerPos.x - 5;
      
      if (distance < 15 && !isProgressive) {
        quality = 'safe';
      } else if (isProgressive && distance < 25) {
        quality = 'progressive';
      } else {
        quality = 'risky';
      }
      
      passingOptions.push({ teammate, distance, quality });
    }
    
    // Sort by quality: progressive > safe > risky
    passingOptions.sort((a, b) => {
      const qualityOrder = { 'progressive': 0, 'safe': 1, 'risky': 2 };
      return qualityOrder[a.quality] - qualityOrder[b.quality];
    });
    
    return passingOptions.slice(0, 5); // Return top 5 options
  }
  
  private isPassingLaneClear(passer: PlayerPosition, receiver: any, context: MatchContext): boolean {
    const opposingTeam = passer.team === 'home' ? 'away' : 'home';
    
    // Check if any opponent is blocking the passing lane
    for (const [_, opponent] of context.playerPositions) {
      if (opponent.team === opposingTeam) {
        const distanceToPassingLine = this.distanceToLine(
          { x: passer.x, y: passer.y },
          { x: receiver.x, y: receiver.y },
          { x: opponent.x, y: opponent.y }
        );
        
        // If opponent is close to the passing line and between passer and receiver
        if (distanceToPassingLine < 3) {
          const passerToOpponent = MathUtils.distance(passer.x, passer.y, opponent.x, opponent.y);
          const passerToReceiver = MathUtils.distance(passer.x, passer.y, receiver.x, receiver.y);
          
          if (passerToOpponent < passerToReceiver) {
            return false; // Opponent blocks the pass
          }
        }
      }
    }
    
    return true; // Passing lane is clear
  }
  
  private distanceToLine(start: {x: number, y: number}, end: {x: number, y: number}, point: {x: number, y: number}): number {
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
  
  private getPlayerData(playerId: number, context: MatchContext): any {
    const allPlayers = [...context.homeTeam.players, ...context.awayTeam.players];
    return allPlayers.find(p => p.id === playerId);
  }
  
  private calculateDribblingTarget(playerPos: PlayerPosition, ballPos: any, tacticalPosition: any, context: MatchContext): { x: number; y: number } {
    const isHome = playerPos.team === 'home';
    const spaceAnalysis = this.analyzeAvailableSpace(playerPos, ballPos, context);
    const pressureAnalysis = this.analyzePressureOnPlayer(playerPos, context);
    
    // Get player's dribbling ability
    const playerData = this.getPlayerData(playerPos.playerId, context);
    const dribblingSkill = playerData?.attributes?.dribbling || 60;
    
    // Base movement distance based on skill and pressure
    let moveDistance = 3; // Base distance
    
    if (dribblingSkill > 80) {
      moveDistance = 6; // Skilled dribblers move more
    } else if (dribblingSkill > 70) {
      moveDistance = 4.5;
    }
    
    // Adjust for pressure
    if (pressureAnalysis.level === 'high') {
      moveDistance *= 0.6; // Smaller movements under pressure
    } else if (pressureAnalysis.level === 'low') {
      moveDistance *= 1.4; // Longer movements when free
    }
    
    // Direction of movement
    let targetDirection = isHome ? 0 : Math.PI; // Default forward
    
    if (spaceAnalysis.hasSpace) {
      // Move in the direction where space is available
      targetDirection = spaceAnalysis.direction;
      console.log(`🚀 SPACE DRIBBLE: Moving in direction with space, distance: ${moveDistance.toFixed(1)}`);
    } else {
      // Try to move around pressure
      if (pressureAnalysis.level === 'high') {
        // Look for escape direction
        const escapeDirection = this.findEscapeDirection(playerPos, context);
        if (escapeDirection !== null) {
          targetDirection = escapeDirection;
          console.log(`🏃 ESCAPE DRIBBLE: Escaping pressure`);
        }
      }
    }
    
    // Calculate target position
    let targetX = playerPos.x + Math.cos(targetDirection) * moveDistance;
    let targetY = playerPos.y + Math.sin(targetDirection) * moveDistance;
    
    // Keep within tactical constraints (don't move too far from tactical position)
    const tacticalDistance = MathUtils.distance(targetX, targetY, tacticalPosition.x, tacticalPosition.y);
    const maxTacticalDistance = 12; // Allow some freedom but not too much
    
    if (tacticalDistance > maxTacticalDistance) {
      const tacticalDirection = Math.atan2(tacticalPosition.y - playerPos.y, tacticalPosition.x - playerPos.x);
      const compromiseDirection = (targetDirection + tacticalDirection) / 2; // Average of desired and tactical direction
      
      targetX = playerPos.x + Math.cos(compromiseDirection) * (moveDistance * 0.7);
      targetY = playerPos.y + Math.sin(compromiseDirection) * (moveDistance * 0.7);
      
      console.log(`⚖️  TACTICAL COMPROMISE: Balancing dribbling desire with tactical position`);
    }
    
    // Ensure within pitch boundaries
    targetX = Math.max(0, Math.min(100, targetX));
    targetY = Math.max(0, Math.min(100, targetY));
    
    console.log(`⚽ DRIBBLE TARGET: Player ${playerPos.playerId} moving from (${playerPos.x.toFixed(1)}, ${playerPos.y.toFixed(1)}) to (${targetX.toFixed(1)}, ${targetY.toFixed(1)})`);
    
    return { x: targetX, y: targetY };
  }
  
  private findEscapeDirection(playerPos: PlayerPosition, context: MatchContext): number | null {
    const opposingTeam = playerPos.team === 'home' ? 'away' : 'home';
    const testDirections = [0, Math.PI/4, Math.PI/2, 3*Math.PI/4, Math.PI, 5*Math.PI/4, 3*Math.PI/2, 7*Math.PI/4];
    
    for (const direction of testDirections) {
      const testX = playerPos.x + Math.cos(direction) * 8;
      const testY = playerPos.y + Math.sin(direction) * 8;
      
      // Check if this direction has fewer opponents
      let opponentsInDirection = 0;
      for (const [_, opponent] of context.playerPositions) {
        if (opponent.team === opposingTeam) {
          const distance = MathUtils.distance(testX, testY, opponent.x, opponent.y);
          if (distance < 6) {
            opponentsInDirection++;
          }
        }
      }
      
      if (opponentsInDirection === 0) {
        return direction; // Found escape direction
      }
    }
    
    return null; // No clear escape direction
  }

  private getEnergyReduction(action: string): number {
    switch (action) {
      case 'sprinting':
        return 2;
      case 'running':
        return 1;
      case 'tackling':
        return 1.5;
      case 'shooting':
        return 0.5;
      case 'passing':
        return 0.2;
      case 'dribbling':
        return 0.8;
      case 'positioning':
      default:
        return 0.1;
    }
  }

  // Simplified approach without complex role counting

  private getFormationPositions(formation: string): any {
    // This would return formation-specific positioning data
    // For now, return a default structure
    return {
      defenders: 4,
      midfielders: 4,
      forwards: 2
    };
  }
} 