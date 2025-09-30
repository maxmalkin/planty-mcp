import Database from "better-sqlite3";
import { v4 as uuidv4 } from "uuid";
import { Plant, WateringHistory, GrowthLog, PlantImage } from "./types";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class PlantDatabase {
	private db: Database.Database;

	constructor(dbPath: string = path.join(__dirname, "../database/plants.db")) {
		this.db = new Database(dbPath);
		this.db.pragma("foreign_keys = ON");
		this.initializeDatabase();
	}

	private initializeDatabase(): void {
		const createPlantsTable = `
		CREATE TABLE IF NOT EXISTS plants (
			id TEXT PRIMARY KEY,
			name TEXT NOT NULL,
			species TEXT NOT NULL,
			location TEXT NOT NULL,
			acquiredDate TEXT NOT NULL,
			wateringFrequency INTEGER NOT NULL,
			lastWatered TEXT,
			notes TEXT,
			createdAt TEXT NOT NULL,
			updatedAt TEXT NOT NULL
		)`;
	}
}
