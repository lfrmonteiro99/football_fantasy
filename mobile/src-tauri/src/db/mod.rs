use rusqlite::{Connection, Result, params};
use std::sync::Mutex;
use crate::models::*;

pub struct Database {
    pub conn: Mutex<Connection>,
}

impl Database {
    pub fn new(path: &str) -> Result<Self> {
        let conn = Connection::open(path)?;
        conn.execute_batch("PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;")?;
        Ok(Self { conn: Mutex::new(conn) })
    }

    pub fn initialize(&self) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute_batch(include_str!("schema.sql"))?;
        Ok(())
    }

    // ── Auth ──

    pub fn get_user_by_email(&self, email: &str) -> Result<Option<User>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, name, email, managed_team_id, game_date FROM users WHERE email = ?1"
        )?;
        let mut rows = stmt.query(params![email])?;
        if let Some(row) = rows.next()? {
            Ok(Some(User {
                id: row.get(0)?,
                name: row.get(1)?,
                email: row.get(2)?,
                managed_team_id: row.get(3)?,
                game_date: row.get(4)?,
            }))
        } else {
            Ok(None)
        }
    }

    pub fn create_user(&self, payload: &RegisterPayload) -> Result<User> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "INSERT INTO users (name, email, password, managed_team_id, game_date) VALUES (?1, ?2, ?3, ?4, '2025-08-01')",
            params![payload.name, payload.email, payload.password, payload.managed_team_id],
        )?;
        let id = conn.last_insert_rowid();
        Ok(User {
            id,
            name: payload.name.clone(),
            email: payload.email.clone(),
            managed_team_id: Some(payload.managed_team_id),
            game_date: Some("2025-08-01".to_string()),
        })
    }

    pub fn get_user(&self, user_id: i64) -> Result<Option<User>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, name, email, managed_team_id, game_date FROM users WHERE id = ?1"
        )?;
        let mut rows = stmt.query(params![user_id])?;
        if let Some(row) = rows.next()? {
            Ok(Some(User {
                id: row.get(0)?,
                name: row.get(1)?,
                email: row.get(2)?,
                managed_team_id: row.get(3)?,
                game_date: row.get(4)?,
            }))
        } else {
            Ok(None)
        }
    }

    pub fn update_game_date(&self, user_id: i64, date: &str) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute("UPDATE users SET game_date = ?1 WHERE id = ?2", params![date, user_id])?;
        Ok(())
    }

    // ── Teams ──

    pub fn get_available_teams(&self) -> Result<Vec<Team>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT t.id, t.name, t.short_name, t.city, t.stadium_name, t.stadium_capacity,
                    t.league_id, t.budget, t.reputation, t.primary_color, t.secondary_color,
                    t.founded_year, t.primary_tactic_id
             FROM teams t
             LEFT JOIN users u ON u.managed_team_id = t.id
             WHERE u.id IS NULL
             ORDER BY t.name"
        )?;
        let teams = stmt.query_map([], |row| {
            Ok(Team {
                id: row.get(0)?,
                name: row.get(1)?,
                short_name: row.get(2)?,
                city: row.get(3)?,
                stadium_name: row.get(4)?,
                stadium_capacity: row.get(5)?,
                league_id: row.get(6)?,
                budget: row.get(7)?,
                reputation: row.get(8)?,
                primary_color: row.get(9)?,
                secondary_color: row.get(10)?,
                founded_year: row.get(11)?,
                primary_tactic_id: row.get(12)?,
            })
        })?.collect::<Result<Vec<_>>>()?;
        Ok(teams)
    }

    pub fn get_team(&self, team_id: i64) -> Result<Option<Team>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, name, short_name, city, stadium_name, stadium_capacity,
                    league_id, budget, reputation, primary_color, secondary_color,
                    founded_year, primary_tactic_id
             FROM teams WHERE id = ?1"
        )?;
        let mut rows = stmt.query(params![team_id])?;
        if let Some(row) = rows.next()? {
            Ok(Some(Team {
                id: row.get(0)?,
                name: row.get(1)?,
                short_name: row.get(2)?,
                city: row.get(3)?,
                stadium_name: row.get(4)?,
                stadium_capacity: row.get(5)?,
                league_id: row.get(6)?,
                budget: row.get(7)?,
                reputation: row.get(8)?,
                primary_color: row.get(9)?,
                secondary_color: row.get(10)?,
                founded_year: row.get(11)?,
                primary_tactic_id: row.get(12)?,
            }))
        } else {
            Ok(None)
        }
    }

    pub fn get_all_teams(&self) -> Result<Vec<Team>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, name, short_name, city, stadium_name, stadium_capacity,
                    league_id, budget, reputation, primary_color, secondary_color,
                    founded_year, primary_tactic_id
             FROM teams ORDER BY name"
        )?;
        let teams = stmt.query_map([], |row| {
            Ok(Team {
                id: row.get(0)?,
                name: row.get(1)?,
                short_name: row.get(2)?,
                city: row.get(3)?,
                stadium_name: row.get(4)?,
                stadium_capacity: row.get(5)?,
                league_id: row.get(6)?,
                budget: row.get(7)?,
                reputation: row.get(8)?,
                primary_color: row.get(9)?,
                secondary_color: row.get(10)?,
                founded_year: row.get(11)?,
                primary_tactic_id: row.get(12)?,
            })
        })?.collect::<Result<Vec<_>>>()?;
        Ok(teams)
    }

    // ── Squad / Players ──

    pub fn get_squad(&self, team_id: i64) -> Result<Vec<Player>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT p.id, p.first_name, p.last_name, p.date_of_birth, p.nationality,
                    p.preferred_foot, p.height_cm, p.weight_kg, p.team_id,
                    p.primary_position_id, p.market_value, p.wage_per_week,
                    p.shirt_number, p.is_injured, p.contract_start, p.contract_end,
                    pos.name, pos.short_name
             FROM players p
             LEFT JOIN positions pos ON pos.id = p.primary_position_id
             WHERE p.team_id = ?1
             ORDER BY pos.category, p.last_name"
        )?;
        let players = stmt.query_map(params![team_id], |row| {
            Ok(Player {
                id: row.get(0)?,
                first_name: row.get(1)?,
                last_name: row.get(2)?,
                date_of_birth: row.get(3)?,
                nationality: row.get(4)?,
                preferred_foot: row.get(5)?,
                height_cm: row.get(6)?,
                weight_kg: row.get(7)?,
                team_id: row.get(8)?,
                primary_position_id: row.get(9)?,
                market_value: row.get(10)?,
                wage_per_week: row.get(11)?,
                shirt_number: row.get(12)?,
                is_injured: row.get::<_, i64>(13)? != 0,
                contract_start: row.get(14)?,
                contract_end: row.get(15)?,
                position_name: row.get(16)?,
                position_short: row.get(17)?,
            })
        })?.collect::<Result<Vec<_>>>()?;
        Ok(players)
    }

    pub fn get_player(&self, player_id: i64) -> Result<Option<Player>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT p.id, p.first_name, p.last_name, p.date_of_birth, p.nationality,
                    p.preferred_foot, p.height_cm, p.weight_kg, p.team_id,
                    p.primary_position_id, p.market_value, p.wage_per_week,
                    p.shirt_number, p.is_injured, p.contract_start, p.contract_end,
                    pos.name, pos.short_name
             FROM players p
             LEFT JOIN positions pos ON pos.id = p.primary_position_id
             WHERE p.id = ?1"
        )?;
        let mut rows = stmt.query(params![player_id])?;
        if let Some(row) = rows.next()? {
            Ok(Some(Player {
                id: row.get(0)?,
                first_name: row.get(1)?,
                last_name: row.get(2)?,
                date_of_birth: row.get(3)?,
                nationality: row.get(4)?,
                preferred_foot: row.get(5)?,
                height_cm: row.get(6)?,
                weight_kg: row.get(7)?,
                team_id: row.get(8)?,
                primary_position_id: row.get(9)?,
                market_value: row.get(10)?,
                wage_per_week: row.get(11)?,
                shirt_number: row.get(12)?,
                is_injured: row.get::<_, i64>(13)? != 0,
                contract_start: row.get(14)?,
                contract_end: row.get(15)?,
                position_name: row.get(16)?,
                position_short: row.get(17)?,
            }))
        } else {
            Ok(None)
        }
    }

    pub fn get_player_attributes(&self, player_id: i64) -> Result<Option<PlayerAttributes>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT player_id, finishing, first_touch, free_kick_taking, heading, long_shots,
                    long_throws, marking, passing, penalty_taking, tackling, technique,
                    corners, crossing, dribbling,
                    aggression, anticipation, bravery, composure, concentration, decisions,
                    determination, flair, leadership, off_the_ball, positioning, teamwork,
                    vision, work_rate,
                    acceleration, agility, balance, jumping_reach, natural_fitness, pace,
                    stamina, strength,
                    aerial_reach, command_of_area, communication, eccentricity, handling,
                    kicking, one_on_ones, reflexes, rushing_out, throwing,
                    current_ability, potential_ability
             FROM player_attributes WHERE player_id = ?1"
        )?;
        let mut rows = stmt.query(params![player_id])?;
        if let Some(row) = rows.next()? {
            Ok(Some(PlayerAttributes {
                player_id: row.get(0)?,
                finishing: row.get(1)?,
                first_touch: row.get(2)?,
                free_kick_taking: row.get(3)?,
                heading: row.get(4)?,
                long_shots: row.get(5)?,
                long_throws: row.get(6)?,
                marking: row.get(7)?,
                passing: row.get(8)?,
                penalty_taking: row.get(9)?,
                tackling: row.get(10)?,
                technique: row.get(11)?,
                corners: row.get(12)?,
                crossing: row.get(13)?,
                dribbling: row.get(14)?,
                aggression: row.get(15)?,
                anticipation: row.get(16)?,
                bravery: row.get(17)?,
                composure: row.get(18)?,
                concentration: row.get(19)?,
                decisions: row.get(20)?,
                determination: row.get(21)?,
                flair: row.get(22)?,
                leadership: row.get(23)?,
                off_the_ball: row.get(24)?,
                positioning: row.get(25)?,
                teamwork: row.get(26)?,
                vision: row.get(27)?,
                work_rate: row.get(28)?,
                acceleration: row.get(29)?,
                agility: row.get(30)?,
                balance: row.get(31)?,
                jumping_reach: row.get(32)?,
                natural_fitness: row.get(33)?,
                pace: row.get(34)?,
                stamina: row.get(35)?,
                strength: row.get(36)?,
                aerial_reach: row.get(37)?,
                command_of_area: row.get(38)?,
                communication: row.get(39)?,
                eccentricity: row.get(40)?,
                handling: row.get(41)?,
                kicking: row.get(42)?,
                one_on_ones: row.get(43)?,
                reflexes: row.get(44)?,
                rushing_out: row.get(45)?,
                throwing: row.get(46)?,
                current_ability: row.get(47)?,
                potential_ability: row.get(48)?,
            }))
        } else {
            Ok(None)
        }
    }

    pub fn get_squad_stats(&self, team_id: i64) -> Result<SquadStats> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT COUNT(*), COALESCE(AVG(CAST((julianday('now') - julianday(p.date_of_birth)) / 365.25 AS INTEGER)), 0),
                    COALESCE(AVG(pa.current_ability), 0),
                    COALESCE(SUM(CASE WHEN p.is_injured = 1 THEN 1 ELSE 0 END), 0),
                    COALESCE(SUM(p.market_value), 0)
             FROM players p
             LEFT JOIN player_attributes pa ON pa.player_id = p.id
             WHERE p.team_id = ?1"
        )?;
        let mut rows = stmt.query(params![team_id])?;
        if let Some(row) = rows.next()? {
            Ok(SquadStats {
                total_players: row.get(0)?,
                avg_age: row.get(1)?,
                avg_rating: row.get(2)?,
                injured_count: row.get(3)?,
                total_value: row.get(4)?,
            })
        } else {
            Ok(SquadStats {
                total_players: 0, avg_age: 0.0, avg_rating: 0.0, injured_count: 0, total_value: 0.0,
            })
        }
    }

    // ── Formations ──

    pub fn get_formations(&self) -> Result<Vec<Formation>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, name, display_name, description, positions, style,
                    defenders_count, midfielders_count, forwards_count, is_active
             FROM formations WHERE is_active = 1 ORDER BY name"
        )?;
        let formations = stmt.query_map([], |row| {
            Ok(Formation {
                id: row.get(0)?,
                name: row.get(1)?,
                display_name: row.get(2)?,
                description: row.get(3)?,
                positions: row.get(4)?,
                style: row.get(5)?,
                defenders_count: row.get(6)?,
                midfielders_count: row.get(7)?,
                forwards_count: row.get(8)?,
                is_active: row.get::<_, i64>(9)? != 0,
            })
        })?.collect::<Result<Vec<_>>>()?;
        Ok(formations)
    }

    pub fn get_formation(&self, formation_id: i64) -> Result<Option<Formation>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, name, display_name, description, positions, style,
                    defenders_count, midfielders_count, forwards_count, is_active
             FROM formations WHERE id = ?1"
        )?;
        let mut rows = stmt.query(params![formation_id])?;
        if let Some(row) = rows.next()? {
            Ok(Some(Formation {
                id: row.get(0)?,
                name: row.get(1)?,
                display_name: row.get(2)?,
                description: row.get(3)?,
                positions: row.get(4)?,
                style: row.get(5)?,
                defenders_count: row.get(6)?,
                midfielders_count: row.get(7)?,
                forwards_count: row.get(8)?,
                is_active: row.get::<_, i64>(9)? != 0,
            }))
        } else {
            Ok(None)
        }
    }

    // ── Tactics ──

    pub fn get_team_tactics(&self, team_id: i64) -> Result<Vec<Tactic>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT t.id, t.name, t.description, t.formation_id, t.mentality,
                    t.team_instructions, t.pressing, t.tempo, t.width,
                    t.defensive_line, COALESCE(t.offside_trap, 0), COALESCE(t.play_out_of_defence, 0),
                    f.name
             FROM tactics t
             JOIN team_tactics tt ON tt.tactic_id = t.id
             LEFT JOIN formations f ON f.id = t.formation_id
             WHERE tt.team_id = ?1
             ORDER BY tt.is_primary DESC"
        )?;
        let tactics = stmt.query_map(params![team_id], |row| {
            Ok(Tactic {
                id: row.get(0)?,
                name: row.get(1)?,
                description: row.get(2)?,
                formation_id: row.get(3)?,
                mentality: row.get(4)?,
                team_instructions: row.get(5)?,
                pressing: row.get(6)?,
                tempo: row.get(7)?,
                width: row.get(8)?,
                defensive_line: row.get(9)?,
                offside_trap: row.get::<_, i64>(10)? != 0,
                play_out_of_defence: row.get::<_, i64>(11)? != 0,
                formation_name: row.get(12)?,
            })
        })?.collect::<Result<Vec<_>>>()?;
        Ok(tactics)
    }

    pub fn create_tactic(&self, payload: &CreateTacticPayload) -> Result<Tactic> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "INSERT INTO tactics (name, formation_id, mentality, team_instructions, pressing, tempo, width, defensive_line)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
            params![
                payload.name, payload.formation_id,
                payload.mentality.as_deref().unwrap_or("balanced"),
                payload.team_instructions.as_deref().unwrap_or("mixed"),
                payload.pressing.as_deref().unwrap_or("sometimes"),
                payload.tempo.as_deref().unwrap_or("standard"),
                payload.width.as_deref().unwrap_or("standard"),
                payload.defensive_line.as_deref().unwrap_or("standard"),
            ],
        )?;
        let id = conn.last_insert_rowid();
        let fname: Option<String> = conn.query_row(
            "SELECT name FROM formations WHERE id = ?1", params![payload.formation_id],
            |row| row.get(0),
        ).ok();
        Ok(Tactic {
            id,
            name: payload.name.clone(),
            description: None,
            formation_id: Some(payload.formation_id),
            mentality: Some(payload.mentality.as_deref().unwrap_or("balanced").to_string()),
            team_instructions: Some(payload.team_instructions.as_deref().unwrap_or("mixed").to_string()),
            pressing: Some(payload.pressing.as_deref().unwrap_or("sometimes").to_string()),
            tempo: Some(payload.tempo.as_deref().unwrap_or("standard").to_string()),
            width: Some(payload.width.as_deref().unwrap_or("standard").to_string()),
            defensive_line: Some(payload.defensive_line.as_deref().unwrap_or("standard").to_string()),
            offside_trap: false,
            play_out_of_defence: false,
            formation_name: fname,
        })
    }

    pub fn update_tactic(&self, tactic_id: i64, payload: &UpdateTacticPayload) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        if let Some(ref name) = payload.name {
            conn.execute("UPDATE tactics SET name = ?1 WHERE id = ?2", params![name, tactic_id])?;
        }
        if let Some(fid) = payload.formation_id {
            conn.execute("UPDATE tactics SET formation_id = ?1 WHERE id = ?2", params![fid, tactic_id])?;
        }
        if let Some(ref v) = payload.mentality {
            conn.execute("UPDATE tactics SET mentality = ?1 WHERE id = ?2", params![v, tactic_id])?;
        }
        if let Some(ref v) = payload.pressing {
            conn.execute("UPDATE tactics SET pressing = ?1 WHERE id = ?2", params![v, tactic_id])?;
        }
        if let Some(ref v) = payload.tempo {
            conn.execute("UPDATE tactics SET tempo = ?1 WHERE id = ?2", params![v, tactic_id])?;
        }
        if let Some(ref v) = payload.width {
            conn.execute("UPDATE tactics SET width = ?1 WHERE id = ?2", params![v, tactic_id])?;
        }
        if let Some(ref v) = payload.defensive_line {
            conn.execute("UPDATE tactics SET defensive_line = ?1 WHERE id = ?2", params![v, tactic_id])?;
        }
        Ok(())
    }

    pub fn delete_tactic(&self, tactic_id: i64) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute("DELETE FROM team_tactics WHERE tactic_id = ?1", params![tactic_id])?;
        conn.execute("DELETE FROM tactics WHERE id = ?1", params![tactic_id])?;
        Ok(())
    }

    pub fn assign_tactic_to_team(&self, tactic_id: i64, team_id: i64, is_primary: bool) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        if is_primary {
            conn.execute("UPDATE team_tactics SET is_primary = 0 WHERE team_id = ?1", params![team_id])?;
        }
        conn.execute(
            "INSERT OR REPLACE INTO team_tactics (team_id, tactic_id, is_primary, is_active) VALUES (?1, ?2, ?3, 1)",
            params![team_id, tactic_id, is_primary as i64],
        )?;
        Ok(())
    }

    // ── Matches ──

    pub fn get_upcoming_matches(&self, league_id: Option<i64>, limit: i64) -> Result<Vec<GameMatch>> {
        let conn = self.conn.lock().unwrap();
        let sql = format!(
            "SELECT m.id, m.home_team_id, m.away_team_id, m.league_id, m.season_id, m.manager_id,
                    m.match_date, m.matchday, m.home_formation_id, m.away_formation_id,
                    m.home_score, m.away_score, m.status, m.match_stats,
                    ht.name, at.name, ht.primary_color, at.primary_color,
                    hf.name, af.name
             FROM matches m
             JOIN teams ht ON ht.id = m.home_team_id
             JOIN teams at ON at.id = m.away_team_id
             LEFT JOIN formations hf ON hf.id = m.home_formation_id
             LEFT JOIN formations af ON af.id = m.away_formation_id
             WHERE m.status = 'scheduled'
             {} ORDER BY m.match_date ASC LIMIT ?",
            if league_id.is_some() { "AND m.league_id = ?" } else { "" }
        );
        let mut stmt = conn.prepare(&sql)?;
        let matches = if let Some(lid) = league_id {
            stmt.query_map(params![lid, limit], Self::map_match)?
                .collect::<Result<Vec<_>>>()?
        } else {
            stmt.query_map(params![limit], Self::map_match)?
                .collect::<Result<Vec<_>>>()?
        };
        Ok(matches)
    }

    pub fn get_team_matches(&self, team_id: i64) -> Result<Vec<GameMatch>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT m.id, m.home_team_id, m.away_team_id, m.league_id, m.season_id, m.manager_id,
                    m.match_date, m.matchday, m.home_formation_id, m.away_formation_id,
                    m.home_score, m.away_score, m.status, m.match_stats,
                    ht.name, at.name, ht.primary_color, at.primary_color,
                    hf.name, af.name
             FROM matches m
             JOIN teams ht ON ht.id = m.home_team_id
             JOIN teams at ON at.id = m.away_team_id
             LEFT JOIN formations hf ON hf.id = m.home_formation_id
             LEFT JOIN formations af ON af.id = m.away_formation_id
             WHERE m.home_team_id = ?1 OR m.away_team_id = ?1
             ORDER BY m.match_date ASC"
        )?;
        let matches = stmt.query_map(params![team_id], Self::map_match)?
            .collect::<Result<Vec<_>>>()?;
        Ok(matches)
    }

    pub fn get_match(&self, match_id: i64) -> Result<Option<GameMatch>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT m.id, m.home_team_id, m.away_team_id, m.league_id, m.season_id, m.manager_id,
                    m.match_date, m.matchday, m.home_formation_id, m.away_formation_id,
                    m.home_score, m.away_score, m.status, m.match_stats,
                    ht.name, at.name, ht.primary_color, at.primary_color,
                    hf.name, af.name
             FROM matches m
             JOIN teams ht ON ht.id = m.home_team_id
             JOIN teams at ON at.id = m.away_team_id
             LEFT JOIN formations hf ON hf.id = m.home_formation_id
             LEFT JOIN formations af ON af.id = m.away_formation_id
             WHERE m.id = ?1"
        )?;
        let mut rows = stmt.query(params![match_id])?;
        if let Some(row) = rows.next()? {
            Ok(Some(Self::map_match(row)?))
        } else {
            Ok(None)
        }
    }

    fn map_match(row: &rusqlite::Row) -> Result<GameMatch> {
        Ok(GameMatch {
            id: row.get(0)?,
            home_team_id: row.get(1)?,
            away_team_id: row.get(2)?,
            league_id: row.get(3)?,
            season_id: row.get(4)?,
            manager_id: row.get(5)?,
            match_date: row.get(6)?,
            matchday: row.get(7)?,
            home_formation_id: row.get(8)?,
            away_formation_id: row.get(9)?,
            home_score: row.get(10)?,
            away_score: row.get(11)?,
            status: row.get(12)?,
            match_stats: row.get(13)?,
            home_team_name: row.get(14)?,
            away_team_name: row.get(15)?,
            home_team_color: row.get(16)?,
            away_team_color: row.get(17)?,
            home_formation_name: row.get(18)?,
            away_formation_name: row.get(19)?,
        })
    }

    // ── Lineups ──

    pub fn get_match_lineup(&self, match_id: i64, team_id: i64) -> Result<Vec<MatchLineup>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT ml.id, ml.match_id, ml.team_id, ml.player_id, ml.is_starting,
                    ml.position, ml.sort_order, ml.x, ml.y,
                    p.first_name || ' ' || p.last_name, p.shirt_number
             FROM match_lineups ml
             JOIN players p ON p.id = ml.player_id
             WHERE ml.match_id = ?1 AND ml.team_id = ?2
             ORDER BY ml.is_starting DESC, ml.sort_order ASC"
        )?;
        let lineups = stmt.query_map(params![match_id, team_id], |row| {
            Ok(MatchLineup {
                id: row.get(0)?,
                match_id: row.get(1)?,
                team_id: row.get(2)?,
                player_id: row.get(3)?,
                is_starting: row.get::<_, i64>(4)? != 0,
                position: row.get(5)?,
                sort_order: row.get(6)?,
                x: row.get(7)?,
                y: row.get(8)?,
                player_name: row.get(9)?,
                shirt_number: row.get(10)?,
            })
        })?.collect::<Result<Vec<_>>>()?;
        Ok(lineups)
    }

    pub fn save_match_lineup(&self, match_id: i64, team_id: i64, payload: &SaveLineupPayload) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "DELETE FROM match_lineups WHERE match_id = ?1 AND team_id = ?2",
            params![match_id, team_id],
        )?;
        for (i, entry) in payload.starters.iter().enumerate() {
            conn.execute(
                "INSERT INTO match_lineups (match_id, team_id, player_id, is_starting, position, sort_order, x, y)
                 VALUES (?1, ?2, ?3, 1, ?4, ?5, ?6, ?7)",
                params![match_id, team_id, entry.player_id, entry.position, i as i64, entry.x, entry.y],
            )?;
        }
        for (i, entry) in payload.bench.iter().enumerate() {
            conn.execute(
                "INSERT INTO match_lineups (match_id, team_id, player_id, is_starting, position, sort_order, x, y)
                 VALUES (?1, ?2, ?3, 0, ?4, ?5, ?6, ?7)",
                params![match_id, team_id, entry.player_id, entry.position, (100 + i) as i64, entry.x, entry.y],
            )?;
        }
        Ok(())
    }

    // ── Match Events ──

    pub fn get_match_events(&self, match_id: i64) -> Result<Vec<MatchEvent>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, match_id, minute, event_type, team_type, player_name,
                    description, x_coordinate, y_coordinate, commentary, sub_events
             FROM match_events WHERE match_id = ?1 ORDER BY minute ASC, id ASC"
        )?;
        let events = stmt.query_map(params![match_id], |row| {
            Ok(MatchEvent {
                id: row.get(0)?,
                match_id: row.get(1)?,
                minute: row.get(2)?,
                event_type: row.get(3)?,
                team_type: row.get(4)?,
                player_name: row.get(5)?,
                description: row.get(6)?,
                x_coordinate: row.get(7)?,
                y_coordinate: row.get(8)?,
                commentary: row.get(9)?,
                sub_events: row.get(10)?,
            })
        })?.collect::<Result<Vec<_>>>()?;
        Ok(events)
    }

    pub fn save_match_result(&self, match_id: i64, home_score: i64, away_score: i64, stats: &str) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "UPDATE matches SET home_score = ?1, away_score = ?2, status = 'completed', match_stats = ?3 WHERE id = ?4",
            params![home_score, away_score, stats, match_id],
        )?;
        Ok(())
    }

    pub fn save_match_event(&self, event: &MatchEvent) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "INSERT INTO match_events (match_id, minute, event_type, team_type, player_name, description, x_coordinate, y_coordinate, commentary, sub_events)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
            params![
                event.match_id, event.minute, event.event_type, event.team_type,
                event.player_name, event.description, event.x_coordinate, event.y_coordinate,
                event.commentary, event.sub_events
            ],
        )?;
        Ok(())
    }

    pub fn reset_match(&self, match_id: i64) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute("UPDATE matches SET status = 'scheduled', home_score = NULL, away_score = NULL, match_stats = NULL WHERE id = ?1", params![match_id])?;
        conn.execute("DELETE FROM match_events WHERE match_id = ?1", params![match_id])?;
        Ok(())
    }

    // ── Leagues / Standings ──

    pub fn get_leagues(&self) -> Result<Vec<League>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare("SELECT id, name, country, level, reputation FROM leagues ORDER BY name")?;
        let leagues = stmt.query_map([], |row| {
            Ok(League {
                id: row.get(0)?,
                name: row.get(1)?,
                country: row.get(2)?,
                level: row.get(3)?,
                reputation: row.get(4)?,
            })
        })?.collect::<Result<Vec<_>>>()?;
        Ok(leagues)
    }

    pub fn get_standings(&self, league_id: i64) -> Result<Vec<StandingEntry>> {
        let conn = self.conn.lock().unwrap();
        // Get all teams in the league
        let mut team_stmt = conn.prepare(
            "SELECT id, name, short_name, primary_color FROM teams WHERE league_id = ?1"
        )?;
        let teams: Vec<(i64, String, Option<String>, Option<String>)> = team_stmt.query_map(params![league_id], |row| {
            Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?))
        })?.collect::<Result<Vec<_>>>()?;

        let mut standings = Vec::new();
        for (team_id, team_name, short_name, color) in &teams {
            // Home matches
            let mut home_stmt = conn.prepare(
                "SELECT home_score, away_score FROM matches
                 WHERE home_team_id = ?1 AND league_id = ?2 AND status = 'completed'"
            )?;
            let home_matches: Vec<(i64, i64)> = home_stmt.query_map(params![team_id, league_id], |row| {
                Ok((row.get(0)?, row.get(1)?))
            })?.collect::<Result<Vec<_>>>()?;

            // Away matches
            let mut away_stmt = conn.prepare(
                "SELECT home_score, away_score FROM matches
                 WHERE away_team_id = ?1 AND league_id = ?2 AND status = 'completed'"
            )?;
            let away_matches: Vec<(i64, i64)> = away_stmt.query_map(params![team_id, league_id], |row| {
                Ok((row.get(0)?, row.get(1)?))
            })?.collect::<Result<Vec<_>>>()?;

            let (mut w, mut d, mut l, mut gf, mut ga) = (0i64, 0i64, 0i64, 0i64, 0i64);
            for (hs, as_) in &home_matches {
                gf += hs; ga += as_;
                if hs > as_ { w += 1; } else if hs == as_ { d += 1; } else { l += 1; }
            }
            for (hs, as_) in &away_matches {
                gf += as_; ga += hs;
                if as_ > hs { w += 1; } else if as_ == hs { d += 1; } else { l += 1; }
            }

            // Form (last 5)
            let mut form_stmt = conn.prepare(
                "SELECT home_team_id, home_score, away_score FROM matches
                 WHERE (home_team_id = ?1 OR away_team_id = ?1) AND league_id = ?2 AND status = 'completed'
                 ORDER BY match_date DESC LIMIT 5"
            )?;
            let form: Vec<String> = form_stmt.query_map(params![team_id, league_id], |row| {
                let htid: i64 = row.get(0)?;
                let hs: i64 = row.get(1)?;
                let avs: i64 = row.get(2)?;
                let is_home = htid == *team_id;
                let (team_goals, opp_goals) = if is_home { (hs, avs) } else { (avs, hs) };
                Ok(if team_goals > opp_goals { "W".to_string() } else if team_goals == opp_goals { "D".to_string() } else { "L".to_string() })
            })?.collect::<Result<Vec<_>>>()?;

            standings.push(StandingEntry {
                team_id: *team_id,
                team_name: team_name.clone(),
                short_name: short_name.clone(),
                primary_color: color.clone(),
                played: w + d + l,
                won: w,
                drawn: d,
                lost: l,
                goals_for: gf,
                goals_against: ga,
                goal_difference: gf - ga,
                points: w * 3 + d,
                form,
                position: 0,
            });
        }

        standings.sort_by(|a, b| {
            b.points.cmp(&a.points)
                .then(b.goal_difference.cmp(&a.goal_difference))
                .then(b.goals_for.cmp(&a.goals_for))
        });
        for (i, entry) in standings.iter_mut().enumerate() {
            entry.position = (i + 1) as i64;
        }
        Ok(standings)
    }

    // ── Positions ──

    pub fn get_positions(&self) -> Result<Vec<Position>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare("SELECT id, name, short_name, category FROM positions ORDER BY category, name")?;
        let positions = stmt.query_map([], |row| {
            Ok(Position {
                id: row.get(0)?,
                name: row.get(1)?,
                short_name: row.get(2)?,
                category: row.get(3)?,
            })
        })?.collect::<Result<Vec<_>>>()?;
        Ok(positions)
    }

    // ── Game Time ──

    pub fn get_next_match(&self, team_id: i64, after_date: &str) -> Result<Option<GameMatch>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT m.id, m.home_team_id, m.away_team_id, m.league_id, m.season_id, m.manager_id,
                    m.match_date, m.matchday, m.home_formation_id, m.away_formation_id,
                    m.home_score, m.away_score, m.status, m.match_stats,
                    ht.name, at.name, ht.primary_color, at.primary_color,
                    hf.name, af.name
             FROM matches m
             JOIN teams ht ON ht.id = m.home_team_id
             JOIN teams at ON at.id = m.away_team_id
             LEFT JOIN formations hf ON hf.id = m.home_formation_id
             LEFT JOIN formations af ON af.id = m.away_formation_id
             WHERE (m.home_team_id = ?1 OR m.away_team_id = ?1) AND m.status = 'scheduled' AND m.match_date >= ?2
             ORDER BY m.match_date ASC LIMIT 1"
        )?;
        let mut rows = stmt.query(params![team_id, after_date])?;
        if let Some(row) = rows.next()? {
            Ok(Some(Self::map_match(row)?))
        } else {
            Ok(None)
        }
    }
}
