import { GameState, Player } from './types';
import { queryNeighbors } from './spatial';

export type Perception = {
  dist_to_ball: number;
  nearby_teammates: Player[];
  nearby_opponents: Player[];
  passing_options: Player[];
  can_shoot: boolean;
  space_ahead: number;
};

export function build_perception(player: Player, G: GameState): Perception {
  const ball = G.ball;
  const dist_to_ball = Math.hypot(player.pos.x - ball.pos.x, player.pos.y - ball.pos.y);

  const teammatesAll = G.all_players.filter((p) => p.team_id === player.team_id && p.id !== player.id);
  const opponentsAll = G.all_players.filter((p) => p.team_id !== player.team_id);

  let nearby_teammates: Player[] = [];
  let nearby_opponents: Player[] = [];
  if (G.spatial_index) {
    const near = queryNeighbors(G.spatial_index, player.pos.x, player.pos.y, 30);
    nearby_teammates = near.filter(p => p.team_id === player.team_id && p.id !== player.id);
    nearby_opponents = near.filter(p => p.team_id !== player.team_id);
  } else {
    nearby_teammates = teammatesAll.filter((t) => Math.hypot(t.pos.x - player.pos.x, t.pos.y - player.pos.y) < 30);
    nearby_opponents = opponentsAll.filter((o) => Math.hypot(o.pos.x - player.pos.x, o.pos.y - player.pos.y) < 30);
  }

  // Simple passing options: teammates within 35 units and further than 5
  const passing_options = teammatesAll
    .filter((t) => {
      const d = Math.hypot(t.pos.x - player.pos.x, t.pos.y - player.pos.y);
      return d > 5 && d < 35;
    })
    .slice(0, 6);

  // Shooting check: if close to opponent goal area depending on team side
  const attackingRight = player.team_id === G.teams.home.id; // home attacks right for simplicity
  const xToGoal = attackingRight ? 100 - player.pos.x : player.pos.x;
  const can_shoot = xToGoal < 20; // within 20 units of goal line

  // Space ahead: naive (distance to closest opponent in forward cone)
  const forwardSign = attackingRight ? 1 : -1;
  const inFront = nearby_opponents.filter((o) => (o.pos.x - player.pos.x) * forwardSign > 0);
  const distances = inFront.map((o) => Math.hypot(o.pos.x - player.pos.x, o.pos.y - player.pos.y));
  const space_ahead = distances.length ? Math.min(...distances) : 30;

  return { dist_to_ball, nearby_teammates, nearby_opponents, passing_options, can_shoot, space_ahead };
}


