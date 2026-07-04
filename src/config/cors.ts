import type { CorsOptions } from 'cors';

/** Parse comma-separated CORS_ORIGIN env value into a list of allowed origins. */
export function parseCorsOrigins(value: string): string[] {
  return value
    .split(',')
    .map((origin) => origin.trim().replace(/\/$/, ''))
    .filter(Boolean);
}

export function createCorsOptions(allowedOrigins: string[]): CorsOptions {
  const origins = new Set(parseCorsOrigins(allowedOrigins.join(',')));

  return {
    origin(origin, callback) {
      if (!origin) {
        callback(null, true);
        return;
      }
      const normalized = origin.replace(/\/$/, '');
      if (origins.has(normalized)) {
        callback(null, true);
        return;
      }
      callback(null, false);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  };
}
