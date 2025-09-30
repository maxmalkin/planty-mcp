import express from 'express';
import type { PlantDatabase } from './database.js';
import type { AuthenticatedRequest } from './auth.js';

export function createRoutes(db: PlantDatabase) {
	const router = express.Router();

	router.post('/generate-key', async (req, res) => {
		try {
			const userId = await db.createUser();
			const apiKey = await db.createApiKey(userId);

			res.json({
				apiKey,
				userId,
				message: "Save this API key. You won't be able to see it again.",
			});
		} catch (error) {
			console.error('Error generating key:', error);
			res.status(500).json({ error: 'Failed to generate API key' });
		}
	});

	router.post('/add-email', async (req: AuthenticatedRequest, res) => {
		const { email } = req.body;

		if (!req.userId) {
			return res.status(400).json({ error: 'User ID is required' });
		}
		const userId = req.userId;

		if (!email || !email.includes('@')) {
			return res.status(400).json({ error: 'Valid email required' });
		}

		try {
			const success = await db.addEmailToUser(userId, email);

			if (!success) {
				return res.status(400).json({ error: 'Email already in use' });
			}

			res.json({ message: 'Email added successfully' });
		} catch (error) {
			console.error('Error adding email:', error);
			res.status(500).json({ error: 'Failed to add email' });
		}
	});

	router.get('/me', async (req: AuthenticatedRequest, res) => {
		try {
			if (!req.userId) {
				return res.status(400).json({ error: 'User ID is required' });
			}

			const user = await db.getUserById(req.userId);
			const apiKeys = await db.getUserApiKeys(req.userId);

			res.json({
				user: {
					id: user?.id,
					email: user?.email,
					createdAt: user?.createdAt,
				},
				apiKeys: apiKeys.map((key) => ({
					keyPrefix: key.keyPrefix,
					createdAt: key.createdAt,
					lastUsedAt: key.lastUsedAt,
				})),
			});
		} catch (error) {
			console.error('Error fetching user info:', error);
			res.status(500).json({ error: 'Failed to fetch user info' });
		}
	});

	return router;
}
