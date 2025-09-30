import type { PlantDatabase } from "./database";
import type { Request, Response, NextFunction } from "express";

export interface AuthenticatedRequest extends Request {
	userId?: string;
}

export function createMiddleware(db: PlantDatabase) {
	return async (
		req: AuthenticatedRequest,
		res: Response,
		next: NextFunction
	) => {
		if (req.path === "api/generate-key") {
			return next();
		}

		const authHeader = req.headers.authorization;

		if (!authHeader || !authHeader.startsWith("Bearer ")) {
			return res.status(401).json({ error: "Unauthorized" });
		}

		const key = authHeader.substring(7);

		if (!key.startsWith("planty")) {
			return res.status(401).json({ error: "Unauthorized" });
		}

		try {
			const user = await db.getUserByApiKey(key);
			if (!user) {
				return res.status(401).json({ error: "Unauthorized" });
			}

			req.userId = user.id;
			next();
		} catch (error) {
			console.error("Authentication error:", error);
			return res.status(500).json({ error: "Internal Server Error" });
		}
	};
}
