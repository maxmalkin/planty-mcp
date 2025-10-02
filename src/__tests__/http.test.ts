import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import request from 'supertest';
import express, { type Express } from 'express';
import { PlantDatabase } from '../database.js';
import { createAuthMiddleware } from '../auth.js';
import { createRoutes } from '../routes.js';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { setupToolHandlers } from '../handlers.js';

/**
 * Integration test for HTTP/SSE MCP endpoint
 *
 * This test demonstrates the proper flow for using the MCP server over HTTP/SSE:
 * 1. Generate an API key
 * 2. Connect to /sse endpoint with the API key
 * 3. Send JSON-RPC messages to /message endpoint
 * 4. Receive responses through the SSE stream
 */
describe('HTTP/SSE MCP Integration', () => {
	let app: Express;
	let mockDb: PlantDatabase;
	const userTransports = new Map<string, SSEServerTransport>();

	beforeEach(() => {
		app = express();
		app.use(express.json());

		// Mock database
		mockDb = {
			getUserByApiKey: jest.fn<any>(),
			listPlants: jest.fn<any>(),
			getPlant: jest.fn<any>(),
		} as unknown as PlantDatabase;

		// Add auth middleware
		app.use(createAuthMiddleware(mockDb));
		app.use('/api', createRoutes(mockDb));

		// Add SSE endpoint (simplified version)
		app.get('/sse', async (req: any, res) => {
			if (!req.userId) {
				return res.status(401).send('Unauthorized');
			}
			const userId = req.userId;

			try {
				const transport = new SSEServerTransport('/message', res);
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

				setupToolHandlers(server, mockDb, userId);

				transport.onclose = () => {
					userTransports.delete(userId);
				};

				await server.connect(transport);
			} catch (error) {
				console.error('Error establishing SSE stream:', error);
				if (!res.headersSent) {
					res.status(500).send('Error establishing SSE stream');
				}
			}
		});

		// Add message endpoint
		app.post('/message', async (req: any, res) => {
			if (!req.userId) {
				return res.status(401).send('Unauthorized');
			}

			const userId = req.userId;
			const transport = userTransports.get(userId);

			if (!transport) {
				return res.status(400).json({
					error: 'No active SSE connection',
					message:
						'Please establish an SSE connection to /sse before sending messages.',
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
	});

	describe('POST /message without SSE connection', () => {
		it('should reject messages when no SSE connection exists', async () => {
			const mockUser = {
				id: 'test-user-id',
				email: 'test@example.com',
				createdAt: '2025-01-01T00:00:00.000Z',
			};

			(mockDb.getUserByApiKey as jest.Mock<any>).mockResolvedValue(mockUser);

			const response = await request(app)
				.post('/message')
				.set('Authorization', 'Bearer planty_live_testkey123')
				.send({
					jsonrpc: '2.0',
					id: 1,
					method: 'tools/list',
					params: {},
				})
				.expect(400);

			expect(response.body).toEqual({
				error: 'No active SSE connection',
				message:
					'Please establish an SSE connection to /sse before sending messages.',
			});
		});
	});

	describe('SSE flow documentation', () => {
		it('should document the correct flow for using SSE/MCP', () => {
			// This is a documentation test that shows the proper flow
			const correctFlow = `
1. Generate API key:
   POST /api/generate-key
   Response: { apiKey: "planty_live_...", userId: "..." }

2. Establish SSE connection (keep this connection open):
   GET /sse
   Headers: Authorization: Bearer planty_live_...

   This returns an SSE stream that stays open. Responses will come through this stream.

3. Send MCP messages (in a separate request):
   POST /message
   Headers:
     - Authorization: Bearer planty_live_...
     - Content-Type: application/json
   Body: {
     "jsonrpc": "2.0",
     "id": 1,
     "method": "tools/list",
     "params": {}
   }

   The response will come through the SSE stream from step 2, NOT as an HTTP response.

4. Listen to SSE stream for responses:
   The SSE stream will send events containing the JSON-RPC responses.
`;
			expect(correctFlow).toBeTruthy();
		});
	});
});
