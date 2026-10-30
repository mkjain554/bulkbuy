import cors from 'cors';
import cookieParser from 'cookie-parser';
import express from 'express';
import helmet from 'helmet';
import { pinoHttp } from 'pino-http';
import { config } from './config.js';
import { accountRouter } from './routes/account.js';
import { authRouter } from './routes/auth.js';
import { catalogRouter } from './routes/catalog.js';
import { poolsRouter } from './routes/pools.js';
import { csrfProtection } from './middleware/csrf.js';
import { errorHandler } from './middleware/errors.js';

const app = express();
const allowedOrigins = config.WEB_ORIGIN.split(',').map((origin) =>
  origin.trim(),
);

app.disable('x-powered-by');
app.use(helmet());
app.use(
  cors({
    origin: (origin, callback) => {
      callback(null, !origin || allowedOrigins.includes(origin));
    },
    credentials: true,
    allowedHeaders: ['Content-Type', 'X-CSRF-Token'],
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  }),
);
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());
app.use(pinoHttp({ level: config.LOG_LEVEL }));
app.use('/api', csrfProtection);

app.get('/api/health', (_request, response) => {
  response.status(200).json({ status: 'ok' });
});
app.get('/api/openapi.json', (_request, response) => {
  response.json({
    openapi: '3.1.0',
    info: { title: 'BulkBuy API', version: '0.1.0' },
    servers: [{ url: '/api' }],
    paths: {
      '/auth/csrf': {
        get: { summary: 'Issue the CSRF token cookie and token.' },
      },
      '/auth/register': { post: { summary: 'Register a buyer or seller.' } },
      '/auth/login': {
        post: { summary: 'Create a cookie-authenticated session.' },
      },
      '/auth/me': { get: { summary: 'Get the current user.' } },
      '/categories': { get: { summary: 'List product categories.' } },
      '/products': {
        get: { summary: 'Browse products.' },
        post: { summary: 'Create a product as a seller.' },
      },
      '/pools': {
        get: { summary: 'Browse group-buying pools.' },
        post: { summary: 'Create a pool as a seller.' },
      },
      '/pools/{id}': { get: { summary: 'View pool details and custom form.' } },
      '/pools/{id}/join': { post: { summary: 'Join a pool as a buyer.' } },
    },
  });
});
app.use('/api/auth', authRouter);
app.use('/api', catalogRouter);
app.use('/api/pools', poolsRouter);
app.use('/api', accountRouter);
app.use(errorHandler);

export { app };
