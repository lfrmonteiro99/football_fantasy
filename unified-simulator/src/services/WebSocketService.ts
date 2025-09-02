import { Server as SocketIOServer, Socket } from 'socket.io';
import { Server as HttpServer } from 'http';
//import { Logger } from '../utils/Logger';
import * as amqp from 'amqplib';

export class WebSocketService {
    private io: SocketIOServer;
    private clients: Map<string, any> = new Map();
    private rabbitmqConnection: any = null;
    private rabbitmqChannel: any = null;
    private readonly exchangeName = 'match.events';

    constructor(server: HttpServer) {
        this.io = new SocketIOServer(server, {
            cors: {
                origin: "*", // Allow all origins for development
                methods: ["GET", "POST"]
            },
            pingTimeout: 60000, // 60 seconds
            pingInterval: 25000, // 25 seconds
            transports: ['polling', 'websocket']
        });
    }

    public async initialize(): Promise<void> {
        this.setupEventHandlers();
        await this.connectToRabbitMQ();
    }

    private setupEventHandlers(): void {
        this.io.on('connection', (socket: Socket) => {

            socket.on('subscribe-simulation', (data: { jobId: string }) => {
                const { jobId } = data;
                
                // Join room for this simulation
                socket.join(`simulation:${jobId}`);
                this.clients.set(socket.id, { jobId, socket });

                // Send confirmation
                socket.emit('subscribed', { jobId, message: 'Subscribed to simulation updates' });
            });

            socket.on('disconnect', () => {
                this.clients.delete(socket.id);
            });
        });
    }

    public broadcastSimulationUpdate(jobId: string, update: any): void {
        this.io.to(`simulation:${jobId}`).emit('simulation-update', update);
    }

    public broadcastSimulationComplete(jobId: string, result: any): void {
        this.io.to(`simulation:${jobId}`).emit('simulation-complete', result);
    }

    public broadcastSimulationError(jobId: string, error: any): void {
        this.io.to(`simulation:${jobId}`).emit('simulation-error', error);
    }

    public getConnectedClients(): number {
        return this.clients.size;
    }

    private async connectToRabbitMQ(): Promise<void> {
        try {
            const rabbitmqUrl = process.env.RABBITMQ_URL || 
                `amqp://${process.env.RABBITMQ_USER || 'football'}:${process.env.RABBITMQ_PASSWORD || 'fantasy'}@${process.env.RABBITMQ_HOST || 'rabbitmq'}:${process.env.RABBITMQ_PORT || 5672}${process.env.RABBITMQ_VHOST || '/'}`;

            this.rabbitmqConnection = await amqp.connect(rabbitmqUrl);
            this.rabbitmqChannel = await this.rabbitmqConnection.createChannel();

            // Declare the exchange
            await this.rabbitmqChannel.assertExchange(this.exchangeName, 'topic', { 
                durable: true,
                autoDelete: false 
            });

            // Declare a queue for this WebSocket service instance
            const queueName = `websocket_events_${process.env.INSTANCE_ID || 'default'}`;
            await this.rabbitmqChannel.assertQueue(queueName, { 
                durable: true,
                autoDelete: false 
            });

            // Bind to all match events (use # to match multiple levels)
            await this.rabbitmqChannel.bindQueue(queueName, this.exchangeName, 'match.#');

            // Start consuming events
            await this.rabbitmqChannel.consume(queueName, (message: any) => {
                if (!message) return;

                try {
                    const event = JSON.parse(message.content.toString());
                    this.handleRabbitMQEvent(event);
                    this.rabbitmqChannel.ack(message);
                } catch (error) {
                    this.rabbitmqChannel.nack(message, false, false);
                }
            });

            // Set up error handlers
            this.rabbitmqConnection.on('error', (error: any) => {
               // Logger.error('RabbitMQ connection error in WebSocket service', { error: error.message });
            });

            this.rabbitmqConnection.on('close', () => {
               // Logger.info('RabbitMQ connection closed in WebSocket service');
            });

        } catch (error) {
            throw error;
        }
    }

    private handleRabbitMQEvent(event: any): void {
        const { jobId, type, data } = event;
        
        // Find all clients subscribed to this simulation
        const subscribedClients = Array.from(this.clients.values())
            .filter(client => client.jobId === jobId);

        if (subscribedClients.length === 0) {
            return;
        }

        // Broadcast to all subscribed clients
        switch (type) {
            case 'simulation-update':
                this.io.to(`simulation:${jobId}`).emit('simulation-update', data);
                break;
            case 'simulation-complete':
                this.io.to(`simulation:${jobId}`).emit('simulation-complete', data);
                break;
            case 'simulation-error':
                this.io.to(`simulation:${jobId}`).emit('simulation-error', data);
                break;
            default:
        }

    }

    public async disconnect(): Promise<void> {
        try {
            if (this.rabbitmqChannel) {
                await this.rabbitmqChannel.close();
                this.rabbitmqChannel = null;
            }
            if (this.rabbitmqConnection) {
                await this.rabbitmqConnection.close();
                this.rabbitmqConnection = null;
            }
        } catch (error) {
            //Logger.error('Error disconnecting WebSocket service from RabbitMQ', {
            //    error: error instanceof Error ? error.message : 'Unknown error'
            //});
        }
    }
}