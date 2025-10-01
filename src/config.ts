import 'dotenv/config';

export interface DatabaseConfig {
	host: string;
	port: number;
	user: string;
	password: string;
	database: string;
}

function parseDatabaseConfig(): DatabaseConfig {
	if (process.env.DATABASE_URL) {
		try {
			const url = new URL(process.env.DATABASE_URL);
			return {
				host: url.hostname,
				port: Number.parseInt(url.port || '5432', 10),
				user: url.username,
				password: url.password,
				database: url.pathname.slice(1),
			};
		} catch (error) {
			console.error('Failed to parse DATABASE_URL:', error);
		}
	}

	return {
		host: process.env.DB_HOST || '127.0.0.1',
		port: Number.parseInt(process.env.DB_PORT || '5432', 10),
		user: process.env.DB_USER || 'username',
		password: process.env.DB_PASSWORD || 'password',
		database: process.env.DB_NAME || 'planty',
	};
}

export const dbConfig: DatabaseConfig = parseDatabaseConfig();

export const mcpConfig = {
	userId: process.env.MCP_USER_ID || '',
};
