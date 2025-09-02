import { GameState } from './types';

export function update_stamina_morale_and_fatigue(G: GameState) {
  for (const p of G.all_players) {
    const speed = Math.hypot(p.vel.x, p.vel.y);
    const exertion = 0.02 + 0.03 * (speed / 8); // simple decay
    p.dynamic.stamina = Math.max(0, p.dynamic.stamina - exertion);
    if (p.dynamic.stamina < 25) {
      p.dynamic.fatigue = Math.min(1, p.dynamic.fatigue + 0.005);
    }
  }
}


