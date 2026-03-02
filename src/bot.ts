import { Client, GatewayIntentBits, Interaction } from 'discord.js';
import { handleJoin, joinCommandData } from './commands/join';
import { handlePlay, playCommandData } from './commands/play';
import { logger } from './infra/logger';
import { GuildMusicManager } from './music/guildMusicManager';

export const commandData = [joinCommandData, playCommandData];

export function createBotClient(): Client {
  const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates],
  });

  const manager = new GuildMusicManager();

  client.on('ready', () => {
    logger.info({ user: client.user?.tag }, 'Bot is online');
  });

  client.on('interactionCreate', async (interaction: Interaction) => {
    if (!interaction.isChatInputCommand()) return;

    try {
      switch (interaction.commandName) {
        case 'join':
          await handleJoin(interaction, manager);
          break;
        case 'play':
          await handlePlay(interaction, manager);
          break;
        default:
          await interaction.reply({ content: 'Unknown command.', ephemeral: true });
      }
    } catch (error) {
      logger.error({ error }, 'Interaction handler failed');
      if (interaction.deferred || interaction.replied) {
        await interaction.followUp({ content: 'Something went wrong running that command.', ephemeral: true });
      } else {
        await interaction.reply({ content: 'Something went wrong running that command.', ephemeral: true });
      }
    }
  });

  return client;
}
