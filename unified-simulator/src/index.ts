import { connect as amqpConnect } from 'amqplib';
import { createServer } from 'http';
import { WebSocketService } from './services/WebSocketService';
import { Player, Team } from './types';
import { run_match } from './engine';

// Engine skeleton implementing the spec

// AMQP glue (placeholder queue names)
async function main() {
  const log = (...args: any[]) => console.log('[UnifiedSim]', ...args);
  // Optional Socket.IO bridge (consumes match.events and broadcasts)
  if (process.env.ENABLE_WS === '1') {
    const port = Number(process.env.PORT || 8010);
    const server = createServer((req, res) => { res.statusCode = 200; res.end('ok'); });
    const ws = new WebSocketService(server);
    await ws.initialize();
    server.listen(port, () => log('WebSocket server listening', { port }));
  }
  if (process.env.DRY_RUN === '1') {
    log('Dry run starting...');
    // fabricate minimal teams of 11 each
    const mkPlayer = (id: number, team_id: number, role: string): Player => ({
      id, name: `P${id}`, team_id, role, pos: { x: 50, y: 50 }, vel: { x: 0, y: 0 },
      base_position: { x: 40 + Math.random() * 20, y: 20 + Math.random() * 60 },
      attributes: { speed: 6, staminaMax: 90, passing: 60, vision: 60, dribbling: 60, shooting: 60, tackling: 60, aggression: 50, composure: 50, positioning: 60, first_touch: 60 },
      dynamic: { stamina: 90, morale: 50, confidence: 50, fatigue: 0, action_timer: 0, cooldowns: {}, memory: {}, distance_covered: 0 },
      tactical: {}, stats: {}
    });
    const home: Team = { id: 1, name: 'Home', formation_slots: {}, tactic: {}, cohesion: 0.8, momentum: 0.5, players: [], bench: [], subs_left: 5 };
    const away: Team = { id: 2, name: 'Away', formation_slots: {}, tactic: {}, cohesion: 0.8, momentum: 0.5, players: [], bench: [], subs_left: 5 };
    for (let i = 0; i < 11; i++) { home.players.push(mkPlayer(100 + i, 1, 'role')); away.players.push(mkPlayer(200 + i, 2, 'role')); }
    const result = run_match(home, away);
    log('Dry run complete. Final ball pos:', result.ball.pos);
    return;
  }

  const conn = await amqpConnect(process.env.RABBITMQ_URL || 'amqp://football:fantasy@rabbitmq:5672/');
  const ch = await conn.createChannel();
  const queueName = process.env.RABBITMQ_QUEUE || process.env.UNIFIED_QUEUE || 'microservice_jobs';
  await ch.assertQueue(queueName, { durable: true });
  await ch.assertExchange('match.events', 'topic', { durable: true });
  log('Connected to RabbitMQ');

  await ch.consume(queueName, async (msg) => {
    if (!msg) return;
    try {
      const payload = JSON.parse(msg.content.toString());
      const { home, away } = payload;
      // Trust payload to include formations/tactics/players/attributes
      console.log('[UnifiedSim][Job] Received', { homePlayers: home?.players?.length, awayPlayers: away?.players?.length, tacticH: home?.tactic, tacticA: away?.tactic });
      const result = run_match(home, away, {
        tickPublishInterval: 1,
        onTick: (snapshot) => {
          try {
            const ev = { type: 'simulation-update', jobId: payload.jobId || 'n/a', userId: payload.userId || 0, data: snapshot };
            ch.publish('match.events', `match.${payload.jobId || 'n/a'}.simulation-update`, Buffer.from(JSON.stringify(ev)), { persistent: false, contentType: 'application/json' });
          } catch {}
        },
        onEvent: (e) => {
          try {
            const ev = { type: 'simulation-event', jobId: payload.jobId || 'n/a', userId: payload.userId || 0, data: e };
            ch.publish('match.events', `match.${payload.jobId || 'n/a'}.simulation-event`, Buffer.from(JSON.stringify(ev)), { persistent: false, contentType: 'application/json' });
          } catch {}
        }
      });
      const event = { type: 'simulation-complete', jobId: payload.jobId || 'n/a', userId: payload.userId || 0, data: { summary: { distanceCovered: result.all_players.map(p => p.dynamic.distance_covered) } } };
      ch.publish('match.events', `match.${payload.jobId || 'n/a'}.simulation-complete`, Buffer.from(JSON.stringify(event)), { persistent: true, contentType: 'application/json' });
    } catch (e) {
      log('Error processing job:', (e as Error).message);
    } finally {
      ch.ack(msg!);
    }
  });
}

main().catch(e => { console.error('[UnifiedSim] Fatal error', e); process.exit(1); });


