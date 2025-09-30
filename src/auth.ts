import type { PlantDatabase } from './database.js';
import type { Request, Response, NextFunction } from 'express';

export interface AuthenticatedRequest extends Request {
	userId?: string;
	userEmail?: string | null;
}

export function createAuthMiddleware(db: PlantDatabase) {
	return async (
		req: AuthenticatedRequest,
		res: Response,
		next: NextFunction,
	) => {
		if (req.path === '/api/generate-key') {
			return next();
		}

		const authHeader = req.headers.authorization;

		if (!authHeader || !authHeader.startsWith('Bearer ')) {
			return res.status(401).json({
				error: 'Unauthorized',
				message: 'API key required',
			});
		}

		const apiKey = authHeader.substring(7);

		if (!apiKey.startsWith('planty_live_')) {
			return res.status(401).json({
				error: 'Unauthorized',
				message: 'Invalid API key format',
			});
		}

		try {
			const user = await db.getUserByApiKey(apiKey);

			if (!user) {
				return res.status(401).json({
					error: 'Unauthorized',
					message: 'Invalid API key',
				});
			}

			req.userId = user.id;
			req.userEmail = user.email;
			next();
		} catch (error) {
			console.error('Authentication error:', error);
			return res.status(500).json({
				error: 'Internal server error',
				message: 'Authentication failed',
			});
		}
	};
}
