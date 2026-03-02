import {
  DiscordGatewayAdapterCreator,
  VoiceConnection,
  joinVoiceChannel,
  getVoiceConnection,
} from '@discordjs/voice';
import { MusicSubscription } from './musicSubscription';

interface JoinConfig {
  guildId: string;
  channelId: string;
  adapterCreator: DiscordGatewayAdapterCreator;
  selfDeaf?: boolean;
}

export class GuildMusicManager {
  private readonly subscriptions = new Map<string, MusicSubscription>();

  public get(guildId: string): MusicSubscription | undefined {
    return this.subscriptions.get(guildId);
  }

  public getOrCreateSubscription(config: JoinConfig): MusicSubscription {
    const existing = this.subscriptions.get(config.guildId);
    if (existing) return existing;

    const connection = this.createConnection(config);
    const subscription = new MusicSubscription(config.guildId, connection, () => {
      this.subscriptions.delete(config.guildId);
    });

    this.subscriptions.set(config.guildId, subscription);
    return subscription;
  }

  public destroy(guildId: string): void {
    const sub = this.subscriptions.get(guildId);
    if (sub) {
      sub.destroy();
    } else {
      getVoiceConnection(guildId)?.destroy();
    }
    this.subscriptions.delete(guildId);
  }

  private createConnection(config: JoinConfig): VoiceConnection {
    return joinVoiceChannel({
      guildId: config.guildId,
      channelId: config.channelId,
      adapterCreator: config.adapterCreator,
      selfDeaf: config.selfDeaf ?? true,
    });
  }
}
