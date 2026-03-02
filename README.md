# Discord Music Bot Scripts

This project includes complete scripts and TypeScript source for a Discord music bot.

## npm scripts

- `npm run dev` - Run bot in watch mode with `tsx`.
- `npm run build` - Compile TypeScript to `dist/`.
- `npm start` - Start compiled bot from `dist/index.js`.
- `npm run register:commands` - Register slash commands (guild-scoped if `DISCORD_GUILD_ID` is set, otherwise global).
- `npm run check` - Type-check without emitting output.

## setup

1. Copy environment template:
   ```bash
   cp .env.example .env
   ```
2. Fill in your Discord app credentials.
3. Install dependencies:
   ```bash
   npm install
   ```
4. Register commands and run:
   ```bash
   npm run register:commands
   npm run dev
   ```

## included commands

- `/join` - Bot joins your voice channel.
- `/play query:<url or text>` - Queue/play from YouTube URL or search term.
