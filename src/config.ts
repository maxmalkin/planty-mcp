import "dotenv/config";

export interface DatabaseConfig {
	host: string;
	port: number;
	user: string;
	password: string;
	database: string;
}

export const dbConfig: DatabaseConfig = {
	host: process.env.DB_HOST || "127.0.0.1",
	port: Number.parseInt(process.env.DB_PORT || "5432", 10),
	user: process.env.DB_USER || "username",
	password: process.env.DB_PASSWORD || "password",
	database: process.env.DB_NAME || "planty",
};
