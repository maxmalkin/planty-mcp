import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import type { Response, NextFunction } from 'express';
import { createAuthMiddleware, type AuthenticatedRequest } from '../auth.js';
import type { PlantDatabase } from '../database.js';

describe('Authentication Middleware', () => {
	let mockDb: PlantDatabase;
	let mockReq: Partial<AuthenticatedRequest>;
	let mockRes: Partial<Response>;
	let mockNext: NextFunction;
	let authMiddleware: ReturnType<typeof createAuthMiddleware>;

	beforeEach(() => {
		mockDb = {
			getUserByApiKey: jest.fn(),
		} as unknown as PlantDatabase;

		mockReq = {} as any;

		mockRes = {
			status: jest.fn().mockReturnThis() as any,
			json: jest.fn().mockReturnThis() as any,
		} as any;

		mockNext = jest.fn();

		authMiddleware = createAuthMiddleware(mockDb);
	});

	describe('Public Routes', () => {
		it('should allow access to /api/generate-key', async () => {
			mockReq = {
				path: '/api/generate-key',
				headers: {},
			} as any;

			await authMiddleware(
				mockReq as AuthenticatedRequest,
				mockRes as Response,
				mockNext,
			);

			expect(mockNext).toHaveBeenCalled();
			expect(mockRes.status).not.toHaveBeenCalled();
		});

		it('should allow access to root path', async () => {
			mockReq = {
				path: '/',
				headers: {},
			} as any;

			await authMiddleware(
				mockReq as AuthenticatedRequest,
				mockRes as Response,
				mockNext,
			);

			expect(mockNext).toHaveBeenCalled();
			expect(mockRes.status).not.toHaveBeenCalled();
		});

		it('should allow access to static files', async () => {
			mockReq = {
				path: '/static/style.css',
				headers: {},
			} as any;

			await authMiddleware(
				mockReq as AuthenticatedRequest,
				mockRes as Response,
				mockNext,
			);

			expect(mockNext).toHaveBeenCalled();
		});

		it('should allow access to HTML files', async () => {
			mockReq = {
				path: '/index.html',
				headers: {},
			} as any;

			await authMiddleware(
				mockReq as AuthenticatedRequest,
				mockRes as Response,
				mockNext,
			);

			expect(mockNext).toHaveBeenCalled();
		});

		it('should allow access to image files', async () => {
			mockReq = {
				path: '/logo.png',
				headers: {},
			} as any;

			await authMiddleware(
				mockReq as AuthenticatedRequest,
				mockRes as Response,
				mockNext,
			);

			expect(mockNext).toHaveBeenCalled();
		});
	});

	describe('Protected Routes', () => {
		it('should reject requests without Authorization header', async () => {
			mockReq = {
				path: '/api/me',
				headers: {},
			} as any;

			await authMiddleware(
				mockReq as AuthenticatedRequest,
				mockRes as Response,
				mockNext,
			);

			expect(mockRes.status).toHaveBeenCalledWith(401);
			expect(mockRes.json).toHaveBeenCalledWith({
				error: 'Unauthorized',
				message: 'API key required',
			});
			expect(mockNext).not.toHaveBeenCalled();
		});

		it('should reject requests with invalid Authorization format', async () => {
			mockReq = {
				path: '/api/me',
				headers: {},
			} as any;
			mockReq.headers = { authorization: 'InvalidFormat' };

			await authMiddleware(
				mockReq as AuthenticatedRequest,
				mockRes as Response,
				mockNext,
			);

			expect(mockRes.status).toHaveBeenCalledWith(401);
			expect(mockRes.json).toHaveBeenCalledWith({
				error: 'Unauthorized',
				message: 'API key required',
			});
		});

		it('should reject requests with invalid API key format', async () => {
			mockReq = {
				path: '/api/me',
				headers: {},
			} as any;
			mockReq.headers = { authorization: 'Bearer invalid_key_format' };

			await authMiddleware(
				mockReq as AuthenticatedRequest,
				mockRes as Response,
				mockNext,
			);

			expect(mockRes.status).toHaveBeenCalledWith(401);
			expect(mockRes.json).toHaveBeenCalledWith({
				error: 'Unauthorized',
				message: 'Invalid API key format',
			});
		});

		it('should reject requests with non-existent API key', async () => {
			mockReq = {
				path: '/api/me',
				headers: {},
			} as any;
			mockReq.headers = { authorization: 'Bearer planty_live_invalid' };
			(mockDb.getUserByApiKey as jest.Mock<any>).mockResolvedValue(undefined);

			await authMiddleware(
				mockReq as AuthenticatedRequest,
				mockRes as Response,
				mockNext,
			);

			expect(mockDb.getUserByApiKey).toHaveBeenCalledWith('planty_live_invalid');
			expect(mockRes.status).toHaveBeenCalledWith(401);
			expect(mockRes.json).toHaveBeenCalledWith({
				error: 'Unauthorized',
				message: 'Invalid API key',
			});
		});

		it('should allow requests with valid API key', async () => {
			mockReq = {
				path: '/api/me',
				headers: {},
			} as any;
			mockReq.headers = { authorization: 'Bearer planty_live_validkey123' };

			const mockUser = {
				id: 'user-123',
				email: 'test@example.com',
				createdAt: '2025-01-01T00:00:00.000Z',
			};

			(mockDb.getUserByApiKey as jest.Mock<any>).mockResolvedValue(mockUser);

			await authMiddleware(
				mockReq as AuthenticatedRequest,
				mockRes as Response,
				mockNext,
			);

			expect(mockDb.getUserByApiKey).toHaveBeenCalledWith(
				'planty_live_validkey123',
			);
			expect(mockReq.userId).toBe('user-123');
			expect(mockReq.userEmail).toBe('test@example.com');
			expect(mockNext).toHaveBeenCalled();
			expect(mockRes.status).not.toHaveBeenCalled();
		});

		it('should handle database errors gracefully', async () => {
			mockReq = {
				path: '/api/me',
				headers: {},
			} as any;
			mockReq.headers = { authorization: 'Bearer planty_live_validkey123' };

			(mockDb.getUserByApiKey as jest.Mock<any>).mockRejectedValue(
				new Error('Database error'),
			);

			await authMiddleware(
				mockReq as AuthenticatedRequest,
				mockRes as Response,
				mockNext,
			);

			expect(mockRes.status).toHaveBeenCalledWith(500);
			expect(mockRes.json).toHaveBeenCalledWith({
				error: 'Internal server error',
				message: 'Authentication failed',
			});
			expect(mockNext).not.toHaveBeenCalled();
		});
	});
});
