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

const sseTransports = new Map<string, SSEServerTransport>();

app.get('/sse', async (req: AuthenticatedRequest, res) => {
	if (!req.userId) {
		return res.status(401).send('Unauthorized');
	}
	const userId = req.userId;
	console.info(`SSE client connected: ${userId}`);

	try {
		const transport = new SSEServerTransport('/message', res);
		const sessionId = transport.sessionId;

		sseTransports.set(sessionId, transport);

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
			console.info(`SSE transport closed for ${sessionId}, user ${userId}`);
			sseTransports.delete(sessionId);
		};

		await server.connect(transport);

		console.info(`SSE session: ${sessionId} for user ${userId}`);
	} catch (error) {
		console.error('Error establishing SSE stream:', error);
		if (!res.headersSent) {
			res.status(500).send('Error establishing SSE stream');
		}
	}
});

app.post('/message', async (req: AuthenticatedRequest, res) => {
	const sessionId = req.query.sessionId as string;

	if (!sessionId) {
		console.error('POST /message: Missing sessionId query parameter');
		return res.status(400).json({
			error: 'Missing sessionId parameter',
			message: 'sessionId parameter is required.',
		});
	}

	const transport = sseTransports.get(sessionId);

	if (!transport) {
		console.error(`POST /message: No session ${sessionId}`);
		return res.status(404).json({
			error: 'Session not found',
			message: `No session found with ID: ${sessionId}`,
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
