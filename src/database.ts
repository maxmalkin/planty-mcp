import pg from "pg";
import { v4 as uuidv4 } from "uuid";
import type { Plant, WateringHistory, GrowthLog, PlantImage } from "./types.js";
import { dbConfig } from "./config.js";
import _ from "lodash";

const { Pool } = pg;

export class PlantDatabase {
	private pool: pg.Pool;

	constructor() {
		this.pool = new Pool({
			host: dbConfig.host,
			port: dbConfig.port,
			user: dbConfig.user,
			password: dbConfig.password,
			database: dbConfig.database,
			max: 10,
			idleTimeoutMillis: 30000,
		});
	}

	async initialize(): Promise<boolean> {
		try {
			const client = await this.pool.connect();
			console.log("Connected to PostgreSQL database");

			await this.initializeDatabase(client);
			client.release();

			console.log("Database initialized successfully.");
			return true;
		} catch (error) {
			console.error("Failed to initialize database:", error);
			return false;
		}
	}

	private async initializeDatabase(client: pg.PoolClient): Promise<void> {
		const createPlantsTable = `
			CREATE TABLE IF NOT EXISTS plants (
			id VARCHAR(36) PRIMARY KEY,
			name VARCHAR(255) NOT NULL,
			species VARCHAR(255) NOT NULL,
			location VARCHAR(255) NOT NULL,
			acquired_date DATE NOT NULL,
			watering_frequency INTEGER NOT NULL,
			last_watered DATE,
			notes TEXT,
			created_at TIMESTAMP NOT NULL,
			updated_at TIMESTAMP NOT NULL
		)`;

		const createWateringHistoryTable = `
			CREATE TABLE IF NOT EXISTS watering_history (
			id VARCHAR(36) PRIMARY KEY,
			plant_id VARCHAR(36) NOT NULL,
			watered_date DATE NOT NULL,
			notes TEXT,
			created_at TIMESTAMP NOT NULL,
			FOREIGN KEY (plant_id) REFERENCES plants(id) ON DELETE CASCADE
		)`;

		const createGrowthLogsTable = `
			CREATE TABLE IF NOT EXISTS growth_logs (
			id VARCHAR(36) PRIMARY KEY,
			plant_id VARCHAR(36) NOT NULL,
			log_date DATE NOT NULL,
			measure_type VARCHAR(100) NOT NULL,
			measure_unit VARCHAR(50) NOT NULL,
			value DECIMAL(10, 2) NOT NULL,
			notes TEXT,
			created_at TIMESTAMP NOT NULL,
			FOREIGN KEY (plant_id) REFERENCES plants(id) ON DELETE CASCADE
		)`;

		const createPlantImagesTable = `
			CREATE TABLE IF NOT EXISTS plant_images (
			id VARCHAR(36) PRIMARY KEY,
			plant_id VARCHAR(36) NOT NULL,
			filename VARCHAR(255) NOT NULL,
			caption TEXT,
			taken_at DATE NOT NULL,
			created_at TIMESTAMP NOT NULL,
			FOREIGN KEY (plant_id) REFERENCES plants(id) ON DELETE CASCADE
		)`;

		const createIndexes = `
			CREATE INDEX IF NOT EXISTS idx_watering_history_plant_id ON watering_history(plant_id);
			CREATE INDEX IF NOT EXISTS idx_growth_logs_plant_id ON growth_logs(plant_id);
			CREATE INDEX IF NOT EXISTS idx_plant_images_plant_id ON plant_images(plant_id);
		`;

		await client.query(createPlantsTable);
		await client.query(createWateringHistoryTable);
		await client.query(createGrowthLogsTable);
		await client.query(createPlantImagesTable);

		const indexStatements = createIndexes
			.split(";")
			.map((s) => s.trim())
			.filter((s) => s.length > 0);

		for (const statement of indexStatements) {
			await client.query(statement);
		}
	}

	private toISOString(date: Date | string | null): string | null {
		if (!date) return null;
		if (typeof date === "string") return date;
		return date.toISOString();
	}

	// DB operations

	async addPlant(
		plant: Omit<Plant, "id" | "createdAt" | "updatedAt">
	): Promise<Plant> {
		const id = uuidv4();
		const now = new Date().toISOString();

		await this.pool.query(
			`INSERT INTO plants (
				id, name, species, location, acquired_date, watering_frequency, last_watered, notes, created_at, updated_at
			) 
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
			[
				id,
				plant.name,
				plant.species,
				plant.location,
				plant.acquiredDate,
				plant.wateringFrequency,
				plant.lastWatered,
				plant.notes,
				now,
				now,
			]
		);

		return { id, ...plant, createdAt: now, updatedAt: now };
	}

	async getPlant(id: string): Promise<Plant | undefined> {
		const result = await this.pool.query("SELECT * FROM plants WHERE id = $1", [
			id,
		]);

		if (result.rows.length === 0) return undefined;

		const row = result.rows[0];
		return {
			id: row.id,
			name: row.name,
			species: row.species,
			location: row.location,
			acquiredDate: this.toISOString(row.acquired_date) as string,
			wateringFrequency: row.watering_frequency,
			lastWatered: this.toISOString(row.last_watered),
			notes: row.notes,
			createdAt: this.toISOString(row.created_at) as string,
			updatedAt: this.toISOString(row.updated_at) as string,
		};
	}

	async listPlants(filters?: {
		location?: string;
		species?: string;
	}): Promise<Plant[]> {
		let query = "SELECT * FROM plants";
		const params: string[] = [];
		let paramIndex = 1;

		// build filtered query
		if (filters) {
			const conditions: string[] = [];
			if (filters.location) {
				conditions.push(`location = $${paramIndex++}`);
				params.push(filters.location);
			}

			if (filters.species) {
				conditions.push(`species = $${paramIndex++}`);
				params.push(filters.species);
			}

			if (conditions.length > 0) {
				query += " WHERE " + conditions.join(" AND ");
			}
		}

		query += " ORDER BY name";

		const result = await this.pool.query(query, params);

		return result.rows.map((row) => ({
			id: row.id,
			name: row.name,
			species: row.species,
			location: row.location,
			acquiredDate: this.toISOString(row.acquired_date) as string,
			wateringFrequency: row.watering_frequency,
			lastWatered: this.toISOString(row.last_watered),
			notes: row.notes,
			createdAt: this.toISOString(row.created_at) as string,
			updatedAt: this.toISOString(row.updated_at) as string,
		}));
	}

	async updatePlant(
		id: string,
		updates: Partial<Omit<Plant, "id" | "createdAt" | "updatedAt">>
	): Promise<Plant | undefined> {
		const exists = await this.getPlant(id);
		if (!exists) return undefined;

		const fields = _.keys(updates);
		if (fields.length === 0) return exists;

		const dbFieldMap: Record<string, string> = {
			acquiredDate: "acquired_date",
			wateringFrequency: "watering_frequency",
			lastWatered: "last_watered",
		};

		const setClause = fields
			.map((field, index) => {
				const dbField = dbFieldMap[field] || field;
				return `${dbField} = $${index + 1}`;
			})
			.join(", ");

		const values = fields.map(
			(field) => updates[field as keyof typeof updates]
		);

		const now = new Date().toISOString();

		await this.pool.query(
			`UPDATE plants 
			SET ${setClause}, 
			updated_at = $${fields.length + 1}
			WHERE id = $${fields.length + 2}`,
			[...values, now, id]
		);

		return this.getPlant(id);
	}

	async deletePlant(id: string): Promise<boolean> {
		const result = await this.pool.query("DELETE FROM plants WHERE id = $1", [
			id,
		]);

		// 0 if no row deleted, 1 if row deleted
		return result.rowCount !== null && result.rowCount > 0;
	}

	async waterPlant(
		plantId: string,
		wateredDate: string,
		notes?: string
	): Promise<WateringHistory> {
		const id = uuidv4();
		const now = new Date().toISOString();

		await this.pool.query(
			`INSERT INTO watering_history (
				id, plant_id, watered_date, notes, created_at
			) 
			VALUES ($1, $2, $3, $4, $5)`,
			[id, plantId, wateredDate, notes || null, now]
		);

		// update plant table lastWatered
		await this.pool.query(
			`UPDATE plants 
			SET last_watered = $1,
			updated_at = $2
			WHERE id = $3`,
			[wateredDate, now, plantId]
		);

		return {
			id,
			plantId: plantId,
			wateredDate: wateredDate,
			notes: notes || null,
			createdAt: now,
		};
	}

	async getWateringHistory(plantId: string): Promise<WateringHistory[]> {
		const result = await this.pool.query(
			`SELECT * FROM watering_history
			WHERE plant_id = $1
			ORDER BY watered_date DESC`,
			[plantId]
		);

		return result.rows.map((row) => ({
			id: row.id,
			plantId: row.plant_id,
			wateredDate: this.toISOString(row.watered_date) as string,
			notes: row.notes,
			createdAt: this.toISOString(row.created_at) as string,
		}));
	}

	async addGrowthLog(
		log: Omit<GrowthLog, "id" | "createdAt">
	): Promise<GrowthLog> {
		const id = uuidv4();
		const now = new Date().toISOString();

		await this.pool.query(
			`INSERT INTO growth_logs (
				id, plant_id, log_date, measure_type, measure_unit, value, notes, created_at
			)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
			[
				id,
				log.plantId,
				log.logDate,
				log.measureType,
				log.measureUnit,
				log.value,
				log.notes || null,
				now,
			]
		);

		return { id, ...log, notes: log.notes || null, createdAt: now };
	}

	async getGrowthLogs(plantId: string): Promise<GrowthLog[]> {
		const result = await this.pool.query(
			`SELECT * FROM growth_logs
			WHERE plant_id = $1
			ORDER BY log_date DESC`,
			[plantId]
		);

		return result.rows.map((row) => ({
			id: row.id,
			plantId: row.plant_id,
			logDate: this.toISOString(row.log_date) as string,
			measureType: row.measure_type,
			measureUnit: row.measure_unit,
			value: row.value.toString(),
			notes: row.notes,
			createdAt: this.toISOString(row.created_at) as string,
		}));
	}

	async addPlantImage(
		image: Omit<PlantImage, "id" | "createdAt">
	): Promise<PlantImage> {
		const id = uuidv4();
		const now = new Date().toISOString();

		await this.pool.query(
			`INSERT INTO plant_images (
				id, plant_id, filename, caption, taken_at, created_at
			)
			VALUES ($1, $2, $3, $4, $5, $6)`,
			[
				id,
				image.plantId,
				image.filename,
				image.caption || null,
				image.takenAt,
				now,
			]
		);

		return { id, ...image, caption: image.caption || null, createdAt: now };
	}

	async getPlantImage(id: string): Promise<PlantImage | undefined> {
		const result = await this.pool.query(
			"SELECT * FROM plant_images WHERE id = $1",
			[id]
		);

		if (result.rows.length === 0) return undefined;

		const row = result.rows[0];
		return {
			id: row.id,
			plantId: row.plant_id,
			filename: row.filename,
			caption: row.caption,
			takenAt: this.toISOString(row.taken_at) as string,
			createdAt: this.toISOString(row.created_at) as string,
		};
	}

	async getPlantImages(plantId: string): Promise<PlantImage[]> {
		const result = await this.pool.query(
			`SELECT * FROM plant_images
			WHERE plant_id = $1
			ORDER BY taken_at DESC`,
			[plantId]
		);

		return result.rows.map((row) => ({
			id: row.id,
			plantId: row.plant_id,
			filename: row.filename,
			caption: row.caption,
			takenAt: this.toISOString(row.taken_at) as string,
			createdAt: this.toISOString(row.created_at) as string,
		}));
	}

	async close(): Promise<void> {
		await this.pool.end();
	}
}

if (import.meta.url === `file://${process.argv[1]}`) {
	(async () => {
		const db = new PlantDatabase();

		if (!(await db.initialize())) {
			console.error("Failed to initialize database");
			process.exit(1);
		}

		const p = await db.addPlant({
			name: "Fiddle Leaf Fig",
			species: "Ficus lyrata",
			location: "Living Room",
			acquiredDate: "2023-01-15",
			wateringFrequency: 7,
			lastWatered: null,
			notes: "Needs bright, indirect light.",
		});

		console.log("added plant: ", p);

		const r = await db.getPlant(p.id);

		console.log("got plant: ", r);

		const all = await db.listPlants();
		console.log("all plants: ", all);

		await db.close();
		process.exit(0);
	})();
}
