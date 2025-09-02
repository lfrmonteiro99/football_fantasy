import { MatchContext, PossessionState } from '../../types';
import { MathUtils } from '../../utils/MathUtils';

export class PossessionEngine {
  updatePossession(context: MatchContext): PossessionState {
    const currentPossession = context.possession;
    const ballPos = context.ballPosition;
    const playerPositions = context.playerPositions;
    
    // Find closest player to ball
    const closestPlayer = this.findClosestPlayerToBall(ballPos, playerPositions);
    
    // Calculate possession change probability
    const changeProb = this.calculatePossessionChangeProbability(context, closestPlayer);
    
    // Check if possession changes
    if (MathUtils.probability(changeProb)) {
      const newPossession = this.determineNewPossession(context, closestPlayer);
      return newPossession;
    }
    
    return currentPossession;
  }
  
  private findClosestPlayerToBall(ballPos: any, playerPositions: Map<number, any>): any {
    let closestPlayer = null;
    let minDistance = Infinity;
    
    for (const [playerId, playerPos] of playerPositions) {
      const distance = MathUtils.distance(ballPos.x, ballPos.y, playerPos.x, playerPos.y);
      if (distance < minDistance) {
        minDistance = distance;
        closestPlayer = { playerId, playerPos };
      }
    }
    
    return closestPlayer;
  }
  
  private calculatePossessionChangeProbability(context: MatchContext, closestPlayer: any): number {
    const baseProb = 0.01; // 1% chance per second
    
    if (!closestPlayer) return baseProb;
    
    // Player skill impact
    const skillImpact = this.calculateSkillImpact(closestPlayer, context);
    
    // Tactical impact
    const tacticalImpact = this.calculateTacticalImpact(context, closestPlayer);
    
    // Fatigue impact
    const fatigueImpact = this.calculateFatigueImpact(closestPlayer, context);
    
    // Pressure impact
    const pressureImpact = this.calculatePressureImpact(context, closestPlayer);
    
    return baseProb * skillImpact * tacticalImpact * fatigueImpact * pressureImpact;
  }
  
  private determineNewPossession(context: MatchContext, closestPlayer: any): PossessionState {
    if (!closestPlayer) return context.possession;
    
    const playerId = closestPlayer.playerId;
    const isHomePlayer = context.homeTeam.players.some(p => p.id === playerId);
    
    return {
      team: isHomePlayer ? 'home' : 'away',
      playerId,
      timestamp: context.currentSecond
    };
  }
  
  private calculateSkillImpact(closestPlayer: any, context: MatchContext): number {
    // Simplified skill calculation
    return 1.0;
  }
  
  private calculateTacticalImpact(context: MatchContext, closestPlayer: any): number {
    // Simplified tactical impact
    return 1.0;
  }
  
  private calculateFatigueImpact(closestPlayer: any, context: MatchContext): number {
    const fatigue = context.fatigueLevels[closestPlayer.playerId.toString()] || 0;
    return 1 - fatigue * 0.5;
  }
  
  private calculatePressureImpact(context: MatchContext, closestPlayer: any): number {
    // Simplified pressure calculation
    return 1.0;
  }
} 