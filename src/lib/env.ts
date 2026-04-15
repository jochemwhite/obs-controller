import { z } from "zod";

function emptyToUndefined(v: unknown): unknown {
  if (v === "" || v === undefined || v === null) return undefined;
  return v;
}

const envSchema = z.object({
  OBS_HOST: z.string(),
  OBS_PASSWORD: z.string(),
  MEDIAMTX_API_URL: z.preprocess(
    emptyToUndefined,
    z.string().default("http://10.10.10.237:9998"),
  ),
  POLL_INTERVAL_MS: z.preprocess(
    emptyToUndefined,
    z.coerce.number().int().positive().default(5000),
  ),
  PORT: z.preprocess(
    emptyToUndefined,
    z.coerce.number().int().positive().default(3000),
  ),
  TOKEN_ENCRYPTION_KEY: z.string(),
  SUPABASE_URL: z.string(),
  SUPABASE_SECRET_KEY: z.string(),
  TWITCH_CLIENT_ID: z.string(),
  TWITCH_CLIENT_SECRET: z.string(),
});

export const env = envSchema.parse(process.env);
