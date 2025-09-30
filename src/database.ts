import Database from "better-sqlite3";
import { v4 as uuidv4 } from "uuid";
import type { Plant, WateringHistory, GrowthLog, PlantImage } from "./types";
import path from "path";
import { fileURLToPath } from "url";
import _ from "lodash";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class PlantDatabase {
	private db: Database.Database;

	constructor(dbPath: string = path.join(__dirname, "../database/plants.db")) {
		this.db = new Database(dbPath);
		this.db.pragma("foreign_keys = ON");

		if (!this.initializeDatabase()) {
			throw new Error("Failed to initialize database.");
		} else {
			console.log("Database initialized successfully.");
		}
	}

	private initializeDatabase(): boolean {
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

		const createIndexes = `
			CREATE INDEX IF NOT EXISTS idx_watering_history_plantId ON watering_history(plantId);
			CREATE INDEX IF NOT EXISTS idx_growth_logs_plantId ON growth_logs(plantId);
			CREATE INDEX IF NOT EXISTS idx_plant_images_plantId ON plant_images(plantId);
		`;

		try {
			this.db.exec(createPlantsTable);
			this.db.exec(createWateringHistoryTable);
			this.db.exec(createGrowthLogsTable);
			this.db.exec(createPlantImagesTable);
			this.db.exec(createIndexes);

			return true;
		} catch (error) {
			return false;
		}
	}

	// DB operations

	addPlant(plant: Omit<Plant, "id" | "createdAt" | "updatedAt">): Plant {
		const id = uuidv4();
		const now = new Date().toISOString();
		const stmt = this.db.prepare(`
			INSERT INTO plants (
				id, name, species, location, acquiredDate, wateringFrequency, lastWatered, notes, createdAt, updatedAt
			) 
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
		`);

		stmt.run(
			id,
			plant.name,
			plant.species,
			plant.location,
			plant.acquiredDate,
			plant.wateringFrequency,
			plant.lastWatered,
			plant.notes,
			now,
			now
		);

		return { id, ...plant, createdAt: now, updatedAt: now };
	}

	getPlant(id: string): Plant | undefined {
		const stmt = this.db.prepare(`SELECT * FROM plants WHERE id = ?`);
		const row = stmt.get(id);

		return stmt.get(id) as Plant | undefined;
	}

	listPlants(filters?: { location?: string; species?: string }): Plant[] {
		let query = "SELECT * FROM plants";
		const params: string[] = [];

		// build filtered query
		if (filters) {
			const conditions: string[] = [];
			if (filters.location) {
				conditions.push("location = ?");
				params.push(filters.location);
			}

			if (filters.species) {
				conditions.push("species = ?");
				params.push(filters.species);
			}

			if (conditions.length > 0) {
				query += " WHERE " + conditions.join(" AND ");
			}
		}

		query += " ORDER BY name";

		const stmt = this.db.prepare(query);
		const rows = stmt.all(...params);

		return rows as Plant[];
	}

	updatePlant(
		id: string,
		updates: Partial<Omit<Plant, "id" | "createdAt" | "updatedAt">>
	): Plant | undefined {
		const exists = this.getPlant(id);
		if (!exists) return undefined;

		const fields = _.keys(updates);
		if (fields.length === 0) return exists;

		const set = fields.map((field) => `${field} = ?`).join(", ");
		const values = fields.map(
			(field) => updates[field as keyof typeof updates]
		);

		const now = new Date().toISOString();

		const stmt = this.db.prepare(`
			UPDATE plants 
			SET ${set}, 
			updatedAt = ? 
			WHERE id = ?
		`);

		stmt.run(...values, now, id);

		return this.getPlant(id);
	}

	deletePlant(id: string): boolean {
		const stmt = this.db.prepare("DELETE FROM plants WHERE id = ?");
		const r = stmt.run(id);

		// 0 if no row deleted, 1 if row deleted
		return r.changes > 0;
	}

	waterPlant(
		plantId: string,
		wateredDate: string,
		notes?: string
	): WateringHistory {
		const id = uuidv4();
		const now = new Date().toISOString();

		const insert = this.db.prepare(`
			INSERT INTO watering_history (
				id, plantId, wateredDate, notes, createdAt
			) 
			VALUES (?, ?, ?, ?, ?)
		`);

		insert.run(id, plantId, wateredDate, notes || null, now);

		//update plant table lastWatered
		const update = this.db.prepare(`
			UPDATE plants 
			SET lastWatered = ?,
			updatedAt = ? 
			WHERE id = ?
		`);

		update.run(wateredDate, now, plantId);

		return {
			id,
			plantId: plantId,
			wateredDate: wateredDate,
			notes: notes || null,
			createdAt: now,
		};
	}

	getWateringHistory(plantId: string): WateringHistory[] {
		const stmt = this.db.prepare(`
			SELECT * FROM watering_history
			WHERE plantId = ?
			ORDER BY wateredDate DESC
		`);

		const rows = stmt.all(plantId);
		return rows as WateringHistory[];
	}

	addGrowthLog(log: Omit<GrowthLog, "id" | "createdAt">): GrowthLog {
		const id = uuidv4();
		const now = new Date().toISOString();

		const stmt = this.db.prepare(`
			INSERT INTO growth_logs (
				id, plantId, logDate, measureType, measureUnit, value, notes, createdAt
			)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?)
		`);

		stmt.run(
			id,
			log.plantId,
			log.logDate,
			log.measureType,
			log.measureUnit,
			log.value,
			log.notes || null,
			now
		);

		return { id, ...log, notes: log.notes || null, createdAt: now };
	}

	getGrowthLogs(plantId: string): GrowthLog[] {
		const stmt = this.db.prepare(`
			SELECT * FROM growth_logs
			WHERE plantId = ?
			ORDER BY logDate DESC
		`);

		const rows = stmt.all(plantId);
		return rows as GrowthLog[];
	}

	addPlantImage(image: Omit<PlantImage, "id" | "createdAt"): PlantImage {
		const id = uuidv4();
		const now = new Date().toISOString();

		const stmt = this.db.prepare(`
			INSER INTO plant_images (
				id, plantId, filename, caption, takenAt, createdAt
			)
			VALUES (?, ?, ?, ?, ?, ?)
		`)

		stmt.run(id, image.plantId, image.filename, image.caption || null, image.takenAt, now);
		return { id, ...image, caption: image.caption || null, createdAt: now };
	}

	getPlantImage(id: string): PlantImage | undefined {
		const stmt = this.db.prepare(`SELECT * FROM plant_images WHERE id = ?`);
		const row = stmt.get(id);

		return row as PlantImage | undefined;
	}
	
	getPlantImages(plantId: string): PlantImage[] {
		const stmt = this.db.prepare(`
			SELECT * FROM plant_images
			WHERE plantID = ?
			ORDER BY takenAt DESC
		`);

		const rows = stmt.all(plantId);
		return rows as PlantImage[];
	}

}
