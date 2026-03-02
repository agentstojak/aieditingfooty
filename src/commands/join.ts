import { ChannelType, ChatInputCommandInteraction, PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { GuildMusicManager } from '../music/guildMusicManager';

export const joinCommandData = new SlashCommandBuilder()
  .setName('join')
  .setDescription('Join your current voice channel');

export async function handleJoin(interaction: ChatInputCommandInteraction, manager: GuildMusicManager): Promise<void> {
  if (!interaction.guild || !interaction.member || !interaction.channel) {
    await interaction.reply({ content: 'This command can only be used in a server.', ephemeral: true });
    return;
  }

  const member = await interaction.guild.members.fetch(interaction.user.id);
  const voiceChannel = member.voice.channel;

  if (!voiceChannel || voiceChannel.type !== ChannelType.GuildVoice) {
    await interaction.reply({ content: 'You must be in a voice channel first.', ephemeral: true });
    return;
  }

  const botPerms = voiceChannel.permissionsFor(interaction.guild.members.me ?? interaction.client.user);
  if (!botPerms?.has(PermissionFlagsBits.Connect) || !botPerms?.has(PermissionFlagsBits.Speak)) {
    await interaction.reply({ content: 'I need Connect and Speak permissions in your voice channel.', ephemeral: true });
    return;
  }

  try {
    const subscription = manager.getOrCreateSubscription({
      guildId: interaction.guildId!,
      channelId: voiceChannel.id,
      adapterCreator: interaction.guild.voiceAdapterCreator,
    });
    await subscription.waitForReady();
    await interaction.reply(`Joined **${voiceChannel.name}**.`);
  } catch {
    manager.destroy(interaction.guildId!);
    await interaction.reply({ content: 'Could not join the voice channel.', ephemeral: true });
  }
}
