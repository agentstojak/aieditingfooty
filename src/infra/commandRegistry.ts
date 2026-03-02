import { REST, Routes, SlashCommandBuilder } from 'discord.js';

interface RegisterCommandOptions {
  token: string;
  clientId: string;
  guildId?: string;
  commands: SlashCommandBuilder[];
}

export async function registerCommands(options: RegisterCommandOptions): Promise<void> {
  const rest = new REST({ version: '10' }).setToken(options.token);
  const body = options.commands.map((command) => command.toJSON());

  if (options.guildId) {
    await rest.put(Routes.applicationGuildCommands(options.clientId, options.guildId), { body });
    return;
  }

  await rest.put(Routes.applicationCommands(options.clientId), { body });
}
