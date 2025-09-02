Unified Simulator (Engine v2)

This microservice implements a clean 1-second tick football simulation loop and RabbitMQ integration.

Quick Start
1) cd unified-simulator
2) npm install
3) npm run build
4) DRY_RUN=1 npm start

Docker
docker build -t unified-simulator .

Integration
- Consumes jobs from UNIFIED_QUEUE (default: unified_jobs)
- Publishes events to unified_events exchange

Extend src/index.ts to implement the full algorithm (intent, movement, passes, contests, stamina, referee, etc.).

