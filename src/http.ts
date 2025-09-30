import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import express from "express";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import cors from "cors";
import { PlantDatabase } from "./database";
import { createAuthMiddleware, type AuthenticatedRequest } from "./auth";
import { createRoutes } from "./routes";
