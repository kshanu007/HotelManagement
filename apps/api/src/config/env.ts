import { z } from 'zod';
export const env = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().default(5000),
    TRUST_PROXY_HOPS: z.coerce.number().int().min(0).max(5).default(0),
    MONGODB_URI: z.string().min(1),
    WEB_ORIGIN: z.string().url(),
    JWT_SECRET: z.string().min(48),
    REFRESH_DAYS: z.coerce.number().int().min(1).max(30).default(7),
  })
  .parse(process.env);
if (
  env.NODE_ENV === 'production' &&
  (env.JWT_SECRET.includes('replace-with') || !env.WEB_ORIGIN.startsWith('https://'))
)
  throw new Error('Production requires a random JWT secret and HTTPS origin');
