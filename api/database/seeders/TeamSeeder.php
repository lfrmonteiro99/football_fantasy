<?php

namespace Database\Seeders;

use App\Models\Team;
use App\Models\League;
use Illuminate\Database\Seeder;

class TeamSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        // Get leagues
        $premierLeague = League::where('name', 'Premier League')->first();
        $laLiga = League::where('name', 'La Liga')->first();
        $serieA = League::where('name', 'Serie A')->first();
        $bundesliga = League::where('name', 'Bundesliga')->first();
        $ligue1 = League::where('name', 'Ligue 1')->first();
        $championship = League::where('name', 'Championship')->first();
        $segunda = League::where('name', 'Segunda División')->first();
        $serieB = League::where('name', 'Serie B')->first();
        $ligue2 = League::where('name', 'Ligue 2')->first();
        $primeiraLiga = League::where('name', 'Primeira Liga')->first();
        $portugal2 = League::where('name', 'Liga Portugal 2')->first();
        $eredivisie = League::where('name', 'Eredivisie')->first();
        $brazil = League::where('name', 'Brasileirão')->first();
        $argentina = League::where('name', 'Liga Profesional')->first();

        $teams = [
            // Premier League Teams
            [
                'name' => 'Manchester United',
                'short_name' => 'MUN',
                'city' => 'Manchester',
                'stadium_name' => 'Old Trafford',
                'stadium_capacity' => 74879,
                'league_id' => $premierLeague->id,
                'budget' => 350000000,
                'reputation' => 9.2,
                'primary_color' => '#FF0000',
                'secondary_color' => '#FFFFFF',
                'founded_year' => 1878
            ],
            [
                'name' => 'Manchester City',
                'short_name' => 'MCI',
                'city' => 'Manchester',
                'stadium_name' => 'Etihad Stadium',
                'stadium_capacity' => 53400,
                'league_id' => $premierLeague->id,
                'budget' => 400000000,
                'reputation' => 9.0,
                'primary_color' => '#6CABDD',
                'secondary_color' => '#FFFFFF',
                'founded_year' => 1880
            ],
            [
                'name' => 'Liverpool',
                'short_name' => 'LIV',
                'city' => 'Liverpool',
                'stadium_name' => 'Anfield',
                'stadium_capacity' => 53394,
                'league_id' => $premierLeague->id,
                'budget' => 320000000,
                'reputation' => 9.1,
                'primary_color' => '#C8102E',
                'secondary_color' => '#FFFFFF',
                'founded_year' => 1892
            ],
            [
                'name' => 'Chelsea',
                'short_name' => 'CHE',
                'city' => 'London',
                'stadium_name' => 'Stamford Bridge',
                'stadium_capacity' => 40834,
                'league_id' => $premierLeague->id,
                'budget' => 380000000,
                'reputation' => 8.8,
                'primary_color' => '#034694',
                'secondary_color' => '#FFFFFF',
                'founded_year' => 1905
            ],
            [
                'name' => 'Arsenal',
                'short_name' => 'ARS',
                'city' => 'London',
                'stadium_name' => 'Emirates Stadium',
                'stadium_capacity' => 60704,
                'league_id' => $premierLeague->id,
                'budget' => 280000000,
                'reputation' => 8.6,
                'primary_color' => '#EF0107',
                'secondary_color' => '#FFFFFF',
                'founded_year' => 1886
            ],

            // La Liga Teams
            [
                'name' => 'Real Madrid',
                'short_name' => 'RMA',
                'city' => 'Madrid',
                'stadium_name' => 'Santiago Bernabéu',
                'stadium_capacity' => 81044,
                'league_id' => $laLiga->id,
                'budget' => 450000000,
                'reputation' => 9.8,
                'primary_color' => '#FFFFFF',
                'secondary_color' => '#000000',
                'founded_year' => 1902
            ],
            [
                'name' => 'Barcelona',
                'short_name' => 'BAR',
                'city' => 'Barcelona',
                'stadium_name' => 'Camp Nou',
                'stadium_capacity' => 99354,
                'league_id' => $laLiga->id,
                'budget' => 420000000,
                'reputation' => 9.6,
                'primary_color' => '#A50044',
                'secondary_color' => '#004D98',
                'founded_year' => 1899
            ],
            [
                'name' => 'Atletico Madrid',
                'short_name' => 'ATM',
                'city' => 'Madrid',
                'stadium_name' => 'Wanda Metropolitano',
                'stadium_capacity' => 68456,
                'league_id' => $laLiga->id,
                'budget' => 250000000,
                'reputation' => 8.4,
                'primary_color' => '#CE3524',
                'secondary_color' => '#FFFFFF',
                'founded_year' => 1903
            ],

            // Serie A Teams
            [
                'name' => 'Juventus',
                'short_name' => 'JUV',
                'city' => 'Turin',
                'stadium_name' => 'Allianz Stadium',
                'stadium_capacity' => 41507,
                'league_id' => $serieA->id,
                'budget' => 300000000,
                'reputation' => 8.9,
                'primary_color' => '#000000',
                'secondary_color' => '#FFFFFF',
                'founded_year' => 1897
            ],
            [
                'name' => 'AC Milan',
                'short_name' => 'MIL',
                'city' => 'Milan',
                'stadium_name' => 'San Siro',
                'stadium_capacity' => 75923,
                'league_id' => $serieA->id,
                'budget' => 280000000,
                'reputation' => 8.7,
                'primary_color' => '#FB090B',
                'secondary_color' => '#000000',
                'founded_year' => 1899
            ],
            [
                'name' => 'Inter Milan',
                'short_name' => 'INT',
                'city' => 'Milan',
                'stadium_name' => 'San Siro',
                'stadium_capacity' => 75923,
                'league_id' => $serieA->id,
                'budget' => 270000000,
                'reputation' => 8.5,
                'primary_color' => '#0068A8',
                'secondary_color' => '#000000',
                'founded_year' => 1908
            ],

            // Bundesliga Teams
            [
                'name' => 'Bayern Munich',
                'short_name' => 'BAY',
                'city' => 'Munich',
                'stadium_name' => 'Allianz Arena',
                'stadium_capacity' => 75000,
                'league_id' => $bundesliga->id,
                'budget' => 380000000,
                'reputation' => 9.3,
                'primary_color' => '#DC052D',
                'secondary_color' => '#FFFFFF',
                'founded_year' => 1900
            ],
            [
                'name' => 'Borussia Dortmund',
                'short_name' => 'BVB',
                'city' => 'Dortmund',
                'stadium_name' => 'Signal Iduna Park',
                'stadium_capacity' => 81365,
                'league_id' => $bundesliga->id,
                'budget' => 220000000,
                'reputation' => 8.2,
                'primary_color' => '#FDE100',
                'secondary_color' => '#000000',
                'founded_year' => 1909
            ],

            // Ligue 1 Teams
            [
                'name' => 'Paris Saint-Germain',
                'short_name' => 'PSG',
                'city' => 'Paris',
                'stadium_name' => 'Parc des Princes',
                'stadium_capacity' => 47929,
                'league_id' => $ligue1->id,
                'budget' => 500000000,
                'reputation' => 8.8,
                'primary_color' => '#004170',
                'secondary_color' => '#FF0000',
                'founded_year' => 1970
            ],
            [
                'name' => 'Olympique Marseille',
                'short_name' => 'OLM',
                'city' => 'Marseille',
                'stadium_name' => 'Stade Vélodrome',
                'stadium_capacity' => 67394,
                'league_id' => $ligue1->id,
                'budget' => 150000000,
                'reputation' => 7.2,
                'primary_color' => '#2FAEE0',
                'secondary_color' => '#FFFFFF',
                'founded_year' => 1899
            ],

            // More Premier League teams
            [
                'name' => 'Tottenham Hotspur', 'short_name' => 'TOT', 'city' => 'London', 'stadium_name' => 'Tottenham Hotspur Stadium', 'stadium_capacity' => 62850, 'league_id' => $premierLeague->id, 'budget' => 200000000, 'reputation' => 8.2, 'primary_color' => '#132257', 'secondary_color' => '#FFFFFF', 'founded_year' => 1882
            ],
            [
                'name' => 'Leicester City', 'short_name' => 'LEI', 'city' => 'Leicester', 'stadium_name' => 'King Power Stadium', 'stadium_capacity' => 32312, 'league_id' => $premierLeague->id, 'budget' => 120000000, 'reputation' => 7.8, 'primary_color' => '#003090', 'secondary_color' => '#FFFFFF', 'founded_year' => 1884
            ],
            [
                'name' => 'Everton', 'short_name' => 'EVE', 'city' => 'Liverpool', 'stadium_name' => 'Goodison Park', 'stadium_capacity' => 39572, 'league_id' => $premierLeague->id, 'budget' => 100000000, 'reputation' => 7.5, 'primary_color' => '#003399', 'secondary_color' => '#FFFFFF', 'founded_year' => 1878
            ],
            [
                'name' => 'West Ham United', 'short_name' => 'WHU', 'city' => 'London', 'stadium_name' => 'London Stadium', 'stadium_capacity' => 60000, 'league_id' => $premierLeague->id, 'budget' => 95000000, 'reputation' => 7.4, 'primary_color' => '#7A263A', 'secondary_color' => '#1BB1E7', 'founded_year' => 1895
            ],
            [
                'name' => 'Wolverhampton Wanderers', 'short_name' => 'WOL', 'city' => 'Wolverhampton', 'stadium_name' => 'Molineux Stadium', 'stadium_capacity' => 32050, 'league_id' => $premierLeague->id, 'budget' => 90000000, 'reputation' => 7.2, 'primary_color' => '#FDB913', 'secondary_color' => '#231F20', 'founded_year' => 1877
            ],

            // More La Liga teams
            [
                'name' => 'Sevilla', 'short_name' => 'SEV', 'city' => 'Seville', 'stadium_name' => 'Ramón Sánchez Pizjuán', 'stadium_capacity' => 43883, 'league_id' => $laLiga->id, 'budget' => 120000000, 'reputation' => 8.0, 'primary_color' => '#FFFFFF', 'secondary_color' => '#FF0000', 'founded_year' => 1890
            ],
            [
                'name' => 'Valencia', 'short_name' => 'VAL', 'city' => 'Valencia', 'stadium_name' => 'Mestalla', 'stadium_capacity' => 55000, 'league_id' => $laLiga->id, 'budget' => 110000000, 'reputation' => 7.7, 'primary_color' => '#FFFFFF', 'secondary_color' => '#FF9900', 'founded_year' => 1919
            ],
            [
                'name' => 'Villarreal', 'short_name' => 'VIL', 'city' => 'Villarreal', 'stadium_name' => 'Estadio de la Cerámica', 'stadium_capacity' => 23500, 'league_id' => $laLiga->id, 'budget' => 90000000, 'reputation' => 7.5, 'primary_color' => '#FFF200', 'secondary_color' => '#0000FF', 'founded_year' => 1923
            ],
            [
                'name' => 'Real Betis', 'short_name' => 'BET', 'city' => 'Seville', 'stadium_name' => 'Benito Villamarín', 'stadium_capacity' => 60721, 'league_id' => $laLiga->id, 'budget' => 85000000, 'reputation' => 7.3, 'primary_color' => '#0A4936', 'secondary_color' => '#FFFFFF', 'founded_year' => 1907
            ],

            // More Serie A teams
            [
                'name' => 'Roma', 'short_name' => 'ROM', 'city' => 'Rome', 'stadium_name' => 'Stadio Olimpico', 'stadium_capacity' => 70634, 'league_id' => $serieA->id, 'budget' => 120000000, 'reputation' => 8.2, 'primary_color' => '#8E1C1A', 'secondary_color' => '#F7D358', 'founded_year' => 1927
            ],
            [
                'name' => 'Napoli', 'short_name' => 'NAP', 'city' => 'Naples', 'stadium_name' => 'Stadio Diego Armando Maradona', 'stadium_capacity' => 54726, 'league_id' => $serieA->id, 'budget' => 110000000, 'reputation' => 8.0, 'primary_color' => '#007FFF', 'secondary_color' => '#FFFFFF', 'founded_year' => 1926
            ],
            [
                'name' => 'Lazio', 'short_name' => 'LAZ', 'city' => 'Rome', 'stadium_name' => 'Stadio Olimpico', 'stadium_capacity' => 70634, 'league_id' => $serieA->id, 'budget' => 95000000, 'reputation' => 7.8, 'primary_color' => '#87CEEB', 'secondary_color' => '#FFFFFF', 'founded_year' => 1900
            ],

            // More Bundesliga teams
            [
                'name' => 'RB Leipzig', 'short_name' => 'RBL', 'city' => 'Leipzig', 'stadium_name' => 'Red Bull Arena', 'stadium_capacity' => 47069, 'league_id' => $bundesliga->id, 'budget' => 95000000, 'reputation' => 7.9, 'primary_color' => '#FFFFFF', 'secondary_color' => '#E32219', 'founded_year' => 2009
            ],
            [
                'name' => 'Bayer Leverkusen', 'short_name' => 'B04', 'city' => 'Leverkusen', 'stadium_name' => 'BayArena', 'stadium_capacity' => 30210, 'league_id' => $bundesliga->id, 'budget' => 90000000, 'reputation' => 7.7, 'primary_color' => '#E32219', 'secondary_color' => '#000000', 'founded_year' => 1904
            ],

            // More Ligue 1 teams
            [
                'name' => 'Olympique Lyonnais', 'short_name' => 'LYO', 'city' => 'Lyon', 'stadium_name' => 'Groupama Stadium', 'stadium_capacity' => 59186, 'league_id' => $ligue1->id, 'budget' => 110000000, 'reputation' => 8.0, 'primary_color' => '#001E61', 'secondary_color' => '#FFFFFF', 'founded_year' => 1950
            ],
            [
                'name' => 'Olympique de Marseille', 'short_name' => 'MAR', 'city' => 'Marseille', 'stadium_name' => 'Stade Vélodrome', 'stadium_capacity' => 67394, 'league_id' => $ligue1->id, 'budget' => 105000000, 'reputation' => 7.9, 'primary_color' => '#0093D0', 'secondary_color' => '#FFFFFF', 'founded_year' => 1899
            ],

            // More Portuguese teams (Primeira Liga)
            [
                'name' => 'FC Porto', 'short_name' => 'POR', 'city' => 'Porto', 'stadium_name' => 'Estádio do Dragão', 'stadium_capacity' => 50033, 'league_id' => $primeiraLiga->id, 'budget' => 90000000, 'reputation' => 7.8, 'primary_color' => '#003399', 'secondary_color' => '#FFFFFF', 'founded_year' => 1893
            ],
            [
                'name' => 'SL Benfica', 'short_name' => 'BEN', 'city' => 'Lisbon', 'stadium_name' => 'Estádio da Luz', 'stadium_capacity' => 64642, 'league_id' => $primeiraLiga->id, 'budget' => 95000000, 'reputation' => 7.9, 'primary_color' => '#FF0000', 'secondary_color' => '#FFFFFF', 'founded_year' => 1904
            ],
            [
                'name' => 'Sporting CP', 'short_name' => 'SCP', 'city' => 'Lisbon', 'stadium_name' => 'Estádio José Alvalade', 'stadium_capacity' => 50095, 'league_id' => $primeiraLiga->id, 'budget' => 85000000, 'reputation' => 7.7, 'primary_color' => '#00B04F', 'secondary_color' => '#FFFFFF', 'founded_year' => 1906
            ],

            // More Brazilian teams
            [
                'name' => 'Flamengo', 'short_name' => 'FLA', 'city' => 'Rio de Janeiro', 'stadium_name' => 'Maracanã', 'stadium_capacity' => 78838, 'league_id' => $brazil->id, 'budget' => 120000000, 'reputation' => 8.2, 'primary_color' => '#F90000', 'secondary_color' => '#000000', 'founded_year' => 1895
            ],
            [
                'name' => 'Palmeiras', 'short_name' => 'PAL', 'city' => 'São Paulo', 'stadium_name' => 'Allianz Parque', 'stadium_capacity' => 43600, 'league_id' => $brazil->id, 'budget' => 110000000, 'reputation' => 8.0, 'primary_color' => '#008000', 'secondary_color' => '#FFFFFF', 'founded_year' => 1914
            ],

            // More Argentine teams
            [
                'name' => 'Boca Juniors', 'short_name' => 'BOC', 'city' => 'Buenos Aires', 'stadium_name' => 'La Bombonera', 'stadium_capacity' => 49000, 'league_id' => $argentina->id, 'budget' => 90000000, 'reputation' => 7.8, 'primary_color' => '#0033A0', 'secondary_color' => '#FFD100', 'founded_year' => 1905
            ],
            [
                'name' => 'River Plate', 'short_name' => 'RIV', 'city' => 'Buenos Aires', 'stadium_name' => 'El Monumental', 'stadium_capacity' => 70074, 'league_id' => $argentina->id, 'budget' => 95000000, 'reputation' => 7.9, 'primary_color' => '#FFFFFF', 'secondary_color' => '#FF0000', 'founded_year' => 1901
            ],
        ];

        // Add more teams for Championship
        if ($championship) {
            $teams = array_merge($teams, [
                ['name' => 'Norwich City', 'short_name' => 'NOR', 'city' => 'Norwich', 'stadium_name' => 'Carrow Road', 'stadium_capacity' => 27244, 'league_id' => $championship->id, 'budget' => 40000000, 'reputation' => 6.5, 'primary_color' => '#FFF200', 'secondary_color' => '#00A650', 'founded_year' => 1902],
                ['name' => 'Watford', 'short_name' => 'WAT', 'city' => 'Watford', 'stadium_name' => 'Vicarage Road', 'stadium_capacity' => 21577, 'league_id' => $championship->id, 'budget' => 35000000, 'reputation' => 6.3, 'primary_color' => '#FBEE23', 'secondary_color' => '#000000', 'founded_year' => 1881],
                ['name' => 'Sheffield United', 'short_name' => 'SHU', 'city' => 'Sheffield', 'stadium_name' => 'Bramall Lane', 'stadium_capacity' => 32702, 'league_id' => $championship->id, 'budget' => 30000000, 'reputation' => 6.2, 'primary_color' => '#EE2737', 'secondary_color' => '#000000', 'founded_year' => 1889],
                ['name' => 'West Bromwich Albion', 'short_name' => 'WBA', 'city' => 'West Bromwich', 'stadium_name' => 'The Hawthorns', 'stadium_capacity' => 26445, 'league_id' => $championship->id, 'budget' => 28000000, 'reputation' => 6.1, 'primary_color' => '#122F67', 'secondary_color' => '#FFFFFF', 'founded_year' => 1878],
                ['name' => 'Middlesbrough', 'short_name' => 'MID', 'city' => 'Middlesbrough', 'stadium_name' => 'Riverside Stadium', 'stadium_capacity' => 34000, 'league_id' => $championship->id, 'budget' => 25000000, 'reputation' => 6.0, 'primary_color' => '#E30613', 'secondary_color' => '#FFFFFF', 'founded_year' => 1876],
            ]);
        }
        // Add more teams for Segunda División
        if ($segunda) {
            $teams = array_merge($teams, [
                ['name' => 'Real Zaragoza', 'short_name' => 'ZAR', 'city' => 'Zaragoza', 'stadium_name' => 'La Romareda', 'stadium_capacity' => 34596, 'league_id' => $segunda->id, 'budget' => 20000000, 'reputation' => 5.8, 'primary_color' => '#FFFFFF', 'secondary_color' => '#0033A0', 'founded_year' => 1932],
                ['name' => 'Sporting Gijón', 'short_name' => 'GIJ', 'city' => 'Gijón', 'stadium_name' => 'El Molinón', 'stadium_capacity' => 30000, 'league_id' => $segunda->id, 'budget' => 18000000, 'reputation' => 5.7, 'primary_color' => '#E30613', 'secondary_color' => '#FFFFFF', 'founded_year' => 1905],
                ['name' => 'UD Las Palmas', 'short_name' => 'LPA', 'city' => 'Las Palmas', 'stadium_name' => 'Gran Canaria', 'stadium_capacity' => 32400, 'league_id' => $segunda->id, 'budget' => 17000000, 'reputation' => 5.6, 'primary_color' => '#FFDE00', 'secondary_color' => '#0057B8', 'founded_year' => 1949],
                ['name' => 'CD Tenerife', 'short_name' => 'TEN', 'city' => 'Santa Cruz', 'stadium_name' => 'Heliodoro Rodríguez López', 'stadium_capacity' => 22667, 'league_id' => $segunda->id, 'budget' => 16000000, 'reputation' => 5.5, 'primary_color' => '#FFFFFF', 'secondary_color' => '#0033A0', 'founded_year' => 1922],
            ]);
        }
        // Add more teams for Serie B
        if ($serieB) {
            $teams = array_merge($teams, [
                ['name' => 'Brescia', 'short_name' => 'BRE', 'city' => 'Brescia', 'stadium_name' => 'Stadio Mario Rigamonti', 'stadium_capacity' => 16743, 'league_id' => $serieB->id, 'budget' => 15000000, 'reputation' => 5.5, 'primary_color' => '#0055A4', 'secondary_color' => '#FFFFFF', 'founded_year' => 1911],
                ['name' => 'Lecce', 'short_name' => 'LEC', 'city' => 'Lecce', 'stadium_name' => 'Stadio Via del Mare', 'stadium_capacity' => 33876, 'league_id' => $serieB->id, 'budget' => 14000000, 'reputation' => 5.4, 'primary_color' => '#FFD700', 'secondary_color' => '#E30613', 'founded_year' => 1908],
                ['name' => 'Cremonese', 'short_name' => 'CRE', 'city' => 'Cremona', 'stadium_name' => 'Stadio Giovanni Zini', 'stadium_capacity' => 20341, 'league_id' => $serieB->id, 'budget' => 13000000, 'reputation' => 5.3, 'primary_color' => '#C8102E', 'secondary_color' => '#A7A9AC', 'founded_year' => 1903],
            ]);
        }
        // Add more teams for Ligue 2
        if ($ligue2) {
            $teams = array_merge($teams, [
                ['name' => 'Auxerre', 'short_name' => 'AUX', 'city' => 'Auxerre', 'stadium_name' => 'Stade de l’Abbé-Deschamps', 'stadium_capacity' => 23467, 'league_id' => $ligue2->id, 'budget' => 12000000, 'reputation' => 5.2, 'primary_color' => '#0055A4', 'secondary_color' => '#FFFFFF', 'founded_year' => 1905],
                ['name' => 'Sochaux', 'short_name' => 'SOC', 'city' => 'Montbéliard', 'stadium_name' => 'Stade Auguste Bonal', 'stadium_capacity' => 20005, 'league_id' => $ligue2->id, 'budget' => 11000000, 'reputation' => 5.1, 'primary_color' => '#FFD700', 'secondary_color' => '#0055A4', 'founded_year' => 1928],
            ]);
        }
        // Add more teams for Liga Portugal 2
        if ($portugal2) {
            $teams = array_merge($teams, [
                ['name' => 'Academica', 'short_name' => 'ACA', 'city' => 'Coimbra', 'stadium_name' => 'Estádio Cidade de Coimbra', 'stadium_capacity' => 30210, 'league_id' => $portugal2->id, 'budget' => 8000000, 'reputation' => 4.8, 'primary_color' => '#000000', 'secondary_color' => '#FFFFFF', 'founded_year' => 1887],
                ['name' => 'Farense', 'short_name' => 'FAR', 'city' => 'Faro', 'stadium_name' => 'Estádio de São Luís', 'stadium_capacity' => 6000, 'league_id' => $portugal2->id, 'budget' => 7000000, 'reputation' => 4.7, 'primary_color' => '#FFFFFF', 'secondary_color' => '#000000', 'founded_year' => 1910],
            ]);
        }
        // Add more teams for Eredivisie
        if ($eredivisie) {
            $teams = array_merge($teams, [
                ['name' => 'Ajax', 'short_name' => 'AJA', 'city' => 'Amsterdam', 'stadium_name' => 'Johan Cruyff Arena', 'stadium_capacity' => 54990, 'league_id' => $eredivisie->id, 'budget' => 90000000, 'reputation' => 7.5, 'primary_color' => '#FFFFFF', 'secondary_color' => '#D3101C', 'founded_year' => 1900],
                ['name' => 'PSV Eindhoven', 'short_name' => 'PSV', 'city' => 'Eindhoven', 'stadium_name' => 'Philips Stadion', 'stadium_capacity' => 35000, 'league_id' => $eredivisie->id, 'budget' => 80000000, 'reputation' => 7.3, 'primary_color' => '#E30613', 'secondary_color' => '#FFFFFF', 'founded_year' => 1913],
                ['name' => 'Feyenoord', 'short_name' => 'FEY', 'city' => 'Rotterdam', 'stadium_name' => 'De Kuip', 'stadium_capacity' => 51177, 'league_id' => $eredivisie->id, 'budget' => 75000000, 'reputation' => 7.2, 'primary_color' => '#E30613', 'secondary_color' => '#FFFFFF', 'founded_year' => 1908],
            ]);
        }
        // Add more teams for Belgian Pro League
        $belgium = League::where('name', 'Belgian Pro League')->first();
        if ($belgium) {
            $teams = array_merge($teams, [
                ['name' => 'Club Brugge', 'short_name' => 'BRU', 'city' => 'Bruges', 'stadium_name' => 'Jan Breydel Stadium', 'stadium_capacity' => 29062, 'league_id' => $belgium->id, 'budget' => 60000000, 'reputation' => 6.8, 'primary_color' => '#003087', 'secondary_color' => '#000000', 'founded_year' => 1891],
                ['name' => 'Anderlecht', 'short_name' => 'AND', 'city' => 'Brussels', 'stadium_name' => 'Lotto Park', 'stadium_capacity' => 22500, 'league_id' => $belgium->id, 'budget' => 55000000, 'reputation' => 6.7, 'primary_color' => '#5B2A8C', 'secondary_color' => '#FFFFFF', 'founded_year' => 1908],
            ]);
        }
        // Add more teams for Brasileirão
        if ($brazil) {
            $teams = array_merge($teams, [
                ['name' => 'Santos', 'short_name' => 'SAN', 'city' => 'Santos', 'stadium_name' => 'Vila Belmiro', 'stadium_capacity' => 16068, 'league_id' => $brazil->id, 'budget' => 80000000, 'reputation' => 7.8, 'primary_color' => '#FFFFFF', 'secondary_color' => '#000000', 'founded_year' => 1912],
                ['name' => 'São Paulo', 'short_name' => 'SAO', 'city' => 'São Paulo', 'stadium_name' => 'Morumbi', 'stadium_capacity' => 66795, 'league_id' => $brazil->id, 'budget' => 85000000, 'reputation' => 8.0, 'primary_color' => '#FFFFFF', 'secondary_color' => '#FF0000', 'founded_year' => 1930],
            ]);
        }
        // Add more teams for Liga Profesional
        if ($argentina) {
            $teams = array_merge($teams, [
                ['name' => 'Independiente', 'short_name' => 'IND', 'city' => 'Avellaneda', 'stadium_name' => 'Estadio Libertadores de América', 'stadium_capacity' => 48069, 'league_id' => $argentina->id, 'budget' => 70000000, 'reputation' => 7.7, 'primary_color' => '#E30613', 'secondary_color' => '#FFFFFF', 'founded_year' => 1905],
                ['name' => 'San Lorenzo', 'short_name' => 'SLO', 'city' => 'Buenos Aires', 'stadium_name' => 'Estadio Pedro Bidegain', 'stadium_capacity' => 47464, 'league_id' => $argentina->id, 'budget' => 65000000, 'reputation' => 7.6, 'primary_color' => '#002B5C', 'secondary_color' => '#E30613', 'founded_year' => 1908],
            ]);
        }

        foreach ($teams as $team) {
            Team::create($team);
        }
    }
}
