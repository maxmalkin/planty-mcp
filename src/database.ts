import pg from 'pg';
import { v4 as uuidv4 } from 'uuid';
import type { Plant, WateringHistory, GrowthLog, PlantImage } from './types.js';
import { dbConfig } from './config.js';
import crypto from 'crypto';
import _ from 'lodash';

const { Pool } = pg;

export interface User {
	id: string;
	email: string | null;
	createdAt: string;
}

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
			console.log('Connected to PostgreSQL database');

			await this.initializeDatabase(client);
			client.release();

			console.log('Database initialized successfully.');
			return true;
		} catch (error) {
			console.error('Failed to initialize database:', error);
			return false;
		}
	}

	private async initializeDatabase(client: pg.PoolClient): Promise<void> {
		const createUserTable = `
			CREATE TABLE IF NOT EXISTS users (
				id VARCHAR(36) PRIMARY KEY,
				email VARCHAR(255) UNIQUE NOT NULL,
				created_at TIMESTAMP NOT NULL
			)`;

		const createApiKeysTable = `
			CREATE TABLE IF NOT EXISTS api_keys (
			id VARCHAR(36) PRIMARY KEY,
			user_id VARCHAR(36) NOT NULL,
			key_hash VARCHAR(255) UNIQUE NOT NULL,
			key_prefix VARCHAR(10) NOT NULL,
			created_at TIMESTAMP NOT NULL,
			last_used TIMESTAMP,
			is_active BOOLEAN DEFAULT true,
			FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
		)`;

		const createPlantsTable = `
			CREATE TABLE IF NOT EXISTS plants (
				id VARCHAR(36) PRIMARY KEY,
				user_id VARCHAR(36) NOT NULL,
				name VARCHAR(255) NOT NULL,
				species VARCHAR(255) NOT NULL,
				location VARCHAR(255) NOT NULL,
				acquired_date DATE NOT NULL,
				watering_frequency INTEGER NOT NULL,
				last_watered DATE,
				notes TEXT,
				created_at TIMESTAMP NOT NULL,
				updated_at TIMESTAMP NOT NULL,
				FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
			)`;

		const createWateringHistoryTable = `
			CREATE TABLE IF NOT EXISTS watering_history (
				id VARCHAR(36) PRIMARY KEY,
				user_id VARCHAR(36) NOT NULL,
				plant_id VARCHAR(36) NOT NULL,
				watered_date DATE NOT NULL,
				notes TEXT,
				created_at TIMESTAMP NOT NULL,
				FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
				FOREIGN KEY (plant_id) REFERENCES plants(id) ON DELETE CASCADE
			)`;

		const createGrowthLogsTable = `
			CREATE TABLE IF NOT EXISTS growth_logs (
				id VARCHAR(36) PRIMARY KEY,
				user_id VARCHAR(36) NOT NULL,
				plant_id VARCHAR(36) NOT NULL,
				log_date DATE NOT NULL,
				measure_type VARCHAR(100) NOT NULL,
				measure_unit VARCHAR(50) NOT NULL,
				value DECIMAL(10, 2) NOT NULL,
				notes TEXT,
				created_at TIMESTAMP NOT NULL,
				FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
				FOREIGN KEY (plant_id) REFERENCES plants(id) ON DELETE CASCADE
			)`;

		const createPlantImagesTable = `
			CREATE TABLE IF NOT EXISTS plant_images (
				id VARCHAR(36) PRIMARY KEY,
				user_id VARCHAR(36) NOT NULL,
				plant_id VARCHAR(36) NOT NULL,
				filename VARCHAR(255) NOT NULL,
				caption TEXT,
				taken_at DATE NOT NULL,
				created_at TIMESTAMP NOT NULL,
				FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
				FOREIGN KEY (plant_id) REFERENCES plants(id) ON DELETE CASCADE
			)`;

		const createIndexes = `
			CREATE INDEX IF NOT EXISTS idx_plants_user_id ON plants(user_id);
			CREATE INDEX IF NOT EXISTS idx_api_keys_key_hash ON api_keys(key_hash);
			CREATE INDEX IF NOT EXISTS idx_api_keys_user_id ON api_keys(user_id);
			CREATE INDEX IF NOT EXISTS idx_watering_history_user_id ON watering_history(user_id);
			CREATE INDEX IF NOT EXISTS idx_watering_history_plant_id ON watering_history(plant_id);
			CREATE INDEX IF NOT EXISTS idx_growth_logs_user_id ON growth_logs(user_id);
			CREATE INDEX IF NOT EXISTS idx_growth_logs_plant_id ON growth_logs(plant_id);
			CREATE INDEX IF NOT EXISTS idx_plant_images_user_id ON plant_images(user_id);
			CREATE INDEX IF NOT EXISTS idx_plant_images_plant_id ON plant_images(plant_id);
		`;

		await client.query(createUserTable);
		await client.query(createApiKeysTable);
		await client.query(createPlantsTable);
		await client.query(createWateringHistoryTable);
		await client.query(createGrowthLogsTable);
		await client.query(createPlantImagesTable);

		const indexStatements = createIndexes
			.split(';')
			.map((s) => s.trim())
			.filter((s) => s.length > 0);

		for (const statement of indexStatements) {
			await client.query(statement);
		}
	}

	private toISOString(date: Date | string | null): string | null {
		if (!date) return null;
		if (typeof date === 'string') return date;
		return date.toISOString();
	}

	async createUser(email: string | null = null): Promise<string> {
		const id = uuidv4();
		const now = new Date().toISOString();

		try {
			await this.pool.query(
				'INSERT INTO users (id, email, created_at) VALUES ($1, $2, $3)',
				[id, email, now],
			);
			return id;
		} catch (error) {
			if (error) {
				const existing = await this.getUserById(id);
				if (existing) return existing.id;
			}
			throw error;
		}
	}

	async getUserByEmail(email: string): Promise<User | undefined> {
		const result = await this.pool.query(
			'SELECT id, email, created_at FROM users WHERE email = $1',
			[email],
		);

		if (result.rows.length === 0) return undefined;

		const row = result.rows[0];
		return {
			id: row.id,
			email: row.email,
			createdAt: this.toISOString(row.created_at) as string,
		};
	}

	async getUserById(id: string): Promise<User | undefined> {
		const result = await this.pool.query(
			'SELECT id, email, created_at FROM users WHERE id = $1',
			[id],
		);

		if (result.rows.length === 0) return undefined;

		const row = result.rows[0];
		return {
			id: row.id,
			email: row.email,
			createdAt: this.toISOString(row.created_at) as string,
		};
	}

	async addPlant(
		userId: string,
		plant: Omit<Plant, 'id' | 'createdAt' | 'updatedAt'>,
	): Promise<Plant> {
		const id = uuidv4();
		const now = new Date().toISOString();

		await this.pool.query(
			`INSERT INTO plants (
				id, user_id, name, species, location, acquired_date, watering_frequency, last_watered, notes, created_at, updated_at
			) 
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
			[
				id,
				userId,
				plant.name,
				plant.species,
				plant.location,
				plant.acquiredDate,
				plant.wateringFrequency,
				plant.lastWatered,
				plant.notes,
				now,
				now,
			],
		);

		return { id, ...plant, createdAt: now, updatedAt: now };
	}

	async getPlant(userId: string, id: string): Promise<Plant | undefined> {
		const result = await this.pool.query(
			'SELECT * FROM plants WHERE id = $1 AND user_id = $2',
			[id, userId],
		);

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

	async listPlants(
		userId: string,
		filters?: {
			location?: string;
			species?: string;
		},
	): Promise<Plant[]> {
		let query = 'SELECT * FROM plants WHERE user_id = $1';
		const params = [userId];
		let paramIndex = 2;

		if (filters) {
			if (filters.location) {
				query += ` AND location = $${paramIndex++}`;
				params.push(filters.location);
			}

			if (filters.species) {
				query += ` AND species = $${paramIndex++}`;
				params.push(filters.species);
			}
		}

		query += ' ORDER BY name';

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
		userId: string,
		id: string,
		updates: Partial<Omit<Plant, 'id' | 'createdAt' | 'updatedAt'>>,
	): Promise<Plant | undefined> {
		const exists = await this.getPlant(userId, id);
		if (!exists) return undefined;

		const fields = _.keys(updates);
		if (fields.length === 0) return exists;

		const dbFieldMap: Record<string, string> = {
			acquiredDate: 'acquired_date',
			wateringFrequency: 'watering_frequency',
			lastWatered: 'last_watered',
		};

		const setClause = fields
			.map((field, index) => {
				const dbField = dbFieldMap[field] || field;
				return `${dbField} = $${index + 1}`;
			})
			.join(', ');

		const values = fields.map(
			(field) => updates[field as keyof typeof updates],
		);

		const now = new Date().toISOString();

		await this.pool.query(
			`UPDATE plants 
			SET ${setClause}, 
			updated_at = $${fields.length + 1}
			WHERE id = $${fields.length + 2} AND user_id = $${fields.length + 3}`,
			[...values, now, id, userId],
		);

		return this.getPlant(userId, id);
	}

	async deletePlant(userId: string, id: string): Promise<boolean> {
		const result = await this.pool.query(
			'DELETE FROM plants WHERE id = $1 AND user_id = $2',
			[id, userId],
		);

		return result.rowCount !== null && result.rowCount > 0;
	}

	async waterPlant(
		userId: string,
		plantId: string,
		wateredDate: string,
		notes?: string,
	): Promise<WateringHistory | undefined> {
		const plant = await this.getPlant(userId, plantId);
		if (!plant) return undefined;

		const id = uuidv4();
		const now = new Date().toISOString();

		await this.pool.query(
			`INSERT INTO watering_history (
				id, user_id, plant_id, watered_date, notes, created_at
			) 
			VALUES ($1, $2, $3, $4, $5, $6)`,
			[id, userId, plantId, wateredDate, notes || null, now],
		);

		await this.pool.query(
			`UPDATE plants 
			SET last_watered = $1,
			updated_at = $2
			WHERE id = $3 AND user_id = $4`,
			[wateredDate, now, plantId, userId],
		);

		return {
			id,
			plantId: plantId,
			wateredDate: wateredDate,
			notes: notes || null,
			createdAt: now,
		};
	}

	async getWateringHistory(
		userId: string,
		plantId: string,
	): Promise<WateringHistory[]> {
		const result = await this.pool.query(
			`SELECT * FROM watering_history
			WHERE plant_id = $1 AND user_id = $2
			ORDER BY watered_date DESC`,
			[plantId, userId],
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
		userId: string,
		log: Omit<GrowthLog, 'id' | 'createdAt'>,
	): Promise<GrowthLog | undefined> {
		const plant = await this.getPlant(userId, log.plantId);
		if (!plant) return undefined;

		const id = uuidv4();
		const now = new Date().toISOString();

		await this.pool.query(
			`INSERT INTO growth_logs (
				id, user_id, plant_id, log_date, measure_type, measure_unit, value, notes, created_at
			)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
			[
				id,
				userId,
				log.plantId,
				log.logDate,
				log.measureType,
				log.measureUnit,
				log.value,
				log.notes || null,
				now,
			],
		);

		return { id, ...log, notes: log.notes || null, createdAt: now };
	}

	async getGrowthLogs(userId: string, plantId: string): Promise<GrowthLog[]> {
		const result = await this.pool.query(
			`SELECT * FROM growth_logs
			WHERE plant_id = $1 AND user_id = $2
			ORDER BY log_date DESC`,
			[plantId, userId],
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
		userId: string,
		image: Omit<PlantImage, 'id' | 'createdAt'>,
	): Promise<PlantImage | undefined> {
		const plant = await this.getPlant(userId, image.plantId);
		if (!plant) return undefined;

		const id = uuidv4();
		const now = new Date().toISOString();

		await this.pool.query(
			`INSERT INTO plant_images (
				id, user_id, plant_id, filename, caption, taken_at, created_at
			)
			VALUES ($1, $2, $3, $4, $5, $6, $7)`,
			[
				id,
				userId,
				image.plantId,
				image.filename,
				image.caption || null,
				image.takenAt,
				now,
			],
		);

		return { id, ...image, caption: image.caption || null, createdAt: now };
	}

	async getPlantImage(
		userId: string,
		id: string,
	): Promise<PlantImage | undefined> {
		const result = await this.pool.query(
			'SELECT * FROM plant_images WHERE id = $1 AND user_id = $2',
			[id, userId],
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

	async getPlantImages(userId: string, plantId: string): Promise<PlantImage[]> {
		const result = await this.pool.query(
			`SELECT * FROM plant_images
			WHERE plant_id = $1 AND user_id = $2
			ORDER BY taken_at DESC`,
			[plantId, userId],
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

	generateApiKey(): string {
		const randomBytes = crypto.randomBytes(24).toString('base64url');
		return `planty_live_${randomBytes}`;
	}

	private hashApiKey(apiKey: string): string {
		return crypto.createHash('sha256').update(apiKey).digest('hex');
	}

	async createApiKey(userId: string): Promise<string> {
		const apiKey = this.generateApiKey();
		const keyHash = this.hashApiKey(apiKey);
		const keyPrefix = apiKey.substring(0, 16);
		const id = uuidv4();
		const now = new Date().toISOString();

		await this.pool.query(
			`INSERT INTO api_keys (id, user_id, key_hash, key_prefix, created_at)
			VALUES ($1, $2, $3, $4, $5)`,
			[id, userId, keyHash, keyPrefix, now],
		);

		return apiKey;
	}

	async getUserByApiKey(apiKey: string): Promise<User | undefined> {
		const keyHash = this.hashApiKey(apiKey);

		const result = await this.pool.query(
			`SELECT u.id, u.email, u.created_at
			FROM users u
			JOIN api_keys ak ON u.id = ak.user_id
			WHERE ak.key_hash = $1 AND ak.is_active = true`,
			[keyHash],
		);

		if (result.rows.length === 0) return undefined;

		await this.pool.query(
			`UPDATE api_keys SET last_used_at = $1 WHERE key_hash = $2`,
			[new Date().toISOString(), keyHash],
		);

		const row = result.rows[0];
		return {
			id: row.id,
			email: row.email,
			createdAt: this.toISOString(row.created_at) as string,
		};
	}

	async addEmailToUser(userId: string, email: string): Promise<boolean> {
		try {
			await this.pool.query(`UPDATE users SET email = $1 WHERE id = $2`, [
				email,
				userId,
			]);
			return true;
		} catch (error) {
			console.error('Error adding email to user:', error);
			return false;
		}
	}

	async getUserApiKeys(userId: string): Promise<
		Array<{
			id: string;
			keyPrefix: string;
			createdAt: string;
			lastUsedAt: string | null;
		}>
	> {
		const result = await this.pool.query(
			`SELECT id, key_prefix, created_at, last_used_at
			FROM api_keys
			WHERE user_id = $1 AND is_active = true
			ORDER BY created_at DESC`,
			[userId],
		);

		return result.rows.map((row) => ({
			id: row.id,
			keyPrefix: row.key_prefix,
			createdAt: this.toISOString(row.created_at) as string,
			lastUsedAt: this.toISOString(row.last_used_at),
		}));
	}

	async revokeApiKey(keyHash: string): Promise<boolean> {
		const result = await this.pool.query(
			`UPDATE api_keys SET is_active = false WHERE key_hash = $1`,
			[this.hashApiKey(keyHash)],
		);

		return result.rowCount !== null && result.rowCount > 0;
	}

	async close(): Promise<void> {
		await this.pool.end();
	}
}
