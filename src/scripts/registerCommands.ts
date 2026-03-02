import { commandData } from '../bot';
import { env } from '../config/env';
import { logger } from '../infra/logger';
import { registerCommands } from '../infra/commandRegistry';

async function run(): Promise<void> {
  await registerCommands({
    token: env.DISCORD_TOKEN,
    clientId: env.DISCORD_CLIENT_ID,
    guildId: env.DISCORD_GUILD_ID,
    commands: commandData,
  });

  logger.info(
    { scope: env.DISCORD_GUILD_ID ? `guild:${env.DISCORD_GUILD_ID}` : 'global' },
    'Slash commands registered',
  );
}

run().catch((error) => {
  logger.error({ error }, 'Failed to register commands');
  process.exit(1);
});
