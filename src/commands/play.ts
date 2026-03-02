import play from 'play-dl';
import {
  ChannelType,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  SlashCommandBuilder,
  SlashCommandStringOption,
} from 'discord.js';
import { GuildMusicManager } from '../music/guildMusicManager';
import { Track } from '../music/track';

export const playCommandData = new SlashCommandBuilder()
  .setName('play')
  .setDescription('Play a song from YouTube URL or search query')
  .addStringOption((option: SlashCommandStringOption) =>
    option
      .setName('query')
      .setDescription('YouTube URL or search terms')
      .setRequired(true)
      .setMaxLength(200),
  );

export async function handlePlay(interaction: ChatInputCommandInteraction, manager: GuildMusicManager): Promise<void> {
  if (!interaction.guild || !interaction.member) {
    await interaction.reply({ content: 'This command can only be used in a server.', ephemeral: true });
    return;
  }

  await interaction.deferReply();

  const member = await interaction.guild.members.fetch(interaction.user.id);
  const voiceChannel = member.voice.channel;

  if (!voiceChannel || voiceChannel.type !== ChannelType.GuildVoice) {
    await interaction.editReply('You need to join a voice channel first.');
    return;
  }

  const botPerms = voiceChannel.permissionsFor(interaction.guild.members.me ?? interaction.client.user);
  if (!botPerms?.has(PermissionFlagsBits.Connect) || !botPerms?.has(PermissionFlagsBits.Speak)) {
    await interaction.editReply('I need Connect and Speak permissions in your voice channel.');
    return;
  }

  const query = interaction.options.getString('query', true).trim();

  const existing = manager.get(interaction.guildId!);
  if (existing && member.voice.channelId !== voiceChannel.id) {
    await interaction.editReply('You must be in the same voice channel as the bot.');
    return;
  }

  const subscription = manager.getOrCreateSubscription({
    guildId: interaction.guildId!,
    channelId: voiceChannel.id,
    adapterCreator: interaction.guild.voiceAdapterCreator,
  });

  try {
    await subscription.waitForReady();
    const track = await resolveTrack(query, interaction.user.username);
    const result = subscription.enqueue(track);

    if (result.startedNow) {
      await interaction.editReply(`▶️ Now playing **${track.title}**`);
    } else {
      await interaction.editReply(`✅ Queued **${track.title}** at position #${result.position}`);
    }
  } catch {
    await interaction.editReply('I could not find or play that track. Try another query or URL.');
  }
}

async function resolveTrack(query: string, requestedBy: string): Promise<Track> {
  if (play.yt_validate(query) === 'video') {
    const info = await play.video_basic_info(query);
    return {
      title: info.video_details.title ?? query,
      url: info.video_details.url,
      requestedBy,
      duration: info.video_details.durationRaw,
      sourceId: info.video_details.id,
    };
  }

  const results = await play.search(query, { source: { youtube: 'video' }, limit: 1 });
  const first = results[0];
  if (!first || !first.url) {
    throw new Error('No track found');
  }

  return {
    title: first.title ?? query,
    url: first.url,
    requestedBy,
    duration: first.durationRaw,
    sourceId: first.id,
  };
}
