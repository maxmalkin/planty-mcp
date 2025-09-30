import express from 'express';
import { PlantDatabase } from './database';
import { AuthenticatedRequest } from './auth';

export function createRoutes(db: PlantDatabase) {
	const router = express.Router();
	router.post('/generate-key', async (req, res) => {
		try {
			const userId = db.createUser(null as any);
			const key = db.generateApiKey(userId);

			res.json({
				apiKey: key,
				userId,
				message:
					'Please store this API key securely. You will not be able to see it again.',
			});
		} catch (error) {
			console.error('Error generating API key:', error);
			res.status(500).json({ error: 'Internal Server Error' });
		}
	});
}
