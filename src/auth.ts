import type { Request, Response, NextFunction } from "express";
import type { PlantDatabase } from "./database";

export interface AuthenticatedRequest extends Request {
	userId?: string;
	userEmail?: string;
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
			req.userEmail = user.email;
			next();
		} catch (error) {
			console.error("Authentication error:", error);
			return res.status(500).json({ error: "Internal Server Error" });
		}
	};
}
