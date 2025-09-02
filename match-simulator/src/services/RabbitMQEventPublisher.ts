import * as amqp from 'amqplib';
import { Logger } from '../utils/Logger';

export interface MatchEvent {
    jobId: string;
    userId: number;
    timestamp: string;
    type: 'simulation-update' | 'simulation-complete' | 'simulation-error';
    data: any;
}

export class RabbitMQEventPublisher {
    private connection: any = null;
    private channel: any = null;
    private readonly exchangeName = 'match.events';

    async connect(): Promise<void> {
        try {
            const rabbitmqUrl = process.env.RABBITMQ_URL || 
                `amqp://${process.env.RABBITMQ_USER || 'football'}:${process.env.RABBITMQ_PASSWORD || 'fantasy'}@${process.env.RABBITMQ_HOST || 'rabbitmq'}:${process.env.RABBITMQ_PORT || 5672}${process.env.RABBITMQ_VHOST || '/'}`;

            this.connection = await amqp.connect(rabbitmqUrl);
            this.channel = await this.connection.createChannel();

            // Declare topic exchange for match events
            await this.channel.assertExchange(this.exchangeName, 'topic', { 
                durable: true,
                autoDelete: false 
            });

            Logger.info('Connected to RabbitMQ Event Publisher', { exchange: this.exchangeName });

            // Set up error handlers
            this.connection.on('error', (error: any) => {
                Logger.error('RabbitMQ Event Publisher connection error', { error: error.message });
            });

            this.connection.on('close', () => {
                Logger.info('RabbitMQ Event Publisher connection closed');
            });

        } catch (error) {
            Logger.error('Failed to connect to RabbitMQ Event Publisher', { 
                error: error instanceof Error ? error.message : 'Unknown error' 
            });
            throw error;
        }
    }

    async publishMatchEvent(event: MatchEvent): Promise<void> {
        if (!this.channel) {
            throw new Error('RabbitMQ channel not initialized');
        }

        const routingKey = `match.${event.jobId}.${event.type}`;
        const message = Buffer.from(JSON.stringify(event));

        await this.channel.publish(this.exchangeName, routingKey, message, {
            persistent: true,
            contentType: 'application/json',
            headers: {
                jobId: event.jobId,
                userId: event.userId,
                eventType: event.type,
                timestamp: event.timestamp
            }
        });

        Logger.info('📡 PUBLISHED MATCH EVENT TO RABBITMQ', { 
            jobId: event.jobId, 
            type: event.type, 
            routingKey,
            data_keys: Object.keys(event.data),
            data_summary: {
                status: event.data.status,
                message: event.data.message,
                progress: event.data.progress,
                minute: event.data.current_minute,
                score: event.data.score,
                events_count: event.data.events?.length || 0
            }
        });
    }

    async publishSimulationUpdate(jobId: string, userId: number, update: any): Promise<void> {
        // Sanitize payload to guarantee max 22 players and valid coordinates
        try {
            if (update && Array.isArray(update.playerPositions)) {
                const byId: Record<number, any> = {} as any;
                for (const p of update.playerPositions) {
                    if (!p || typeof p.playerId !== 'number') continue;
                    byId[p.playerId] = {
                        ...p,
                        x: Math.max(0, Math.min(100, p.x ?? 50)),
                        y: Math.max(0, Math.min(100, p.y ?? 50))
                    };
                }
                const unique = Object.values(byId) as any[];
                const home = unique.filter((p: any) => p.team === 'home').slice(0, 11);
                const away = unique.filter((p: any) => p.team === 'away').slice(0, 11);
                update.playerPositions = [...home, ...away];
            }
        } catch {}

        const event: MatchEvent = {
            jobId,
            userId,
            timestamp: new Date().toISOString(),
            type: 'simulation-update',
            data: update
        };

        await this.publishMatchEvent(event);
    }

    async publishSimulationComplete(jobId: string, userId: number, result: any): Promise<void> {
        const event: MatchEvent = {
            jobId,
            userId,
            timestamp: new Date().toISOString(),
            type: 'simulation-complete',
            data: result
        };

        await this.publishMatchEvent(event);
    }

    async publishSimulationError(jobId: string, userId: number, error: any): Promise<void> {
        const event: MatchEvent = {
            jobId,
            userId,
            timestamp: new Date().toISOString(),
            type: 'simulation-error',
            data: error
        };

        await this.publishMatchEvent(event);
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
            Logger.info('Disconnected from RabbitMQ Event Publisher');
        } catch (error) {
            Logger.error('Error disconnecting from RabbitMQ Event Publisher', {
                error: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }

    isConnected(): boolean {
        return this.connection !== null && this.channel !== null;
    }
} 