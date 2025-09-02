import { SimulationRequest } from '../types';

interface ValidationResult {
  success: boolean;
  error?: string;
}

export class ValidationService {
  validateSimulationRequest(data: any): ValidationResult {
    // Check if data exists
    if (!data) {
      return { success: false, error: 'Request body is required' };
    }
    
    // Validate home team
    if (!data.home_team) {
      return { success: false, error: 'Home team is required' };
    }
    
    if (!this.validateTeam(data.home_team)) {
      return { success: false, error: 'Invalid home team structure' };
    }
    
    // Validate away team
    if (!data.away_team) {
      return { success: false, error: 'Away team is required' };
    }
    
    if (!this.validateTeam(data.away_team)) {
      return { success: false, error: 'Invalid away team structure' };
    }
    
    // Validate minimum players
    if (data.home_team.players.length < 11) {
      return { success: false, error: 'Home team must have at least 11 players' };
    }
    
    if (data.away_team.players.length < 11) {
      return { success: false, error: 'Away team must have at least 11 players' };
    }
    
    // Validate tactics if provided
    if (data.home_tactic && !this.validateTactic(data.home_tactic)) {
      return { success: false, error: 'Invalid home tactic structure' };
    }
    
    if (data.away_tactic && !this.validateTactic(data.away_tactic)) {
      return { success: false, error: 'Invalid away tactic structure' };
    }
    
    // Validate options if provided
    if (data.options && !this.validateOptions(data.options)) {
      return { success: false, error: 'Invalid simulation options' };
    }
    
    return { success: true };
  }
  
  private validateTeam(team: any): boolean {
    if (!team.id || !team.name || !Array.isArray(team.players)) {
      return false;
    }
    
    // Validate each player
    for (const player of team.players) {
      if (!this.validatePlayer(player)) {
        return false;
      }
    }
    
    return true;
  }
  
  private validatePlayer(player: any): boolean {
    if (!player.id || !player.first_name || !player.last_name) {
      return false;
    }
    
    // Attributes are optional, but if provided, they must be valid
    if (player.attributes !== null && player.attributes !== undefined) {
      if (!this.validatePlayerAttributes(player.attributes)) {
        return false;
      }
    }
    
    return true;
  }
  
  private validatePlayerAttributes(attributes: any): boolean {
    // If attributes is null or undefined, that's fine
    if (attributes === null || attributes === undefined) {
      return true;
    }
    
    // If attributes is provided, it should be an object
    if (typeof attributes !== 'object') {
      return false;
    }
    
    const requiredAttributes = [
      'pace', 'shooting', 'passing', 'dribbling', 'defending', 'physical',
      'stamina', 'strength', 'acceleration', 'sprint_speed', 'finishing',
      'shot_power', 'long_shots', 'volleys', 'penalties', 'vision',
      'crossing', 'free_kick_accuracy', 'short_passing', 'long_passing',
      'curve', 'agility', 'balance', 'reactions', 'ball_control',
      'dribbling_skill', 'composure', 'interceptions', 'heading_accuracy',
      'marking', 'standing_tackle', 'sliding_tackle', 'jumping',
      'stamina_attr', 'strength_attr', 'aggression'
    ];
    
    for (const attr of requiredAttributes) {
      // If the attribute exists, it should be a valid number
      if (attributes[attr] !== undefined && attributes[attr] !== null) {
        if (typeof attributes[attr] !== 'number' || attributes[attr] < 0 || attributes[attr] > 100) {
          return false;
        }
      }
    }
    
    return true;
  }
  
  private validateTactic(tactic: any): boolean {
    if (!tactic.id || !tactic.name) {
      return false;
    }
    
    return true;
  }
  
  private validateOptions(options: any): boolean {
    // Validate tick rate
    if (options.tickRate && (typeof options.tickRate !== 'number' || options.tickRate < 1 || options.tickRate > 120)) {
      return false;
    }
    
    // Validate max duration
    if (options.maxDuration && (typeof options.maxDuration !== 'number' || options.maxDuration < 1 || options.maxDuration > 7200)) {
      return false;
    }
    
    // Validate boolean options
    const booleanOptions = ['realTime', 'enableCommentary', 'enableStatistics', 'enableFatigue', 'enableMomentum', 'enableWeather'];
    for (const option of booleanOptions) {
      if (options[option] !== undefined && typeof options[option] !== 'boolean') {
        return false;
      }
    }
    
    return true;
  }
} 