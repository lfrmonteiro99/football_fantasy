Unified Simulator – Implementation TODO with Algorithm (tracked with logs)

1) Formation & Tactics
   - Algorithm:
     assign_base_positions_by_formation(team_home)
     assign_base_positions_by_formation(team_away)
     update_team_phases_and_dynamic_tactics(GameState) per tick:
       team.ball_owned = (ball.holder_id != null) && (holder.team_id == team.id)
       if ball_owned: phase='attack'
       else if ball free and recently contested: phase='transition'
       else: phase='defence'
       if minute>=75 and team.is_losing(): adjust_to_more_attacking
       if minute>=80 and team.is_winning(): adjust_to_more_defensive
   - LOG: [Formation] assignments; [Phase] per-tick.

2) Off-ball Intelligence
   - Algorithm:
     compute_player_intent per player using PRESS_RADIUS and base_position; add run triggers when space_ahead large; marking/pressing when in defence; respect tactic width/line depth.
   - LOG: [OffBall] intent target and reason.

3) Memory / Anti-oscillation
   - Algorithm:
     player.dynamic.memory: last_failed_action, fail_counts; if fail_counts[action]>=N then dampen weight for that action; cool down reconsideration only when timers or cooldowns permit.
   - LOG: [Memory] increments and dampening decisions.

4) Full Action Set
   - Algorithm:
     include 'cross','clear','intercept','save','first_touch' outcomes and state transitions; use timers and cooldowns; resolve outcomes when action_timer==0.
   - LOG: [Action] CROSS/CLEAR/INTERCEPT with inputs/outcomes.

5) Contest Resolver Depth
   - Algorithm:
     In resolve_pass_arrival: compute time_to_ball + line distance/angle to pass line; add intended receiver first_touch bias; aerial vs ground toggle; smallest score wins.
   - LOG: [Contest] candidates with dist_to_line, ttb, bonuses.

6) Set Pieces
   - Algorithm:
     detect ball_out_of_bounds -> schedule set_piece(type, location, execute_tick); position players into slots; execute kick; schedule arrival; re-enter play.
   - LOG: [SetPiece] detected, positioned, executed.

7) Referee Decisions
   - Algorithm:
     for contests (tackles/aerial): compute foul prob; if foul -> whistle, maybe advantage; card thresholds with Y/R; restart type and location.
   - LOG: [Referee] FOUL, CARD, ADVANTAGE, RESTART.

8) Stamina/Morale/Momentum
   - Algorithm:
     exertion per tick -> stamina decay; fatigue penalties; morale/confidence impact on decision weights; team momentum swings on events; clamp 0..1.
   - LOG: [Physio] stamina/fatigue deltas; [Momentum] updates.

9) Substitutions
   - Algorithm:
     triggers: injury or stamina<thresh or tactical; select bench by role; perform_substitution and update subs_left.
   - LOG: [Subs] out/in and reason.

10) Spatial Index
   - Algorithm:
     grid/quadtree build; on movement, update buckets; use for perception queries (nearby within radius).
   - LOG: [Spatial] build/update timings and counts.

11) Commentary/Events
   - Algorithm:
     filter_recent_high_importance_events(); append_to_commentary; throttle off-ball flavor with MAX_OFFBALL_EVENTS_PER_5S.
   - LOG: [Commentary] enqueued/highlighted.

12) RabbitMQ Integration
   - Algorithm:
     consume job with full formations/tactics/players; publish tick snapshots (throttled) and final summary; apply QoS/prefetch.
   - LOG: [AMQP] publish counts and queue lag.


