import { createBotClient } from './bot';
import { env } from './config/env';
import { logger } from './infra/logger';

async function main(): Promise<void> {
  const client = createBotClient();
  await client.login(env.DISCORD_TOKEN);
}

main().catch((error) => {
  logger.error({ error }, 'Failed to start bot');
  process.exit(1);
});
