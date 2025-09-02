import * as amqp from 'amqplib';
import { Logger } from '../utils/Logger';
import { RealTimeMatchSimulationService } from './RealTimeMatchSimulationService';
import { WebSocketService } from './WebSocketService';
import { RabbitMQEventPublisher } from './RabbitMQEventPublisher';

export interface MatchSimulationJob {
    job_id: string;
    user_id: number;
    match_data: {
        home_team_id: number;
        away_team_id: number;
        home_team?: any;
        away_team?: any;
        home_tactic_id?: number;
        away_tactic_id?: number;
        weather: string;
        stadium: string;
    };
    options: {
        tickRate?: number;
        enableCommentary?: boolean;
        enableStatistics?: boolean;
        enableFatigue?: boolean;
        enableMomentum?: boolean;
        enableWeather?: boolean;
    };
}

export class RabbitMQConsumerService {
    private connection: any = null;
    private channel: any = null;
    private simulationService: RealTimeMatchSimulationService;
    private webSocketService?: WebSocketService;
    private eventPublisher: RabbitMQEventPublisher;

    constructor(simulationService: RealTimeMatchSimulationService, webSocketService?: WebSocketService) {
        this.simulationService = simulationService;
        this.webSocketService = webSocketService;
        this.eventPublisher = new RabbitMQEventPublisher();
    }

    async connect(): Promise<void> {
        try {
            const rabbitmqUrl = process.env.RABBITMQ_URL || 
                `amqp://${process.env.RABBITMQ_USER || 'football'}:${process.env.RABBITMQ_PASSWORD || 'fantasy'}@${process.env.RABBITMQ_HOST || 'localhost'}:${process.env.RABBITMQ_PORT || 5672}${process.env.RABBITMQ_VHOST || '/'}`;

            this.connection = await amqp.connect(rabbitmqUrl);
            this.channel = await this.connection.createChannel();

            // Declare exchange for publishing results back
            await this.channel.assertExchange('simulation_results', 'topic', { durable: true });

            // Declare queue for receiving jobs
            const queue = process.env.RABBITMQ_QUEUE || 'microservice_jobs';
            await this.channel.assertQueue(queue, { durable: true });

            // Connect to event publisher
            await this.eventPublisher.connect();

            Logger.info('Connected to RabbitMQ', { queue, exchange: 'simulation_results' });

            // Set up error handlers
            this.connection.on('error', (error: any) => {
                Logger.error('RabbitMQ connection error', { error: error.message });
            });

            this.connection.on('close', () => {
                Logger.info('RabbitMQ connection closed');
            });

        } catch (error) {
            Logger.error('Failed to connect to RabbitMQ', { 
                error: error instanceof Error ? error.message : 'Unknown error' 
            });
            throw error;
        }
    }

    async startConsuming(): Promise<void> {
        if (!this.channel) {
            throw new Error('RabbitMQ channel not initialized');
        }

        const queue = process.env.RABBITMQ_QUEUE || 'microservice_jobs';

        // Set QoS to process one message at a time
        await this.channel.prefetch(1);

        Logger.info('Starting to consume match simulation jobs', { queue });

        await this.channel.consume(queue, async (message: any) => {
            if (!message) {
                Logger.warn('Received null message from RabbitMQ');
                return;
            }

            Logger.info('🐰 RAW MESSAGE RECEIVED', {
                messageId: message.properties?.messageId,
                contentType: message.properties?.contentType,
                contentLength: message.content.length,
                headers: message.properties?.headers,
                fields: message.fields
            });

            try {
                const rawData = message.content.toString();
                Logger.info('🐰 RAW MESSAGE CONTENT', { 
                    rawData: rawData.substring(0, 500) + (rawData.length > 500 ? '...' : ''),
                    fullLength: rawData.length 
                });

                // Try to parse JSON
                let jobData: MatchSimulationJob;
                try {
                    jobData = JSON.parse(rawData);
                    Logger.info('🐰 JSON PARSING SUCCESS', { 
                        hasJobId: !!jobData.job_id,
                        hasUserId: !!jobData.user_id,
                        hasMatchData: !!jobData.match_data,
                        hasOptions: !!jobData.options,
                        dataKeys: Object.keys(jobData)
                    });
                } catch (parseError) {
                    Logger.error('🐰 JSON PARSING FAILED', {
                        error: parseError instanceof Error ? parseError.message : 'Unknown parse error',
                        rawDataPreview: rawData.substring(0, 200),
                        rawDataType: typeof rawData
                    });
                    this.channel.ack(message); // Acknowledge to prevent requeue of invalid messages
                    return;
                }

                // Validate required fields
                if (!jobData.job_id || !jobData.user_id || !jobData.match_data) {
                    Logger.error('🐰 INVALID MESSAGE STRUCTURE', {
                        hasJobId: !!jobData.job_id,
                        hasUserId: !!jobData.user_id,
                        hasMatchData: !!jobData.match_data,
                        actualStructure: Object.keys(jobData)
                    });
                    this.channel.ack(message);
                    return;
                }
                
                Logger.info('🐰 VALID JOB DATA EXTRACTED', { 
                    job_id: jobData.job_id,
                    user_id: jobData.user_id,
                    match_data: jobData.match_data,
                    options: jobData.options
                });

                // Process the job
                Logger.info('🐰 STARTING JOB PROCESSING', { job_id: jobData.job_id });
                await this.processSimulationJob(jobData);
                Logger.info('🐰 JOB PROCESSING COMPLETED', { job_id: jobData.job_id });

                // Acknowledge the message
                this.channel.ack(message);
                Logger.info('🐰 MESSAGE ACKNOWLEDGED', { job_id: jobData.job_id });

            } catch (error) {
                Logger.error('🐰 CONSUMER ERROR', {
                    error: error instanceof Error ? error.message : 'Unknown error',
                    stack: error instanceof Error ? error.stack : undefined,
                    messageContent: message.content.toString().substring(0, 200)
                });

                // Reject and requeue the message (with limit to prevent infinite loops)
                this.channel.nack(message, false, false);
            }
        });
    }

    private async processSimulationJob(jobData: MatchSimulationJob): Promise<void> {
        const { job_id, user_id, match_data, options } = jobData;

        try {
            // Publish job started update
            const startUpdate = {
                status: 'processing',
                message: 'Microservice started processing simulation',
                progress: 5
            };
            await this.publishJobUpdate(job_id, user_id, startUpdate);
            
            // Also publish to RabbitMQ event exchange
            await this.eventPublisher.publishSimulationUpdate(job_id, user_id, startUpdate);

            // Convert match data to the format expected by the simulation service
            // Use real team data from API if available, otherwise create mock teams
            const simulationData = {
                home_team: match_data.home_team || {
                    id: match_data.home_team_id,
                    name: `Team ${match_data.home_team_id}`,
                    players: this.generateBasicPlayers(match_data.home_team_id, 'home')
                },
                away_team: match_data.away_team || {
                    id: match_data.away_team_id,
                    name: `Team ${match_data.away_team_id}`,
                    players: this.generateBasicPlayers(match_data.away_team_id, 'away')
                },
                options: {
                    weather: match_data.weather,
                    stadium: match_data.stadium,
                    ...options
                }
            };

            // Create progress callback to publish updates
            const progressCallback = (update: any) => {
                // Sanitize playerPositions to avoid >22 players and duplicates
                try {
                    if (update && Array.isArray(update.playerPositions)) {
                        const byId: Record<number, any> = {} as any;
                        for (const p of update.playerPositions) {
                            if (!p || typeof p.playerId !== 'number') continue;
                            // Keep last occurrence
                            byId[p.playerId] = p;
                        }
                        let players = Object.values(byId) as any[];
                        // Bound coordinates
                        players = players.map(p => ({
                            ...p,
                            x: Math.max(0, Math.min(100, p.x ?? 50)),
                            y: Math.max(0, Math.min(100, p.y ?? 50))
                        }));
                        // Limit 11 per team
                        const home: any[] = [];
                        const away: any[] = [];
                        for (const p of players) {
                            if (p.team === 'home' && home.length < 11) home.push(p);
                            else if (p.team === 'away' && away.length < 11) away.push(p);
                        }
                        update.playerPositions = [...home, ...away];
                    }
                } catch (e) {
                    Logger.warn('Sanitization of playerPositions failed', { error: e instanceof Error ? e.message : String(e) });
                }
                const progress = Math.min(95, Math.max(5, (update.minute || 0) / 90 * 90));
                
                const progressUpdate = {
                    status: 'processing',
                    message: `Match in progress - Minute ${update.minute || 0}`,
                    progress,
                    current_minute: update.minute,
                    score: update.score,
                    events: update.events,
                    statistics: update.statistics,
                    ...update // Include all simulation data
                };
                
                // LOG ALL EVENTS BEING PRODUCED
                Logger.info('📡 PRODUCING SIMULATION UPDATE', {
                    job_id,
                    minute: update.minute,
                    score: update.score,
                    events_count: update.events?.length || 0,
                    events: update.events?.map((e: any) => ({
                        minute: e.minute,
                        type: e.type,
                        team: e.team,
                        player: e.playerName,
                        description: e.description
                    })) || [],
                    statistics: update.statistics,
                    ball_position: update.ballPosition,
                    player_positions_count: update.playerPositions?.length || 0,
                    team_counts: {
                        home: (update.playerPositions || []).filter((p: any) => p.team === 'home').length,
                        away: (update.playerPositions || []).filter((p: any) => p.team === 'away').length,
                    },
                    player_positions_sample: update.playerPositions?.slice(0, 3).map((p: any) => ({
                        id: p.playerId,
                        team: p.team,
                        role: p.role,
                        pos: `(${p.x?.toFixed(1)}, ${p.y?.toFixed(1)})`
                    })) || [],
                    possession: update.possession,
                    momentum: update.momentum,
                    intensity: update.intensity
                });
                
                // Publish to both RabbitMQ exchanges
                this.publishJobUpdate(job_id, user_id, progressUpdate).catch(error => {
                    Logger.error('Failed to publish progress update to simulation_results', { 
                        job_id, 
                        error: error.message 
                    });
                });
                
                this.eventPublisher.publishSimulationUpdate(job_id, user_id, progressUpdate).catch(error => {
                    Logger.error('Failed to publish progress update to match.events', { 
                        job_id, 
                        error: error.message 
                    });
                });
            };

            // Run the actual match simulation with real-time updates
            Logger.info('Starting real match simulation', { job_id, user_id, simulationData });
            
            try {
                // Run the simulation with progress callback for real-time updates
                await this.simulationService.simulateStreamingMatch(simulationData, progressCallback);
                
                // Publish completion update
                const completionUpdate = {
                    status: 'completed',
                    message: 'Match simulation completed successfully!',
                    progress: 100,
                    result: { message: 'Match simulation completed successfully' }
                };
                
                await this.publishJobUpdate(job_id, user_id, completionUpdate);
                
                // Also publish to RabbitMQ event exchange
                await this.eventPublisher.publishSimulationComplete(job_id, user_id, completionUpdate);

                Logger.info('Match simulation completed successfully', { job_id, user_id });
                
            } catch (simulationError) {
                Logger.error('Match simulation failed', {
                    job_id,
                    user_id,
                    error: simulationError instanceof Error ? simulationError.message : 'Unknown error'
                });

                // Publish failure update
                const failureUpdate = {
                    status: 'failed',
                    message: `Match simulation failed: ${simulationError instanceof Error ? simulationError.message : 'Unknown error'}`,
                    error: simulationError instanceof Error ? simulationError.message : 'Unknown error'
                };
                
                await this.publishJobUpdate(job_id, user_id, failureUpdate);
                
                // Also publish to RabbitMQ event exchange
                await this.eventPublisher.publishSimulationError(job_id, user_id, failureUpdate);
            }

        } catch (error) {
            Logger.error('Match simulation failed', {
                job_id,
                user_id,
                error: error instanceof Error ? error.message : 'Unknown error'
            });

            // Publish failure update
            await this.publishJobUpdate(job_id, user_id, {
                status: 'failed',
                message: `Match simulation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
                error: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }

    private async publishJobUpdate(jobId: string, userId: number, data: any): Promise<void> {
        if (!this.channel) {
            throw new Error('RabbitMQ channel not initialized');
        }

        const updateData = {
            job_id: jobId,
            user_id: userId,
            timestamp: new Date().toISOString(),
            ...data
        };

        const routingKey = `job.${jobId}`;
        const message = Buffer.from(JSON.stringify(updateData));

        await this.channel.publish('simulation_results', routingKey, message, {
            persistent: true,
            contentType: 'application/json'
        });

        Logger.debug('Published job update', { job_id: jobId, status: data.status });
    }

    async disconnect(): Promise<void> {
        try {
            if (this.channel) {
                await this.channel.close();
                this.channel = null;
            }
            if (this.connection) {
                await this.connection.close();
                this.connection = null;
            }
            await this.eventPublisher.disconnect();
            Logger.info('Disconnected from RabbitMQ');
        } catch (error) {
            Logger.error('Error disconnecting from RabbitMQ', {
                error: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }

    isConnected(): boolean {
        return this.connection !== null && this.channel !== null;
    }

    private generateBasicPlayers(teamId: number, teamSide: 'home' | 'away'): any[] {
        const players = [];
        const positions = ['GK', 'DF', 'DF', 'DF', 'DF', 'MF', 'MF', 'MF', 'MF', 'FW', 'FW'];
        
        for (let i = 0; i < 11; i++) {
            players.push({
                id: teamId * 100 + i + 1,
                first_name: `Player`,
                last_name: `${i + 1}`,
                shirt_number: i + 1,
                team_id: teamId,
                primary_position: {
                    name: positions[i],
                    short_name: positions[i],
                    category: positions[i] === 'GK' ? 'goalkeeper' : positions[i] === 'DF' ? 'defender' : positions[i] === 'MF' ? 'midfielder' : 'forward'
                },
                attributes: {
                    pace: 70 + Math.random() * 20,
                    shooting: 60 + Math.random() * 30,
                    passing: 65 + Math.random() * 25,
                    defending: positions[i] === 'DF' ? 75 + Math.random() * 20 : 50 + Math.random() * 30,
                    dribbling: 60 + Math.random() * 30,
                    physical: 70 + Math.random() * 20
                }
            });
        }
        
        return players;
    }
}