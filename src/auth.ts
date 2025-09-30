import { PlantDatabase } from "./database";
import type { Request, Response, NextFunction } from "express";
import { OAuth2Client } from "google-auth-library";

export interface AuthenticatedRequest extends Request {
	userId?: string;
	userEmail?: string;
}

const GOOGLE = process.env.GOOGLE;

if (!GOOGLE) {
	console.warn("GOOGLE env variable is missing.");
}

const client = new OAuth2Client(GOOGLE);

export function createMiddleware(db: PlantDatabase) {
	return async (
		req: AuthenticatedRequest,
		res: Response,
		next: NextFunction
	) => {
		if (req.path === "/health") {
			return next();
		}

		const authHeader = req.headers.authorization;

		if (!authHeader || !authHeader.startsWith("Bearer ")) {
			return res.status(401).json({ error: "Unauthorized" });
		}

		const token = authHeader.substring(7);
	};
}
