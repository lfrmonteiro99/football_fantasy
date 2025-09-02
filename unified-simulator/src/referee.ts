import { GameState } from './types';

export function process_referee_and_injury_checks(G: GameState) {
  // Fouls from recent contests (basic)
  if (G.recent_contests && G.recent_contests.length) {
    for (const ev of G.recent_contests) {
      if (ev.type === 'tackle' && ev.outcome === 'foul' && ev.attacker_id && ev.defender_id) {
        // Card decision
        const severity = Math.random();
        let card: 'yellow' | 'red' | null = null;
        if (severity > 0.9) card = 'red';
        else if (severity > 0.6) card = 'yellow';
        if (card) {
          const who = ev.defender_id;
          console.log('[UnifiedSim][Referee] CARD', { tick: G.tick, player: who, card });
          G.commentary_log.push(`${card.toUpperCase()} card shown!`);
        }
        // Restart: free-kick for attacker team at location
        const atkPlayer = G.all_players.find(p => p.id === ev.attacker_id)!;
        const location = ev.location;
        const attacking_team_id = atkPlayer.team_id;
        G.ball.scheduled_events.push({ tick: G.tick + 2, type: 'set_piece', subtype: 'free_kick', location, attacking_team_id });
        console.log('[UnifiedSim][Referee] RESTART_FREE_KICK', { tick: G.tick, location });
      }
    }
    // Clear recent contests after processing
    G.recent_contests = [];
  }
  // Injuries
  for (const p of G.all_players) {
    if (p.dynamic.stamina < 10 && Math.random() < 0.0005) {
      p.dynamic.is_injured = true;
      p.dynamic.current_action = null;
      G.commentary_log.push(`${p.name} picks up a knock.`);
      console.log('[UnifiedSim][Referee] INJURY', { tick: G.tick, player: p.id });
    }
  }
}

export function foul_probability(defAggression: number, attComposure: number, strictness: number) {
  // Simple model: base plus aggression vs composure plus ref strictness
  return Math.min(0.6, Math.max(0, 0.02 + (defAggression - attComposure) * 0.003 + strictness * 0.005));
}


