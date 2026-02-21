mod commands;
mod db;
mod models;
mod simulation;

use db::Database;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            // Use app data directory for the database
            let app_dir = app.path().app_data_dir().expect("Failed to get app data dir");
            std::fs::create_dir_all(&app_dir).ok();
            let db_path = app_dir.join("football_fantasy.sqlite");

            let database = Database::new(db_path.to_str().unwrap())
                .expect("Failed to open database");
            database.initialize().expect("Failed to initialize database");

            app.manage(database);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // Auth
            commands::login,
            commands::register,
            commands::get_profile,
            commands::get_available_teams,
            // Teams
            commands::get_team,
            commands::get_all_teams,
            commands::get_squad,
            commands::get_squad_stats,
            // Players
            commands::get_player,
            commands::get_player_attributes,
            // Formations
            commands::get_formations,
            commands::get_formation,
            // Tactics
            commands::get_team_tactics,
            commands::create_tactic,
            commands::update_tactic,
            commands::delete_tactic,
            commands::assign_tactic_to_team,
            // Matches
            commands::get_upcoming_matches,
            commands::get_team_matches,
            commands::get_match_details,
            commands::get_match_lineup,
            commands::save_match_lineup,
            commands::get_match_events,
            commands::reset_match,
            // Leagues
            commands::get_leagues,
            commands::get_standings,
            // Positions
            commands::get_positions,
            // Game Time
            commands::get_current_date,
            commands::advance_day,
            commands::advance_to_match,
            // Simulation
            commands::simulate_match,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
