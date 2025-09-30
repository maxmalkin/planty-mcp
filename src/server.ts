import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
	CallToolRequestSchema,
	ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

import { PlantDatabase } from "./database";

const db = new PlantDatabase();

const server = new Server(
	{
		name: "planty-mcp",
		version: "1.0.0",
	},
	{
		capabilities: {
			tools: {},
		},
	}
);

// available tools

server.setRequestHandler(ListToolsRequestSchema, async () => {
	return {
		tools: [
			{
				name: "add_plant",
				description: "Add a new plant to the database.",
				inputSchema: {
					type: "object",
					properties: {
						name: { type: "string", description: "The name of the plant." },
						species: {
							type: "string",
							description: "The species of the plant.",
						},
						location: {
							type: "string",
							description: "The location of the plant.",
						},
						acquiredDate: {
							type: "string",
							description: "The date the plant was acquired (ISO format).",
						},
						wateringFrequency: {
							type: "number",
							description: "How often the plant needs to be watered, in days.",
						},
					},
				},
			},
		],
	};
});
