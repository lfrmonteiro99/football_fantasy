import { GameState, Player, DEFAULT_ACTION_DURATIONS, COOLDOWNS } from './types';
import { Perception } from './perception';

export type Decision = 'shoot' | 'pass' | 'dribble' | 'hold' | 'clear';

export function decide_on_ball(player: Player, per: Perception, G: GameState): Decision {
  // Cooldown-aware simple weighted choice
  const weights: Record<Decision, number> = { shoot: 0, pass: 0, dribble: 0, hold: 1, clear: 0 };
  if (per.can_shoot) weights.shoot = 3;
  if (per.passing_options.length > 0) weights.pass = 4;
  if (per.space_ahead > 8) weights.dribble = 2;
  if (!per.can_shoot && per.passing_options.length === 0) weights.clear = 2;

  // Memory / anti-oscillation dampening
  const mem = player.dynamic.memory || {};
  const fails = mem.fail_counts || {};
  if ((fails['dribble'] || 0) >= 2) weights.dribble *= 0.5;
  if ((fails['pass'] || 0) >= 2) weights.pass *= 0.7;

  for (const k of Object.keys(weights) as Decision[]) {
    if ((player.dynamic.cooldowns[k] || 0) > 0) weights[k] = 0;
  }

  const entries = Object.entries(weights) as [Decision, number][];
  const sum = entries.reduce((s, [, w]) => s + w, 0) || 1;
  let r = Math.random() * sum;
  for (const [d, w] of entries) {
    if ((r -= w) <= 0) return d;
  }
  return 'hold';
}

export function initiate_action(player: Player, decision: Decision) {
  player.dynamic.current_action = decision;
  player.dynamic.action_timer = DEFAULT_ACTION_DURATIONS[decision] || 1;
  player.dynamic.cooldowns[decision] = COOLDOWNS[decision] || 0;
  player.dynamic.memory.last_action_tick = player.dynamic.memory.last_action_tick || 0;
}

function isInShootingZone(player: Player): boolean {
  // Home attacks to the right (x -> 100), away attacks to the left (x -> 0)
  if (player.team_id === 1) return player.pos.x > 85;
  return player.pos.x < 15;
}

export function make_decision_on_ball(player: Player, G: GameState): 'shoot' | 'pass' | 'dribble' | 'hold' {
  // Very simple first pass heuristic
  const staminaFactor = Math.max(0.6, player.dynamic.stamina / (player.attributes.staminaMax || 90));
  const shootAbility = (player.attributes.shooting || 50) * staminaFactor;
  const passAbility = ((player.attributes.passing || 50) + (player.attributes.vision || 50)) / 2 * staminaFactor;
  const dribbleAbility = (player.attributes.dribbling || 50) * staminaFactor;

  if (isInShootingZone(player) && shootAbility > 60 && (player.dynamic.cooldowns['shoot'] || 0) === 0) {
    return 'shoot';
  }

  // Prefer pass if teammates ahead exist (very basic check in index via initiate)
  if (passAbility >= dribbleAbility && (player.dynamic.cooldowns['pass'] || 0) === 0) {
    return 'pass';
  }

  if ((player.dynamic.cooldowns['dribble'] || 0) === 0 && dribbleAbility > 45) {
    return 'dribble';
  }

  return 'hold';
}


