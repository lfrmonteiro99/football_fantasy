import { GameState, Player, DRIBBLE_JITTER, SHOT_JITTER, TACKLE_SUCCESS_THRESHOLD, FOUL_BASE_PROB, jitter, TACKLE_RADIUS } from './types';
import { foul_probability } from './referee';

const log = (...a: any[]) => console.log('[UnifiedSim][Outcome]', ...a);

export function resolve_dribble(attacker: Player, defender: Player, G: GameState): 'success' | 'partial' | 'fail' {
  const A = (attacker.attributes.dribbling * 0.6 + attacker.attributes.speed * 0.2 + attacker.attributes.composure * 0.15)
    * (attacker.dynamic.stamina / (attacker.attributes.staminaMax || 90));
  const D = (defender.attributes.tackling * 0.6 + defender.attributes.positioning * 0.2 + defender.attributes.aggression * 0.15)
    * (defender.dynamic.stamina / (defender.attributes.staminaMax || 90));
  const score = A - D + jitter(DRIBBLE_JITTER);
  const result: 'success' | 'partial' | 'fail' = score >= 20 ? 'success' : score >= 5 ? 'partial' : 'fail';
  log('DRIBBLE', { tick: G.tick, attacker: attacker.id, defender: defender.id, A, D, score, result });
  return result;
}

export function resolve_tackle(defender: Player, attacker: Player, G: GameState): 'success' | 'foul' | 'fail' {
  const timing_bonus = 0; // placeholder
  const tackle_power = defender.attributes.tackling * 0.6 + defender.attributes.aggression * 0.2 + timing_bonus;
  const attacker_control = attacker.attributes.dribbling * 0.5 + attacker.attributes.composure * 0.3;
  const score = tackle_power - attacker_control + jitter([-10, 10]);
  let result: 'success' | 'foul' | 'fail' = 'fail';
  if (score > TACKLE_SUCCESS_THRESHOLD) result = 'success';
  else {
    const foulProb = foul_probability(defender.attributes.aggression || 50, attacker.attributes.composure || 50, G.referee_strictness || 50);
    if (Math.random() < foulProb) result = 'foul';
  }
  log('TACKLE', { tick: G.tick, defender: defender.id, attacker: attacker.id, score, result });
  return result;
}

export function resolve_shot(shooter: Player, goalkeeper: Player, context: { dist_to_goal: number; angle_score: number }, G: GameState): 'goal' | 'saved' | 'off' {
  const S = (shooter.attributes.shooting * 0.6 + shooter.attributes.composure * 0.2)
    * (shooter.dynamic.stamina / (shooter.attributes.staminaMax || 90));
  const shot_score = S - context.dist_to_goal * 0.4 + context.angle_score * 10 + jitter(SHOT_JITTER);
  const keeper_skill = (goalkeeper.attributes.goalkeeping || 60) * 0.7 * (goalkeeper.dynamic.stamina / (goalkeeper.attributes.staminaMax || 90)) + goalkeeper.attributes.composure * 0.2;
  const diff = shot_score - keeper_skill;
  let result: 'goal' | 'saved' | 'off' = diff >= 12 ? 'goal' : diff >= -6 ? 'saved' : 'off';
  if (result === 'saved' && Math.random() < 0.5) {
    // Parry/deflection -> free ball near goal
    G.ball.holder_id = null;
    const jitterX = (Math.random() - 0.5) * 4;
    const jitterY = (Math.random() - 0.5) * 6;
    G.ball.vel = { x: jitterX, y: jitterY };
  }
  log('SHOT', { tick: G.tick, shooter: shooter.id, keeper: goalkeeper.id, shot_score, keeper_skill, diff, result });
  return result;
}


