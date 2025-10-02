import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import { PlantDatabase } from '../database.js';
import type { Plant } from '../types.js';

describe.skip('PlantDatabase', () => {
	let db: PlantDatabase;
	let testUserId: string;

	beforeAll(async () => {
		// Use test database config
		process.env.DB_HOST = 'localhost';
		process.env.DB_PORT = '5432';
		process.env.DB_USER = 'test';
		process.env.DB_PASSWORD = 'test';
		process.env.DB_NAME = 'planty_test';

		db = new PlantDatabase();
		await db.initialize();

		// Create a test user
		testUserId = await db.createUser('test@example.com');
	});

	afterAll(async () => {
		await db.close();
	});

	describe('User Management', () => {
		it('should create a user', async () => {
			const userId = await db.createUser('newuser@example.com');
			expect(userId).toBeTruthy();
			expect(typeof userId).toBe('string');
		});

		it('should get user by id', async () => {
			const user = await db.getUserById(testUserId);
			expect(user).toBeDefined();
			expect(user?.id).toBe(testUserId);
			expect(user?.email).toBe('test@example.com');
		});

		it('should get user by email', async () => {
			const user = await db.getUserByEmail('test@example.com');
			expect(user).toBeDefined();
			expect(user?.id).toBe(testUserId);
		});

		it('should add email to user', async () => {
			const userId = await db.createUser();
			const success = await db.addEmailToUser(userId, 'added@example.com');
			expect(success).toBe(true);

			const user = await db.getUserById(userId);
			expect(user?.email).toBe('added@example.com');
		});
	});

	describe('API Key Management', () => {
		it('should generate API key with correct format', () => {
			const apiKey = db.generateApiKey();
			expect(apiKey).toMatch(/^planty_live_[A-Za-z0-9_-]+$/);
		});

		it('should create and retrieve API key', async () => {
			const userId = await db.createUser();
			const apiKey = await db.createApiKey(userId);

			expect(apiKey).toBeTruthy();
			expect(apiKey).toMatch(/^planty_live_/);

			const user = await db.getUserByApiKey(apiKey);
			expect(user).toBeDefined();
			expect(user?.id).toBe(userId);
		});

		it('should return undefined for invalid API key', async () => {
			const user = await db.getUserByApiKey('invalid_key');
			expect(user).toBeUndefined();
		});

		it('should list user API keys', async () => {
			const userId = await db.createUser();
			await db.createApiKey(userId);
			await db.createApiKey(userId);

			const keys = await db.getUserApiKeys(userId);
			expect(keys.length).toBeGreaterThanOrEqual(2);
			expect(keys[0]).toHaveProperty('keyPrefix');
			expect(keys[0]).toHaveProperty('createdAt');
		});
	});

	describe('Plant Management', () => {
		let testPlantId: string;

		beforeEach(async () => {
			const plant = await db.addPlant(testUserId, {
				name: 'Test Plant',
				species: 'Monstera deliciosa',
				location: 'Living Room',
				acquiredDate: '2025-01-01',
				wateringFrequency: 7,
				lastWatered: null,
				notes: 'Test notes',
			});
			testPlantId = plant.id;
		});

		it('should add a plant', async () => {
			const plant = await db.addPlant(testUserId, {
				name: 'New Plant',
				species: 'Pothos',
				location: 'Bedroom',
				acquiredDate: '2025-01-15',
				wateringFrequency: 5,
				lastWatered: null,
				notes: 'New plant notes',
			});

			expect(plant.id).toBeTruthy();
			expect(plant.name).toBe('New Plant');
			expect(plant.species).toBe('Pothos');
		});

		it('should get a plant by id', async () => {
			const plant = await db.getPlant(testUserId, testPlantId);

			expect(plant).toBeDefined();
			expect(plant?.id).toBe(testPlantId);
			expect(plant?.name).toBe('Test Plant');
		});

		it('should list plants', async () => {
			const plants = await db.listPlants(testUserId);

			expect(Array.isArray(plants)).toBe(true);
			expect(plants.length).toBeGreaterThan(0);
			expect(plants[0]).toHaveProperty('name');
			expect(plants[0]).toHaveProperty('species');
		});

		it('should filter plants by location', async () => {
			await db.addPlant(testUserId, {
				name: 'Kitchen Plant',
				species: 'Basil',
				location: 'Kitchen',
				acquiredDate: '2025-01-01',
				wateringFrequency: 3,
				lastWatered: null,
				notes: '',
			});

			const plants = await db.listPlants(testUserId, { location: 'Kitchen' });
			expect(plants.length).toBeGreaterThan(0);
			expect(plants.every((p) => p.location === 'Kitchen')).toBe(true);
		});

		it('should update a plant', async () => {
			const updated = await db.updatePlant(testUserId, testPlantId, {
				name: 'Updated Plant Name',
				notes: 'Updated notes',
			});

			expect(updated).toBeDefined();
			expect(updated?.name).toBe('Updated Plant Name');
			expect(updated?.notes).toBe('Updated notes');
			expect(updated?.species).toBe('Monstera deliciosa'); // Unchanged
		});

		it('should delete a plant', async () => {
			const deleted = await db.deletePlant(testUserId, testPlantId);
			expect(deleted).toBe(true);

			const plant = await db.getPlant(testUserId, testPlantId);
			expect(plant).toBeUndefined();
		});

		it('should not access another user\'s plants', async () => {
			const otherUserId = await db.createUser();
			const plant = await db.getPlant(otherUserId, testPlantId);

			expect(plant).toBeUndefined();
		});
	});

	describe('Watering Management', () => {
		let plantId: string;

		beforeEach(async () => {
			const plant = await db.addPlant(testUserId, {
				name: 'Watering Test Plant',
				species: 'Fern',
				location: 'Bathroom',
				acquiredDate: '2025-01-01',
				wateringFrequency: 3,
				lastWatered: null,
				notes: '',
			});
			plantId = plant.id;
		});

		it('should record watering event', async () => {
			const watering = await db.waterPlant(
				testUserId,
				plantId,
				'2025-01-15',
				'Regular watering',
			);

			expect(watering).toBeDefined();
			expect(watering?.plantId).toBe(plantId);
			expect(watering?.wateredDate).toBe('2025-01-15');
			expect(watering?.notes).toBe('Regular watering');
		});

		it('should update plant lastWatered field', async () => {
			await db.waterPlant(testUserId, plantId, '2025-01-15');

			const plant = await db.getPlant(testUserId, plantId);
			expect(plant?.lastWatered).toBeTruthy();
		});

		it('should get watering history', async () => {
			await db.waterPlant(testUserId, plantId, '2025-01-10');
			await db.waterPlant(testUserId, plantId, '2025-01-15');
			await db.waterPlant(testUserId, plantId, '2025-01-20');

			const history = await db.getWateringHistory(testUserId, plantId);

			expect(history.length).toBe(3);
			expect(history[0].wateredDate).toBe('2025-01-20'); // Most recent first
		});
	});

	describe('Growth Logs', () => {
		let plantId: string;

		beforeEach(async () => {
			const plant = await db.addPlant(testUserId, {
				name: 'Growth Test Plant',
				species: 'Tomato',
				location: 'Garden',
				acquiredDate: '2025-01-01',
				wateringFrequency: 2,
				lastWatered: null,
				notes: '',
			});
			plantId = plant.id;
		});

		it('should add growth log', async () => {
			const log = await db.addGrowthLog(testUserId, {
				plantId,
				logDate: '2025-01-15',
				measureType: 'height',
				measureUnit: 'cm',
				value: 25,
				notes: 'Growing well',
			});

			expect(log).toBeDefined();
			expect(log?.plantId).toBe(plantId);
			expect(log?.measureType).toBe('height');
			expect(log?.value).toBe('25');
		});

		it('should get growth logs', async () => {
			await db.addGrowthLog(testUserId, {
				plantId,
				logDate: '2025-01-10',
				measureType: 'height',
				measureUnit: 'cm',
				value: 20,
				notes: null,
			});

			await db.addGrowthLog(testUserId, {
				plantId,
				logDate: '2025-01-15',
				measureType: 'height',
				measureUnit: 'cm',
				value: 25,
				notes: null,
			});

			const logs = await db.getGrowthLogs(testUserId, plantId);

			expect(logs.length).toBe(2);
			expect(logs[0].logDate).toBe('2025-01-15'); // Most recent first
		});
	});

	describe('Plant Images', () => {
		let plantId: string;

		beforeEach(async () => {
			const plant = await db.addPlant(testUserId, {
				name: 'Image Test Plant',
				species: 'Rose',
				location: 'Garden',
				acquiredDate: '2025-01-01',
				wateringFrequency: 3,
				lastWatered: null,
				notes: '',
			});
			plantId = plant.id;
		});

		it('should add plant image', async () => {
			const image = await db.addPlantImage(testUserId, {
				plantId,
				filename: 'rose-2025-01-15.jpg',
				caption: 'First bloom',
				takenAt: '2025-01-15',
			});

			expect(image).toBeDefined();
			expect(image?.plantId).toBe(plantId);
			expect(image?.filename).toBe('rose-2025-01-15.jpg');
		});

		it('should get plant images', async () => {
			await db.addPlantImage(testUserId, {
				plantId,
				filename: 'image1.jpg',
				caption: 'First',
				takenAt: '2025-01-10',
			});

			await db.addPlantImage(testUserId, {
				plantId,
				filename: 'image2.jpg',
				caption: 'Second',
				takenAt: '2025-01-15',
			});

			const images = await db.getPlantImages(testUserId, plantId);

			expect(images.length).toBe(2);
			expect(images[0].takenAt).toBe('2025-01-15'); // Most recent first
		});

		it('should get plant image by id', async () => {
			const added = await db.addPlantImage(testUserId, {
				plantId,
				filename: 'test.jpg',
				caption: null,
				takenAt: '2025-01-15',
			});

			const image = await db.getPlantImage(testUserId, added!.id);

			expect(image).toBeDefined();
			expect(image?.filename).toBe('test.jpg');
		});
	});
});
