import { MatchContext, SecondUpdate, MatchStatistics } from '../../types';

export class StatisticsEngine {
  updateStatistics(context: MatchContext, update: SecondUpdate): MatchStatistics {
    // Calculate possession based on ball control time and events
    const possessionStats = this.calculatePossession(context);
    
    // Count events by type and team
    const eventStats = this.calculateEventStatistics(context);
    
    return {
      possession: possessionStats,
      passes: eventStats.passes,
      shots: eventStats.shots,
      shots_on_target: eventStats.shots_on_target,
      tackles: eventStats.tackles,
      fouls: eventStats.fouls,
      cards: eventStats.cards,
      corners: eventStats.corners,
      offsides: eventStats.offsides,
      saves: eventStats.saves,
      clearances: eventStats.clearances,
      interceptions: eventStats.interceptions
    };
  }
  
  calculateFinalStatistics(context: MatchContext): MatchStatistics {
    return this.updateStatistics(context, {} as SecondUpdate);
  }

  private calculatePossession(context: MatchContext): { home: number; away: number } {
    // Simple possession calculation based on current possession and some randomness
    const currentPossession = context.possession.team;
    const minute = context.currentMinute;
    
    // Add some variation based on match progression
    const homeBase = currentPossession === 'home' ? 55 : 45;
    const awayBase = 100 - homeBase;
    
    // Add some randomness and trend based on events
    const eventInfluence = this.getEventInfluence(context);
    
    const homePossession = Math.max(20, Math.min(80, homeBase + eventInfluence.home));
    const awayPossession = 100 - homePossession;
    
    return {
      home: Math.round(homePossession),
      away: Math.round(awayPossession)
    };
  }

  private calculateEventStatistics(context: MatchContext): any {
    const stats = {
      passes: { home: 0, away: 0 },
      shots: { home: 0, away: 0 },
      shots_on_target: { home: 0, away: 0 },
      tackles: { home: 0, away: 0 },
      fouls: { home: 0, away: 0 },
      cards: { home: { yellow: 0, red: 0 }, away: { yellow: 0, red: 0 } },
      corners: { home: 0, away: 0 },
      offsides: { home: 0, away: 0 },
      saves: { home: 0, away: 0 },
      clearances: { home: 0, away: 0 },
      interceptions: { home: 0, away: 0 }
    };

    // Count events by type and team
    context.matchEvents.forEach(event => {
      const team = event.team as 'home' | 'away';
      
      switch (event.type) {
        case 'pass':
          stats.passes[team]++;
          break;
        case 'shot':
          stats.shots[team]++;
          break;
        case 'shot_on_target':
          stats.shots_on_target[team]++;
          break;
        case 'tackle':
          stats.tackles[team]++;
          break;
        case 'foul':
          stats.fouls[team]++;
          break;
        case 'yellow_card':
          stats.cards[team].yellow++;
          break;
        case 'red_card':
          stats.cards[team].red++;
          break;
        case 'corner':
          stats.corners[team]++;
          break;
        case 'offside':
          stats.offsides[team]++;
          break;
        case 'save':
          stats.saves[team]++;
          break;
        // Note: clearance and interception are not in EventType - using tackle as proxy
        case 'dribbling':
          // Count as potential clearance or interception context
          break;
      }
    });

    return stats;
  }

  private getEventInfluence(context: MatchContext): { home: number; away: number } {
    // Calculate possession influence based on recent events
    let homeInfluence = 0;
    let awayInfluence = 0;
    
    // Recent events have more influence
    const recentEvents = context.matchEvents.slice(-10);
    
    recentEvents.forEach(event => {
      const influence = this.getEventPossessionInfluence(event.type);
      if (event.team === 'home') {
        homeInfluence += influence;
      } else {
        awayInfluence += influence;
      }
    });
    
    return {
      home: Math.max(-15, Math.min(15, homeInfluence - awayInfluence)),
      away: Math.max(-15, Math.min(15, awayInfluence - homeInfluence))
    };
  }

  private getEventPossessionInfluence(eventType: string): number {
    switch (eventType) {
      case 'pass':
      case 'dribbling':
        return 1;
      case 'tackle':
        return 2;
      case 'foul':
        return -1;
      case 'shot':
        return 2;
      case 'goal':
        return 3;
      default:
        return 0;
    }
  }
} 