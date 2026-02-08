// =============================================================================
// API Endpoint Functions — Football Fantasy Manager
// =============================================================================
// Every backend call is defined here as a typed async function.  Components and
// Redux thunks import from this file — they NEVER import Axios directly.
//
// Convention:
//   - Each function returns the inner `data` payload (unwrapped from Axios).
//   - For paginated endpoints the full PaginatedResponse is returned so the
//     caller can access pagination metadata.
//   - Query-parameter filters are passed via an optional `params` object.
// =============================================================================

import client from './client';
import type {
  // Response types
  ApiResponse,
  ApiStatusResponse,
  AuthLoginResponse,
  AuthRegisterResponse,
  FormationsByStyle,
  FormationSampleInstructions,
  FormationVisualization,
  GameTimeResponse,
  AdvanceDayResponse,
  InstantSimulationResponse,
  LeagueOverviewEntry,
  LeagueStandingsResponse,
  LeagueMatchesResponse,
  Match,
  MatchEvent,
  MatchLineupResponse,
  MatchSimulationResult,
  MatchTacticsResponse,
  PaginatedResponse,
  PlayerAttributesByCategory,
  TacticAnalysis,
  TacticAssignResponse,
  User,
  // Domain models
  Formation,
  League,
  Match as MatchModel,
  Player,
  Position,
  Tactic,
  Team,
  TeamSquadResponse,
  TeamTacticsResponse,
  // Payloads
  RegisterPayload,
  LoginPayload,
  SaveLineupPayload,
  UpdateMatchTacticsPayload,
  CreateTacticPayload,
  UpdateTacticPayload,
  AssignTacticPayload,
  AdvanceDayPayload,
} from '../types';

// ============================================================
// AUTH
// ============================================================

export async function register(payload: RegisterPayload) {
  const { data } = await client.post<ApiResponse<AuthRegisterResponse>>(
    'auth/register',
    payload,
  );
  return data.data;
}

export async function login(payload: LoginPayload) {
  const { data } = await client.post<ApiResponse<AuthLoginResponse>>(
    'auth/login',
    payload,
  );
  return data.data;
}

export async function getProfile() {
  const { data } = await client.get<ApiResponse<User>>('auth/profile');
  return data.data;
}

export async function logout() {
  const { data } = await client.post<ApiResponse<null>>('auth/logout');
  return data;
}

export async function getAvailableTeams() {
  const { data } = await client.get<ApiResponse<Team[]>>('auth/available-teams');
  return data.data;
}

export async function regenerateCalendars() {
  const { data } = await client.post<ApiResponse<Record<string, unknown>>>(
    'auth/regenerate-calendars',
  );
  return data.data;
}

export async function getCalendarStats() {
  const { data } = await client.get<ApiResponse<Record<string, unknown>>>(
    'auth/calendar-stats',
  );
  return data.data;
}

// ============================================================
// TEAMS
// ============================================================

export async function getTeams(params?: {
  league_id?: number;
  country?: string;
  search?: string;
  per_page?: number;
  page?: number;
}) {
  const { data } = await client.get<ApiResponse<PaginatedResponse<Team>>>(
    'teams',
    { params },
  );
  return data.data;
}

export async function getTeam(teamId: number) {
  const { data } = await client.get<ApiResponse<Team>>(`teams/${teamId}`);
  return data.data;
}

export async function getTeamSquad(teamId: number) {
  const { data } = await client.get<ApiResponse<TeamSquadResponse>>(
    `teams/${teamId}/squad`,
  );
  return data.data;
}

export async function getTeamTactics(teamId: number) {
  const { data } = await client.get<ApiResponse<TeamTacticsResponse>>(
    `teams/${teamId}/tactics`,
  );
  return data.data;
}

export async function assignTacticToTeam(
  teamId: number,
  payload: { tactic_id: number; is_primary?: boolean },
) {
  const { data } = await client.post<ApiResponse<unknown>>(
    `teams/${teamId}/assign-tactic`,
    payload,
  );
  return data;
}

// ============================================================
// PLAYERS
// ============================================================

export async function getPlayers(params?: {
  team_id?: number;
  position_id?: number;
  nationality?: string;
  search?: string;
  min_age?: number;
  max_age?: number;
  min_value?: number;
  max_value?: number;
  sort_by?: string;
  sort_order?: 'asc' | 'desc';
  per_page?: number;
  page?: number;
}) {
  const { data } = await client.get<ApiResponse<PaginatedResponse<Player>>>(
    'players',
    { params },
  );
  return data.data;
}

export async function getPlayer(playerId: number) {
  const { data } = await client.get<ApiResponse<Player>>(
    `players/${playerId}`,
  );
  return data.data;
}

export async function getPlayerAttributes(playerId: number) {
  const { data } = await client.get<ApiResponse<PlayerAttributesByCategory>>(
    `players/${playerId}/attributes`,
  );
  return data.data;
}

// ============================================================
// POSITIONS
// ============================================================

export async function getPositions(params?: { category?: string }) {
  const { data } = await client.get<ApiResponse<Position[]>>('positions', {
    params,
  });
  return data.data;
}

export async function getPosition(positionId: number) {
  const { data } = await client.get<ApiResponse<Position>>(
    `positions/${positionId}`,
  );
  return data.data;
}

export async function getPositionsGroupedByCategory() {
  const { data } = await client.get<ApiResponse<Record<string, Position[]>>>(
    'positions/category/grouped',
  );
  return data.data;
}

// ============================================================
// FORMATIONS
// ============================================================

export async function getFormations(params?: {
  style?: string;
  is_active?: boolean;
}) {
  const { data } = await client.get<ApiResponse<Formation[]>>('formations', {
    params,
  });
  return data.data;
}

export async function getFormation(formationId: number) {
  const { data } = await client.get<ApiResponse<Formation>>(
    `formations/${formationId}`,
  );
  return data.data;
}

export async function getFormationVisualization(formationId: number) {
  const { data } = await client.get<ApiResponse<FormationVisualization>>(
    `formations/${formationId}/visualization`,
  );
  return data.data;
}

export async function getFormationSampleInstructions(formationId: number) {
  const { data } = await client.get<ApiResponse<FormationSampleInstructions>>(
    `formations/${formationId}/sample-instructions`,
  );
  return data.data;
}

export async function getFormationsGroupedByStyle() {
  const { data } = await client.get<ApiResponse<FormationsByStyle>>(
    'formations/style/grouped',
  );
  return data.data;
}

export async function detectFormation(
  positions: { x: number; y: number; position?: string }[],
) {
  const { data } = await client.post<
    ApiResponse<{ formation: Formation; detected_pattern: string }>
  >('formations/detect', { positions });
  return data.data;
}

// ============================================================
// TACTICS
// ============================================================

export async function getTactics(params?: {
  formation_id?: number;
  mentality?: string;
  style?: string;
  per_page?: number;
  page?: number;
}) {
  const { data } = await client.get<ApiResponse<PaginatedResponse<Tactic>>>(
    'tactics',
    { params },
  );
  return data.data;
}

export async function getTactic(tacticId: number) {
  const { data } = await client.get<ApiResponse<Tactic>>(
    `tactics/${tacticId}`,
  );
  return data.data;
}

export async function createTactic(payload: CreateTacticPayload) {
  const { data } = await client.post<ApiResponse<Tactic>>('tactics', payload);
  return data.data;
}

export async function updateTactic(
  tacticId: number,
  payload: UpdateTacticPayload,
) {
  const { data } = await client.put<ApiResponse<Tactic>>(
    `tactics/${tacticId}`,
    payload,
  );
  return data.data;
}

export async function deleteTactic(tacticId: number) {
  const { data } = await client.delete<ApiResponse<null>>(
    `tactics/${tacticId}`,
  );
  return data;
}

export async function assignTacticToTeamViaTactic(
  tacticId: number,
  payload: AssignTacticPayload,
) {
  const { data } = await client.post<ApiResponse<TacticAssignResponse>>(
    `tactics/${tacticId}/assign-team`,
    payload,
  );
  return data.data;
}

export async function getTacticAnalysis(tacticId: number) {
  const { data } = await client.get<ApiResponse<TacticAnalysis>>(
    `tactics/${tacticId}/analysis`,
  );
  return data.data;
}

// ============================================================
// LEAGUES
// ============================================================

export async function getLeagues(params?: {
  country?: string;
  level?: number;
  per_page?: number;
  page?: number;
}) {
  const { data } = await client.get<ApiResponse<PaginatedResponse<League>>>(
    'leagues',
    { params },
  );
  return data.data;
}

export async function getLeague(leagueId: number) {
  const { data } = await client.get<ApiResponse<League>>(
    `leagues/${leagueId}`,
  );
  return data.data;
}

export async function getLeagueStandings(leagueId: number) {
  // NOTE: This endpoint returns a flat object, not wrapped in ApiResponse.
  const { data } = await client.get<LeagueStandingsResponse>(
    `leagues/${leagueId}/standings`,
  );
  return data;
}

export async function getStatsOverview() {
  // NOTE: This returns a raw array, not wrapped in ApiResponse.
  const { data } = await client.get<LeagueOverviewEntry[]>('stats/overview');
  return data;
}

// ============================================================
// MATCHES
// ============================================================

export async function getLeagueMatches(params: {
  league_id: number;
  season_id?: number;
  matchday?: number;
  team_id?: number;
  status?: string;
}) {
  const { data } = await client.get<ApiStatusResponse<LeagueMatchesResponse>>(
    'matches/league',
    { params },
  );
  return data.data;
}

export async function getTeamMatches(params: {
  team_id: number;
  season_id?: number;
  status?: string;
}) {
  const { data } = await client.get<ApiStatusResponse<Match[]>>(
    'matches/team',
    { params },
  );
  return data.data;
}

export async function getUpcomingMatches(params?: {
  league_id?: number;
  limit?: number;
}) {
  const { data } = await client.get<ApiStatusResponse<Match[]>>(
    'matches/upcoming',
    { params },
  );
  return data.data;
}

export async function getMatchDetails(matchId: number) {
  const { data } = await client.get<ApiStatusResponse<Match>>(
    `matches/${matchId}`,
  );
  return data.data;
}

export async function getMatchLineup(matchId: number) {
  const { data } = await client.get<ApiStatusResponse<MatchLineupResponse>>(
    `matches/${matchId}/lineup`,
  );
  return data.data;
}

export async function saveMatchLineup(
  matchId: number,
  payload: SaveLineupPayload,
) {
  const { data } = await client.put<ApiStatusResponse<MatchLineupResponse>>(
    `matches/${matchId}/lineup`,
    payload,
  );
  return data.data;
}

export async function updateMatchTactics(
  matchId: number,
  payload: UpdateMatchTacticsPayload,
) {
  const { data } = await client.patch<ApiResponse<Match>>(
    `matches/${matchId}/tactics`,
    payload,
  );
  return data.data;
}

export async function simulateMatch(matchId: number) {
  const { data } = await client.post<ApiResponse<MatchSimulationResult>>(
    `matches/${matchId}/simulate`,
  );
  return data.data;
}

export async function resetMatch(matchId: number) {
  const { data } = await client.post<ApiResponse<null>>(
    `matches/${matchId}/reset`,
  );
  return data;
}

export async function completeMatch(matchId: number) {
  const { data } = await client.post<ApiResponse<null>>(
    `matches/${matchId}/complete`,
  );
  return data;
}

export async function getMatchTactics(matchId: number) {
  const { data } = await client.get<ApiResponse<MatchTacticsResponse>>(
    `matches/${matchId}/tactics`,
  );
  return data.data;
}

// ============================================================
// SIMULATION — SSE Stream & Instant
// ============================================================

/**
 * Start an SSE stream for live match simulation.
 *
 * Returns an EventSource that emits the following event types:
 *   lineup   — SSELineupData
 *   minute   — SimulationTick
 *   goal     — SSEGoalData
 *   card     — SSECardData
 *   half_time — SSEPhaseData
 *   full_time — SSEPhaseData
 *   error    — SSEErrorData
 *
 * The caller is responsible for closing the EventSource when done.
 *
 * NOTE: EventSource only supports GET, but the backend route is POST.
 *       We use fetch() to initiate the SSE stream instead.
 */
export function createSimulationStream(
  matchId: number,
  speed: 'realtime' | 'fast' | 'instant' = 'fast',
): {
  /** Async generator yielding parsed SSE frames. */
  stream: () => AsyncGenerator<{ event: string; data: unknown }>;
  /** Abort the stream. */
  abort: () => void;
} {
  const controller = new AbortController();
  const token = localStorage.getItem('ff_auth_token');

  const baseUrl = process.env.REACT_APP_API_URL || '/api/v1';
  const url = `${baseUrl}/matches/${matchId}/simulate-stream?speed=${speed}`;

  async function* stream() {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Accept: 'text/event-stream',
        Authorization: token ? `Bearer ${token}` : '',
      },
      signal: controller.signal,
    });

    if (!response.ok || !response.body) {
      throw new Error(`SSE stream failed: ${response.status} ${response.statusText}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || ''; // keep incomplete line in buffer

      let currentEvent = 'message';
      let currentData = '';

      for (const line of lines) {
        if (line.startsWith('event: ')) {
          currentEvent = line.slice(7).trim();
        } else if (line.startsWith('data: ')) {
          currentData = line.slice(6);
        } else if (line === '' && currentData) {
          // Empty line = end of SSE frame
          try {
            const parsed = JSON.parse(currentData);
            yield { event: currentEvent, data: parsed };
          } catch {
            // skip malformed frames
          }
          currentEvent = 'message';
          currentData = '';
        }
      }
    }
  }

  return {
    stream,
    abort: () => controller.abort(),
  };
}

/**
 * Run a full instant simulation (no streaming).
 * Returns every minute tick + final score + stats in one response.
 */
export async function simulateInstant(matchId: number) {
  const { data } = await client.get<InstantSimulationResponse>(
    `matches/${matchId}/simulate-instant`,
  );
  return data;
}

// ============================================================
// TIME PROGRESSION
// ============================================================

export async function getCurrentGameDate(teamId?: number) {
  const { data } = await client.get<ApiResponse<GameTimeResponse>>(
    'time/current-date',
    { params: teamId ? { team_id: teamId } : undefined },
  );
  return data.data;
}

export async function advanceDay(payload: AdvanceDayPayload) {
  const { data } = await client.post<ApiResponse<AdvanceDayResponse>>(
    'time/advance-day',
    payload,
  );
  return data.data;
}

export async function advanceToMatch(payload: AdvanceDayPayload) {
  const { data } = await client.post<ApiResponse<AdvanceDayResponse>>(
    'time/advance-to-match',
    payload,
  );
  return data.data;
}

// ============================================================
// STATISTICS
// ============================================================

export async function getTopRatedPlayers() {
  const { data } = await client.get<ApiResponse<Player[]>>(
    'stats/players/top-rated',
  );
  return data.data;
}

export async function getMostValuableTeams() {
  const { data } = await client.get<ApiResponse<Team[]>>(
    'stats/teams/most-valuable',
  );
  return data.data;
}

// ============================================================
// UTILITIES
// ============================================================

export async function getCountries() {
  const { data } = await client.get<ApiResponse<string[]>>('utils/countries');
  return data.data;
}

export async function getNationalities() {
  const { data } = await client.get<ApiResponse<string[]>>(
    'utils/nationalities',
  );
  return data.data;
}

export async function getTacticalOptions() {
  const { data } = await client.get<
    ApiResponse<Record<string, string[]>>
  >('utils/tactical-options');
  return data.data;
}
