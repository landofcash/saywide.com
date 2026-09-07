import { buildApp } from "./app.js";
import { loadConfig } from "./config.js";

async function main(): Promise<void> {
  const config = loadConfig();
  const app = buildApp({ config });

  const close = async () => {
    await app.close();
  };
  process.once("SIGINT", close);
  process.once("SIGTERM", close);

  try {
    await app.listen({ host: config.host, port: config.port });
  } catch (error) {
    app.log.error({ err: error }, "Backend failed to start");
    await app.close();
    process.exitCode = 1;
  }
}

void main();
