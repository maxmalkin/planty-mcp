import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { setupToolHandlers } from '../handlers.js';
import type { PlantDatabase } from '../database.js';
import type { Plant } from '../types.js';

describe.skip('MCP Tool Handlers', () => {
	let server: Server;
	let mockDb: PlantDatabase;
	let serverTransport: InMemoryTransport;
	const testUserId = 'test-user-123';

	beforeEach(async () => {
		server = new Server(
			{ name: 'test-server', version: '1.0.0' },
			{ capabilities: { tools: {} } },
		);

		mockDb = {
			addPlant: jest.fn<any>(),
			listPlants: jest.fn<any>(),
			getPlant: jest.fn<any>(),
			updatePlant: jest.fn<any>(),
			deletePlant: jest.fn<any>(),
			waterPlant: jest.fn<any>(),
			getWateringHistory: jest.fn<any>(),
			addGrowthLog: jest.fn<any>(),
			getGrowthLogs: jest.fn<any>(),
			addPlantImage: jest.fn<any>(),
			getPlantImages: jest.fn<any>(),
		} as unknown as PlantDatabase;

		setupToolHandlers(server, mockDb, testUserId);

		// Connect server with in-memory transport for testing
		const [clientTransport, transport] = InMemoryTransport.createLinkedPair();
		serverTransport = transport;
		await server.connect(serverTransport);
	});

	afterEach(async () => {
		try {
			await server.close();
		} catch (e) {
			// Ignore close errors
		}
	});

	describe('add_plant tool', () => {
		it('should add a new plant', async () => {
			const mockPlant: Plant = {
				id: 'plant-123',
				name: 'Monstera',
				species: 'Monstera deliciosa',
				location: 'Living Room',
				acquiredDate: '2025-01-01',
				wateringFrequency: 7,
				lastWatered: null,
				notes: 'Beautiful plant',
				createdAt: '2025-01-01T00:00:00.000Z',
				updatedAt: '2025-01-01T00:00:00.000Z',
			};

			(mockDb.addPlant as jest.Mock<any>).mockResolvedValue(mockPlant);

			const result = await server.request(
				{
					method: 'tools/call',
					params: {
						name: 'add_plant',
						arguments: {
							name: 'Monstera',
							species: 'Monstera deliciosa',
							location: 'Living Room',
							acquiredDate: '2025-01-01',
							wateringFrequency: 7,
							notes: 'Beautiful plant',
						},
					},
				},
				{} as any,
			);

			expect(mockDb.addPlant).toHaveBeenCalledWith(testUserId, {
				name: 'Monstera',
				species: 'Monstera deliciosa',
				location: 'Living Room',
				acquiredDate: '2025-01-01',
				wateringFrequency: 7,
				lastWatered: null,
				notes: 'Beautiful plant',
			});

			expect(result.content[0].type).toBe('text');
			expect((result.content[0] as any).text).toContain('Successfully added plant');
		});

		it('should reject missing required fields', async () => {
			const result = await server.request(
				{
					method: 'tools/call',
					params: {
						name: 'add_plant',
						arguments: {
							name: 'Incomplete Plant',
						},
					},
				},
				{} as any,
			);

			expect(result.isError).toBe(true);
			expect((result.content[0] as any).text).toContain('Missing required');
		});
	});

	describe('list_plants tool', () => {
		it('should list all plants', async () => {
			const mockPlants: Plant[] = [
				{
					id: 'plant-1',
					name: 'Plant 1',
					species: 'Species 1',
					location: 'Room 1',
					acquiredDate: '2025-01-01',
					wateringFrequency: 7,
					lastWatered: null,
					notes: '',
					createdAt: '2025-01-01T00:00:00.000Z',
					updatedAt: '2025-01-01T00:00:00.000Z',
				},
			];

			(mockDb.listPlants as jest.Mock<any>).mockResolvedValue(mockPlants);

			const result = await server.request(
				{
					method: 'tools/call',
					params: {
						name: 'list_plants',
						arguments: {},
					},
				},
				{} as any,
			);

			expect(mockDb.listPlants).toHaveBeenCalledWith(testUserId, {});
			expect(result.content[0].type).toBe('text');
		});

		it('should filter plants by location', async () => {
			(mockDb.listPlants as jest.Mock<any>).mockResolvedValue([]);

			await server.request(
				{
					method: 'tools/call',
					params: {
						name: 'list_plants',
						arguments: { location: 'Kitchen' },
					},
				},
				{} as any,
			);

			expect(mockDb.listPlants).toHaveBeenCalledWith(testUserId, {
				location: 'Kitchen',
			});
		});
	});

	describe('get_plant tool', () => {
		it('should get plant details', async () => {
			const mockPlant: Plant = {
				id: 'plant-123',
				name: 'Test Plant',
				species: 'Test Species',
				location: 'Test Location',
				acquiredDate: '2025-01-01',
				wateringFrequency: 5,
				lastWatered: null,
				notes: '',
				createdAt: '2025-01-01T00:00:00.000Z',
				updatedAt: '2025-01-01T00:00:00.000Z',
			};

			(mockDb.getPlant as jest.Mock<any>).mockResolvedValue(mockPlant);

			const result = await server.request(
				{
					method: 'tools/call',
					params: {
						name: 'get_plant',
						arguments: { plantId: 'plant-123' },
					},
				},
				{} as any,
			);

			expect(mockDb.getPlant).toHaveBeenCalledWith(testUserId, 'plant-123');
			expect(result.content[0].type).toBe('text');
		});

		it('should handle plant not found', async () => {
			(mockDb.getPlant as jest.Mock<any>).mockResolvedValue(undefined);

			const result = await server.request(
				{
					method: 'tools/call',
					params: {
						name: 'get_plant',
						arguments: { plantId: 'nonexistent' },
					},
				},
				{} as any,
			);

			expect(result.isError).toBe(true);
			expect((result.content[0] as any).text).toContain('not found');
		});
	});

	describe('water_plant tool', () => {
		it('should record watering event', async () => {
			const mockWatering = {
				id: 'watering-123',
				plantId: 'plant-123',
				wateredDate: '2025-01-15',
				notes: 'Regular watering',
				createdAt: '2025-01-15T00:00:00.000Z',
			};

			(mockDb.waterPlant as jest.Mock<any>).mockResolvedValue(mockWatering);

			const result = await server.request(
				{
					method: 'tools/call',
					params: {
						name: 'water_plant',
						arguments: {
							plantId: 'plant-123',
							date: '2025-01-15',
							notes: 'Regular watering',
						},
					},
				},
				{} as any,
			);

			expect(mockDb.waterPlant).toHaveBeenCalledWith(
				testUserId,
				'plant-123',
				'2025-01-15',
				'Regular watering',
			);
			expect(result.content[0].type).toBe('text');
			expect((result.content[0] as any).text).toContain('watered successfully');
		});

		it('should use current date if not provided', async () => {
			const mockWatering = {
				id: 'watering-123',
				plantId: 'plant-123',
				wateredDate: new Date().toISOString().split('T')[0],
				notes: null,
				createdAt: new Date().toISOString(),
			};

			(mockDb.waterPlant as jest.Mock<any>).mockResolvedValue(mockWatering);

			await server.request(
				{
					method: 'tools/call',
					params: {
						name: 'water_plant',
						arguments: { plantId: 'plant-123' },
					},
				},
				{} as any,
			);

			const expectedDate = new Date().toISOString().split('T')[0];
			expect(mockDb.waterPlant).toHaveBeenCalledWith(
				testUserId,
				'plant-123',
				expectedDate,
				undefined,
			);
		});
	});

	describe('get_watering_schedule tool', () => {
		it('should return plants needing water', async () => {
			const mockPlants: Plant[] = [
				{
					id: 'plant-1',
					name: 'Thirsty Plant',
					species: 'Species',
					location: 'Room',
					acquiredDate: '2025-01-01',
					wateringFrequency: 3,
					lastWatered: '2025-01-01',
					notes: '',
					createdAt: '2025-01-01T00:00:00.000Z',
					updatedAt: '2025-01-01T00:00:00.000Z',
				},
			];

			(mockDb.listPlants as jest.Mock<any>).mockResolvedValue(mockPlants);

			const result = await server.request(
				{
					method: 'tools/call',
					params: {
						name: 'get_watering_schedule',
						arguments: { daysAhead: 7 },
					},
				},
				{} as any,
			);

			expect(mockDb.listPlants).toHaveBeenCalledWith(testUserId);
			expect(result.content[0].type).toBe('text');
		});
	});

	describe('add_growth_log tool', () => {
		it('should add growth log', async () => {
			const mockLog = {
				id: 'log-123',
				plantId: 'plant-123',
				logDate: '2025-01-15',
				measureType: 'height',
				measureUnit: 'cm',
				value: '25',
				notes: 'Growing well',
				createdAt: '2025-01-15T00:00:00.000Z',
			};

			(mockDb.addGrowthLog as jest.Mock<any>).mockResolvedValue(mockLog);

			const result = await server.request(
				{
					method: 'tools/call',
					params: {
						name: 'add_growth_log',
						arguments: {
							plantId: 'plant-123',
							date: '2025-01-15',
							measureType: 'height',
							measureUnit: 'cm',
							value: 25,
							notes: 'Growing well',
						},
					},
				},
				{} as any,
			);

			expect(mockDb.addGrowthLog).toHaveBeenCalled();
			expect(result.content[0].type).toBe('text');
			expect((result.content[0] as any).text).toContain('Growth log added');
		});
	});

	describe('add_plant_image tool', () => {
		it('should add plant image', async () => {
			const mockImage = {
				id: 'image-123',
				plantId: 'plant-123',
				filename: 'plant.jpg',
				caption: 'Beautiful bloom',
				takenAt: '2025-01-15',
				createdAt: '2025-01-15T00:00:00.000Z',
			};

			(mockDb.addPlantImage as jest.Mock<any>).mockResolvedValue(mockImage);

			const result = await server.request(
				{
					method: 'tools/call',
					params: {
						name: 'add_plant_image',
						arguments: {
							plantId: 'plant-123',
							filename: 'plant.jpg',
							caption: 'Beautiful bloom',
							takenAt: '2025-01-15',
						},
					},
				},
				{} as any,
			);

			expect(mockDb.addPlantImage).toHaveBeenCalled();
			expect(result.content[0].type).toBe('text');
			expect((result.content[0] as any).text).toContain('Image added');
		});
	});

	describe('delete_plant tool', () => {
		it('should delete a plant', async () => {
			(mockDb.deletePlant as jest.Mock<any>).mockResolvedValue(true);

			const result = await server.request(
				{
					method: 'tools/call',
					params: {
						name: 'delete_plant',
						arguments: { plantId: 'plant-123' },
					},
				},
				{} as any,
			);

			expect(mockDb.deletePlant).toHaveBeenCalledWith(testUserId, 'plant-123');
			expect(result.content[0].type).toBe('text');
			expect((result.content[0] as any).text).toContain('deleted successfully');
		});

		it('should handle plant not found', async () => {
			(mockDb.deletePlant as jest.Mock<any>).mockResolvedValue(false);

			const result = await server.request(
				{
					method: 'tools/call',
					params: {
						name: 'delete_plant',
						arguments: { plantId: 'nonexistent' },
					},
				},
				{} as any,
			);

			expect(result.isError).toBe(true);
			expect((result.content[0] as any).text).toContain('not found');
		});
	});
});
