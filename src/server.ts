import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
	CallToolRequestSchema,
	ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

import { PlantDatabase } from './database.js';
import { mcpConfig } from './config.js';

const db = new PlantDatabase();
const USER_ID = mcpConfig.userId;

const server = new Server(
	{
		name: 'planty-mcp',
		version: '1.0.0',
	},
	{
		capabilities: {
			tools: {},
		},
	},
);

// available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
	return {
		tools: [
			{
				name: 'add_plant',
				description: 'Add a new plant to the database.',
				inputSchema: {
					type: 'object',
					properties: {
						name: { type: 'string', description: 'The name of the plant.' },
						species: {
							type: 'string',
							description: 'The species of the plant.',
						},
						location: {
							type: 'string',
							description: 'The location of the plant.',
						},
						acquiredDate: {
							type: 'string',
							description: 'The date the plant was acquired (ISO format).',
						},
						wateringFrequency: {
							type: 'number',
							description: 'How often the plant needs to be watered, in days.',
						},
						notes: {
							type: 'string',
							description: 'Any additional care notes.',
						},
					},
					required: [
						'name',
						'species',
						'location',
						'acquiredDate',
						'wateringFrequency',
					],
				},
			},
			{
				name: 'list_plants',
				description:
					'List all plants in the database, optionally filtered by location or species.',
				inputSchema: {
					type: 'object',
					properties: {
						location: {
							type: 'string',
							description: 'Filter plants by location.',
						},
						species: {
							type: 'string',
							description: 'Filter plants by species.',
						},
					},
				},
			},
			{
				name: 'get_plant',
				description:
					'Get detailed information about a specific plant by its ID.',
				inputSchema: {
					type: 'object',
					properties: {
						plantId: { type: 'string', description: 'The ID of the plant.' },
					},
					required: ['plantId'],
				},
			},
			{
				name: 'water_plant',
				description: 'Record a plant was watered.',
				inputSchema: {
					type: 'object',
					properties: {
						plantId: { type: 'string', description: 'The ID of the plant.' },
						date: {
							type: 'string',
							description: 'The date the plant was watered (ISO format YYYY-MM-DD, defaults to today).',
						},
						notes: {
							type: 'string',
							description: 'Any additional notes about watering.',
						},
					},
					required: ['plantId'],
				},
			},
			{
				name: 'get_watering_schedule',
				description:
					'Get a list of plants that need to be watered today or are overdue.',
				inputSchema: {
					type: 'object',
					properties: {
						days: {
							type: 'number',
							description: 'Look ahead this many days. Default is 3 days.',
						},
					},
				},
			},
			{
				name: 'delete_plant',
				description: 'Delete a plant from the database by its ID.',
				inputSchema: {
					type: 'object',
					properties: {
						plantId: { type: 'string', description: 'The ID of the plant.' },
					},
					required: ['plantId'],
				},
			},
			{
				name: 'update_plant',
				description: 'Update information about an existing plant.',
				inputSchema: {
					type: 'object',
					properties: {
						plantId: { type: 'string', description: 'The ID of the plant.' },
						name: { type: 'string', description: 'The name of the plant.' },
						species: {
							type: 'string',
							description: 'The species of the plant.',
						},
						location: {
							type: 'string',
							description: 'The location of the plant.',
						},
						acquiredDate: {
							type: 'string',
							description: 'The date the plant was acquired (ISO format).',
						},
						wateringFrequency: {
							type: 'number',
							description: 'How often the plant needs to be watered, in days.',
						},
						notes: {
							type: 'string',
							description: 'Any additional care notes.',
						},
					},
					required: ['plantId'],
				},
			},
			{
				name: 'add_growth_log',
				description: 'Log a growth log for a plant.',
				inputSchema: {
					type: 'object',
					properties: {
						plantId: { type: 'string', description: 'The ID of the plant.' },
						date: {
							type: 'string',
							description: 'The date of the log (ISO format).',
						},
						measureType: {
							type: 'string',
							description: 'Type of measurement',
							enum: ['height', 'width', 'leafCount', 'other'],
						},
						measureUnit: {
							type: 'string',
							description: 'Unit of measurement',
							enum: ['cm', 'inches', 'count', 'other'],
						},
						value: { type: 'number', description: 'The measurement value.' },
						notes: { type: 'string', description: 'Optional notes.' },
					},
					required: ['plantId', 'date', 'measureType', 'measureUnit', 'value'],
				},
			},
			{
				name: 'get_growth_logs',
				description: 'Get growth logs for a specific plant.',
				inputSchema: {
					type: 'object',
					properties: {
						plantId: { type: 'string', description: 'The ID of the plant.' },
					},
					required: ['plantId'],
				},
			},
			{
				name: 'add_plant_image',
				description: 'Add an image for a specific plant.',
				inputSchema: {
					type: 'object',
					properties: {
						plantId: { type: 'string', description: 'The ID of the plant.' },
						filename: { type: 'string', description: 'Image filename.' },
						caption: { type: 'string', description: 'Optional caption.' },
						takenAt: {
							type: 'string',
							description: 'Date taken (ISO format).',
						},
					},
				},
			},
			{
				name: 'get_plant_images',
				description: 'Get images for a specific plant.',
				inputSchema: {
					type: 'object',
					properties: {
						plantId: { type: 'string', description: 'The ID of the plant.' },
					},
					required: ['plantId'],
				},
			},
		],
	};
});

server.setRequestHandler(CallToolRequestSchema, async (req) => {
	const { name, arguments: args } = req.params;
	try {
		switch (name) {
			case 'add_plant': {
				if (!args?.name || !args?.species) {
					return {
						content: [
							{
								type: 'text',
								text: `Missing required fields: name and species are required.`,
							},
						],
						isError: true,
					};
				}
				const plant = await db.addPlant(USER_ID, {
					name: args.name as string,
					species: args.species as string,
					location: args.location as string,
					acquiredDate: args.acquiredDate as string,
					wateringFrequency: args.wateringFrequency as number,
					lastWatered: null,
					notes: args.notes as string,
				});

				return {
					content: [
						{
							type: 'text',
							text: `Successfully added plant "${plant.name}" with ID ${plant.id}.`,
						},
					],
				};
			}

			case 'list_plants': {
				const filters = args as { location?: string; species?: string };
				const plants = await db.listPlants(USER_ID, filters);

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(plants, null, 2),
						},
					],
				};
			}

			case 'get_plant': {
				if (args?.plantId === undefined) {
					return {
						content: [
							{
								type: 'text',
								text: `Plant ID is required.`,
							},
						],
						isError: true,
					};
				}

				const plant = await db.getPlant(USER_ID, args.plantId as string);

				if (!plant) {
					return {
						content: [
							{
								type: 'text',
								text: `Plant with ID ${args.plantId} not found.`,
							},
						],
					};
				}

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(plant, null, 2),
						},
					],
				};
			}

			case 'delete_plant': {
				if (args?.plantId === undefined) {
					return {
						content: [
							{
								type: 'text',
								text: `Plant ID is required.`,
							},
						],
						isError: true,
					};
				}

				await db.deletePlant(USER_ID, args.plantId as string);

				return {
					content: [
						{
							type: 'text',
							text: `Deleted plant.`,
						},
					],
				};
			}

			case 'water_plant': {
				if (args?.plantId === undefined) {
					return {
						content: [
							{
								type: 'text',
								text: `Plant ID is required.`,
							},
						],
						isError: true,
					};
				}
				const date =
					(args.date as string) ||
					new Date().toISOString().split('T')[0];
				const history = await db.waterPlant(
					USER_ID,
					args.plantId as string,
					date,
					args.notes as string | undefined,
				);

				if (!history) {
					return {
						content: [
							{
								type: 'text',
								text: `Plant with ID ${args.plantId} not found.`,
							},
						],
						isError: true,
					};
				}

				return {
					content: [
						{
							type: 'text',
							text: `Plant watered on ${history.wateredDate}.`,
						},
					],
				};
			}

			case 'get_watering_schedule': {
				const daysAhead = (args?.daysAhead as number) || 3;
				const plants = await db.listPlants(USER_ID);
				const today = new Date();

				const needsWatering = plants.filter((plant): boolean => {
					if (!plant.lastWatered) return true;

					const lastWatered = new Date(plant.lastWatered);
					const daysSinceWatered = Math.floor(
						(today.getTime() - lastWatered.getTime()) / (1000 * 60 * 60 * 24),
					);
					const daysUntilNextWatering =
						plant.wateringFrequency - daysSinceWatered;

					return daysUntilNextWatering <= daysAhead;
				});

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(needsWatering, null, 2),
						},
					],
				};
			}

			case 'update_plant': {
				if (!args?.plantId) {
					return {
						content: [
							{
								type: 'text',
								text: `Plant ID is required.`,
							},
						],
						isError: true,
					};
				}

				const updates: {
					name?: string;
					species?: string;
					location?: string;
					acquiredDate?: string;
					wateringFrequency?: number;
					notes?: string;
				} = {};

				if (typeof args?.name === 'string') updates.name = args.name;
				if (typeof args?.species === 'string') updates.species = args.species;
				if (typeof args?.location === 'string')
					updates.location = args.location;
				if (typeof args?.acquiredDate === 'string')
					updates.acquiredDate = args.acquiredDate;
				if (typeof args?.wateringFrequency === 'number')
					updates.wateringFrequency = args.wateringFrequency;
				if (typeof args?.notes === 'string') updates.notes = args.notes;

				const plant = await db.updatePlant(
					USER_ID,
					args.plantId as string,
					updates,
				);

				if (!plant) {
					return {
						content: [
							{
								type: 'text',
								text: `Plant with ID ${args.plantId} not found.`,
							},
						],
					};
				}

				return {
					content: [
						{
							type: 'text',
							text: `Successfully updated plant "${plant.name}" with ID ${plant.id}.`,
						},
					],
				};
			}

			case 'add_growth_log': {
				if (!args?.plantId) {
					return {
						content: [
							{
								type: 'text',
								text: `Plant ID is required.`,
							},
						],
						isError: true,
					};
				}

				const log = await db.addGrowthLog(USER_ID, {
					plantId: args.plantId as string,
					logDate: args.date as string,
					measureType: args.measureType as
						| 'height'
						| 'width'
						| 'leafCount'
						| 'other',
					measureUnit: args.measureUnit as 'cm' | 'inches' | 'count' | 'other',
					value: args.value as number,
					notes: (args.notes as string | undefined) || null,
				});

				if (!log) {
					return {
						content: [
							{
								type: 'text',
								text: `Plant with ID ${args.plantId} not found.`,
							},
						],
						isError: true,
					};
				}

				return {
					content: [
						{
							type: 'text',
							text: `Growth log added successfully.`,
						},
					],
				};
			}

			case 'get_growth_logs': {
				if (!args?.plantId) {
					return {
						content: [
							{
								type: 'text',
								text: `Plant ID is required.`,
							},
						],
						isError: true,
					};
				}

				const logs = await db.getGrowthLogs(USER_ID, args.plantId as string);
				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(logs, null, 2),
						},
					],
				};
			}

			case 'add_plant_image': {
				if (!args?.plantId) {
					return {
						content: [
							{
								type: 'text',
								text: `Plant ID is required.`,
							},
						],
						isError: true,
					};
				}

				const image = await db.addPlantImage(USER_ID, {
					plantId: args.plantId as string,
					filename: args.filename as string,
					caption: (args.caption as string | undefined) || null,
					takenAt: args.takenAt as string,
				});

				if (!image) {
					return {
						content: [
							{
								type: 'text',
								text: `Plant with ID ${args.plantId} not found.`,
							},
						],
						isError: true,
					};
				}

				return {
					content: [
						{
							type: 'text',
							text: `Plant image added successfully.`,
						},
					],
				};
			}

			case 'get_plant_images': {
				if (!args?.plantId) {
					return {
						content: [
							{
								type: 'text',
								text: `Plant ID is required.`,
							},
						],
						isError: true,
					};
				}

				const images = await db.getPlantImages(USER_ID, args.plantId as string);
				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(images, null, 2),
						},
					],
				};
			}

			default: {
				return {
					content: [
						{
							type: 'text',
							text: `Tool ${name} does not exist.`,
						},
					],
					isError: true,
				};
			}
		}
	} catch (error) {
		return {
			content: [
				{
					type: 'text',
					text: `Error: ${
						error instanceof Error ? error.message : String(error)
					}`,
				},
			],
			isError: true,
		};
	}
});

async function main() {
	await db.initialize();

	const transport = new StdioServerTransport();
	await server.connect(transport);

	console.error('MCP server is running');
}

main().catch((error) => {
	console.error('Error starting MCP server:', error);
	process.exit(1);
});
