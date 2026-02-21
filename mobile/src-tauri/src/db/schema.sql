-- Football Fantasy Mobile - SQLite Schema
-- This mirrors the Laravel migration structure

CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL,
    managed_team_id INTEGER,
    game_date TEXT DEFAULT '2025-08-01',
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS leagues (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    country TEXT,
    level INTEGER DEFAULT 1,
    reputation REAL DEFAULT 50.0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS positions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    short_name TEXT NOT NULL,
    category TEXT NOT NULL,
    key_attributes TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS teams (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    short_name TEXT,
    city TEXT,
    stadium_name TEXT,
    stadium_capacity INTEGER,
    league_id INTEGER REFERENCES leagues(id),
    budget REAL DEFAULT 0,
    reputation REAL DEFAULT 50.0,
    primary_color TEXT DEFAULT '#000000',
    secondary_color TEXT DEFAULT '#FFFFFF',
    founded_year INTEGER,
    primary_tactic_id INTEGER,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS players (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    date_of_birth TEXT,
    nationality TEXT,
    preferred_foot TEXT DEFAULT 'right',
    height_cm INTEGER,
    weight_kg INTEGER,
    team_id INTEGER REFERENCES teams(id),
    primary_position_id INTEGER REFERENCES positions(id),
    secondary_positions TEXT,
    market_value REAL DEFAULT 0,
    wage_per_week REAL DEFAULT 0,
    contract_start TEXT,
    contract_end TEXT,
    shirt_number INTEGER,
    is_injured INTEGER DEFAULT 0,
    injury_return_date TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS player_attributes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    player_id INTEGER NOT NULL UNIQUE REFERENCES players(id),
    finishing INTEGER DEFAULT 10,
    first_touch INTEGER DEFAULT 10,
    free_kick_taking INTEGER DEFAULT 10,
    heading INTEGER DEFAULT 10,
    long_shots INTEGER DEFAULT 10,
    long_throws INTEGER DEFAULT 10,
    marking INTEGER DEFAULT 10,
    passing INTEGER DEFAULT 10,
    penalty_taking INTEGER DEFAULT 10,
    tackling INTEGER DEFAULT 10,
    technique INTEGER DEFAULT 10,
    corners INTEGER DEFAULT 10,
    crossing INTEGER DEFAULT 10,
    dribbling INTEGER DEFAULT 10,
    aggression INTEGER DEFAULT 10,
    anticipation INTEGER DEFAULT 10,
    bravery INTEGER DEFAULT 10,
    composure INTEGER DEFAULT 10,
    concentration INTEGER DEFAULT 10,
    decisions INTEGER DEFAULT 10,
    determination INTEGER DEFAULT 10,
    flair INTEGER DEFAULT 10,
    leadership INTEGER DEFAULT 10,
    off_the_ball INTEGER DEFAULT 10,
    positioning INTEGER DEFAULT 10,
    teamwork INTEGER DEFAULT 10,
    vision INTEGER DEFAULT 10,
    work_rate INTEGER DEFAULT 10,
    acceleration INTEGER DEFAULT 10,
    agility INTEGER DEFAULT 10,
    balance INTEGER DEFAULT 10,
    jumping_reach INTEGER DEFAULT 10,
    natural_fitness INTEGER DEFAULT 10,
    pace INTEGER DEFAULT 10,
    stamina INTEGER DEFAULT 10,
    strength INTEGER DEFAULT 10,
    aerial_reach INTEGER DEFAULT 10,
    command_of_area INTEGER DEFAULT 10,
    communication INTEGER DEFAULT 10,
    eccentricity INTEGER DEFAULT 10,
    handling INTEGER DEFAULT 10,
    kicking INTEGER DEFAULT 10,
    one_on_ones INTEGER DEFAULT 10,
    reflexes INTEGER DEFAULT 10,
    rushing_out INTEGER DEFAULT 10,
    throwing INTEGER DEFAULT 10,
    current_ability REAL DEFAULT 50.0,
    potential_ability REAL DEFAULT 60.0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS formations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    display_name TEXT,
    description TEXT,
    positions TEXT NOT NULL,
    style TEXT DEFAULT 'balanced',
    defenders_count INTEGER DEFAULT 4,
    midfielders_count INTEGER DEFAULT 4,
    forwards_count INTEGER DEFAULT 2,
    is_active INTEGER DEFAULT 1,
    sample_instructions TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS tactics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    formation_id INTEGER REFERENCES formations(id),
    mentality TEXT DEFAULT 'balanced',
    team_instructions TEXT DEFAULT 'mixed',
    pressing TEXT DEFAULT 'sometimes',
    tempo TEXT DEFAULT 'standard',
    width TEXT DEFAULT 'standard',
    defensive_line TEXT DEFAULT 'standard',
    offside_trap INTEGER DEFAULT 0,
    play_out_of_defence INTEGER DEFAULT 0,
    use_offside_trap INTEGER DEFAULT 0,
    close_down_more INTEGER DEFAULT 0,
    tackle_harder INTEGER DEFAULT 0,
    get_stuck_in INTEGER DEFAULT 0,
    custom_positions TEXT,
    player_assignments TEXT,
    characteristics TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS team_tactics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    team_id INTEGER NOT NULL REFERENCES teams(id),
    tactic_id INTEGER NOT NULL REFERENCES tactics(id),
    is_primary INTEGER DEFAULT 0,
    is_active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(team_id, tactic_id)
);

CREATE TABLE IF NOT EXISTS seasons (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    start_date TEXT,
    end_date TEXT,
    is_current INTEGER DEFAULT 0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS matches (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    home_team_id INTEGER NOT NULL REFERENCES teams(id),
    away_team_id INTEGER NOT NULL REFERENCES teams(id),
    league_id INTEGER REFERENCES leagues(id),
    season_id INTEGER REFERENCES seasons(id),
    manager_id INTEGER REFERENCES users(id),
    match_date TEXT,
    matchday INTEGER,
    match_time TEXT,
    home_formation_id INTEGER REFERENCES formations(id),
    away_formation_id INTEGER REFERENCES formations(id),
    stadium TEXT,
    weather TEXT,
    temperature INTEGER,
    attendance INTEGER,
    home_score INTEGER,
    away_score INTEGER,
    status TEXT DEFAULT 'scheduled',
    match_stats TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS match_lineups (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    match_id INTEGER NOT NULL REFERENCES matches(id),
    team_id INTEGER NOT NULL REFERENCES teams(id),
    player_id INTEGER NOT NULL REFERENCES players(id),
    is_starting INTEGER DEFAULT 1,
    position TEXT,
    sort_order INTEGER DEFAULT 0,
    x REAL,
    y REAL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS match_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    match_id INTEGER NOT NULL REFERENCES matches(id),
    minute INTEGER NOT NULL,
    event_type TEXT NOT NULL,
    team_type TEXT,
    player_name TEXT,
    description TEXT,
    x_coordinate REAL,
    y_coordinate REAL,
    commentary TEXT,
    sub_events TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS tactical_positions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    team_id INTEGER REFERENCES teams(id),
    tactic_id INTEGER REFERENCES tactics(id),
    player_id INTEGER REFERENCES players(id),
    position_id INTEGER REFERENCES positions(id),
    x REAL,
    y REAL,
    role TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);
