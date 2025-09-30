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
app.use(express.static(path.join(__dirname, "../public")));

const db = new PlantDatabase();

app.use("/api", createRoutes(db));
app.use(createAuthMiddleware(db));

app.get("/health", (req, res) => {
	res.json({ status: "ok" });
});

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
});

app.post("/message", async (req, res) => {
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
