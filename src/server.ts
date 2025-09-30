import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
	CallToolRequestSchema,
	ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

import { PlantDatabase } from './database';

const db = new PlantDatabase();

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
						wateredDate: {
							type: 'string',
							description: 'The date the plant was watered (ISO format).',
						},
						notes: {
							type: 'string',
							description: 'Any additional notes about watering.',
						},
					},
				},
				required: ['plantId'],
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
		],
	};
});

server.setRequestHandler(CallToolRequestSchema, async (req) => {
	const { name, arguments: args } = req.params;
	try {
		switch (name) {
			case 'add_plant': {
				if (args?.plantId === undefined) {
					return {
						content: [
							{
								type: 'text',
								text: `Args are undefined.`,
							},
						],
					};
				}
				const plant = await db.addPlant({
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
				const plants = await db.listPlants(filters);

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
								text: `Args are undefined.`,
							},
						],
					};
				}

				const plant = await db.getPlant(args.plantId as string);

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

			case 'water_plant': {
				if (args?.plantId === undefined) {
					return {
						content: [
							{
								type: 'text',
								text: `Args are undefined.`,
							},
						],
					};
				}
				const date =
					(args.wateredDate as string) ||
					new Date().toISOString().split('T')[0];
				const history = await db.waterPlant(
					args.plantId as string,
					date,
					args.notes as string | undefined,
				);

				return {
					content: [
						{
							type: 'text',
							text: `Plant watered on ${history.wateredDate}.`,
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
				};
			}
		}
	} catch (error) {
		throw new Error(`Error executing tool ${name}: ${error}`);
	}
});
