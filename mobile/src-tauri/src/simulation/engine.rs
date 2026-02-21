use crate::models::*;
use rand::Rng;
use std::collections::HashMap;

pub struct SimulationEngine {
    home_team: Team,
    away_team: Team,
    home_squad: Vec<Player>,
    away_squad: Vec<Player>,
    home_attrs: HashMap<i64, PlayerAttributes>,
    away_attrs: HashMap<i64, PlayerAttributes>,
    home_formation: Option<Formation>,
    away_formation: Option<Formation>,
    // Runtime state
    score: Score,
    stats: MatchStats,
    ball: BallPosition,
    possession: String,
    zone: String,
    home_starters: Vec<Player>,
    away_starters: Vec<Player>,
    player_fatigue: HashMap<i64, f64>,
    player_yellow_cards: HashMap<i64, i64>,
    player_sent_off: HashMap<i64, bool>,
}

impl SimulationEngine {
    pub fn new(
        home_team: Team,
        away_team: Team,
        home_squad: Vec<Player>,
        away_squad: Vec<Player>,
        home_attrs: HashMap<i64, PlayerAttributes>,
        away_attrs: HashMap<i64, PlayerAttributes>,
        home_formation: Option<Formation>,
        away_formation: Option<Formation>,
    ) -> Self {
        Self {
            home_team,
            away_team,
            home_squad,
            away_squad,
            home_attrs,
            away_attrs,
            home_formation,
            away_formation,
            score: Score { home: 0, away: 0 },
            stats: MatchStats { home: TeamStats::new(), away: TeamStats::new() },
            ball: BallPosition { x: 50.0, y: 34.0 },
            possession: "home".to_string(),
            zone: "mid".to_string(),
            home_starters: Vec::new(),
            away_starters: Vec::new(),
            player_fatigue: HashMap::new(),
            player_yellow_cards: HashMap::new(),
            player_sent_off: HashMap::new(),
        }
    }

    pub fn get_lineup_data(&self) -> LineupData {
        let home_positions = self.parse_formation_positions(&self.home_formation);
        let away_positions = self.parse_formation_positions(&self.away_formation);

        let home = self.home_squad.iter().take(11).enumerate().map(|(i, p)| {
            let (x, y) = home_positions.get(i).map(|fp| (fp.x, fp.y)).unwrap_or((50.0, 50.0));
            LineupPlayer {
                id: p.id,
                name: format!("{} {}", p.first_name, p.last_name),
                shirt_number: p.shirt_number.unwrap_or((i + 1) as i64),
                position: p.position_short.clone().unwrap_or_else(|| "CM".to_string()),
                x, y,
                team: "home".to_string(),
            }
        }).collect();

        let away = self.away_squad.iter().take(11).enumerate().map(|(i, p)| {
            let (x, y) = away_positions.get(i).map(|fp| (100.0 - fp.x, fp.y)).unwrap_or((50.0, 50.0));
            LineupPlayer {
                id: p.id,
                name: format!("{} {}", p.first_name, p.last_name),
                shirt_number: p.shirt_number.unwrap_or((i + 1) as i64),
                position: p.position_short.clone().unwrap_or_else(|| "CM".to_string()),
                x, y,
                team: "away".to_string(),
            }
        }).collect();

        LineupData { home, away }
    }

    fn parse_formation_positions(&self, formation: &Option<Formation>) -> Vec<FormationPosition> {
        formation.as_ref().and_then(|f| {
            serde_json::from_str::<Vec<FormationPosition>>(&f.positions).ok()
        }).unwrap_or_else(|| {
            // Default 4-4-2
            vec![
                FormationPosition { position: "GK".into(), x: 5.0, y: 34.0 },
                FormationPosition { position: "LB".into(), x: 20.0, y: 8.0 },
                FormationPosition { position: "CB".into(), x: 20.0, y: 24.0 },
                FormationPosition { position: "CB".into(), x: 20.0, y: 44.0 },
                FormationPosition { position: "RB".into(), x: 20.0, y: 60.0 },
                FormationPosition { position: "LM".into(), x: 45.0, y: 8.0 },
                FormationPosition { position: "CM".into(), x: 45.0, y: 24.0 },
                FormationPosition { position: "CM".into(), x: 45.0, y: 44.0 },
                FormationPosition { position: "RM".into(), x: 45.0, y: 60.0 },
                FormationPosition { position: "ST".into(), x: 75.0, y: 24.0 },
                FormationPosition { position: "ST".into(), x: 75.0, y: 44.0 },
            ]
        })
    }

    fn get_attr(&self, player_id: i64, attr: &str) -> f64 {
        let attrs = self.home_attrs.get(&player_id)
            .or_else(|| self.away_attrs.get(&player_id));
        let base = match attrs {
            Some(a) => match attr {
                "finishing" => a.finishing,
                "heading" => a.heading,
                "long_shots" => a.long_shots,
                "passing" => a.passing,
                "tackling" => a.tackling,
                "technique" => a.technique,
                "crossing" => a.crossing,
                "dribbling" => a.dribbling,
                "composure" => a.composure,
                "decisions" => a.decisions,
                "off_the_ball" => a.off_the_ball,
                "positioning" => a.positioning,
                "vision" => a.vision,
                "pace" => a.pace,
                "strength" => a.strength,
                "aggression" => a.aggression,
                "bravery" => a.bravery,
                "anticipation" => a.anticipation,
                "concentration" => a.concentration,
                "marking" => a.marking,
                "reflexes" => a.reflexes,
                "handling" => a.handling,
                "aerial_reach" => a.aerial_reach,
                "one_on_ones" => a.one_on_ones,
                "penalty_taking" => a.penalty_taking,
                "free_kick_taking" => a.free_kick_taking,
                "corners" => a.corners,
                "flair" => a.flair,
                "stamina" => a.stamina,
                "work_rate" => a.work_rate,
                _ => 10,
            } as f64,
            None => 10.0,
        };

        // Apply fatigue modifier
        let fatigue = self.player_fatigue.get(&player_id).copied().unwrap_or(0.0);
        base * (1.0 - fatigue * 0.25)
    }

    fn pick_player(&self, side: &str) -> &Player {
        let squad = if side == "home" { &self.home_squad } else { &self.away_squad };
        let available: Vec<&Player> = squad.iter()
            .take(11)
            .filter(|p| !self.player_sent_off.get(&p.id).copied().unwrap_or(false))
            .collect();
        let mut rng = rand::thread_rng();
        available[rng.gen_range(0..available.len())]
    }

    fn pick_weighted_player(&self, side: &str, attr: &str) -> &Player {
        let squad = if side == "home" { &self.home_squad } else { &self.away_squad };
        let available: Vec<&Player> = squad.iter()
            .take(11)
            .filter(|p| !self.player_sent_off.get(&p.id).copied().unwrap_or(false))
            .collect();
        let weights: Vec<f64> = available.iter()
            .map(|p| self.get_attr(p.id, attr).max(1.0))
            .collect();
        let total: f64 = weights.iter().sum();
        let mut rng = rand::thread_rng();
        let mut r = rng.gen::<f64>() * total;
        for (i, w) in weights.iter().enumerate() {
            r -= w;
            if r <= 0.0 {
                return available[i];
            }
        }
        available.last().unwrap()
    }

    fn pick_goalkeeper(&self, side: &str) -> &Player {
        let squad = if side == "home" { &self.home_squad } else { &self.away_squad };
        squad.iter().find(|p| {
            p.position_short.as_deref() == Some("GK")
        }).unwrap_or(&squad[0])
    }

    fn opponent(side: &str) -> &str {
        if side == "home" { "away" } else { "home" }
    }

    fn inc_stat(&mut self, side: &str, stat: &str, amount: i64) {
        let team_stats = if side == "home" { &mut self.stats.home } else { &mut self.stats.away };
        match stat {
            "shots" => team_stats.shots += amount,
            "shots_on_target" => team_stats.shots_on_target += amount,
            "corners" => team_stats.corners += amount,
            "fouls" => team_stats.fouls += amount,
            "yellow_cards" => team_stats.yellow_cards += amount,
            "red_cards" => team_stats.red_cards += amount,
            "saves" => team_stats.saves += amount,
            "passes" => team_stats.passes += amount,
            "tackles" => team_stats.tackles += amount,
            "offsides" => team_stats.offsides += amount,
            _ => {}
        }
    }

    fn is_attacking_third(&self, side: &str) -> bool {
        if side == "home" { self.ball.x > 70.0 } else { self.ball.x < 30.0 }
    }

    fn move_ball_forward(&mut self, side: &str) {
        let mut rng = rand::thread_rng();
        let delta = rng.gen_range(5.0..15.0);
        if side == "home" {
            self.ball.x = (self.ball.x + delta).min(100.0);
        } else {
            self.ball.x = (self.ball.x - delta).max(0.0);
        }
        self.ball.y = (self.ball.y + rng.gen_range(-8.0..8.0)).clamp(0.0, 68.0);
    }

    fn jitter_ball(&mut self) {
        let mut rng = rand::thread_rng();
        self.ball.x = (self.ball.x + rng.gen_range(-3.0..3.0)).clamp(0.0, 100.0);
        self.ball.y = (self.ball.y + rng.gen_range(-3.0..3.0)).clamp(0.0, 68.0);
    }

    fn resolve_shot(&mut self, side: &str, minute: i64) -> Vec<SimulationEvent> {
        let mut events = Vec::new();
        let mut rng = rand::thread_rng();

        let shooter = self.pick_weighted_player(side, "finishing");
        let shooter_name = format!("{} {}", shooter.first_name, shooter.last_name);
        let shooter_id = shooter.id;
        let finishing = self.get_attr(shooter_id, "finishing");
        let composure = self.get_attr(shooter_id, "composure");

        let opp = Self::opponent(side);
        let gk = self.pick_goalkeeper(opp);
        let gk_name = format!("{} {}", gk.first_name, gk.last_name);
        let gk_id = gk.id;
        let gk_reflexes = self.get_attr(gk_id, "reflexes");

        self.inc_stat(side, "shots", 1);

        // Block chance (25% base - positioning)
        let block_chance = 0.25;
        if rng.gen::<f64>() < block_chance {
            events.push(SimulationEvent {
                event_type: "shot_blocked".into(),
                team: side.into(),
                primary_player: Some(shooter_name.clone()),
                secondary_player: None,
                description: format!("{}'s shot is blocked!", shooter_name),
                x: self.ball.x, y: self.ball.y,
                sequence: vec![],
            });
            // Corner chance after block
            if rng.gen::<f64>() < 0.4 {
                self.inc_stat(side, "corners", 1);
                events.push(SimulationEvent {
                    event_type: "corner".into(),
                    team: side.into(),
                    primary_player: None, secondary_player: None,
                    description: format!("Corner kick to {}", if side == "home" { &self.home_team.name } else { &self.away_team.name }),
                    x: if side == "home" { 100.0 } else { 0.0 }, y: self.ball.y,
                    sequence: vec![],
                });
            }
            return events;
        }

        // Miss chance (40% base - finishing/composure)
        let miss_chance = 0.40 - (finishing + composure) / 80.0 * 0.15;
        if rng.gen::<f64>() < miss_chance {
            events.push(SimulationEvent {
                event_type: "shot_off_target".into(),
                team: side.into(),
                primary_player: Some(shooter_name.clone()),
                secondary_player: None,
                description: format!("{} fires wide!", shooter_name),
                x: self.ball.x, y: self.ball.y,
                sequence: vec![],
            });
            return events;
        }

        // On target
        self.inc_stat(side, "shots_on_target", 1);

        // Goal chance (25% of on-target)
        let goal_chance = 0.25 + (finishing - 10.0) / 40.0 * 0.1;
        if rng.gen::<f64>() < goal_chance {
            if side == "home" { self.score.home += 1; } else { self.score.away += 1; }
            events.push(SimulationEvent {
                event_type: "goal".into(),
                team: side.into(),
                primary_player: Some(shooter_name.clone()),
                secondary_player: None,
                description: format!("GOAL! {} scores!", shooter_name),
                x: if side == "home" { 95.0 } else { 5.0 },
                y: 34.0,
                sequence: vec![],
            });
            self.ball = BallPosition { x: 50.0, y: 34.0 };
            self.possession = opp.to_string();
            return events;
        }

        // Save
        self.inc_stat(opp, "saves", 1);
        events.push(SimulationEvent {
            event_type: "save".into(),
            team: opp.into(),
            primary_player: Some(gk_name.clone()),
            secondary_player: Some(shooter_name.clone()),
            description: format!("Great save by {}!", gk_name),
            x: self.ball.x, y: self.ball.y,
            sequence: vec![],
        });

        // Corner after save
        if rng.gen::<f64>() < 0.5 {
            self.inc_stat(side, "corners", 1);
        }

        events
    }

    fn simulate_foul(&mut self, side: &str) -> Vec<SimulationEvent> {
        let mut events = Vec::new();
        let mut rng = rand::thread_rng();

        let opp = Self::opponent(side);
        let fouler = self.pick_weighted_player(opp, "aggression");
        let fouler_name = format!("{} {}", fouler.first_name, fouler.last_name);
        let fouler_id = fouler.id;
        let fouled = self.pick_player(side);
        let fouled_name = format!("{} {}", fouled.first_name, fouled.last_name);

        self.inc_stat(opp, "fouls", 1);

        events.push(SimulationEvent {
            event_type: "foul".into(),
            team: opp.into(),
            primary_player: Some(fouler_name.clone()),
            secondary_player: Some(fouled_name),
            description: format!("Foul by {}", fouler_name),
            x: self.ball.x, y: self.ball.y,
            sequence: vec![],
        });

        // Yellow card (13% + aggression modifier)
        let aggression = self.get_attr(fouler_id, "aggression");
        let card_chance = 0.13 + (aggression - 10.0) / 20.0 * 0.07;
        if rng.gen::<f64>() < card_chance {
            let prev_yellows = self.player_yellow_cards.get(&fouler_id).copied().unwrap_or(0);
            if prev_yellows >= 1 {
                // Second yellow = red
                self.player_sent_off.insert(fouler_id, true);
                self.inc_stat(opp, "yellow_cards", 1);
                self.inc_stat(opp, "red_cards", 1);
                events.push(SimulationEvent {
                    event_type: "second_yellow".into(),
                    team: opp.into(),
                    primary_player: Some(fouler_name.clone()),
                    secondary_player: None,
                    description: format!("Second yellow card! {} is sent off!", fouler_name),
                    x: self.ball.x, y: self.ball.y,
                    sequence: vec![],
                });
            } else {
                *self.player_yellow_cards.entry(fouler_id).or_insert(0) += 1;
                self.inc_stat(opp, "yellow_cards", 1);
                events.push(SimulationEvent {
                    event_type: "yellow_card".into(),
                    team: opp.into(),
                    primary_player: Some(fouler_name.clone()),
                    secondary_player: None,
                    description: format!("Yellow card for {}", fouler_name),
                    x: self.ball.x, y: self.ball.y,
                    sequence: vec![],
                });
            }
        }

        // Straight red (very rare)
        if rng.gen::<f64>() < 0.005 {
            self.player_sent_off.insert(fouler_id, true);
            self.inc_stat(opp, "red_cards", 1);
            events.push(SimulationEvent {
                event_type: "red_card".into(),
                team: opp.into(),
                primary_player: Some(fouler_name.clone()),
                secondary_player: None,
                description: format!("Straight red card for {}!", fouler_name),
                x: self.ball.x, y: self.ball.y,
                sequence: vec![],
            });
        }

        events
    }

    fn build_commentary(&self, events: &[SimulationEvent], minute: i64) -> String {
        if events.is_empty() {
            let poss_team = if self.possession == "home" { &self.home_team.name } else { &self.away_team.name };
            return format!("{}' - {} keep possession in midfield.", minute, poss_team);
        }
        events.iter().map(|e| format!("{}' - {}", minute, e.description)).collect::<Vec<_>>().join(" ")
    }

    pub fn simulate(&mut self) -> Vec<SimulationTick> {
        let mut ticks = Vec::new();
        let mut rng = rand::thread_rng();

        // Select starters
        self.home_starters = self.home_squad.iter().take(11).cloned().collect();
        self.away_starters = self.away_squad.iter().take(11).cloned().collect();

        // First half
        self.ball = BallPosition { x: 50.0, y: 34.0 };
        self.possession = "home".to_string();

        let injury_time_h1 = rng.gen_range(1..=4);
        for minute in 1..=(45 + injury_time_h1) {
            let tick = self.simulate_minute(minute);
            ticks.push(tick);
        }

        // Half time
        ticks.push(SimulationTick {
            minute: 45,
            phase: "half_time".into(),
            possession: self.possession.clone(),
            zone: "mid".into(),
            ball: BallPosition { x: 50.0, y: 34.0 },
            events: vec![],
            score: self.score.clone(),
            stats: self.stats.clone(),
            commentary: format!("Half time! {} {} - {} {}", self.home_team.name, self.score.home, self.score.away, self.away_team.name),
        });

        // Second half
        self.ball = BallPosition { x: 50.0, y: 34.0 };
        self.possession = "away".to_string();

        let injury_time_h2 = rng.gen_range(1..=5);
        for minute in 46..=(90 + injury_time_h2) {
            let tick = self.simulate_minute(minute);
            ticks.push(tick);
        }

        // Full time
        ticks.push(SimulationTick {
            minute: 90,
            phase: "full_time".into(),
            possession: self.possession.clone(),
            zone: "mid".into(),
            ball: BallPosition { x: 50.0, y: 34.0 },
            events: vec![],
            score: self.score.clone(),
            stats: self.stats.clone(),
            commentary: format!("Full time! {} {} - {} {}", self.home_team.name, self.score.home, self.score.away, self.away_team.name),
        });

        // Update possession stats
        let total_minutes = ticks.len() as f64;
        let home_poss_min = ticks.iter().filter(|t| t.possession == "home").count() as f64;
        self.stats.home.possession_pct = (home_poss_min / total_minutes * 100.0).round();
        self.stats.away.possession_pct = 100.0 - self.stats.home.possession_pct;
        if let Some(last) = ticks.last_mut() {
            last.stats = self.stats.clone();
        }

        ticks
    }

    fn simulate_minute(&mut self, minute: i64) -> SimulationTick {
        let mut rng = rand::thread_rng();
        let mut events = Vec::new();
        let side = self.possession.clone();

        // Update fatigue after 60 min
        if minute > 60 {
            for p in self.home_starters.iter().chain(self.away_starters.iter()) {
                let stamina = self.get_attr(p.id, "stamina");
                let rate = 0.01 * (1.0 - stamina / 40.0).max(0.2);
                let f = self.player_fatigue.entry(p.id).or_insert(0.0);
                *f = (*f + rate).min(1.0);
            }
        }

        // Background passing (3-8 actions per minute)
        let pass_count = rng.gen_range(3..=8);
        for _ in 0..pass_count {
            self.inc_stat(&side, "passes", 1);
            self.jitter_ball();
        }

        // Move ball forward
        if rng.gen::<f64>() < 0.6 {
            self.move_ball_forward(&side);
        }

        // Decision tree
        let in_attacking = self.is_attacking_third(&side);

        // Shot attempt
        let shot_chance = if in_attacking { 0.15 } else { 0.03 };
        if rng.gen::<f64>() < shot_chance {
            events.extend(self.resolve_shot(&side, minute));
        }
        // Foul
        else if rng.gen::<f64>() < 0.08 {
            events.extend(self.simulate_foul(&side));
        }
        // Defensive action / turnover
        else if rng.gen::<f64>() < 0.20 {
            let opp = Self::opponent(&side).to_string();
            let tackler = self.pick_weighted_player(&opp, "tackling");
            let tackler_name = format!("{} {}", tackler.first_name, tackler.last_name);
            self.inc_stat(&opp, "tackles", 1);
            events.push(SimulationEvent {
                event_type: "tackle".into(),
                team: opp.clone(),
                primary_player: Some(tackler_name.clone()),
                secondary_player: None,
                description: format!("Good tackle by {}", tackler_name),
                x: self.ball.x, y: self.ball.y,
                sequence: vec![],
            });
            self.possession = opp;
        }
        // Offside
        else if in_attacking && rng.gen::<f64>() < 0.06 {
            self.inc_stat(&side, "offsides", 1);
            let opp = Self::opponent(&side).to_string();
            events.push(SimulationEvent {
                event_type: "offside".into(),
                team: side.clone(),
                primary_player: None, secondary_player: None,
                description: "Offside! The flag is up.".into(),
                x: self.ball.x, y: self.ball.y,
                sequence: vec![],
            });
            self.possession = opp;
        }

        // Resolve possession flip
        if rng.gen::<f64>() < 0.35 {
            self.possession = Self::opponent(&self.possession).to_string();
        }

        // Update zone
        self.zone = if self.ball.x < 33.0 {
            if self.possession == "home" { "def_home" } else { "att_away" }
        } else if self.ball.x > 67.0 {
            if self.possession == "home" { "att_home" } else { "def_away" }
        } else {
            "mid"
        }.to_string();

        let phase = if events.iter().any(|e| e.event_type == "goal" || e.event_type == "shot_blocked" || e.event_type == "save") {
            format!("attack_{}", side)
        } else {
            "open_play".to_string()
        };

        let commentary = self.build_commentary(&events, minute);

        SimulationTick {
            minute,
            phase,
            possession: self.possession.clone(),
            zone: self.zone.clone(),
            ball: self.ball.clone(),
            events,
            score: self.score.clone(),
            stats: self.stats.clone(),
            commentary,
        }
    }
}
