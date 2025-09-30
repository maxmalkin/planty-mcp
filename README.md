# planty-mcp

An MCP server for plant care management. This is a personal project providing tools to track plants, watering schedules, growth measurements, and images.

## Prod

Production: https://planty-mcp.onrender.com

## Architecture

```
┌─────────────────┐         ┌─────────────────┐
│   MCP Client    │         │   Web Client    │
│ (Claude Desktop)│         │   (Browser)     │
└────────┬────────┘         └────────┬────────┘
         │                           │
         │ STDIO                     │ HTTPS
         │                           │
         v                           v
┌────────────────────────────────────────────┐
│            Planty MCP Server               │
│  ┌──────────────┐      ┌─────────────────┐ │
│  │ STDIO Server │      │ HTTP/SSE Server │ │
│  │ (server.ts)  │      │   (http.ts)     │ │
│  └──────┬───────┘      └────────┬────────┘ │
│         │                       │          │
│         │    ┌──────────────────┘          │
│         │    │                             │
│         v    v                             │
│  ┌─────────────────┐   ┌────────────────┐  │
│  │  PlantDatabase  │   │  Auth/Routes   │  │
│  │  (database.ts)  │   │  API Keys      │  │
│  └────────┬────────┘   └────────────────┘  │
└───────────┼──────────────────────────────-─┘
            │
            v
   ┌────────────────┐
   │   PostgreSQL   │
   │    Database    │
   └────────────────┘
```

## Features

- Plant collection management
- Watering tracking and scheduling
- Growth measurement logging
- Plant image references
- Multi-user support with API key authentication
- STDIO for MCP clients, HTTP/SSE for web clients

## Stack

- TypeScript
- Node.js 18+
- PostgreSQL 15
- Express
- MCP SDK
- Biome

## Get Started

### Local

```bash
pnpm install

# Create .env file based on .env.example

pnpm dev:http

pnpm dev
```

### Docker

```bash
# Start with Postgres
docker-compose up -d
```

## API

### HTTP

- `GET /` - Landing
- `POST /api/generate-key` - Generate API key
- `GET /api/me` - Get user info
- `POST /api/add-email` - Add email to account
- `GET /sse` - MCP connection through SSE

### Tools

All tools need user authentication

- `add_plant` - Add new plant
- `list_plants` - List all plants
- `get_plant` - Get plant details
- `update_plant` - Update plant info
- `delete_plant` - Remove plant
- `water_plant` - Record watering event
- `get_watering_history` - View watering logs
- `get_watering_schedule` - Get plants needing water
- `add_growth_log` - Log growth measurements
- `get_growth_logs` - View growth history
- `add_plant_image` - Add image reference
- `get_plant_images` - Get plant images

## Environment

```bash
DB_HOST=127.0.0.1
DB_PORT=5432
DB_USER=username
DB_PASSWORD=password
DB_NAME=planty
MCP_USER_ID=         # STDIO
PORT=3000            # HTTP
```

## Build

```bash
pnpm build

node build/server.js    # STDIO
node build/http.js      # HTTP
```
