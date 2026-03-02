import {
  AudioPlayer,
  AudioPlayerStatus,
  NoSubscriberBehavior,
  VoiceConnection,
  VoiceConnectionStatus,
  createAudioPlayer,
  createAudioResource,
  entersState,
} from '@discordjs/voice';
import play from 'play-dl';
import { env } from '../config/env';
import { logger } from '../infra/logger';
import { Track } from './track';

export class MusicSubscription {
  private readonly queue: Track[] = [];
  private readonly player: AudioPlayer;
  private idleTimer: NodeJS.Timeout | undefined;
  private isTransitioning = false;

  constructor(public readonly guildId: string, private readonly connection: VoiceConnection, private readonly onDestroy: () => void) {
    this.player = createAudioPlayer({
      behaviors: { noSubscriber: NoSubscriberBehavior.Pause },
    });

    this.connection.subscribe(this.player);
    this.registerEventHandlers();
  }

  public get queueLength(): number {
    return this.queue.length;
  }

  public enqueue(track: Track): { startedNow: boolean; position: number } {
    this.clearIdleTimer();
    this.queue.push(track);
    const startedNow = this.player.state.status === AudioPlayerStatus.Idle;
    if (startedNow) {
      void this.processNext();
    }
    return { startedNow, position: this.queue.length };
  }

  public async waitForReady(): Promise<void> {
    await entersState(this.connection, VoiceConnectionStatus.Ready, 15_000);
  }

  public destroy(): void {
    this.clearIdleTimer();
    this.player.removeAllListeners();
    this.connection.removeAllListeners();
    this.connection.destroy();
    this.onDestroy();
  }

  private registerEventHandlers(): void {
    this.player.on(AudioPlayerStatus.Idle, async () => {
      await this.processNext();
    });

    this.player.on('error', async (error: Error) => {
      logger.error({ error, guildId: this.guildId }, 'Audio player error; skipping track');
      await this.processNext();
    });

    this.connection.on(VoiceConnectionStatus.Disconnected, async () => {
      try {
        await Promise.race([
          entersState(this.connection, VoiceConnectionStatus.Signalling, 5_000),
          entersState(this.connection, VoiceConnectionStatus.Connecting, 5_000),
        ]);
      } catch {
        this.destroy();
      }
    });
  }

  private async processNext(): Promise<void> {
    if (this.isTransitioning) return;
    this.isTransitioning = true;
    try {
      while (true) {
        const nextTrack = this.queue.shift();
        if (!nextTrack) {
          this.startIdleTimer();
          return;
        }

        try {
          const stream = await play.stream(nextTrack.url, { discordPlayerCompatibility: true });
          const resource = createAudioResource(stream.stream, {
            inputType: stream.type,
            inlineVolume: true,
          });
          this.player.play(resource);

          logger.info(
            { guildId: this.guildId, title: nextTrack.title, requestedBy: nextTrack.requestedBy },
            'Now playing',
          );
          return;
        } catch (error) {
          logger.error({ error, guildId: this.guildId, title: nextTrack.title }, 'Failed to play track; trying next');
        }
      }
    } finally {
      this.isTransitioning = false;
    }
  }

  private startIdleTimer(): void {
    this.clearIdleTimer();
    this.idleTimer = setTimeout(() => {
      logger.info({ guildId: this.guildId }, 'Idle timeout reached; destroying subscription');
      this.destroy();
    }, env.IDLE_TIMEOUT_MS);
  }

  private clearIdleTimer(): void {
    if (this.idleTimer) {
      clearTimeout(this.idleTimer);
      this.idleTimer = undefined;
    }
  }
}
