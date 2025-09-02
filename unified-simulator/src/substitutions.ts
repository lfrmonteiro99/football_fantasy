import { GameState, Player, Team } from './types';

const log = (...a: any[]) => console.log('[UnifiedSim][Subs]', ...a);

function pick_low_stamina_or_injured_player(team: Team): Player | undefined {
  const onPitch = [...team.players].filter(p => !p.dynamic.is_injured);
  const byStamina = onPitch.sort((a, b) => a.dynamic.stamina - b.dynamic.stamina);
  return byStamina[0];
}

function select_best_bench_sub(team: Team, role: string): Player | undefined {
  const bench = team.bench || [];
  const sameRole = bench.filter(p => p.role === role);
  return (sameRole[0] || bench[0]);
}

export function handle_substitutions_and_tactical_changes(G: GameState) {
  for (const team of [G.teams.home, G.teams.away]) {
    if ((team.subs_left || 0) <= 0) continue;
    const out = pick_low_stamina_or_injured_player(team);
    if (!out || out.dynamic.stamina > 20) continue;
    const sub = select_best_bench_sub(team, out.role);
    if (!sub) continue;
    // Perform substitution
    team.players = team.players.filter(p => p.id !== out.id);
    team.players.push(sub);
    team.bench = (team.bench || []).filter(p => p.id !== sub.id);
    team.subs_left = (team.subs_left || 0) - 1;
    log('APPLY', { team: team.name, out: out.id, in: sub.id });
  }
}


