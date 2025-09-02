import { GameState, Player, PRESS_RADIUS, PERSONAL_SPACE, clamp } from './types';

export function compute_player_intent(player: Player, G: GameState) {
  // Off-ball intelligence by phase + simple tactical influences
  const phase = (player.team_id === G.teams.home.id ? G.teams.home.phase : G.teams.away.phase) || 'defence';
  const ball = G.ball;
  const dx = ball.pos.x - player.pos.x;
  const dy = ball.pos.y - player.pos.y;
  const dist = Math.hypot(dx, dy);

  // Tactic influences
  const team = player.team_id === G.teams.home.id ? G.teams.home : G.teams.away;
  const width = clamp(team.tactic?.width ?? 50, 0, 100);
  const lineDepth = clamp(team.tactic?.defensive_line_depth ?? 50, 0, 100);
  const pressing = clamp(team.tactic?.pressing_level ?? 50, 0, 100);

  // Base target from formation
  let target = { ...player.base_position };
  // Apply width preference: push wingers wider, central players keep center
  const lateralBias = ((player.role || '').includes('WM') || (player.role || '').includes('W') ? (width - 50) * 0.1 : 0);
  target.y = clamp(target.y + lateralBias, 0, 100);

  if (phase === 'attack') {
    // Support forward lanes; simple forward nudge based on line depth (higher means deeper defensive line, so smaller push)
    const forwardSign = team === G.teams.home ? 1 : -1;
    const forwardPush = (60 - lineDepth) * 0.05 * forwardSign;
    target.x = clamp(target.x + forwardPush, 0, 100);

    // Timed runs: if space ahead and not too close to others
    const spaceAhead = dist > PRESS_RADIUS ? 10 : Math.max(0, 20 - dist);
    if (spaceAhead > 8) {
      target.x = clamp(target.x + 3 * forwardSign, 0, 100);
    }
  } else if (phase === 'defence') {
    // Compact shape: pull slightly toward own goal line and toward base
    const backSign = team === G.teams.home ? -1 : 1;
    target.x = clamp(target.x + 2 * backSign, 0, 100);
    // Pressing near ball with cap on clustering
    if (dist < (PRESS_RADIUS * (0.5 + pressing / 200))) {
      // Count teammates already pressing
      const sameTeamPressing = G.all_players.filter(p => p.team_id === player.team_id && Math.hypot(p.pos.x - ball.pos.x, p.pos.y - ball.pos.y) < PERSONAL_SPACE * 3).length;
      if (sameTeamPressing < 2) {
        target = { x: ball.pos.x, y: ball.pos.y };
      }
    }
  } else {
    // transition: nearest few react
    if (dist < PRESS_RADIUS) {
      target = { x: ball.pos.x, y: ball.pos.y };
    }
  }

  player.dynamic.action_intent = { move_target: target };
}


