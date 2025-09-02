import { MatchEvent } from '../../types';

export class CommentaryEngine {
  generateCommentary(event: MatchEvent): string {
    // Simplified commentary generation
    return event.commentary;
  }
  
  generateSecondCommentary(update: any): string | null {
    // Simplified second-by-second commentary
    if (update.events.length > 0) {
      return this.generateCommentary(update.events[0]);
    }
    return null;
  }
} 