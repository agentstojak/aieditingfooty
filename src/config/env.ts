import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const EnvSchema = z.object({
  DISCORD_TOKEN: z.string().min(1, 'DISCORD_TOKEN is required'),
  DISCORD_CLIENT_ID: z.string().min(1, 'DISCORD_CLIENT_ID is required'),
  DISCORD_GUILD_ID: z.string().optional(),
  LOG_LEVEL: z.string().optional().default('info'),
  IDLE_TIMEOUT_MS: z.coerce.number().int().positive().optional().default(5 * 60 * 1000),
});

const parsed = EnvSchema.safeParse(process.env);
if (!parsed.success) {
  const formatted = parsed.error.issues.map((issue: { path: (string | number)[]; message: string }) => `${issue.path.join('.')}: ${issue.message}`).join('\n');
  throw new Error(`Invalid environment variables:\n${formatted}`);
}

export const env = parsed.data;
