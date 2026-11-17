/** The PostgreSQL pool shared by better-auth and the app's own hand-written queries. */
import { Pool, type PoolClient, type QueryResult, type QueryResultRow } from "pg";

/** One pool per process. It connects lazily, so importing this module never needs a database. */
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
});

/** Either the shared pool or a client inside a transaction. */
export type Queryable = { query<R extends QueryResultRow>(text: string, values?: unknown[]): Promise<QueryResult<R>> };

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
