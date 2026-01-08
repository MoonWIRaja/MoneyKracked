import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';
import { DATABASE_URL } from '$env/static/private';

// Export schema for use elsewhere
export * from './schema';

// Connection for queries
const queryClient = postgres(DATABASE_URL);

// Drizzle instance
export const db = drizzle(queryClient, { schema });
