import { MatchContext, PlayerPosition } from '../../types';
import { MathUtils } from '../../utils/MathUtils';

/**
 * Enhanced Tactical Position Engine based on realistic football tactics
 * Uses 105m x 68m pitch dimensions with proper positional zones
 */
export class TacticalPositionEngine {
  // Pitch dimensions (converted to 0-100 scale for compatibility)
  private static readonly PITCH_LENGTH = 105; // meters
  private static readonly PITCH_WIDTH = 68; // meters
  
  // Convert real coordinates to our 0-100 system
  private static realToGameCoords(realX: number, realY: number): { x: number; y: number } {
    return {
      x: (realX / TacticalPositionEngine.PITCH_LENGTH) * 100,
      y: (realY / TacticalPositionEngine.PITCH_WIDTH) * 100
    };
  }
  
  // Tactical zones based on real football positioning
  private static readonly TACTICAL_ZONES = {
    // Goalkeeper zones
    GK: {
      STARTING: { xMin: 0, xMax: 6, yMin: 26, yMax: 42 },
      MOVEMENT: { xMin: 0, xMax: 16, yMin: 20, yMax: 48 }
    },
    
    // Defender zones
    CB_RIGHT: {
      STARTING: { xMin: 6, xMax: 18, yMin: 34, yMax: 48 },
      MOVEMENT: { xMin: 6, xMax: 35, yMin: 20, yMax: 48 }
    },
    CB_LEFT: {
      STARTING: { xMin: 6, xMax: 18, yMin: 20, yMax: 34 },
      MOVEMENT: { xMin: 6, xMax: 35, yMin: 20, yMax: 48 }
    },
    RB: {
      STARTING: { xMin: 6, xMax: 20, yMin: 48, yMax: 64 },
      MOVEMENT: { xMin: 6, xMax: 60, yMin: 58, yMax: 68 }
    },
    LB: {
      STARTING: { xMin: 6, xMax: 20, yMin: 4, yMax: 20 },
      MOVEMENT: { xMin: 6, xMax: 60, yMin: 0, yMax: 10 }
    },
    
    // Midfielder zones
    CDM: {
      STARTING: { xMin: 20, xMax: 35, yMin: 28, yMax: 40 },
      MOVEMENT: { xMin: 10, xMax: 45, yMin: 24, yMax: 44 }
    },
    CM_RIGHT: {
      STARTING: { xMin: 25, xMax: 45, yMin: 40, yMax: 52 },
      MOVEMENT: { xMin: 20, xMax: 70, yMin: 12, yMax: 56 }
    },
    CM_LEFT: {
      STARTING: { xMin: 25, xMax: 45, yMin: 16, yMax: 28 },
      MOVEMENT: { xMin: 20, xMax: 70, yMin: 12, yMax: 56 }
    },
    CAM: {
      STARTING: { xMin: 35, xMax: 50, yMin: 26, yMax: 42 },
      MOVEMENT: { xMin: 30, xMax: 70, yMin: 20, yMax: 50 }
    },
    
    // Forward zones
    RW: {
      STARTING: { xMin: 40, xMax: 55, yMin: 52, yMax: 66 },
      MOVEMENT: { xMin: 35, xMax: 90, yMin: 48, yMax: 68 }
    },
    LW: {
      STARTING: { xMin: 40, xMax: 55, yMin: 2, yMax: 16 },
      MOVEMENT: { xMin: 35, xMax: 90, yMin: 0, yMax: 20 }
    },
    ST: {
      STARTING: { xMin: 50, xMax: 70, yMin: 28, yMax: 40 },
      MOVEMENT: { xMin: 40, xMax: 100, yMin: 20, yMax: 50 }
    }
  };

  /**
   * Get tactical position for a player based on role, game context, and tactical behavior
   */
  static getTacticalPosition(
    role: string, 
    isHome: boolean, 
    context: MatchContext,
    playerData?: any
  ): { x: number; y: number } {
    const ballPos = context.ballPosition;
    const possession = context.possession;
    const hasPossession = possession.team === (isHome ? 'home' : 'away');
    
    // Flip coordinates for away team
    const flipX = (x: number) => isHome ? x : 100 - x;
    const flipY = (y: number) => y; // Y coordinates don't flip
    
    switch (role) {
      case 'GK':
        return TacticalPositionEngine.getGoalkeeperPosition(isHome, ballPos, hasPossession, playerData);
      
      case 'CB1':
      case 'CB2':
      case 'CB3':
        return TacticalPositionEngine.getCenterBackPosition(role, isHome, ballPos, hasPossession, context, playerData);
      
      case 'RB':
      case 'LB':
        return TacticalPositionEngine.getFullBackPosition(role, isHome, ballPos, hasPossession, context, playerData);
      
      case 'DM':
      case 'CDM':
        return TacticalPositionEngine.getDefensiveMidfielderPosition(isHome, ballPos, hasPossession, context, playerData);
      
      case 'CM':
        return TacticalPositionEngine.getCentralMidfielderPosition(isHome, ballPos, hasPossession, context, playerData);
      
      case 'AM':
      case 'CAM':
        return TacticalPositionEngine.getAttackingMidfielderPosition(isHome, ballPos, hasPossession, context, playerData);
      
      case 'WM':
      case 'RW':
      case 'LW':
        return TacticalPositionEngine.getWingerPosition(role, isHome, ballPos, hasPossession, context, playerData);
      
      case 'ST':
      case 'CF':
        return TacticalPositionEngine.getStrikerPosition(isHome, ballPos, hasPossession, context, playerData);
      
      default:
        // Default to center midfield position
        return { x: flipX(40), y: 50 };
    }
  }

  /**
   * Goalkeeper positioning with tactical variations
   */
  private static getGoalkeeperPosition(
    isHome: boolean, 
    ballPos: any, 
    hasPossession: boolean,
    playerData?: any
  ): { x: number; y: number } {
    const baseX = isHome ? 5 : 95;
    let adjustedX = baseX;
    let adjustedY = 50;
    
    if (ballPos) {
      // Sweeper-keeper behavior: move out when ball is in dangerous areas
      const dangerZone = isHome ? ballPos.x < 20 : ballPos.x > 80;
      if (dangerZone && playerData?.playingStyle === 'sweeper') {
        adjustedX = isHome ? Math.min(15, ballPos.x + 8) : Math.max(85, ballPos.x - 8);
      }
      
      // Adjust Y position based on ball position
      const yAdjustment = (ballPos.y - 50) * 0.3;
      adjustedY = Math.max(25, Math.min(75, 50 + yAdjustment));
    }
    
    return { x: adjustedX, y: adjustedY };
  }

  /**
   * Center-back positioning with tactical roles
   */
  private static getCenterBackPosition(
    role: string,
    isHome: boolean,
    ballPos: any,
    hasPossession: boolean,
    context: MatchContext,
    playerData?: any
  ): { x: number; y: number } {
    const baseX = isHome ? 15 : 85;
    let adjustedX = baseX;
    
    // Ball-playing CB: step into midfield when in possession
    if (hasPossession && playerData?.playingStyle === 'ball_playing') {
      adjustedX = isHome ? Math.min(30, baseX + 10) : Math.max(70, baseX - 10);
    }
    
    // Stopper CB: press forward when ball is in midfield
    if (!hasPossession && ballPos && playerData?.playingStyle === 'stopper') {
      const ballInMidfield = ballPos.x > 30 && ballPos.x < 70;
      if (ballInMidfield) {
        adjustedX = isHome ? Math.min(35, baseX + 15) : Math.max(65, baseX - 15);
      }
    }
    
    // Y positioning: CB1 (right), CB2 (left), CB3 (center)
    let adjustedY = 50;
    if (role === 'CB1') {
      adjustedY = ballPos ? Math.max(35, Math.min(48, ballPos.y + 5)) : 42;
    } else if (role === 'CB2') {
      adjustedY = ballPos ? Math.max(20, Math.min(35, ballPos.y - 5)) : 28;
    } else { // CB3
      adjustedY = ballPos ? Math.max(30, Math.min(70, ballPos.y)) : 50;
    }
    
    return { x: adjustedX, y: adjustedY };
  }

  /**
   * Full-back positioning with attacking/defensive phases
   */
  private static getFullBackPosition(
    role: string,
    isHome: boolean,
    ballPos: any,
    hasPossession: boolean,
    context: MatchContext,
    playerData?: any
  ): { x: number; y: number } {
    const baseX = isHome ? 20 : 80;
    let adjustedX = baseX;
    
    const isRightBack = role === 'RB';
    const isLeftBack = role === 'LB';
    
    // Attacking full-back: overlap when in possession
    if (hasPossession && playerData?.playingStyle === 'attacking') {
      adjustedX = isHome ? Math.min(65, baseX + 35) : Math.max(35, baseX - 35);
    }
    
    // Inverted full-back: move central during build-up
    if (hasPossession && playerData?.playingStyle === 'inverted') {
      adjustedX = isHome ? Math.min(40, baseX + 15) : Math.max(60, baseX - 15);
    }
    
    // Y positioning on flanks
    let adjustedY: number;
    if (isRightBack) {
      adjustedY = hasPossession ? 
        Math.max(50, Math.min(68, ballPos?.y + 15 || 60)) : 
        Math.max(45, Math.min(65, ballPos?.y + 10 || 55));
    } else { // Left back
      adjustedY = hasPossession ? 
        Math.max(0, Math.min(18, ballPos?.y - 15 || 8)) : 
        Math.max(3, Math.min(23, ballPos?.y - 10 || 13));
    }
    
    return { x: adjustedX, y: adjustedY };
  }

  /**
   * Defensive midfielder positioning
   */
  private static getDefensiveMidfielderPosition(
    isHome: boolean,
    ballPos: any,
    hasPossession: boolean,
    context: MatchContext,
    playerData?: any
  ): { x: number; y: number } {
    const baseX = isHome ? 30 : 70;
    let adjustedX = baseX;
    
    // Anchor: stay close to defense
    if (playerData?.playingStyle === 'anchor') {
      adjustedX = isHome ? Math.max(20, baseX - 5) : Math.min(80, baseX + 5);
    }
    
    // Deep-lying playmaker: spread passes from deeper position
    if (hasPossession && playerData?.playingStyle === 'playmaker') {
      adjustedX = isHome ? Math.max(25, baseX - 3) : Math.min(75, baseX + 3);
    }
    
    // Y positioning: shield the defense
    const adjustedY = ballPos ? 
      Math.max(25, Math.min(75, ballPos.y * 0.6 + 50 * 0.4)) : 50;
    
    return { x: adjustedX, y: adjustedY };
  }

  /**
   * Central midfielder positioning (box-to-box)
   */
  private static getCentralMidfielderPosition(
    isHome: boolean,
    ballPos: any,
    hasPossession: boolean,
    context: MatchContext,
    playerData?: any
  ): { x: number; y: number } {
    const baseX = isHome ? 45 : 55;
    let adjustedX = baseX;
    
    // Box-to-box: arrive in both boxes
    if (playerData?.playingStyle === 'box_to_box') {
      if (hasPossession && ballPos) {
        // Push forward when attacking
        const attackingThird = isHome ? ballPos.x > 70 : ballPos.x < 30;
        if (attackingThird) {
          adjustedX = isHome ? Math.min(75, baseX + 20) : Math.max(25, baseX - 20);
        }
      } else if (ballPos) {
        // Track back when defending
        const defensiveThird = isHome ? ballPos.x < 35 : ballPos.x > 65;
        if (defensiveThird) {
          adjustedX = isHome ? Math.max(25, baseX - 15) : Math.min(75, baseX + 15);
        }
      }
    }
    
    const adjustedY = ballPos ? 
      Math.max(20, Math.min(80, ballPos.y * 0.7 + 50 * 0.3)) : 50;
    
    return { x: adjustedX, y: adjustedY };
  }

  /**
   * Attacking midfielder positioning
   */
  private static getAttackingMidfielderPosition(
    isHome: boolean,
    ballPos: any,
    hasPossession: boolean,
    context: MatchContext,
    playerData?: any
  ): { x: number; y: number } {
    const baseX = isHome ? 60 : 40;
    let adjustedX = baseX;
    
    // False 9: drop deeper to create space
    if (playerData?.playingStyle === 'false_9') {
      adjustedX = isHome ? Math.max(45, baseX - 10) : Math.min(55, baseX + 10);
    }
    
    // Shadow striker: attack the box frequently
    if (hasPossession && playerData?.playingStyle === 'shadow_striker') {
      adjustedX = isHome ? Math.min(80, baseX + 15) : Math.max(20, baseX - 15);
    }
    
    // Free roaming #10
    let adjustedY = 50;
    if (playerData?.playingStyle === 'free_roam' && ballPos) {
      // Move toward the ball but maintain central presence
      adjustedY = Math.max(25, Math.min(75, ballPos.y * 0.8 + 50 * 0.2));
    }
    
    return { x: adjustedX, y: adjustedY };
  }

  /**
   * Winger positioning with cutting inside vs staying wide
   */
  private static getWingerPosition(
    role: string,
    isHome: boolean,
    ballPos: any,
    hasPossession: boolean,
    context: MatchContext,
    playerData?: any
  ): { x: number; y: number } {
    const baseX = isHome ? 60 : 40;
    let adjustedX = baseX;
    
    const isRightWinger = role === 'RW' || role === 'WM';
    const isLeftWinger = role === 'LW';
    
    // Inverted winger: cut inside to shoot
    if (hasPossession && playerData?.playingStyle === 'inverted') {
      adjustedX = isHome ? Math.min(75, baseX + 10) : Math.max(25, baseX - 10);
    }
    
    // Traditional winger: stay wide for crosses
    if (hasPossession && playerData?.playingStyle === 'traditional') {
      adjustedX = isHome ? Math.min(85, baseX + 20) : Math.max(15, baseX - 20);
    }
    
    // Y positioning on flanks
    let adjustedY: number;
    if (isRightWinger) {
      adjustedY = playerData?.playingStyle === 'inverted' ? 
        Math.max(40, Math.min(65, ballPos?.y || 55)) : 
        Math.max(55, Math.min(68, ballPos?.y + 8 || 62));
    } else { // Left winger
      adjustedY = playerData?.playingStyle === 'inverted' ? 
        Math.max(3, Math.min(28, ballPos?.y || 13)) : 
        Math.max(0, Math.min(13, ballPos?.y - 8 || 6));
    }
    
    return { x: adjustedX, y: adjustedY };
  }

  /**
   * Striker positioning with different tactical roles
   */
  private static getStrikerPosition(
    isHome: boolean,
    ballPos: any,
    hasPossession: boolean,
    context: MatchContext,
    playerData?: any
  ): { x: number; y: number } {
    const baseX = isHome ? 75 : 25;
    let adjustedX = baseX;
    
    // Poacher: stay near goal
    if (playerData?.playingStyle === 'poacher') {
      adjustedX = isHome ? Math.max(80, baseX + 5) : Math.min(20, baseX - 5);
    }
    
    // Target man: receive long balls
    if (playerData?.playingStyle === 'target_man') {
      adjustedX = isHome ? Math.max(70, baseX - 3) : Math.min(30, baseX + 3);
    }
    
    // False 9: drop to midfield
    if (playerData?.playingStyle === 'false_9') {
      adjustedX = isHome ? Math.max(50, baseX - 20) : Math.min(50, baseX + 20);
    }
    
    const adjustedY = ballPos ? 
      Math.max(25, Math.min(75, ballPos.y * 0.6 + 50 * 0.4)) : 50;
    
    return { x: adjustedX, y: adjustedY };
  }

  /**
   * Determine player actions based on position and tactical context
   */
  static getPlayerActions(
    role: string,
    position: { x: number; y: number },
    ballPos: any,
    hasPossession: boolean,
    playerData?: any
  ): string[] {
    const actions: string[] = [];
    
    const distanceToBall = ballPos ? 
      MathUtils.distance(position.x, position.y, ballPos.x, ballPos.y) : Infinity;
    
    // Role-specific actions based on your tactical guide
    switch (role) {
      case 'GK':
        if (distanceToBall < 20) {
          actions.push('shot_stopping', 'sweeping');
        }
        if (hasPossession) {
          actions.push('distribution_short', 'distribution_long');
        }
        break;
        
      case 'CB1':
      case 'CB2':
      case 'CB3':
        if (distanceToBall < 15) {
          actions.push('interception', 'block', 'aerial_duel');
        }
        if (hasPossession) {
          actions.push('pass_short', 'pass_switch', 'dribble_forward');
        }
        break;
        
      case 'RB':
      case 'LB':
        if (hasPossession && position.x > 50) {
          actions.push('overlap', 'cross', 'pass_forward');
        }
        if (!hasPossession) {
          actions.push('defensive_recovery', 'track_back');
        }
        break;
        
      case 'DM':
      case 'CDM':
        actions.push('shield_defense', 'intercept', 'distribute');
        if (distanceToBall < 10) {
          actions.push('press_forward');
        }
        break;
        
      case 'CM':
        actions.push('progressive_pass', 'transition', 'box_to_box_run');
        if (position.x > 70) {
          actions.push('late_run', 'shoot_edge_box');
        }
        break;
        
      case 'AM':
      case 'CAM':
        actions.push('key_pass', 'through_ball', 'link_up');
        if (position.x > 65) {
          actions.push('shoot', 'assist');
        }
        break;
        
      case 'RW':
      case 'LW':
      case 'WM':
        if (position.x > 70) {
          actions.push('cross', 'cut_inside', 'dribble');
        }
        actions.push('press_high', 'track_back');
        break;
        
      case 'ST':
      case 'CF':
        if (position.x > 75) {
          actions.push('shoot', 'header', 'finish');
        }
        actions.push('hold_up_play', 'run_behind', 'press');
        break;
    }
    
    return actions;
  }
}