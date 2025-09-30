import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import express from "express";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import cors from "cors";
import { PlantDatabase } from "./database";
import { createAuthMiddleware, type AuthenticatedRequest } from "./auth";
import { createRoutes } from "./routes";
import { setupToolHandlers } from "./handlers";

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

const db = new PlantDatabase();

app.use("/api", createRoutes(db));
app.use(createAuthMiddleware(db));

app.get("/sse", async (req: AuthenticatedRequest, res) => {
	if (!req.userId) {
		return res.status(401).send("Unauthorized");
	}
	const userId = req.userId;

	console.info(`Client connected: ${userId}`);

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

	const transport = new SSEServerTransport("/message", res);
	await server.connect(transport);

	req.on("close", () => {
		console.info("Client disconnected.");
	});

	app.post("/message", async (req, res) => {
		res.status(200).end();
	});

	async function main() {
		await db.initialize();

		app.listen(PORT, () => {
			console.log(`Server is running on http://localhost:${PORT}`);
		});
	}

	main().catch((error) => {
		console.error("Failed to start server:", error);
		process.exit(1);
	});
});
