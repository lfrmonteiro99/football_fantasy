import { MatchContext } from '../../types';

export class FatigueEngine {
  initializeFatigueLevels(context: MatchContext, teamType: 'home' | 'away'): Map<number, number> {
    const fatigueLevels = new Map<number, number>();
    const team = teamType === 'home' ? context.homeTeam : context.awayTeam;
    
    for (const player of team.players) {
      fatigueLevels.set(player.id, 0);
    }
    
    return fatigueLevels;
  }
  
  updateFatigueLevels(context: MatchContext): Map<number, number> {
    const updatedFatigue = new Map<number, number>();
    
    for (const [playerId, currentFatigue] of Object.entries(context.fatigueLevels)) {
      const newFatigue = this.updatePlayerFatigue(parseInt(playerId), currentFatigue, context);
      updatedFatigue.set(parseInt(playerId), newFatigue);
    }
    
    return updatedFatigue;
  }
  
  private updatePlayerFatigue(playerId: number, currentFatigue: number, context: MatchContext): number {
    const baseIncrease = 0.0001; // Very small increase per second
    const newFatigue = Math.min(currentFatigue + baseIncrease, 1.0);
    return newFatigue;
  }
} 