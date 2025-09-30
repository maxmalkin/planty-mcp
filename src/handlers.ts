import type { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
	CallToolRequestSchema,
	ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import type { PlantDatabase } from "./database.js";

export function setupToolHandlers(
	server: Server,
	db: PlantDatabase,
	userId: string
) {
	// List available tools
	server.setRequestHandler(ListToolsRequestSchema, async () => {
		return {
			tools: [
				{
					name: "add_plant",
					description: "Add a new plant to your collection",
					inputSchema: {
						type: "object",
						properties: {
							name: { type: "string", description: "Plant name" },
							species: { type: "string", description: "Plant species" },
							location: {
								type: "string",
								description: "Where the plant is located",
							},
							acquiredDate: {
								type: "string",
								description: "Date acquired (ISO format YYYY-MM-DD)",
							},
							wateringFrequency: {
								type: "number",
								description: "How often to water (in days)",
							},
							notes: { type: "string", description: "Care notes" },
						},
						required: [
							"name",
							"species",
							"location",
							"acquiredDate",
							"wateringFrequency",
							"notes",
						],
					},
				},
				{
					name: "list_plants",
					description:
						"List all your plants, optionally filtered by location or species",
					inputSchema: {
						type: "object",
						properties: {
							location: {
								type: "string",
								description: "Filter by location (optional)",
							},
							species: {
								type: "string",
								description: "Filter by species (optional)",
							},
						},
					},
				},
				{
					name: "get_plant",
					description: "Get detailed information about a specific plant",
					inputSchema: {
						type: "object",
						properties: {
							plantId: { type: "string", description: "The plant ID" },
						},
						required: ["plantId"],
					},
				},
				{
					name: "update_plant",
					description: "Update plant information",
					inputSchema: {
						type: "object",
						properties: {
							plantId: { type: "string", description: "The plant ID" },
							name: { type: "string", description: "New plant name" },
							species: { type: "string", description: "New species" },
							location: { type: "string", description: "New location" },
							wateringFrequency: {
								type: "number",
								description: "New watering frequency (in days)",
							},
							notes: { type: "string", description: "New care notes" },
						},
						required: ["plantId"],
					},
				},
				{
					name: "delete_plant",
					description: "Delete a plant from your collection",
					inputSchema: {
						type: "object",
						properties: {
							plantId: {
								type: "string",
								description: "The plant ID to delete",
							},
						},
						required: ["plantId"],
					},
				},
				{
					name: "water_plant",
					description: "Record that a plant was watered",
					inputSchema: {
						type: "object",
						properties: {
							plantId: { type: "string", description: "The plant ID" },
							date: {
								type: "string",
								description:
									"Date watered (ISO format YYYY-MM-DD, defaults to today)",
							},
							notes: {
								type: "string",
								description: "Optional notes about watering",
							},
						},
						required: ["plantId"],
					},
				},
				{
					name: "get_watering_history",
					description: "Get watering history for a specific plant",
					inputSchema: {
						type: "object",
						properties: {
							plantId: { type: "string", description: "The plant ID" },
						},
						required: ["plantId"],
					},
				},
				{
					name: "get_watering_schedule",
					description: "Get plants that need watering soon or are overdue",
					inputSchema: {
						type: "object",
						properties: {
							daysAhead: {
								type: "number",
								description: "Look ahead this many days (default 3)",
							},
						},
					},
				},
				{
					name: "add_growth_log",
					description: "Log a growth measurement for a plant",
					inputSchema: {
						type: "object",
						properties: {
							plantId: { type: "string", description: "The plant ID" },
							date: {
								type: "string",
								description: "Date of measurement (ISO format YYYY-MM-DD)",
							},
							measureType: {
								type: "string",
								description: "Type of measurement",
								enum: ["height", "width", "leafCount", "other"],
							},
							measureUnit: {
								type: "string",
								description: "Unit of measurement",
								enum: ["cm", "inches", "count", "other"],
							},
							value: { type: "number", description: "Measurement value" },
							notes: { type: "string", description: "Optional notes" },
						},
						required: [
							"plantId",
							"date",
							"measureType",
							"measureUnit",
							"value",
						],
					},
				},
				{
					name: "get_growth_logs",
					description: "Get all growth logs for a specific plant",
					inputSchema: {
						type: "object",
						properties: {
							plantId: { type: "string", description: "The plant ID" },
						},
						required: ["plantId"],
					},
				},
				{
					name: "add_plant_image",
					description: "Add an image reference for a plant",
					inputSchema: {
						type: "object",
						properties: {
							plantId: { type: "string", description: "The plant ID" },
							filename: { type: "string", description: "Image filename" },
							caption: { type: "string", description: "Optional caption" },
							takenAt: {
								type: "string",
								description: "Date photo was taken (ISO format YYYY-MM-DD)",
							},
						},
						required: ["plantId", "filename", "takenAt"],
					},
				},
				{
					name: "get_plant_images",
					description: "Get all images for a specific plant",
					inputSchema: {
						type: "object",
						properties: {
							plantId: { type: "string", description: "The plant ID" },
						},
						required: ["plantId"],
					},
				},
			],
		};
	});

	// Handle tool calls
	server.setRequestHandler(CallToolRequestSchema, async (request) => {
		const { name, arguments: args } = request.params;

		try {
			switch (name) {
				case "add_plant": {
					if (
						!args?.name ||
						!args?.species ||
						!args?.location ||
						!args?.acquiredDate ||
						!args?.wateringFrequency
					) {
						return {
							content: [
								{
									type: "text",
									text: "Missing required arguments for add_plant.",
								},
							],
							isError: true,
						};
					}

					const plant = await db.addPlant(userId, {
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
								type: "text",
								text: `Successfully added plant "${plant.name}" with ID ${plant.id}.`,
							},
						],
					};
				}

				case "list_plants": {
					const filters = args as { location?: string; species?: string };
					const plants = await db.listPlants(userId, filters);

					return {
						content: [
							{
								type: "text",
								text: JSON.stringify(plants, null, 2),
							},
						],
					};
				}

				case "get_plant": {
					if (!args?.plantId) {
						return {
							content: [
								{
									type: "text",
									text: "Missing plantId argument.",
								},
							],
							isError: true,
						};
					}

					const plant = await db.getPlant(userId, args.plantId as string);

					if (!plant) {
						return {
							content: [
								{
									type: "text",
									text: `Plant with ID ${args.plantId} not found.`,
								},
							],
							isError: true,
						};
					}

					return {
						content: [
							{
								type: "text",
								text: JSON.stringify(plant, null, 2),
							},
						],
					};
				}

				case "update_plant": {
					if (!args?.plantId) {
						return {
							content: [
								{
									type: "text",
									text: "Missing plantId argument.",
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

					if (typeof args?.name === "string") updates.name = args.name;
					if (typeof args?.species === "string") updates.species = args.species;
					if (typeof args?.location === "string")
						updates.location = args.location;
					if (typeof args?.acquiredDate === "string")
						updates.acquiredDate = args.acquiredDate;
					if (typeof args?.wateringFrequency === "number")
						updates.wateringFrequency = args.wateringFrequency;
					if (typeof args?.notes === "string") updates.notes = args.notes;

					const plant = await db.updatePlant(
						userId,
						args.plantId as string,
						updates
					);

					if (!plant) {
						return {
							content: [
								{
									type: "text",
									text: `Plant with ID ${args.plantId} not found.`,
								},
							],
							isError: true,
						};
					}

					return {
						content: [
							{
								type: "text",
								text: `Successfully updated plant "${plant.name}".`,
							},
						],
					};
				}

				case "delete_plant": {
					if (!args?.plantId) {
						return {
							content: [
								{
									type: "text",
									text: "Missing plantId argument.",
								},
							],
							isError: true,
						};
					}

					const deleted = await db.deletePlant(userId, args.plantId as string);

					if (!deleted) {
						return {
							content: [
								{
									type: "text",
									text: `Plant with ID ${args.plantId} not found.`,
								},
							],
							isError: true,
						};
					}

					return {
						content: [
							{
								type: "text",
								text: "Plant deleted successfully.",
							},
						],
					};
				}

				case "water_plant": {
					if (!args?.plantId) {
						return {
							content: [
								{
									type: "text",
									text: "Missing plantId argument.",
								},
							],
							isError: true,
						};
					}

					const date =
						(args.date as string) || new Date().toISOString().split("T")[0];
					const history = await db.waterPlant(
						userId,
						args.plantId as string,
						date,
						args.notes as string | undefined
					);

					if (!history) {
						return {
							content: [
								{
									type: "text",
									text: `Plant with ID ${args.plantId} not found.`,
								},
							],
							isError: true,
						};
					}

					return {
						content: [
							{
								type: "text",
								text: `Plant watered successfully on ${history.wateredDate}.`,
							},
						],
					};
				}

				case "get_watering_history": {
					if (!args?.plantId) {
						return {
							content: [
								{
									type: "text",
									text: "Missing plantId argument.",
								},
							],
							isError: true,
						};
					}

					const history = await db.getWateringHistory(
						userId,
						args.plantId as string
					);

					return {
						content: [
							{
								type: "text",
								text: JSON.stringify(history, null, 2),
							},
						],
					};
				}

				case "get_watering_schedule": {
					const daysAhead = (args?.daysAhead as number) || 3;
					const plants = await db.listPlants(userId);
					const today = new Date();

					const needsWatering = plants
						.map((plant) => {
							if (!plant.lastWatered) {
								return {
									...plant,
									daysOverdue: null,
									status: "Never watered",
								};
							}

							const lastWatered = new Date(plant.lastWatered);
							const daysSinceWatered = Math.floor(
								(today.getTime() - lastWatered.getTime()) /
									(1000 * 60 * 60 * 24)
							);
							const daysUntilNextWatering =
								plant.wateringFrequency - daysSinceWatered;

							if (daysUntilNextWatering <= daysAhead) {
								return {
									...plant,
									daysOverdue: -daysUntilNextWatering,
									status: daysUntilNextWatering < 0 ? "Overdue" : "Due soon",
								};
							}
							return null;
						})
						.filter((p) => p !== null);

					return {
						content: [
							{
								type: "text",
								text: JSON.stringify(needsWatering, null, 2),
							},
						],
					};
				}

				case "add_growth_log": {
					if (
						!args?.plantId ||
						!args?.date ||
						!args?.measureType ||
						!args?.measureUnit ||
						args?.value === undefined
					) {
						return {
							content: [
								{
									type: "text",
									text: "Missing required arguments for add_growth_log.",
								},
							],
							isError: true,
						};
					}

					const log = await db.addGrowthLog(userId, {
						plantId: args.plantId as string,
						logDate: args.date as string,
						measureType: args.measureType as
							| "height"
							| "width"
							| "leafCount"
							| "other",
						measureUnit: args.measureUnit as
							| "cm"
							| "inches"
							| "count"
							| "other",
						value: args.value as number,
						notes: (args.notes as string) || null,
					});

					if (!log) {
						return {
							content: [
								{
									type: "text",
									text: `Plant with ID ${args.plantId} not found.`,
								},
							],
							isError: true,
						};
					}

					return {
						content: [
							{
								type: "text",
								text: `Growth log added: ${log.measureType} = ${log.value} ${log.measureUnit}`,
							},
						],
					};
				}

				case "get_growth_logs": {
					if (!args?.plantId) {
						return {
							content: [
								{
									type: "text",
									text: "Missing plantId argument.",
								},
							],
							isError: true,
						};
					}

					const logs = await db.getGrowthLogs(userId, args.plantId as string);

					return {
						content: [
							{
								type: "text",
								text: JSON.stringify(logs, null, 2),
							},
						],
					};
				}

				case "add_plant_image": {
					if (!args?.plantId || !args?.filename || !args?.takenAt) {
						return {
							content: [
								{
									type: "text",
									text: "Missing required arguments for add_plant_image.",
								},
							],
							isError: true,
						};
					}

					const image = await db.addPlantImage(userId, {
						plantId: args.plantId as string,
						filename: args.filename as string,
						caption: (args.caption as string) || null,
						takenAt: args.takenAt as string,
					});

					if (!image) {
						return {
							content: [
								{
									type: "text",
									text: `Plant with ID ${args.plantId} not found.`,
								},
							],
							isError: true,
						};
					}

					return {
						content: [
							{
								type: "text",
								text: `Image added: ${image.filename}`,
							},
						],
					};
				}

				case "get_plant_images": {
					if (!args?.plantId) {
						return {
							content: [
								{
									type: "text",
									text: "Missing plantId argument.",
								},
							],
							isError: true,
						};
					}

					const images = await db.getPlantImages(
						userId,
						args.plantId as string
					);

					return {
						content: [
							{
								type: "text",
								text: JSON.stringify(images, null, 2),
							},
						],
					};
				}

				default: {
					return {
						content: [
							{
								type: "text",
								text: `Unknown tool: ${name}`,
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
						type: "text",
						text: `Error: ${
							error instanceof Error ? error.message : String(error)
						}`,
					},
				],
				isError: true,
			};
		}
	});
}
