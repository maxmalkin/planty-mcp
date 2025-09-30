import Database from 'better-sqlite3';
import { v4 as uuidv4 } from 'uuid';
import type { Plant, WateringHistory, GrowthLog, PlantImage } from './types';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class PlantDatabase {
	private db: Database.Database;

	constructor(dbPath: string = path.join(__dirname, '../database/plants.db')) {
		this.db = new Database(dbPath);
		this.db.pragma('foreign_keys = ON');
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

		const createWateringHistoryTable = `
			CREATE TABLE IF NOT EXISTS watering_history (
			id TEXT PRIMARY KEY,
			plantId TEXT NOT NULL,
			wateredDate TEXT NOT NULL,
			notes TEXT,
			createdAt TEXT NOT NULL,
			FOREIGN KEY (plantId) REFERENCES plants(id) ON DELETE CASCADE
		)`;

		const createGrowthLogsTable = `
			CREATE TABLE IF NOT EXISTS growth_logs (
			id TEXT PRIMARY KEY,
			plantId TEXT NOT NULL,
			logDate TEXT NOT NULL,
			measureType TEXT NOT NULL,
			measureUnit TEXT NOT NULL,
			value REAL NOT NULL,
			notes TEXT,
			createdAt TEXT NOT NULL,
			FOREIGN KEY (plantId) REFERENCES plants(id) ON DELETE CASCADE
		)`;

		const createPlantImagesTable = `
			CREATE TABLE IF NOT EXISTS plant_images (
			id TEXT PRIMARY KEY,
			plantId TEXT NOT NULL,
			filename TEXT NOT NULL,
			caption TEXT,
			takenAt TEXT NOT NULL,
			createdAt TEXT NOT NULL,
			FOREIGN KEY (plantId) REFERENCES plants(id) ON DELETE CASCADE
		)`;
	}
}
