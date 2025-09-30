import express from "express";
import { PlantDatabase } from "./database";
import { AuthenticatedRequest } from "./auth";

export function createRoutes(db: PlantDatabase) {
	const router = express.Router();
	router.post("/generate-key", async (req, res) => {
		try {
			const userId = db.createUser();
			const key = db.generateApiKey(userId);

			res.json({
				apiKey: key,
				userId,
				message:
					"Please store this API key securely. You will not be able to see it again.",
			});
		} catch (error) {
			console.error("Error generating API key:", error);
			res.status(500).json({ error: "Internal Server Error" });
		}
	});

	router.get("/me", async (req: AuthenticatedRequest, res) => {
		try {
			if (!req.userId) {
				return res.status(400).json({ error: "User ID is required" });
			}
			const user = await db.getUserById(req.userId);
			const keys = await db.getUserApiKeys(req.userId);

			res.json({
				user: {
					id: user?.id,
					email: user?.email,
					createdAt: user?.createdAt,
				},
				keys: keys.map((key) => ({
					id: key.id,
					createdAt: key.createdAt,
					lastUsedAt: key.lastUsedAt,
				})),
			});
		} catch (error) {
			console.error("Error fetching user info:", error);
			res.status(500).json({ error: "Internal Server Error" });
		}
	});

	return router;
}
