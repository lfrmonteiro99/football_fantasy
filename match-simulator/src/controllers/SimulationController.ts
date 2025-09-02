import { Request, Response } from 'express';
import { RealTimeMatchSimulationService } from '../services/RealTimeMatchSimulationService';
import { SimulationRequest, SimulationResponse } from '../types';
import { Logger } from '../utils/Logger';
import { ValidationService } from '../services/ValidationService';

export class SimulationController {
  private simulationService: RealTimeMatchSimulationService;
  private validationService: ValidationService;
  
  constructor() {
    this.simulationService = new RealTimeMatchSimulationService();
    this.validationService = new ValidationService();
  }
  
  public async simulateMatch(req: Request, res: Response): Promise<void> {
    const startTime = performance.now();
    
    try {
      Logger.info('Received simulation request', {
        method: req.method,
        path: req.path,
        bodySize: JSON.stringify(req.body).length
      });
      
      // Validate request
      const validationResult = this.validationService.validateSimulationRequest(req.body);
      if (!validationResult.success) {
        res.status(400).json({
          success: false,
          error: validationResult.error
        });
        return;
      }
      
      const request: SimulationRequest = req.body;
      
      // Simulate the match
      const stream = await this.simulationService.simulateRealTimeMatch(request);
      
      const responseTime = performance.now() - startTime;
      
      const response: SimulationResponse = {
        success: true,
        data: stream,
        performance: {
          simulationTime: stream.performance.simulationTime,
          memoryUsage: stream.performance.memoryUsage,
          cpuUsage: responseTime
        }
      };
      
      Logger.info('Simulation completed successfully', {
        responseTime,
        simulationTime: stream.performance.simulationTime,
        updates: stream.updates.length,
        events: stream.events.length,
        finalScore: stream.finalScore
      });
      
      res.json(response);
      
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;
      
      Logger.error('Simulation failed', { 
        error: errorMessage,
        stack: errorStack 
      });
      
      res.status(500).json({
        success: false,
        error: 'Internal server error during simulation',
        details: process.env.NODE_ENV === 'development' ? errorMessage : undefined
      });
    }
  }
  
  public async simulateRealTimeMatch(req: Request, res: Response): Promise<void> {
    // Same as simulateMatch but with real-time options enabled
    const request = req.body;
    request.options = {
      ...request.options,
      realTime: true,
      enableCommentary: true,
      enableStatistics: true,
      enableFatigue: true,
      enableMomentum: true
    };
    
    await this.simulateMatch(req, res);
  }
  
  public async simulateStreamingMatch(req: Request, res: Response): Promise<void> {
    try {
      Logger.info('Received streaming simulation request', {
        method: req.method,
        path: req.path,
        bodySize: JSON.stringify(req.body).length
      });
      
      console.log('=== FRONTEND REQUEST ANALYSIS ===');
      console.log('Full request body:', JSON.stringify(req.body, null, 2));
      console.log('Request body keys:', Object.keys(req.body));
      
      if (req.body.home_team) {
        console.log('HOME TEAM DATA:');
        console.log('- ID:', req.body.home_team.id);
        console.log('- Name:', req.body.home_team.name);
        console.log('- Players count:', req.body.home_team.players?.length || 0);
        if (req.body.home_team.players?.[0]) {
          console.log('- First player sample:', JSON.stringify(req.body.home_team.players[0], null, 2));
        }
      }
      
      if (req.body.away_team) {
        console.log('AWAY TEAM DATA:');
        console.log('- ID:', req.body.away_team.id);
        console.log('- Name:', req.body.away_team.name);
        console.log('- Players count:', req.body.away_team.players?.length || 0);
        if (req.body.away_team.players?.[0]) {
          console.log('- First player sample:', JSON.stringify(req.body.away_team.players[0], null, 2));
        }
      }
      
      if (req.body.home_tactic) {
        console.log('HOME TACTIC DATA:', JSON.stringify(req.body.home_tactic, null, 2));
      }
      
      if (req.body.away_tactic) {
        console.log('AWAY TACTIC DATA:', JSON.stringify(req.body.away_tactic, null, 2));
      }
      
      console.log('=== END REQUEST ANALYSIS ===');
      
      // Handle case where we have team IDs instead of full team objects
      let requestBody = { ...req.body };
      if (requestBody.home_team_id && !requestBody.home_team) {
        console.log(`Generating basic team for home_team_id: ${requestBody.home_team_id}`);
        requestBody.home_team = this.generateBasicTeam(requestBody.home_team_id, 'Home Team');
      }
      if (requestBody.away_team_id && !requestBody.away_team) {
        console.log(`Generating basic team for away_team_id: ${requestBody.away_team_id}`);
        requestBody.away_team = this.generateBasicTeam(requestBody.away_team_id, 'Away Team');
      }
      
      console.log('Request body after team generation:', JSON.stringify({
        home_team: requestBody.home_team ? 'Generated' : 'Not found',
        away_team: requestBody.away_team ? 'Generated' : 'Not found',
        options: requestBody.options
      }));
      
      // Validate request
      const validationResult = this.validationService.validateSimulationRequest(requestBody);
      if (!validationResult.success) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          success: false,
          error: validationResult.error
        }));
        return;
      }
      
      const request: SimulationRequest = requestBody;
      
      // Set up Server-Sent Events
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Cache-Control'
      });
      
      // Send initial event
      res.write(`data: ${JSON.stringify({ type: 'start', message: 'Simulation starting...' })}\n\n`);
      
      // Simulate the match with streaming
      await this.simulationService.simulateStreamingMatch(request, (update) => {
        // Send each update as it becomes available
        res.write(`data: ${JSON.stringify({ type: 'update', data: update })}\n\n`);
      });
      
      // Send completion event
      res.write(`data: ${JSON.stringify({ type: 'complete', message: 'Simulation completed' })}\n\n`);
      res.end();
      
      Logger.info('Streaming simulation completed successfully');
      
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;
      
      Logger.error('Streaming simulation failed', { 
        error: errorMessage,
        stack: errorStack 
      });
      
      res.write(`data: ${JSON.stringify({ type: 'error', error: errorMessage })}\n\n`);
      res.end();
    }
  }

  public health(req: Request, res: Response): void {
    const health = {
      status: 'healthy',
      service: 'match-simulator',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      environment: process.env.NODE_ENV || 'development'
    };
    
    res.json(health);
  }

  private generateBasicTeam(teamId: number, teamName: string): any {
    const basicAttributes = {
      pace: 50, shooting: 50, passing: 50, dribbling: 50, defending: 50, physical: 50,
      stamina: 50, strength: 50, acceleration: 50, sprint_speed: 50, finishing: 50,
      shot_power: 50, long_shots: 50, volleys: 50, penalties: 50, vision: 50,
      crossing: 50, free_kick_accuracy: 50, short_passing: 50, long_passing: 50,
      curve: 50, agility: 50, balance: 50, reactions: 50, ball_control: 50,
      dribbling_skill: 50, composure: 50, interceptions: 50, heading_accuracy: 50,
      marking: 50, standing_tackle: 50, sliding_tackle: 50, jumping: 50,
      stamina_attr: 50, strength_attr: 50, aggression: 50
    };

    const positions = ['GK', 'CB', 'CB', 'LB', 'RB', 'CM', 'CM', 'CM', 'LW', 'RW', 'ST'];
    const players = [];

    for (let i = 0; i < 11; i++) {
      players.push({
        id: teamId * 100 + i + 1,
        first_name: `Player`,
        last_name: `${i + 1}`,
        shirt_number: i + 1,
        team_id: teamId,
        primary_position: {
          id: i + 1,
          name: positions[i],
          short_name: positions[i],
          category: positions[i] === 'GK' ? 'Goalkeeper' : 
                   ['CB', 'LB', 'RB'].includes(positions[i]) ? 'Defender' :
                   ['CM'].includes(positions[i]) ? 'Midfielder' : 'Forward',
          key_attributes: []
        },
        attributes: basicAttributes
      });
    }

    return {
      id: teamId,
      name: teamName,
      players: players
    };
  }
} 