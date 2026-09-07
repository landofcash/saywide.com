import fp from "fastify-plugin";
import { Pool } from "pg";

import type { AppConfig } from "../config.js";

declare module "fastify" {
  interface FastifyInstance {
    db: Pool;
  }
}

export interface DatabasePluginOptions {
  config: AppConfig;
  pool?: Pool;
}

export default fp<DatabasePluginOptions>(async (app, options) => {
  const ownsPool = !options.pool;
  const pool = options.pool ?? new Pool({
    connectionString: options.config.databaseUrl,
    connectionTimeoutMillis: 5_000,
    idleTimeoutMillis: 10_000,
    max: 10,
  });

  pool.on("error", (error) => app.log.error({ err: error }, "Unexpected PostgreSQL pool error"));
  app.decorate("db", pool);

  if (ownsPool) {
    app.addHook("onClose", async () => {
      await pool.end();
    });
  }
}, { name: "database" });
