import { Request, Response, NextFunction } from "express";
import { PlantDatabase } from "./database";

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
	};
}
