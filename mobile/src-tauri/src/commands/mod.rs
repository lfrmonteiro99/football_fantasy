use tauri::{AppHandle, State, Window, Emitter};
use crate::db::Database;
use crate::models::*;
use crate::simulation::engine::SimulationEngine;

type CmdResult<T> = Result<T, String>;

fn map_err<E: std::fmt::Display>(e: E) -> String {
    e.to_string()
}

// ── Auth Commands ──

#[tauri::command]
pub fn login(db: State<Database>, email: String, password: String) -> CmdResult<User> {
    let user = db.get_user_by_email(&email).map_err(map_err)?;
    match user {
        Some(u) => {
            // In a real app we'd verify the password hash
            Ok(u)
        }
        None => Err("Invalid credentials".to_string()),
    }
}

#[tauri::command]
pub fn register(db: State<Database>, name: String, email: String, password: String, managed_team_id: i64) -> CmdResult<User> {
    let payload = RegisterPayload { name, email, password, managed_team_id };
    db.create_user(&payload).map_err(map_err)
}

#[tauri::command]
pub fn get_profile(db: State<Database>, user_id: i64) -> CmdResult<Option<User>> {
    db.get_user(user_id).map_err(map_err)
}

#[tauri::command]
pub fn get_available_teams(db: State<Database>) -> CmdResult<Vec<Team>> {
    db.get_available_teams().map_err(map_err)
}

// ── Team Commands ──

#[tauri::command]
pub fn get_team(db: State<Database>, team_id: i64) -> CmdResult<Option<Team>> {
    db.get_team(team_id).map_err(map_err)
}

#[tauri::command]
pub fn get_all_teams(db: State<Database>) -> CmdResult<Vec<Team>> {
    db.get_all_teams().map_err(map_err)
}

#[tauri::command]
pub fn get_squad(db: State<Database>, team_id: i64) -> CmdResult<Vec<Player>> {
    db.get_squad(team_id).map_err(map_err)
}

#[tauri::command]
pub fn get_squad_stats(db: State<Database>, team_id: i64) -> CmdResult<SquadStats> {
    db.get_squad_stats(team_id).map_err(map_err)
}

// ── Player Commands ──

#[tauri::command]
pub fn get_player(db: State<Database>, player_id: i64) -> CmdResult<Option<Player>> {
    db.get_player(player_id).map_err(map_err)
}

#[tauri::command]
pub fn get_player_attributes(db: State<Database>, player_id: i64) -> CmdResult<Option<PlayerAttributes>> {
    db.get_player_attributes(player_id).map_err(map_err)
}

// ── Formation Commands ──

#[tauri::command]
pub fn get_formations(db: State<Database>) -> CmdResult<Vec<Formation>> {
    db.get_formations().map_err(map_err)
}

#[tauri::command]
pub fn get_formation(db: State<Database>, formation_id: i64) -> CmdResult<Option<Formation>> {
    db.get_formation(formation_id).map_err(map_err)
}

// ── Tactic Commands ──

#[tauri::command]
pub fn get_team_tactics(db: State<Database>, team_id: i64) -> CmdResult<Vec<Tactic>> {
    db.get_team_tactics(team_id).map_err(map_err)
}

#[tauri::command]
pub fn create_tactic(db: State<Database>, payload: CreateTacticPayload) -> CmdResult<Tactic> {
    db.create_tactic(&payload).map_err(map_err)
}

#[tauri::command]
pub fn update_tactic(db: State<Database>, tactic_id: i64, payload: UpdateTacticPayload) -> CmdResult<()> {
    db.update_tactic(tactic_id, &payload).map_err(map_err)
}

#[tauri::command]
pub fn delete_tactic(db: State<Database>, tactic_id: i64) -> CmdResult<()> {
    db.delete_tactic(tactic_id).map_err(map_err)
}

#[tauri::command]
pub fn assign_tactic_to_team(db: State<Database>, tactic_id: i64, team_id: i64, is_primary: bool) -> CmdResult<()> {
    db.assign_tactic_to_team(tactic_id, team_id, is_primary).map_err(map_err)
}

// ── Match Commands ──

#[tauri::command]
pub fn get_upcoming_matches(db: State<Database>, league_id: Option<i64>, limit: Option<i64>) -> CmdResult<Vec<GameMatch>> {
    db.get_upcoming_matches(league_id, limit.unwrap_or(10)).map_err(map_err)
}

#[tauri::command]
pub fn get_team_matches(db: State<Database>, team_id: i64) -> CmdResult<Vec<GameMatch>> {
    db.get_team_matches(team_id).map_err(map_err)
}

#[tauri::command]
pub fn get_match_details(db: State<Database>, match_id: i64) -> CmdResult<Option<GameMatch>> {
    db.get_match(match_id).map_err(map_err)
}

#[tauri::command]
pub fn get_match_lineup(db: State<Database>, match_id: i64, team_id: i64) -> CmdResult<Vec<MatchLineup>> {
    db.get_match_lineup(match_id, team_id).map_err(map_err)
}

#[tauri::command]
pub fn save_match_lineup(db: State<Database>, match_id: i64, team_id: i64, payload: SaveLineupPayload) -> CmdResult<()> {
    db.save_match_lineup(match_id, team_id, &payload).map_err(map_err)
}

#[tauri::command]
pub fn get_match_events(db: State<Database>, match_id: i64) -> CmdResult<Vec<MatchEvent>> {
    db.get_match_events(match_id).map_err(map_err)
}

#[tauri::command]
pub fn reset_match(db: State<Database>, match_id: i64) -> CmdResult<()> {
    db.reset_match(match_id).map_err(map_err)
}

// ── League Commands ──

#[tauri::command]
pub fn get_leagues(db: State<Database>) -> CmdResult<Vec<League>> {
    db.get_leagues().map_err(map_err)
}

#[tauri::command]
pub fn get_standings(db: State<Database>, league_id: i64) -> CmdResult<Vec<StandingEntry>> {
    db.get_standings(league_id).map_err(map_err)
}

// ── Position Commands ──

#[tauri::command]
pub fn get_positions(db: State<Database>) -> CmdResult<Vec<Position>> {
    db.get_positions().map_err(map_err)
}

// ── Game Time Commands ──

#[tauri::command]
pub fn get_current_date(db: State<Database>, user_id: i64) -> CmdResult<GameTimeResponse> {
    let user = db.get_user(user_id).map_err(map_err)?.ok_or("User not found")?;
    let game_date = user.game_date.unwrap_or_else(|| "2025-08-01".to_string());
    let team_id = user.managed_team_id.ok_or("No team assigned")?;

    let next_match = db.get_next_match(team_id, &game_date).map_err(map_err)?;
    let days_until = next_match.as_ref().and_then(|m| {
        let md = m.match_date.as_ref()?;
        let match_date = chrono::NaiveDate::parse_from_str(md.split('T').next().unwrap_or(md), "%Y-%m-%d").ok()?;
        let current = chrono::NaiveDate::parse_from_str(&game_date, "%Y-%m-%d").ok()?;
        Some((match_date - current).num_days())
    });
    let is_match_day = days_until == Some(0);

    let formatted = chrono::NaiveDate::parse_from_str(&game_date, "%Y-%m-%d")
        .map(|d| d.format("%A, %B %e, %Y").to_string())
        .unwrap_or_else(|_| game_date.clone());

    Ok(GameTimeResponse {
        current_date: game_date,
        formatted_date: formatted,
        next_match,
        days_until_match: days_until,
        is_match_day,
    })
}

#[tauri::command]
pub fn advance_day(db: State<Database>, user_id: i64) -> CmdResult<GameTimeResponse> {
    let user = db.get_user(user_id).map_err(map_err)?.ok_or("User not found")?;
    let game_date = user.game_date.unwrap_or_else(|| "2025-08-01".to_string());
    let current = chrono::NaiveDate::parse_from_str(&game_date, "%Y-%m-%d").map_err(map_err)?;
    let next = current + chrono::Duration::days(1);
    let new_date = next.format("%Y-%m-%d").to_string();
    db.update_game_date(user_id, &new_date).map_err(map_err)?;
    get_current_date(db, user_id)
}

#[tauri::command]
pub fn advance_to_match(db: State<Database>, user_id: i64) -> CmdResult<GameTimeResponse> {
    let user = db.get_user(user_id).map_err(map_err)?.ok_or("User not found")?;
    let game_date = user.game_date.unwrap_or_else(|| "2025-08-01".to_string());
    let team_id = user.managed_team_id.ok_or("No team assigned")?;

    if let Some(next_match) = db.get_next_match(team_id, &game_date).map_err(map_err)? {
        if let Some(md) = &next_match.match_date {
            let date_str = md.split('T').next().unwrap_or(md);
            db.update_game_date(user_id, date_str).map_err(map_err)?;
        }
    }
    get_current_date(db, user_id)
}

// ── Simulation Command ──

#[tauri::command]
pub async fn simulate_match(window: Window, db: State<'_, Database>, match_id: i64, speed: String) -> CmdResult<()> {
    let game_match = db.get_match(match_id).map_err(map_err)?.ok_or("Match not found")?;
    if game_match.status == "completed" {
        return Err("Match already completed".to_string());
    }

    let home_team = db.get_team(game_match.home_team_id).map_err(map_err)?.ok_or("Home team not found")?;
    let away_team = db.get_team(game_match.away_team_id).map_err(map_err)?.ok_or("Away team not found")?;

    let home_squad = db.get_squad(game_match.home_team_id).map_err(map_err)?;
    let away_squad = db.get_squad(game_match.away_team_id).map_err(map_err)?;

    let home_formation = game_match.home_formation_id
        .and_then(|fid| db.get_formation(fid).ok().flatten());
    let away_formation = game_match.away_formation_id
        .and_then(|fid| db.get_formation(fid).ok().flatten());

    // Load attributes for all players
    let mut home_attrs = std::collections::HashMap::new();
    for p in &home_squad {
        if let Ok(Some(attr)) = db.get_player_attributes(p.id) {
            home_attrs.insert(p.id, attr);
        }
    }
    let mut away_attrs = std::collections::HashMap::new();
    for p in &away_squad {
        if let Ok(Some(attr)) = db.get_player_attributes(p.id) {
            away_attrs.insert(p.id, attr);
        }
    }

    let delay_ms = match speed.as_str() {
        "slow" => 5000u64,
        "realtime" => 2500,
        "fast" => 500,
        _ => 0,
    };

    let mut engine = SimulationEngine::new(
        home_team.clone(),
        away_team.clone(),
        home_squad,
        away_squad,
        home_attrs,
        away_attrs,
        home_formation,
        away_formation,
    );

    // Emit lineup data
    let lineup_data = engine.get_lineup_data();
    let _ = window.emit("match:lineup", &lineup_data);

    // Run simulation
    let ticks = engine.simulate();
    for tick in &ticks {
        let _ = window.emit("match:minute", tick);

        // Emit specific events
        for event in &tick.events {
            match event.event_type.as_str() {
                "goal" => { let _ = window.emit("match:goal", event); }
                "yellow_card" | "red_card" | "second_yellow" => { let _ = window.emit("match:card", event); }
                _ => {}
            }
        }

        if tick.phase == "half_time" {
            let _ = window.emit("match:half_time", tick);
        }

        if delay_ms > 0 {
            tokio::time::sleep(tokio::time::Duration::from_millis(delay_ms)).await;
        }
    }

    // Save results
    if let Some(last_tick) = ticks.last() {
        let stats_json = serde_json::to_string(&last_tick.stats).unwrap_or_default();
        let _ = db.save_match_result(match_id, last_tick.score.home, last_tick.score.away, &stats_json);

        // Save events
        for tick in &ticks {
            for event in &tick.events {
                if matches!(event.event_type.as_str(), "goal" | "yellow_card" | "red_card" | "second_yellow" | "foul" | "corner" | "substitution") {
                    let me = MatchEvent {
                        id: 0,
                        match_id,
                        minute: tick.minute,
                        event_type: event.event_type.clone(),
                        team_type: Some(event.team.clone()),
                        player_name: event.primary_player.clone(),
                        description: Some(event.description.clone()),
                        x_coordinate: Some(event.x),
                        y_coordinate: Some(event.y),
                        commentary: None,
                        sub_events: None,
                    };
                    let _ = db.save_match_event(&me);
                }
            }
        }

        let _ = window.emit("match:full_time", &ticks.last());
    }

    Ok(())
}
