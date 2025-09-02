# ⚽ Match Simulator Microservice

A **high-performance, real-time football match simulation microservice** built with **Node.js + TypeScript** for ultra-fast processing and second-by-second match simulation.

## 🚀 Features

- **⚡ High Performance**: Optimized for speed with 60Hz+ simulation rate
- **🔄 Real-Time Simulation**: Second-by-second match updates
- **🎯 Realistic Physics**: Ball physics, player movement, fatigue system
- **📊 Live Statistics**: Real-time match statistics and analytics
- **🎮 Tactical Depth**: Advanced tactical analysis and formation detection
- **📝 Live Commentary**: AI-generated match commentary
- **🛡️ API Protection**: Rate limiting and validation
- **📈 Performance Monitoring**: Built-in performance metrics

## 🏗️ Architecture

```
match-simulator/
├── src/
│   ├── controllers/          # HTTP request handlers
│   ├── services/             # Core simulation logic
│   │   └── engines/          # Specialized simulation engines
│   ├── middleware/           # Express middleware
│   ├── utils/                # Utility functions
│   └── types/                # TypeScript type definitions
├── dist/                     # Compiled JavaScript
└── package.json
```

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ 
- npm or yarn

### Installation

```bash
# Clone and install dependencies
cd match-simulator
npm install

# Copy environment file
cp env.example .env

# Start development server
npm run dev
```

### Production Build

```bash
# Build TypeScript
npm run build

# Start production server
npm start
```

## 📡 API Endpoints

### POST /simulate
Simulate a complete match with second-by-second data.

**Request Body:**
```json
{
  "home_team": {
    "id": 1,
    "name": "Leicester City",
    "players": [...]
  },
  "away_team": {
    "id": 2,
    "name": "Arsenal", 
    "players": [...]
  },
  "home_tactic": {...},
  "away_tactic": {...},
  "weather": "normal",
  "stadium": "King Power Stadium",
  "options": {
    "tickRate": 60,
    "enableCommentary": true,
    "enableStatistics": true,
    "enableFatigue": true,
    "enableMomentum": true
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "updates": [...],           // 5400 second-by-second updates
    "finalScore": {"home": 2, "away": 1},
    "matchStatistics": {...},
    "events": [...],            // All match events
    "totalSeconds": 5400,
    "duration": 1250.5,
    "performance": {
      "simulationTime": 1200.3,
      "updatesPerSecond": 4320,
      "memoryUsage": 52428800
    }
  },
  "performance": {
    "simulationTime": 1200.3,
    "memoryUsage": 52428800,
    "cpuUsage": 1250.5
  }
}
```

### POST /simulate-realtime
Same as `/simulate` but with real-time options enabled by default.

### GET /health
Health check endpoint.

## ⚙️ Configuration

Environment variables in `.env`:

```env
# Server Configuration
PORT=8001
NODE_ENV=development

# Performance Settings
SIMULATION_TICK_RATE=60
MAX_CONCURRENT_SIMULATIONS=10
ENABLE_REAL_TIME_MODE=true

# Logging
LOG_LEVEL=info
ENABLE_DEBUG_LOGGING=true

# API Protection
CORS_ORIGIN=http://localhost:3000
RATE_LIMIT_WINDOW=60000
RATE_LIMIT_MAX_REQUESTS=100
```

## 🔧 Integration with Main API

To integrate with your Laravel API, make HTTP requests to this microservice:

```php
// In your Laravel API
$response = Http::post('http://localhost:8001/simulate', [
    'home_team' => $homeTeam->toArray(),
    'away_team' => $awayTeam->toArray(),
    'home_tactic' => $homeTactic->toArray(),
    'away_tactic' => $awayTactic->toArray(),
    'options' => [
        'tickRate' => 60,
        'enableCommentary' => true,
        'enableStatistics' => true
    ]
]);

$simulationData = $response->json()['data'];
```

## 🎯 Performance Features

### High-Speed Simulation
- **60Hz+ tick rate** for smooth real-time simulation
- **Optimized algorithms** for ball physics and player movement
- **Memory-efficient** data structures
- **Async processing** with non-blocking I/O

### Real-Time Capabilities
- **Second-by-second updates** for every match moment
- **Live event detection** (goals, cards, fouls, etc.)
- **Dynamic fatigue system** affecting player performance
- **Momentum tracking** for realistic match flow

### Advanced Physics
- **Ball physics** with friction, gravity, and player influence
- **Player movement** based on tactical positions and fatigue
- **Possession mechanics** with realistic ball control
- **Collision detection** for tackles and challenges

## 🏆 Why Node.js + TypeScript?

### Performance Benefits
- **V8 Engine**: Extremely fast JavaScript execution
- **Event-driven**: Perfect for real-time simulations
- **Non-blocking I/O**: Handles multiple simulations concurrently
- **Memory efficient**: Lower memory footprint than PHP

### Development Benefits
- **TypeScript**: Type safety and better IDE support
- **Rich ecosystem**: Excellent libraries for math and physics
- **Easy deployment**: Simple containerization and scaling
- **Real-time ready**: Built for WebSocket and streaming

## 📊 Performance Benchmarks

| Metric | Value |
|--------|-------|
| Simulation Speed | 60Hz+ |
| Memory Usage | ~50MB per simulation |
| Response Time | <2s for full match |
| Concurrent Simulations | 10+ |
| CPU Usage | <30% |

## 🔮 Future Enhancements

- **WebSocket support** for live streaming
- **Machine learning** for more realistic AI behavior
- **3D visualization** support
- **Multi-language commentary**
- **Advanced weather effects**
- **Player personality system**

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## 📄 License

MIT License - see LICENSE file for details.

---

**Built with ❤️ for the beautiful game** ⚽ 