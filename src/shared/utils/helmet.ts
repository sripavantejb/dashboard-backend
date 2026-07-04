import { createRequire } from 'node:module';
import type { RequestHandler } from 'express';

const require = createRequire(import.meta.url);

type HelmetOptions = {
  crossOriginResourcePolicy?: { policy?: 'same-origin' | 'same-site' | 'cross-origin' };
};

type HelmetMiddleware = (options?: Readonly<HelmetOptions>) => RequestHandler;

const helmet = require('helmet') as HelmetMiddleware;

export default helmet;
