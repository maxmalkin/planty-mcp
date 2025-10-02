import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import express, { type Express } from 'express';
import request from 'supertest';
import { createRoutes } from '../routes.js';
import type { PlantDatabase, User } from '../database.js';
import type { AuthenticatedRequest } from '../auth.js';

describe('API Routes', () => {
	let app: Express;
	let mockDb: PlantDatabase;

	beforeEach(() => {
		app = express();
		app.use(express.json());

		mockDb = {
			createUser: jest.fn<any>(),
			createApiKey: jest.fn<any>(),
			addEmailToUser: jest.fn<any>(),
			getUserById: jest.fn<any>(),
			getUserApiKeys: jest.fn<any>(),
		} as unknown as PlantDatabase;

		// Mock auth middleware to inject userId
		app.use((req: AuthenticatedRequest, res, next) => {
			req.userId = 'test-user-id';
			req.userEmail = 'test@example.com';
			next();
		});

		app.use('/api', createRoutes(mockDb));
	});

	describe('POST /api/generate-key', () => {
		it('should generate a new API key', async () => {
			const mockUserId = 'new-user-123';
			const mockApiKey = 'planty_live_abc123def456';

			(mockDb.createUser as jest.Mock<any>).mockResolvedValue(mockUserId);
			(mockDb.createApiKey as jest.Mock<any>).mockResolvedValue(mockApiKey);

			const response = await request(app).post('/api/generate-key').expect(200);

			expect(response.body).toEqual({
				apiKey: mockApiKey,
				userId: mockUserId,
				message: "Save this API key. You won't be able to see it again.",
			});

			expect(mockDb.createUser).toHaveBeenCalled();
			expect(mockDb.createApiKey).toHaveBeenCalledWith(mockUserId);
		});

		it('should handle errors during key generation', async () => {
			(mockDb.createUser as jest.Mock<any>).mockRejectedValue(
				new Error('Database error'),
			);

			const response = await request(app).post('/api/generate-key').expect(500);

			expect(response.body).toEqual({
				error: 'Failed to generate API key',
			});
		});
	});

	describe('POST /api/add-email', () => {
		it('should add email to user account', async () => {
			(mockDb.addEmailToUser as jest.Mock<any>).mockResolvedValue(true);

			const response = await request(app)
				.post('/api/add-email')
				.send({ email: 'newemail@example.com' })
				.expect(200);

			expect(response.body).toEqual({
				message: 'Email added successfully',
			});

			expect(mockDb.addEmailToUser).toHaveBeenCalledWith(
				'test-user-id',
				'newemail@example.com',
			);
		});

		it('should reject invalid email format', async () => {
			const response = await request(app)
				.post('/api/add-email')
				.send({ email: 'invalid-email' })
				.expect(400);

			expect(response.body).toEqual({
				error: 'Valid email required',
			});

			expect(mockDb.addEmailToUser).not.toHaveBeenCalled();
		});

		it('should reject missing email', async () => {
			const response = await request(app)
				.post('/api/add-email')
				.send({})
				.expect(400);

			expect(response.body).toEqual({
				error: 'Valid email required',
			});
		});

		it('should handle duplicate email', async () => {
			(mockDb.addEmailToUser as jest.Mock<any>).mockResolvedValue(false);

			const response = await request(app)
				.post('/api/add-email')
				.send({ email: 'duplicate@example.com' })
				.expect(400);

			expect(response.body).toEqual({
				error: 'Email already in use',
			});
		});

		it('should handle database errors', async () => {
			(mockDb.addEmailToUser as jest.Mock<any>).mockRejectedValue(
				new Error('Database error'),
			);

			const response = await request(app)
				.post('/api/add-email')
				.send({ email: 'test@example.com' })
				.expect(500);

			expect(response.body).toEqual({
				error: 'Failed to add email',
			});
		});
	});

	describe('GET /api/me', () => {
		it('should return user info and API keys', async () => {
			const mockUser: User = {
				id: 'test-user-id',
				email: 'test@example.com',
				createdAt: '2025-01-01T00:00:00.000Z',
			};

			const mockApiKeys = [
				{
					keyPrefix: 'planty_live_abc1',
					createdAt: '2025-01-01T00:00:00.000Z',
					lastUsedAt: '2025-01-15T12:00:00.000Z',
				},
				{
					keyPrefix: 'planty_live_xyz9',
					createdAt: '2025-01-05T00:00:00.000Z',
					lastUsedAt: null,
				},
			];

			(mockDb.getUserById as jest.Mock<any>).mockResolvedValue(mockUser);
			(mockDb.getUserApiKeys as jest.Mock<any>).mockResolvedValue(mockApiKeys);

			const response = await request(app).get('/api/me').expect(200);

			expect(response.body).toEqual({
				user: {
					id: 'test-user-id',
					email: 'test@example.com',
					createdAt: '2025-01-01T00:00:00.000Z',
				},
				apiKeys: mockApiKeys,
			});

			expect(mockDb.getUserById).toHaveBeenCalledWith('test-user-id');
			expect(mockDb.getUserApiKeys).toHaveBeenCalledWith('test-user-id');
		});

		it('should handle missing user', async () => {
			(mockDb.getUserById as jest.Mock<any>).mockResolvedValue(undefined);
			(mockDb.getUserApiKeys as jest.Mock<any>).mockResolvedValue([]);

			const response = await request(app).get('/api/me').expect(200);

			expect(response.body.user.id).toBeUndefined();
		});

		it('should handle database errors', async () => {
			(mockDb.getUserById as jest.Mock<any>).mockRejectedValue(
				new Error('Database error'),
			);

			const response = await request(app).get('/api/me').expect(500);

			expect(response.body).toEqual({
				error: 'Failed to fetch user info',
			});
		});
	});
});
