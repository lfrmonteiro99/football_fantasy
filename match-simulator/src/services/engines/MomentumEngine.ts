import { MatchContext } from '../../types';

export class MomentumEngine {
  updateMomentum(context: MatchContext): string {
    // Simplified momentum calculation
    const homeScore = context.score.home;
    const awayScore = context.score.away;
    
    if (homeScore > awayScore) {
      return 'home';
    } else if (awayScore > homeScore) {
      return 'away';
    } else {
      return 'balanced';
    }
  }
} 