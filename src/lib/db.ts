import "server-only";
import { Pool, type PoolClient } from "pg";

const globalForDb = globalThis as typeof globalThis & { grimoirePool?: Pool };

/** One PostgreSQL pool shared by Better Auth and the app's own queries. */
export const pool =
  globalForDb.grimoirePool ??
  new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
  });

if (process.env.NODE_ENV !== "production") globalForDb.grimoirePool = pool;

/** Run several statements atomically; rolls back on any thrown error. */
export async function transaction<T>(work: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await work(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}
