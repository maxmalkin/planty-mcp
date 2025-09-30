import { Request, Response, NextFunction } from "express";
import { PlantDatabase } from "./database";

export interface AuthenticatedRequest extends Request {
	userId?: string;
}
