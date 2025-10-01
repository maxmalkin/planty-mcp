import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import express from 'express';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import cors from 'cors';
import { PlantDatabase } from './database.js';
import { createAuthMiddleware, type AuthenticatedRequest } from './auth.js';
import { createRoutes } from './routes.js';
import { setupToolHandlers } from './handlers.js';
import path from 'path';
import { fileURLToPath } from 'url';
import { existsSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

const publicPathInBuild = path.join(__dirname, 'public');
const publicPathRoot = path.join(__dirname, '../public');

const publicPath = existsSync(publicPathInBuild)
	? publicPathInBuild
	: publicPathRoot;
console.log(`Serving static files from: ${publicPath}`);
app.use(express.static(publicPath));

const db = new PlantDatabase();

app.use(createAuthMiddleware(db));
app.use('/api', createRoutes(db));

const userTransports = new Map<string, SSEServerTransport>();

app.get('/sse', async (req: AuthenticatedRequest, res) => {
	if (!req.userId) {
		return res.status(401).send('Unauthorized');
	}
	const userId = req.userId;
	console.info(`SSE client connected: ${userId}`);

	try {
		const existingTransport = userTransports.get(userId);
		if (existingTransport) {
			console.info(`Closing existing SSE session for user ${userId}`);
			await existingTransport.close();
			userTransports.delete(userId);
		}

		const transport = new SSEServerTransport('/message', res);
		const sessionId = transport.sessionId;

		userTransports.set(userId, transport);

		const server = new Server(
			{
				name: 'planty-mcp',
				version: '1.0.0',
			},
			{
				capabilities: {
					tools: {},
				},
			},
		);

		setupToolHandlers(server, db, userId);

		transport.onclose = () => {
			console.info(`SSE transport closed for user ${userId}`);
			userTransports.delete(userId);
		};

		await server.connect(transport);

		console.info(
			`SSE session established for user ${userId} (session: ${sessionId})`,
		);
	} catch (error) {
		console.error('Error establishing SSE stream:', error);
		if (!res.headersSent) {
			res.status(500).send('Error establishing SSE stream');
		}
	}
});

app.post('/message', async (req: AuthenticatedRequest, res) => {
	if (!req.userId) {
		return res.status(401).send('Unauthorized');
	}

	const userId = req.userId;

	const transport = userTransports.get(userId);

	if (!transport) {
		console.error(`POST /message: No active SSE session for user ${userId}`);
		return res.status(400).json({
			error: 'No active SSE connection',
			message:
				'Please establish an SSE connection to /sse before sending messages.',
			hint: `Connect to GET /sse with your API key, then POST to /message`,
		});
	}

	try {
		await transport.handlePostMessage(req, res, req.body);
	} catch (error) {
		console.error('Error handling POST message:', error);
		if (!res.headersSent) {
			res.status(500).json({ error: 'Error handling request' });
		}
	}
});

async function main() {
	await db.initialize();

	app.listen(PORT, () => {
		console.log(`Server running on http://localhost:${PORT}`);
		console.log(`Landing page: http://localhost:${PORT}`);
		console.log(`SSE endpoint: http://localhost:${PORT}/sse`);
	});
}

main().catch((error) => {
	console.error('Failed to start server:', error);
	process.exit(1);
});
