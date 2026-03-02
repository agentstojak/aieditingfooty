# Discord Music Bot (Windows) — Implementation Blueprint

## 1) Recommended Stack

- **Runtime**: Node.js 20 LTS
- **Language**: TypeScript (preferred for maintainability)
- **Discord SDK**: `discord.js` v14
- **Voice**: `@discordjs/voice`
- **Audio source/search**: `play-dl` (YouTube search + stream handling)
- **Optional process manager**: `pm2` (for uptime)
- **Optional logging**: `pino`

### Why this stack

- `discord.js` + `@discordjs/voice` are stable and production-proven.
- `play-dl` supports query/ID/URL flows and can produce stream sources compatible with `@discordjs/voice`.
- TypeScript encourages modular command/service architecture that is easy to extend (`/pause`, `/skip`, `/queue`, volume, etc.).

---

## 2) Architecture (Modular + Extensible)

```text
src/
  index.ts                    # process bootstrap
  bot.ts                      # client init and event wiring
  commands/
    join.ts                   # /join
    play.ts                   # /play
  music/
    guildMusicManager.ts      # per-guild state registry
    musicSubscription.ts      # queue/player/voice for one guild
    track.ts                  # track model
  infra/
    commandRegistry.ts        # slash registration helper
    logger.ts                 # structured logging
  config/
    env.ts                    # env validation
```

### Core model

- **GuildMusicManager**: `Map<guildId, MusicSubscription>`
- **MusicSubscription** (per guild):
  - `VoiceConnection`
  - `AudioPlayer`
  - `queue: Track[]`
  - playback lock / transition guard
  - idle timeout + cleanup hooks
- **Track**:
  - `title`, `url`, `requestedBy`, `duration`, `sourceId`

This avoids global shared mutable state issues and scales across many guilds.

---

## 3) Slash Commands

## `/join`

### Behavior

1. Confirm command runs in guild context.
2. Validate user is in a voice channel.
3. Validate bot permissions in that channel:
   - `Connect`
   - `Speak`
4. Join channel via `joinVoiceChannel(...)`.
5. Reuse existing guild subscription if present.
6. Reply with success or descriptive error.

### Error cases to handle

- User not in voice channel.
- Missing bot permissions.
- Voice adapter unavailable.
- Connection timeout.

---

## `/play query:<string>`

### Behavior

1. Ensure guild + user voice channel (or auto-join same channel).
2. Enforce same-channel rule if bot already connected.
3. Resolve input:
   - YouTube URL/ID -> direct track
   - plain text -> search first match (or top N + choose strategy)
4. Build `Track` and enqueue.
5. If player idle, start playback immediately.
6. Send feedback:
   - `Now playing: ...`
   - `Queued: ... (position #N)`

### Input strategy

- If identifier-like string, attempt ID resolution first.
- Fallback to search with limit=1 (fast UX) or 5 (if you later implement selection menus).

---

## 4) Playback Pipeline

### Queue + transitions

- Use `AudioPlayerStatus.Idle` event to trigger next track.
- Guard transitions with a boolean `isTransitioning` to prevent double-shifts.
- On stream failure, log + skip to next track.

### Streaming

- Fetch stream via `play.stream(url, { discordPlayerCompatibility: true })`.
- Wrap with `createAudioResource(stream.stream, { inputType: stream.type, inlineVolume: true })`.
- Call `audioPlayer.play(resource)`.

### Buffering & quality

- Prefer Opus/webm sources when available.
- Keep queue metadata lightweight (don’t store heavy stream objects).
- Build streams only when track is about to play.

---

## 5) Resource Management & Stability

### Cleanup triggers

- `VoiceConnectionStatus.Disconnected` and failed reconnect attempts.
- Manual idle timeout (e.g., 5–10 minutes with empty queue).
- Bot removed from channel/guild.

### Memory leak prevention

- Remove event listeners when destroying `MusicSubscription`.
- Destroy voice connection explicitly.
- Delete guild entry from manager map.

### Resilience

- Wrap external calls (search/stream) with bounded retries.
- Add per-command timeout wrappers.
- Ensure command handlers use `deferReply()` for longer operations.

---

## 6) Windows Deployment Notes

## Prerequisites

- Node.js 20 LTS (x64)
- Git
- Optional: FFmpeg only if your chosen source pipeline requires it (with `play-dl` + discord voice Opus paths, often not needed)

## Environment variables

```bash
DISCORD_TOKEN=...
DISCORD_CLIENT_ID=...
DISCORD_GUILD_ID=...   # optional for fast dev registration
```

## Run

```powershell
npm install
npm run build
npm run register:commands
npm start
```

## Keep alive in production (Windows)

- **Option A**: PM2 on Windows (`pm2 start dist/index.js --name music-bot`)
- **Option B**: NSSM wrapping `node dist/index.js` as a Windows service
- **Option C**: Docker Desktop + restart policy

---

## 7) Security and Operational Best Practices

- Never hardcode tokens.
- Validate command inputs length/format.
- Implement rate limits (per user/guild) for `/play` to avoid abuse.
- Use structured logs with guild/user correlation IDs.
- Add health heartbeat (log every X min, include active guild count).

---

## 8) Minimal TypeScript Skeleton (Core Ideas)

```ts
// pseudo-implementation style (concise)
class MusicSubscription {
  queue: Track[] = [];
  player = createAudioPlayer();
  connection: VoiceConnection;
  isTransitioning = false;

  constructor(connection: VoiceConnection) {
    this.connection = connection;
    this.connection.subscribe(this.player);

    this.player.on(AudioPlayerStatus.Idle, async () => {
      if (this.isTransitioning) return;
      this.isTransitioning = true;
      try {
        await this.processNext();
      } finally {
        this.isTransitioning = false;
      }
    });

    this.player.on('error', async () => {
      await this.processNext();
    });
  }

  enqueue(track: Track) {
    this.queue.push(track);
    if (this.player.state.status === AudioPlayerStatus.Idle) {
      void this.processNext();
    }
  }

  async processNext() {
    const next = this.queue.shift();
    if (!next) return;

    const stream = await play.stream(next.url, {
      discordPlayerCompatibility: true,
    });

    const resource = createAudioResource(stream.stream, {
      inputType: stream.type,
      inlineVolume: true,
    });

    this.player.play(resource);
  }

  destroy() {
    this.player.stop(true);
    this.connection.destroy();
  }
}
```

---

## 9) Slash Command UX Examples

- `/join`
  - ✅ `Joined #General.`
  - ❌ `You must be in a voice channel to use /join.`

- `/play query: lo-fi beats`
  - ✅ `Queued **lo-fi beats** (position #2).`
  - ✅ `Now playing **Artist - Track**.`
  - ❌ `I couldn't find any results for that query.`

Use ephemeral responses for user-specific errors and public responses for successful queue updates.

---

## 10) Next Features (Easy Add-ons)

- `/pause`, `/resume`, `/skip`
- `/queue` (paginated embed)
- `/volume <0-200>`
- `/stop` (clear queue + disconnect)
- Auto-disconnect when alone in channel
- Optional persistence for queue history

This design keeps each concern isolated (commands, voice lifecycle, queueing, and streaming), making it straightforward to add functionality without destabilizing playback.
