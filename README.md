# ⚽ Football Fantasy Manager

A full-stack real-time football fantasy management application with AI-powered match simulation.

## 🚀 Quick Start

### Option 1: Automatic Setup (Recommended)
```bash
# First time setup
./setup.sh

# Start the application
./start.sh
```

### Option 2: Development Mode
```bash
# Setup (if not done already)
./setup.sh

# Start in development mode (opens multiple terminals)
./dev.sh
```

### Option 3: Docker
```bash
npm run docker:up
```

## 📋 Available Commands

| Command | Description |
|---------|-------------|
| `./setup.sh` | Initial setup (run once) |
| `./start.sh` | Start all services |
| `./stop.sh` | Stop all services |
| `./restart.sh` | Restart all services |
| `./dev.sh` | Development mode with live reload |
| `./status.sh` | Check service status |

### NPM Scripts
```bash
npm run start        # Same as ./start.sh
npm run stop         # Same as ./stop.sh
npm run dev          # Same as ./dev.sh
npm run status       # Same as ./status.sh
npm run docker:up    # Start with Docker
npm run docker:down  # Stop Docker containers
```

## 🌐 Service URLs

Once running, access the application at:

- **Frontend**: http://localhost:3000
- **Laravel API**: http://localhost:8000
- **Microservice**: http://localhost:8001

## 🏗️ Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│  React Frontend │───▶│   Laravel API   │───▶│ Match Simulator │
│    (Port 3000)  │    │   (Port 8000)   │    │   (Port 8001)   │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

### Components

1. **React Frontend** - User interface with real-time match streaming
2. **Laravel API** - Backend API with team/player management
3. **Match Simulator** - Node.js microservice for real-time match simulation

## 🔧 Development

### Prerequisites
- PHP 8.1+
- Node.js 16+
- Composer
- npm

### First Time Setup
```bash
# Automatic setup
./setup.sh

# Manual setup
cd api && composer install && php artisan migrate --seed
cd ../match-simulator && npm install && npm run build
cd ../frontend && npm install
```

### Development Workflow
```bash
# Start development servers
./dev.sh

# Check status
./status.sh

# View logs
tail -f logs/*.log

# Stop everything
./stop.sh
```

## 🚀 Production Deployment

### Docker (Recommended)
```bash
docker-compose up -d
```

### Manual Deployment
```bash
# Production build
cd frontend && npm run build
cd ../match-simulator && npm run build

# Start production servers
./start.sh
```

## 📊 Performance & Scaling

The application supports multiple concurrent users with:

- **Load balancing** across multiple microservice instances
- **Queue management** for high-load scenarios
- **Health checks** and automatic failover
- **Real-time streaming** with Server-Sent Events

Configure scaling in `config/services.php`:
```php
'match_simulator' => [
    'urls' => ['http://localhost:8001', 'http://localhost:8002', 'http://localhost:8003'],
    'max_concurrent' => 9,
    'load_balancer' => 'round_robin'
]
```

## 🐛 Troubleshooting

### Services won't start
```bash
# Check what's using the ports
./status.sh

# Kill any conflicting processes
./stop.sh

# Restart
./start.sh
```

### Database issues
```bash
cd api
php artisan migrate:fresh --seed
```

### Node.js issues
```bash
cd match-simulator && rm -rf node_modules && npm install
cd ../frontend && rm -rf node_modules && npm install
```

### View detailed logs
```bash
# Real-time logs
tail -f logs/api.log
tail -f logs/microservice.log
tail -f logs/frontend.log

# Or use Docker logs
npm run docker:logs
```

## 🎮 Features

- ⚽ **Real-time Match Simulation** - Stream live matches with ball physics
- 📊 **Live Statistics** - Possession, shots, tackles update in real-time
- 🎯 **Tactical Management** - Change formations and tactics during matches
- 👥 **Player Management** - Detailed player attributes and positioning
- 🏆 **League System** - Portuguese league teams and realistic data
- 🔄 **Auto-scaling** - Handles multiple concurrent users

## 📝 License

MIT License - see LICENSE file for details.
