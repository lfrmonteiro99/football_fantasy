<?php

namespace Database\Seeders;

use App\Models\Team;
use App\Models\League;
use Illuminate\Database\Seeder;

class PortugueseTeamsSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        // Get Portuguese leagues
        $primeiraLiga = League::where('name', 'Primeira Liga')->first();
        $portugal2 = League::where('name', 'Liga Portugal 2')->first();

        if (!$primeiraLiga || !$portugal2) {
            return; // Skip if leagues don't exist
        }

        $teams = [
            // Primeira Liga teams (additional to the ones already in TeamSeeder)
            [
                'name' => 'SC Braga', 'short_name' => 'SCB', 'city' => 'Braga', 'stadium_name' => 'Estádio Municipal de Braga', 'stadium_capacity' => 30286, 'league_id' => $primeiraLiga->id, 'budget' => 70000000, 'reputation' => 7.5, 'primary_color' => '#FF0000', 'secondary_color' => '#FFFFFF', 'founded_year' => 1921
            ],
            [
                'name' => 'Vitória SC', 'short_name' => 'VSC', 'city' => 'Guimarães', 'stadium_name' => 'Estádio D. Afonso Henriques', 'stadium_capacity' => 30029, 'league_id' => $primeiraLiga->id, 'budget' => 45000000, 'reputation' => 6.8, 'primary_color' => '#FFFFFF', 'secondary_color' => '#000000', 'founded_year' => 1922
            ],
            [
                'name' => 'Rio Ave FC', 'short_name' => 'RAV', 'city' => 'Vila do Conde', 'stadium_name' => 'Estádio dos Arcos', 'stadium_capacity' => 12815, 'league_id' => $primeiraLiga->id, 'budget' => 25000000, 'reputation' => 6.2, 'primary_color' => '#00B04F', 'secondary_color' => '#FFFFFF', 'founded_year' => 1939
            ],
            [
                'name' => 'Boavista FC', 'short_name' => 'BOA', 'city' => 'Porto', 'stadium_name' => 'Estádio do Bessa', 'stadium_capacity' => 28263, 'league_id' => $primeiraLiga->id, 'budget' => 30000000, 'reputation' => 6.5, 'primary_color' => '#000000', 'secondary_color' => '#FFFFFF', 'founded_year' => 1903
            ],
            [
                'name' => 'Moreirense FC', 'short_name' => 'MOR', 'city' => 'Moreira de Cónegos', 'stadium_name' => 'Parque de Jogos Comendador Joaquim de Almeida Freitas', 'stadium_capacity' => 9000, 'league_id' => $primeiraLiga->id, 'budget' => 20000000, 'reputation' => 5.8, 'primary_color' => '#00B04F', 'secondary_color' => '#FFFFFF', 'founded_year' => 1938
            ],
            [
                'name' => 'Gil Vicente FC', 'short_name' => 'GIL', 'city' => 'Barcelos', 'stadium_name' => 'Estádio Cidade de Barcelos', 'stadium_capacity' => 12504, 'league_id' => $primeiraLiga->id, 'budget' => 18000000, 'reputation' => 5.6, 'primary_color' => '#FF0000', 'secondary_color' => '#0033A0', 'founded_year' => 1924
            ],
            [
                'name' => 'FC Arouca', 'short_name' => 'ARO', 'city' => 'Arouca', 'stadium_name' => 'Estádio Municipal de Arouca', 'stadium_capacity' => 5000, 'league_id' => $primeiraLiga->id, 'budget' => 15000000, 'reputation' => 5.4, 'primary_color' => '#FFD700', 'secondary_color' => '#0033A0', 'founded_year' => 1951
            ],
            [
                'name' => 'CD Santa Clara', 'short_name' => 'SCL', 'city' => 'Ponta Delgada', 'stadium_name' => 'Estádio de São Miguel', 'stadium_capacity' => 13277, 'league_id' => $primeiraLiga->id, 'budget' => 12000000, 'reputation' => 5.2, 'primary_color' => '#FF0000', 'secondary_color' => '#FFFFFF', 'founded_year' => 1921
            ],
            [
                'name' => 'CS Marítimo', 'short_name' => 'MAR', 'city' => 'Funchal', 'stadium_name' => 'Estádio dos Barreiros', 'stadium_capacity' => 10932, 'league_id' => $primeiraLiga->id, 'budget' => 14000000, 'reputation' => 5.3, 'primary_color' => '#00B04F', 'secondary_color' => '#FF0000', 'founded_year' => 1910
            ],
            [
                'name' => 'Portimonense SC', 'short_name' => 'POR', 'city' => 'Portimão', 'stadium_name' => 'Estádio Municipal de Portimão', 'stadium_capacity' => 9544, 'league_id' => $primeiraLiga->id, 'budget' => 16000000, 'reputation' => 5.5, 'primary_color' => '#000000', 'secondary_color' => '#FFD700', 'founded_year' => 1914
            ],

            // Liga Portugal 2 teams
            [
                'name' => 'CD Feirense', 'short_name' => 'FEI', 'city' => 'Santa Maria da Feira', 'stadium_name' => 'Estádio Marcolino de Castro', 'stadium_capacity' => 9000, 'league_id' => $portugal2->id, 'budget' => 8000000, 'reputation' => 4.8, 'primary_color' => '#0033A0', 'secondary_color' => '#FFFFFF', 'founded_year' => 1918
            ],
            [
                'name' => 'Académico de Viseu', 'short_name' => 'ACV', 'city' => 'Viseu', 'stadium_name' => 'Estádio do Fontelo', 'stadium_capacity' => 9264, 'league_id' => $portugal2->id, 'budget' => 7000000, 'reputation' => 4.6, 'primary_color' => '#FFFFFF', 'secondary_color' => '#000000', 'founded_year' => 1916
            ],
            [
                'name' => 'SC Covilhã', 'short_name' => 'COV', 'city' => 'Covilhã', 'stadium_name' => 'Estádio Municipal José Santos Pinto', 'stadium_capacity' => 3000, 'league_id' => $portugal2->id, 'budget' => 5000000, 'reputation' => 4.2, 'primary_color' => '#FFD700', 'secondary_color' => '#0033A0', 'founded_year' => 1923
            ],
            [
                'name' => 'CD Trofense', 'short_name' => 'TRO', 'city' => 'Trofa', 'stadium_name' => 'Estádio CD Trofense', 'stadium_capacity' => 5000, 'league_id' => $portugal2->id, 'budget' => 6000000, 'reputation' => 4.4, 'primary_color' => '#0033A0', 'secondary_color' => '#FFFFFF', 'founded_year' => 1930
            ],
            [
                'name' => 'Leixões SC', 'short_name' => 'LEI', 'city' => 'Matosinhos', 'stadium_name' => 'Estádio do Mar', 'stadium_capacity' => 9922, 'league_id' => $portugal2->id, 'budget' => 9000000, 'reputation' => 5.0, 'primary_color' => '#FF0000', 'secondary_color' => '#0033A0', 'founded_year' => 1907
            ],
            [
                'name' => 'CD Mafra', 'short_name' => 'MAF', 'city' => 'Mafra', 'stadium_name' => 'Estádio Municipal de Mafra', 'stadium_capacity' => 3500, 'league_id' => $portugal2->id, 'budget' => 4500000, 'reputation' => 4.0, 'primary_color' => '#FF0000', 'secondary_color' => '#FFFFFF', 'founded_year' => 1965
            ],
        ];

        foreach ($teams as $team) {
            Team::create($team);
        }
    }
}
