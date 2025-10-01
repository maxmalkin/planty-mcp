import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import express from "express";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import cors from "cors";
import { PlantDatabase } from "./database.js";
import { createAuthMiddleware, type AuthenticatedRequest } from "./auth.js";
import { createRoutes } from "./routes.js";
import { setupToolHandlers } from "./handlers.js";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

const publicPathInBuild = path.join(__dirname, "public");
const publicPathRoot = path.join(__dirname, "../public");

import { existsSync } from "fs";
const publicPath = existsSync(publicPathInBuild)
	? publicPathInBuild
	: publicPathRoot;
console.log(`Serving static files from: ${publicPath}`);
app.use(express.static(publicPath));

const db = new PlantDatabase();

app.use(createAuthMiddleware(db));
app.use("/api", createRoutes(db));

const mcpServers = new Map<string, Server>();

app.get("/sse", async (req: AuthenticatedRequest, res) => {
	if (!req.userId) {
		return res.status(401).send("Unauthorized");
	}
	const userId = req.userId;
	console.info(`SSE client connected: ${userId}`);

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

	setupToolHandlers(server, db, userId);

	const sessionId = `${userId}-${Date.now()}`;
	mcpServers.set(sessionId, server);

	const transport = new SSEServerTransport("/message", res);
	await server.connect(transport);

	req.on("close", () => {
		console.info("SSE client disconnected:", userId);
		mcpServers.delete(sessionId);
	});
});

app.post("/message", async (req: AuthenticatedRequest, res) => {
	res.status(200).end();
});

async function main() {
	await db.initialize();

	app.listen(PORT, () => {
		console.log(`Server running on http://localhost:${PORT}`);
		console.log(`Landing page: http://localhost:${PORT}`);
		console.log(`SSE endpoint: http://localhost:${PORT}/sse`);
	});
}

main().catch((error) => {
	console.error("Failed to start server:", error);
	process.exit(1);
});
