import { PlantDatabase } from "./database";
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
		if (req.path === "/health") {
			return next();
		}
	};
}
